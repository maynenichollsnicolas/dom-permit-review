"""
Compliance Reasoner Agent — uses Claude to evaluate each parameter
against retrieved normative chunks, producing structured verdicts.
"""
from __future__ import annotations

import json
from typing import Any

import anthropic

from config import settings
from agents.input_parser import ParsedProject, ParamDelta

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

SYSTEM_PROMPT = """Eres un revisor técnico especializado de la Dirección de Obras Municipales (DOM) de Las Condes, Chile.
Tu función es analizar si los parámetros declarados de un proyecto de edificación cumplen con la normativa urbanística (OGUC, PRC Las Condes, Ley 21.718).

Para cada parámetro, debes emitir un veredicto usando EXACTAMENTE uno de estos valores:
- VIOLATION: El parámetro declarado infringe claramente la norma. Cita el artículo exacto.
- COMPLIANT: El parámetro declarado cumple la norma. Indica brevemente por qué.
- NEEDS_REVIEW: No puedes determinar con certeza el cumplimiento. Explica qué se necesita para resolver.
- SIN_DATOS: No encontraste norma aplicable en los fragmentos entregados.

Reglas estrictas:
1. NUNCA emitas VIOLATION sin citar el artículo o tabla normativa exacta.
2. NUNCA emitas COMPLIANT si el valor declarado supera el límite máximo o no alcanza el mínimo.
3. Si un fragmento normativo tiene baja relevancia o no cubre el caso exacto, usa NEEDS_REVIEW.
4. Redacta las observaciones (para VIOLATION y NEEDS_REVIEW) en español formal, objetivo, sin juicios de valor.
5. El texto de la observación debe incluir: valor declarado, valor permitido, exceso/déficit, y qué debe corregirse.

Responde SIEMPRE en JSON con esta estructura exacta:
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
      "draft_observation": "texto de la observación para incluir en el Acta, o null si COMPLIANT",
      "reasoning": "explicación interna breve de tu razonamiento"
    }
  ]
}"""


def build_analysis_prompt(parsed: ParsedProject, chunks: list[dict]) -> str:
    """Build the user message for the Compliance Reasoner."""

    # Format parameter deltas for the prompt
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

    # Format normative chunks
    chunk_lines = []
    for chunk in chunks:
        chunk_lines.append(
            f"[{chunk['id']}] {chunk['title']}\n"
            f"Fuente: {chunk.get('article_reference', chunk.get('article', 'N/A'))}\n"
            f"{chunk['content']}\n"
        )

    return f"""PROYECTO A REVISAR:
Expediente: {parsed.expedient_id}
Zona: {parsed.zone}
Tipo de proyecto: {parsed.project_type}

PARÁMETROS (comparación CIP vs. declarado):
{chr(10).join(param_lines)}

FRAGMENTOS NORMATIVOS RECUPERADOS:
{chr(10).join(chunk_lines) if chunk_lines else "No se recuperaron fragmentos."}

Analiza cada parámetro listado arriba y emite tu veredicto en el formato JSON especificado.
Analiza TODOS los parámetros, incluyendo los que están dentro del límite (COMPLIANT)."""


async def run_compliance_check(
    parsed: ParsedProject,
    chunks: list[dict],
) -> dict[str, Any]:
    """
    Run the Compliance Reasoner using Claude.
    Returns the structured JSON output with per-parameter verdicts.
    """
    user_message = build_analysis_prompt(parsed, chunks)

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    # Extract JSON from response
    content = response.content[0].text
    # Strip markdown code fences if present
    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    content = content.strip()

    return json.loads(content)
