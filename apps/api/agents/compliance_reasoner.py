"""
Compliance Reasoner Agent — true ReAct agent using Claude with tool use.

Claude evaluates each parameter against retrieved normative chunks and
can autonomously call retrieve_regulation() when the provided context
is insufficient, creating a genuine tool-use loop before emitting verdicts.
"""
from __future__ import annotations

import asyncio
import json
from typing import Any

import anthropic

from config import settings
from agents.input_parser import ParsedProject
from rag.retriever import retrieve_semantic, retrieve_prc_direct, format_chunks_for_prompt

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

# ─── Tool definition ──────────────────────────────────────────────────────────

RETRIEVE_TOOL = {
    "name": "retrieve_regulation",
    "description": (
        "Busca fragmentos normativos adicionales en la base de datos reglamentaria "
        "(OGUC, LGUC, PRC Las Condes) cuando los fragmentos entregados no son suficientes "
        "para determinar el cumplimiento de un parámetro urbanístico. "
        "Úsalo SOLO cuando no puedas emitir un veredicto fundado con el contexto actual."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "parameter": {
                "type": "string",
                "description": (
                    "Nombre del parámetro urbanístico a buscar "
                    "(ej: constructibilidad, altura_m, estacionamientos, densidad_hab_ha)"
                ),
            },
            "query": {
                "type": "string",
                "description": (
                    "Consulta de búsqueda semántica en español "
                    "(ej: 'altura máxima edificación aislada zona residencial Las Condes')"
                ),
            },
        },
        "required": ["parameter", "query"],
    },
}

# ─── System prompt ────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Eres un revisor técnico especializado de la Dirección de Obras Municipales (DOM) de Las Condes, Chile.
Tu función es analizar si los parámetros declarados de un proyecto de edificación cumplen con la normativa urbanística (OGUC, PRC Las Condes, Ley 21.718).

HERRAMIENTA DISPONIBLE:
Tienes acceso a retrieve_regulation(parameter, query) para buscar fragmentos normativos adicionales.
Úsala cuando los fragmentos entregados no sean suficientes para evaluar un parámetro.
Después de usar la herramienta, evalúa todos los parámetros y emite tu veredicto en JSON.

Para cada parámetro, debes emitir un veredicto usando EXACTAMENTE uno de estos valores:
- VIOLATION: El parámetro declarado infringe claramente la norma. Cita el artículo exacto.
- COMPLIANT: El parámetro declarado cumple la norma. Indica brevemente por qué.
- NEEDS_REVIEW: No puedes determinar con certeza el cumplimiento. Explica qué se necesita.
- SIN_DATOS: No encontraste norma aplicable, incluso después de buscar con la herramienta.

Reglas estrictas:
1. NUNCA emitas VIOLATION sin citar el artículo o tabla normativa exacta.
2. NUNCA emitas COMPLIANT si el valor declarado supera el límite máximo o no alcanza el mínimo.
3. Si un fragmento normativo tiene baja relevancia o no cubre el caso exacto, usa NEEDS_REVIEW.
4. Redacta las observaciones en español formal, objetivo, sin juicios de valor.
5. El texto de la observación debe incluir: valor declarado, valor permitido, exceso/déficit, qué debe corregirse.

Responde SIEMPRE en JSON con esta estructura exacta (después de usar todas las herramientas necesarias):
{
  "results": [
    {
      "parameter": "nombre_del_parametro",
      "verdict": "VIOLATION|COMPLIANT|NEEDS_REVIEW|SIN_DATOS",
      "confidence": "HIGH|MEDIUM|LOW",
      "declared_value": "valor declarado con unidades",
      "allowed_value": "límite normativo con unidades",
      "excess_or_deficit": "diferencia con signo y unidades",
      "normative_reference": "artículo o tabla exacta",
      "chunk_ids_used": ["id1", "id2"],
      "draft_observation": "texto de la observación para el Acta, o null si COMPLIANT",
      "reasoning": "explicación interna breve de tu razonamiento"
    }
  ]
}"""


# ─── Prompt builder ───────────────────────────────────────────────────────────

def _format_reviewer_feedback(feedback: list[dict], zone: str) -> str:
    """
    Format historical reviewer discard data into a prompt section.
    Returns an empty string if there is no feedback to show.
    """
    if not feedback:
        return ""

    lines = [
        "HISTORIAL DE CORRECCIONES DEL REVISOR:",
        f"En expedientes anteriores de zona {zone}, el revisor humano descartó las siguientes",
        "observaciones generadas por IA. Considera esto antes de emitir un veredicto:\n",
    ]
    for fb in feedback:
        param = fb["parameter"]
        lines.append(f"Parámetro '{param}':")
        for d in fb["discards"]:
            count_label = f"×{d['count']}"
            notes_str = ""
            if d.get("notes"):
                notes_str = f" — Notas del revisor: \"{'; '.join(d['notes'])}\""
            lines.append(f"  • Motivo: \"{d['reason']}\" ({count_label}){notes_str}")
        lines.append("")

    lines.append(
        "INSTRUCCIÓN: Si el caso actual de un parámetro es similar a los descartados arriba, "
        "evalúa con mayor cuidado antes de emitir VIOLATION — considera usar NEEDS_REVIEW si "
        "hay duda razonable. Si la situación normativa es claramente distinta, procede normalmente."
    )
    return "\n".join(lines)


def build_analysis_prompt(
    parsed: ParsedProject,
    chunks: list[dict],
    reviewer_feedback: list[dict] | None = None,
) -> str:
    param_lines = []
    for d in parsed.deltas:
        if d.status == "missing":
            param_lines.append(
                f"- {d.label} ({d.parameter}): NO DECLARADO — CIP permite {d.cip_value}"
            )
        elif d.status == "over":
            param_lines.append(
                f"- {d.label} ({d.parameter}): DECLARADO={d.declared_value} | CIP_MAX={d.cip_value} | EXCESO=+{abs(d.delta)}"
            )
        elif d.status == "under":
            param_lines.append(
                f"- {d.label} ({d.parameter}): DECLARADO={d.declared_value} | CIP_MIN={d.cip_value} | DÉFICIT=-{abs(d.delta)}"
            )
        else:
            param_lines.append(
                f"- {d.label} ({d.parameter}): DECLARADO={d.declared_value} | CIP={d.cip_value} | DELTA={d.delta} ✓"
            )

    chunk_lines = []
    for chunk in chunks[:40]:
        content_preview = chunk["content"][:600]
        chunk_lines.append(
            f"[{chunk['id']}] {chunk['title']}\n"
            f"Fuente: {chunk.get('article_reference', chunk.get('article', 'N/A'))}\n"
            f"{content_preview}\n"
        )

    feedback_section = _format_reviewer_feedback(reviewer_feedback or [], parsed.zone)

    return f"""PROYECTO A REVISAR:
