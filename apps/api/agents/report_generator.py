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

# Load few-shot examples (bundled inside apps/api/data/ for Docker deploys)
_EXAMPLES_PATH = Path(__file__).parent.parent / "data" / "actas-examples.json"
try:
    with open(_EXAMPLES_PATH) as f:
        _EXAMPLES_DATA = json.load(f)
    _FEW_SHOT_EXAMPLES = _EXAMPLES_DATA["examples"][:2]
except FileNotFoundError:
    _FEW_SHOT_EXAMPLES = []


def _build_few_shot_context() -> str:
    lines = ["EJEMPLOS DE ACTAS DE OBSERVACIONES (usa como referencia de formato y estilo):\n"]
    for ex in _FEW_SHOT_EXAMPLES:
        lines.append(f"--- Ejemplo {ex['id']} ({ex['num_observations']} observaciones) ---")
        lines.append(ex["full_text"])
        lines.append("")
    return "\n".join(lines)


_FEW_SHOT_CONTEXT = _build_few_shot_context()


def _get_system_prompt(lang: str = "es") -> str:
    if lang == "en":
        return f"""You are a technical writing assistant for the Municipal Works Department (DOM) of Las Condes, Chile.
Your task is to generate observation text for a draft Observations Report in the official DOM format.

WRITING RULES:
1. Include ONLY observations with verdict VIOLATION or NEEDS_REVIEW.
2. Each observation has: sequential number, title in UPPERCASE, objective descriptive text, and normative citation.
3. Text must be formal, technical and direct. No evaluative or emotional language.
4. Each observation ends indicating what the architect must do to remediate.
5. Always cite the exact article or normative table at the end of each observation.
6. Close with the 60 business-day deadline for remediation.

{_FEW_SHOT_CONTEXT}

Respond ONLY with the numbered observation text, in plain text format as shown in the examples.
Do not include JSON blocks, code markers, or any other additional formatting."""
    return f"""Eres un asistente de redacción de la Dirección de Obras Municipales de Las Condes, Chile.
Tu función es generar el texto de las observaciones para un borrador de Acta de Observaciones en formato oficial DOM.

REGLAS DE REDACCIÓN:
1. Incluye SOLO las observaciones con veredicto VIOLATION o NEEDS_REVIEW.
2. Cada observación tiene: número correlativo, título en MAYÚSCULAS, texto descriptivo objetivo, y cita normativa.
3. El texto es formal, técnico y directo. Sin lenguaje evaluativo ni emocional.
4. Cada observación termina indicando qué debe hacer el arquitecto para subsanar.
5. Cita siempre el artículo o tabla normativa al final de cada observación.
6. Cierra con el plazo de 60 días para subsanar.

{_FEW_SHOT_CONTEXT}

Responde ÚNICAMENTE con el texto de las observaciones numeradas, en formato de texto plano tal como aparece
en los ejemplos. No incluyas bloques JSON, marcadores de código ni ningún otro formato adicional."""


def build_report_prompt(
    expedient: dict,
    compliance_results: dict[str, Any],
    review_date: date | None = None,
    lang: str = "es",
) -> str:
    if review_date is None:
        review_date = date.today()

    # Filter to only violations and needs_review
    flagged = [
        r for r in compliance_results.get("results", [])
        if r["verdict"] in ("VIOLATION", "NEEDS_REVIEW")
    ]

    if lang == "en":
        if not flagged:
            return "No observations found. The project complies with all reviewed parameters."

        observations_text = []
        for i, r in enumerate(flagged, 1):
            observations_text.append(
                f"Observation {i}:\n"
                f"  Parameter: {r['parameter']}\n"
                f"  Verdict: {r['verdict']}\n"
                f"  Declared value: {r['declared_value']}\n"
                f"  Permitted value: {r['allowed_value']}\n"
                f"  Excess/deficit: {r.get('excess_or_deficit', 'N/A')}\n"
                f"  Normative reference: {r['normative_reference']}\n"
                f"  AI draft: {r.get('draft_observation', '')}\n"
            )

        return f"""Generate the Observations Report for the following permit application:

APPLICATION DATA:
Number: {expedient.get('exp_number')}
Address: {expedient.get('address')}
Permit type: {expedient.get('project_type', '').replace('_', ' ').title()}
Zone: {expedient.get('zone')}
Owner: {expedient.get('owner_name')}
Architect: {expedient.get('architect_name')}
Review date: {review_date.strftime('%B %d, %Y')}
Submission date: {expedient.get('admitted_at', 'N/A')}
Round: {expedient.get('current_round', 1)}

DETECTED OBSERVATIONS:
{chr(10).join(observations_text)}

Generate the full report and structured JSON."""

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
    lang: str = "es",
) -> dict[str, Any]:
    """
    Generate a draft Acta de Observaciones from compliance results.
    Returns both the full text and a structured list of observations.
    """
    prompt = build_report_prompt(expedient, compliance_results, lang=lang)

    flagged = [
        r for r in compliance_results.get("results", [])
        if r["verdict"] in ("VIOLATION", "NEEDS_REVIEW")
    ]

    if not flagged:
        no_obs = (
            "The project complies with all reviewed urban parameters. No observations issued."
            if lang == "en" else
            "El proyecto cumple con todos los parámetros urbanísticos revisados. No se emiten observaciones."
        )
        return {"acta_text": no_obs, "observations": [], "has_observations": False}

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=4096,
        system=_get_system_prompt(lang),
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content[0].text.strip()

    # The response is plain observation text — no JSON extraction needed.
    # The structured observations list will be built at publish time from
    # the reviewer's confirmed decisions in the observations table.
    return {
        "acta_text": content,
        "observations": [],
        "has_observations": True,
    }
