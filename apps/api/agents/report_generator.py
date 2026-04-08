"""
Report Generator Agent — uses Claude to produce a draft Acta de Observaciones
in official DOM format from the Compliance Reasoner's structured output.
"""
from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import anthropic

from config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

# Load few-shot examples
_EXAMPLES_PATH = Path(__file__).parent.parent.parent.parent / "data" / "examples" / "actas-examples.json"
with open(_EXAMPLES_PATH) as f:
    _EXAMPLES_DATA = json.load(f)

# Use first 2 examples as few-shot
_FEW_SHOT_EXAMPLES = _EXAMPLES_DATA["examples"][:2]


def _build_few_shot_context() -> str:
    lines = ["EJEMPLOS DE ACTAS DE OBSERVACIONES (usa como referencia de formato y estilo):\n"]
    for ex in _FEW_SHOT_EXAMPLES:
        lines.append(f"--- Ejemplo {ex['id']} ({ex['num_observations']} observaciones) ---")
        lines.append(ex["full_text"])
        lines.append("")
    return "\n".join(lines)


SYSTEM_PROMPT = f"""Eres un asistente de redacción de la Dirección de Obras Municipales de Las Condes, Chile.
Tu función es generar un borrador de Acta de Observaciones en el formato oficial DOM, a partir de los resultados de una revisión de cumplimiento normativo.

REGLAS DE REDACCIÓN:
1. El Acta incluye SOLO las observaciones con veredicto VIOLATION o NEEDS_REVIEW. No incluye los COMPLIANT.
2. Cada observación tiene: número correlativo, título en MAYÚSCULAS, texto descriptivo objetivo, y cita normativa.
3. El texto es formal, técnico y directo. No usa lenguaje evaluativo ni emocional.
4. Cada observación termina indicando qué debe hacer el arquitecto para subsanar.
5. Cita siempre el artículo o tabla normativa al final de cada observación.
6. El Acta cierra con el plazo de 60 días para subsanar.

{_build_few_shot_context()}

Responde con el texto completo del Acta en formato de texto plano, tal como aparece en los ejemplos.
Al final, también entrega un JSON con la lista de observaciones estructuradas:
{{
  "acta_text": "texto completo del acta",
  "observations": [
    {{
      "number": 1,
      "parameter": "nombre_parametro",
      "title": "TÍTULO DE LA OBSERVACIÓN",
      "text": "texto de la observación",
      "normative_reference": "artículo o tabla"
    }}
  ]
}}"""


def build_report_prompt(
    expedient: dict,
    compliance_results: dict[str, Any],
    review_date: date | None = None,
) -> str:
    if review_date is None:
        review_date = date.today()

    # Filter to only violations and needs_review
    flagged = [
        r for r in compliance_results.get("results", [])
        if r["verdict"] in ("VIOLATION", "NEEDS_REVIEW")
    ]

    if not flagged:
        return "No se encontraron observaciones. El proyecto cumple con todos los parámetros revisados."

    observations_text = []
    for i, r in enumerate(flagged, 1):
        observations_text.append(
            f"Observación {i}:\n"
            f"  Parámetro: {r['parameter']}\n"
            f"  Veredicto: {r['verdict']}\n"
            f"  Valor declarado: {r['declared_value']}\n"
            f"  Valor permitido: {r['allowed_value']}\n"
            f"  Exceso/déficit: {r.get('excess_or_deficit', 'N/A')}\n"
            f"  Norma infringida: {r['normative_reference']}\n"
            f"  Borrador del AI: {r.get('draft_observation', '')}\n"
        )

    return f"""Genera el Acta de Observaciones para el siguiente expediente:

DATOS DEL EXPEDIENTE:
Número: {expedient.get('exp_number')}
Dirección: {expedient.get('address')}
Tipo de permiso: {expedient.get('project_type', '').replace('_', ' ').title()}
Zona: {expedient.get('zone')}
Propietario: {expedient.get('owner_name')}
Arquitecto: {expedient.get('architect_name')}
Fecha de revisión: {review_date.strftime('%d de %B de %Y')}
Fecha de ingreso: {expedient.get('admitted_at', 'N/A')}
Ronda: {expedient.get('current_round', 1)}

OBSERVACIONES DETECTADAS:
{chr(10).join(observations_text)}

Genera el Acta completa y el JSON estructurado."""


async def generate_acta(
    expedient: dict,
    compliance_results: dict[str, Any],
) -> dict[str, Any]:
    """
    Generate a draft Acta de Observaciones from compliance results.
    Returns both the full text and a structured list of observations.
    """
    prompt = build_report_prompt(expedient, compliance_results)

    # Check if there are any violations
    flagged = [
        r for r in compliance_results.get("results", [])
        if r["verdict"] in ("VIOLATION", "NEEDS_REVIEW")
    ]

    if not flagged:
        return {
            "acta_text": "El proyecto cumple con todos los parámetros urbanísticos revisados. No se emiten observaciones.",
            "observations": [],
            "has_observations": False,
        }

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content[0].text

    # Try to extract the JSON block from the response
    try:
        # Find JSON block
        json_start = content.rfind("{")
        json_end = content.rfind("}") + 1
        if json_start != -1 and json_end > json_start:
            json_block = content[json_start:json_end]
            parsed = json.loads(json_block)
            return {**parsed, "has_observations": True}
    except (json.JSONDecodeError, ValueError):
        pass

    # Fallback: return raw text
    return {
        "acta_text": content,
        "observations": [],
        "has_observations": True,
    }