Expediente: {parsed.expedient_id}
Zona: {parsed.zone}
Tipo de proyecto: {parsed.project_type}

PARÁMETROS (comparación CIP vs. declarado):
{chr(10).join(param_lines)}

FRAGMENTOS NORMATIVOS RECUPERADOS:
{chr(10).join(chunk_lines) if chunk_lines else "No se recuperaron fragmentos. Usa retrieve_regulation() para buscar la normativa aplicable."}
{(chr(10) + feedback_section + chr(10)) if feedback_section else ""}
Analiza cada parámetro. Si no tienes suficiente contexto normativo para algún parámetro,
llama a retrieve_regulation() antes de emitir tu veredicto.
Cuando hayas evaluado todos los parámetros, responde en el formato JSON especificado."""


# ─── Tool executor ────────────────────────────────────────────────────────────

def _execute_retrieve_tool(parameter: str, query: str, zone: str) -> str:
    """Execute the retrieve_regulation tool call. Returns formatted chunks as text."""
    oguc_chunks = retrieve_semantic(
        query=query,
        sources=["OGUC"],
        parameter_types=[parameter],
        k=5,
    )
    lguc_chunks = retrieve_semantic(
        query=query,
        sources=["LGUC"],
        parameter_types=[parameter],
        k=3,
    )
    prc_chunks = retrieve_prc_direct(zone, parameter_types=[parameter])

    all_chunks = prc_chunks + oguc_chunks + lguc_chunks
    if not all_chunks:
        return f"No se encontraron fragmentos normativos para '{parameter}' con la consulta: {query}"
    return format_chunks_for_prompt(all_chunks)


# ─── JSON extractor ───────────────────────────────────────────────────────────

def _extract_json(content: list) -> dict[str, Any]:
    """Extract and parse the JSON verdict from a final Claude response."""
    text = ""
    for block in content:
        if hasattr(block, "text"):
            text = block.text
            break

    if "```" in text:
        parts = text.split("```")
        for part in parts[1:]:
            stripped = part.strip()
            if stripped.startswith("json"):
                text = stripped[4:].strip()
                break
            elif stripped.startswith("{"):
                text = stripped
                break

    return json.loads(text.strip())


# ─── Main agent function ──────────────────────────────────────────────────────

async def run_compliance_check(
    parsed: ParsedProject,
    chunks: list[dict],
    zone: str,
    reviewer_feedback: list[dict] | None = None,
) -> dict[str, Any]:
    """
    Run the Compliance Reasoner as a true ReAct agent.

    Claude receives the project parameters and normative chunks, then
    autonomously calls retrieve_regulation() for any parameter where
    the provided context is insufficient — looping until all parameters
    are evaluated or a maximum turn limit is reached.

    reviewer_feedback: historical discard data from the same zone, injected
    into the prompt so Claude calibrates its verdicts based on past reviewer decisions.
    """
    user_message = build_analysis_prompt(parsed, chunks, reviewer_feedback)
    messages: list[dict] = [{"role": "user", "content": user_message}]

    max_turns = 8  # safety cap on the tool-use loop

    for turn in range(max_turns):
        response = await asyncio.to_thread(
            client.messages.create,
            model=settings.llm_model,
            max_tokens=8000,
            system=SYSTEM_PROMPT,
            tools=[RETRIEVE_TOOL],
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            # Claude is done — extract the final JSON verdict
            return _extract_json(response.content)

        if response.stop_reason == "tool_use":
            # Claude is requesting additional regulatory context
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    result_text = await asyncio.to_thread(
                        _execute_retrieve_tool,
                        block.input.get("parameter", ""),
                        block.input.get("query", ""),
                        zone,
                    )
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": result_text,
                    })

            # Extend conversation with assistant response + tool results
            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})

        else:
            # Unexpected stop reason — try to extract whatever we have
            break

    # Fallback: if max_turns reached without end_turn, extract from last response
    try:
        return _extract_json(response.content)
    except Exception:
        raise RuntimeError(
            f"Compliance Reasoner did not produce valid JSON after {max_turns} turns"
        )
