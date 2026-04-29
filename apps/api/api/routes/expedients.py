from __future__ import annotations

from datetime import datetime, timezone
import anthropic
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from supabase import create_client

from config import settings
from agents.pipeline import run_pipeline

router = APIRouter(prefix="/expedients", tags=["expedients"])
supabase = create_client(settings.supabase_url, settings.supabase_service_key)
claude = anthropic.Anthropic(api_key=settings.anthropic_api_key)


# --- Request / Response models ---

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = []

class ObservationActionRequest(BaseModel):
    action: str  # "accepted" | "edited" | "discarded"
    reviewer_final_text: Optional[str] = None
    reviewer_discard_reason: Optional[str] = None
    reviewer_notes: Optional[str] = None


# --- Routes ---

@router.get("")
async def list_expedients():
    result = (
        supabase.table("expedients")
        .select("id, exp_number, address, zone, project_type, status, current_round, admitted_at, legal_deadline_at, architect_name, owner_name, assigned_reviewer_id")
        .order("legal_deadline_at", desc=False)
        .execute()
    )
    return result.data


@router.get("/{expedient_id}")
async def get_expedient(expedient_id: str):
    expedient_id = _resolve_expedient_id(expedient_id)
    result = (
        supabase.table("expedients")
        .select("*, project_parameters(*)")
        .eq("id", expedient_id)
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Expedient not found")
    return result.data


def _resolve_expedient_id(expedient_id: str) -> str:
    """Resolve either a UUID or an exp_number string to a UUID."""
    import re
    if re.fullmatch(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", expedient_id, re.I):
        return expedient_id
    result = supabase.table("expedients").select("id").eq("exp_number", expedient_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Expedient not found")
    return result.data["id"]


@router.post("/{expedient_id}/analyze")
async def trigger_analysis(expedient_id: str, background_tasks: BackgroundTasks):
    """
    Trigger the AI compliance pipeline for an expedient.
    Runs asynchronously in the background.
    Auto-triggered when expedient is admitted.
    Accepts either a UUID or an exp_number (e.g. 2024-0847).
    """
    expedient_id = _resolve_expedient_id(expedient_id)

    # Check expedient exists
    result = supabase.table("expedients").select("id, status").eq("id", expedient_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Expedient not found")

    # Check no analysis already running
    running = (
        supabase.table("compliance_checks")
        .select("id")
        .eq("expedient_id", expedient_id)
        .eq("status", "running")
        .execute()
    )
    if running.data:
        raise HTTPException(status_code=409, detail="Analysis already running for this expedient")

    background_tasks.add_task(run_pipeline, expedient_id)
    return {"message": "Analysis started", "expedient_id": expedient_id}


@router.get("/{expedient_id}/compliance")
async def get_compliance(expedient_id: str):
    expedient_id = _resolve_expedient_id(expedient_id)
    """Get the latest compliance check results with observations."""
    # Get latest completed check
    check = (
        supabase.table("compliance_checks")
        .select("*")
        .eq("expedient_id", expedient_id)
        .eq("status", "completed")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if not check.data:
        # Check if running
        running = (
            supabase.table("compliance_checks")
            .select("id, status")
            .eq("expedient_id", expedient_id)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if running.data:
            return {"status": running.data[0]["status"], "observations": []}
        return {"status": "not_started", "observations": []}

    check_id = check.data[0]["id"]

    # Get observations for this check
    observations = (
        supabase.table("observations")
        .select("*")
        .eq("compliance_check_id", check_id)
        .order("parameter")
        .execute()
    )

    return {
        "status": "completed",
        "check": check.data[0],
        "observations": observations.data or [],
    }


@router.patch("/{expedient_id}/observations/{observation_id}")
async def update_observation(
    expedient_id: str,
    observation_id: str,
    body: ObservationActionRequest,
):
    """Reviewer action on an observation: accept, edit, or discard."""
    expedient_id = _resolve_expedient_id(expedient_id)
    allowed_actions = {"accepted", "edited", "discarded"}
    if body.action not in allowed_actions:
        raise HTTPException(status_code=400, detail=f"Action must be one of {allowed_actions}")

    if body.action == "discarded" and not body.reviewer_discard_reason:
        raise HTTPException(status_code=400, detail="Discard reason is required when discarding")

    if body.action == "edited" and not body.reviewer_final_text:
        raise HTTPException(status_code=400, detail="Final text is required when editing")

    update_data = {
        "reviewer_action": body.action,
        "reviewer_notes": body.reviewer_notes,
    }

    if body.action == "edited":
        update_data["reviewer_final_text"] = body.reviewer_final_text
    elif body.action == "discarded":
        update_data["reviewer_discard_reason"] = body.reviewer_discard_reason
    elif body.action == "accepted":
        # Use AI draft text as final if accepted without edit
        obs = supabase.table("observations").select("ai_draft_text").eq("id", observation_id).single().execute()
        if obs.data:
            update_data["reviewer_final_text"] = obs.data.get("ai_draft_text")

    result = (
        supabase.table("observations")
        .update(update_data)
        .eq("id", observation_id)
        .eq("expedient_id", expedient_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Observation not found")

    return result.data[0]


@router.get("/{expedient_id}/acta")
async def get_acta(expedient_id: str):
    """Get the current Acta (draft or published)."""
    expedient_id = _resolve_expedient_id(expedient_id)
    result = (
        supabase.table("actas")
        .select("*")
        .eq("expedient_id", expedient_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="No Acta found for this expedient")
    return result.data[0]


@router.post("/{expedient_id}/acta/publish")
async def publish_acta(expedient_id: str):
    """
    Publish the Acta de Observaciones.

    Rebuilds the Acta content from the reviewer's confirmed observations
    (accepted / edited) so the published snapshot always reflects the
    final reviewer decisions, not the original AI draft.
    """
    expedient_id = _resolve_expedient_id(expedient_id)

    # Require a draft Acta record to exist (created by the pipeline)
    acta = (
        supabase.table("actas")
        .select("id")
        .eq("expedient_id", expedient_id)
        .eq("status", "draft")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not acta.data:
        raise HTTPException(status_code=404, detail="No draft Acta found")

    acta_id = acta.data[0]["id"]

    # Guard: no pending non-COMPLIANT observations
    pending = (
        supabase.table("observations")
        .select("id")
        .eq("expedient_id", expedient_id)
        .in_("ai_verdict", ["VIOLATION", "NEEDS_REVIEW", "SIN_DATOS"])
        .eq("reviewer_action", "pending")
        .execute()
    )
    if pending.data:
        raise HTTPException(
            status_code=400,
            detail=f"{len(pending.data)} observation(s) still pending reviewer action.",
        )

    # Load confirmed observations to build the published snapshot
    confirmed = (
        supabase.table("observations")
        .select("parameter, ai_verdict, declared_value, allowed_value, normative_reference, ai_draft_text, reviewer_final_text, reviewer_action")
        .eq("expedient_id", expedient_id)
        .in_("reviewer_action", ["accepted", "edited"])
        .order("parameter")
        .execute()
    )

    # Load expedient for header
    exp = supabase.table("expedients").select("*").eq("id", expedient_id).single().execute()
    expedient = exp.data or {}

    from datetime import date as _date
    today_str = _date.today().strftime("%d de %B de %Y")

    # Build structured observations list
    structured_obs = []
    for i, obs in enumerate(confirmed.data or [], 1):
        text = obs.get("reviewer_final_text") or obs.get("ai_draft_text") or ""
        structured_obs.append({
            "number": i,
            "parameter": obs["parameter"],
            "title": obs["parameter"].replace("_", " ").upper(),
            "declared_value": obs.get("declared_value"),
            "allowed_value": obs.get("allowed_value"),
            "text": text,
            "normative_reference": obs.get("normative_reference") or "",
        })

    # Build plain-text Acta for archiving
    lines = [
        "MUNICIPALIDAD DE LAS CONDES",
        "DIRECCIÓN DE OBRAS MUNICIPALES",
        "",
        "ACTA DE OBSERVACIONES",
        f"Fecha: {today_str}",
        f"Expediente N°: {expedient.get('exp_number', '')}",
        f"Dirección: {expedient.get('address', '')}",
        f"Zona: {expedient.get('zone', '')}",
        f"Tipo de obra: {expedient.get('project_type', '').replace('_', ' ')}",
        f"Propietario: {expedient.get('owner_name', '')}",
        f"Arquitecto: {expedient.get('architect_name', '')}",
        f"Ronda: {expedient.get('current_round', 1)}",
        "",
        "OBSERVACIONES:",
        "",
    ]
    for obs in structured_obs:
        lines.append(f"{obs['number']}. {obs['title']}")
        if obs.get("declared_value") and obs.get("allowed_value"):
            lines.append(f"   Declarado: {obs['declared_value']} / Permitido: {obs['allowed_value']}")
        if obs["text"]:
            lines.append(f"   {obs['text']}")
        if obs["normative_reference"]:
            lines.append(f"   Norma: {obs['normative_reference']}")
        lines.append("")

    if structured_obs:
        lines += [
            "El arquitecto proyectista deberá subsanar las observaciones señaladas dentro",
            "del plazo de 60 días hábiles contado desde la notificación de la presente Acta,",
            "conforme al artículo 5.1.6 de la OGUC y la Ley N° 21.718.",
        ]

    acta_text = "\n".join(lines)

    # Generate Acta number
    year = _date.today().year
    count = supabase.table("actas").select("id", count="exact").eq("status", "published").execute()
    acta_number = f"OBS-{year}-{(count.count or 0) + 1:04d}"

    # Publish with rebuilt content
    result = (
        supabase.table("actas")
        .update({
            "status": "published",
            "acta_number": acta_number,
            "published_at": datetime.now(timezone.utc).isoformat(),
            "content": {
                "acta_text": acta_text,
                "observations": structured_obs,
                "has_observations": len(structured_obs) > 0,
            },
        })
        .eq("id", acta_id)
        .execute()
    )

    supabase.table("expedients").update({"status": "observado"}).eq("id", expedient_id).execute()

    return result.data[0]


@router.post("/{expedient_id}/approve")
async def approve_expedient(expedient_id: str):
    """
    Approve the expedient — all parameters comply, no Acta required.
    Requires that all non-COMPLIANT observations have been reviewed.
    """
    expedient_id = _resolve_expedient_id(expedient_id)

    result = supabase.table("expedients").select("id, status").eq("id", expedient_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Expedient not found")

    # Guard: ensure no confirmed observations exist (if they do, use publish_acta instead)
    confirmed = (
        supabase.table("observations")
        .select("id")
        .eq("expedient_id", expedient_id)
        .in_("reviewer_action", ["accepted", "edited"])
        .execute()
    )
    if confirmed.data:
        raise HTTPException(
            status_code=400,
            detail=f"{len(confirmed.data)} confirmed observation(s) exist. Use publish_acta instead of approve.",
        )

    # Guard: ensure no pending non-COMPLIANT observations remain
    pending = (
        supabase.table("observations")
        .select("id")
        .eq("expedient_id", expedient_id)
        .in_("ai_verdict", ["VIOLATION", "NEEDS_REVIEW", "SIN_DATOS"])
        .eq("reviewer_action", "pending")
        .execute()
    )
    if pending.data:
        raise HTTPException(
            status_code=400,
            detail=f"{len(pending.data)} observation(s) still pending review. Review all before approving.",
        )

    supabase.table("expedients").update({"status": "aprobado"}).eq("id", expedient_id).execute()
    return {"status": "aprobado", "expedient_id": expedient_id}


@router.get("/{expedient_id}/rounds/comparison")
async def get_rounds_comparison(expedient_id: str):
    """
    Compare Round 1 vs Round 2+ observations per parameter.
    Returns FIXED | PERSISTS | NEW | STILL_COMPLIANT for each parameter.
    Only meaningful when current_round >= 2.
    """
    from collections import defaultdict

    expedient_id = _resolve_expedient_id(expedient_id)

    exp = supabase.table("expedients").select("current_round").eq("id", expedient_id).single().execute()
    if not exp.data:
        raise HTTPException(status_code=404, detail="Expedient not found")

    current_round = exp.data["current_round"]
    if current_round < 2:
        return {"available": False, "reason": "Only one round completed", "parameters": [], "summary": {}}

    all_obs = (
        supabase.table("observations")
        .select("id,parameter,round_introduced,ai_verdict,ai_draft_text,declared_value,allowed_value,delta,normative_reference,reviewer_action,reviewer_final_text,round_status")
        .eq("expedient_id", expedient_id)
        .order("round_introduced")
        .execute()
    )

    try:
        history = (
            supabase.table("parameter_history")
            .select("round_number, snapshot")
            .eq("expedient_id", expedient_id)
            .order("round_number")
            .execute()
        )
        history_data = history.data or []
    except Exception:
        history_data = []

    # Group observations by (parameter, round_introduced) — skip rows with NULL keys
    param_round: dict[str, dict[int, dict]] = defaultdict(dict)
    for obs in (all_obs.data or []):
        param = obs.get("parameter")
        rnd = obs.get("round_introduced")
        if param is None or rnd is None:
            continue
        param_round[param][rnd] = obs

    VIOLATION_VERDICTS = {"VIOLATION", "NEEDS_REVIEW", "SIN_DATOS"}

    parameters = []
    for param in sorted(param_round.keys()):
        rounds = param_round[param]
        r1_obs = rounds.get(1)
        r2_obs = rounds.get(current_round)
        if r2_obs is None and rounds:
            r2_obs = rounds[max(rounds.keys())]

        r1_violation = r1_obs is not None and r1_obs.get("ai_verdict") in VIOLATION_VERDICTS
        r2_violation = r2_obs is not None and r2_obs.get("ai_verdict") in VIOLATION_VERDICTS

        if r1_obs is None:
            comparison_status = "NEW" if r2_violation else "STILL_COMPLIANT"
        elif r2_obs is None or not r2_violation:
            comparison_status = "FIXED" if r1_violation else "STILL_COMPLIANT"
        elif r1_violation and r2_violation:
            comparison_status = "PERSISTS"
        elif not r1_violation and r2_violation:
            comparison_status = "NEW"
        else:
            comparison_status = "STILL_COMPLIANT"

        parameters.append({
            "parameter": param,
            "comparison_status": comparison_status,
            "r1_obs": r1_obs,
            "r2_obs": r2_obs,
        })

    summary = {
        "fixed": sum(1 for p in parameters if p["comparison_status"] == "FIXED"),
        "persists": sum(1 for p in parameters if p["comparison_status"] == "PERSISTS"),
        "new_issues": sum(1 for p in parameters if p["comparison_status"] == "NEW"),
        "still_compliant": sum(1 for p in parameters if p["comparison_status"] == "STILL_COMPLIANT"),
    }

    return {
        "available": True,
        "current_round": current_round,
        "parameter_history": history_data,
        "parameters": parameters,
        "summary": summary,
    }


@router.post("/{expedient_id}/chat")
async def chat_with_ai(expedient_id: str, body: ChatRequest):
    """
    Architect chat — agentic Claude with two tools:
      • escalate_to_dom: creates an escalation record when the agent is uncertain
      • (implicit) answer: Claude answers directly when confident

    The agent also learns from past DOM answers for the same zone, injected
    as DOM_GUIDANCE context so it handles recurring questions autonomously.
    """
    from datetime import datetime, timezone as _tz

    exp_id = _resolve_expedient_id(expedient_id)

    exp = supabase.table("expedients").select("*, project_parameters(*)").eq("id", exp_id).single().execute()
    if not exp.data:
        raise HTTPException(status_code=404, detail="Expedient not found")

    zone = exp.data.get("zone", "")

    # ── Latest compliance observations ────────────────────────────────────────
    check = supabase.table("compliance_checks").select("id, round_number") \
        .eq("expedient_id", exp_id).eq("status", "completed") \
        .order("created_at", desc=True).limit(1).execute()

    observations_text = ""
    if check.data:
        obs = supabase.table("observations").select("*") \
            .eq("compliance_check_id", check.data[0]["id"]).execute()
        for o in (obs.data or []):
            observations_text += (
                f"\n- {o['parameter']}: {o['ai_verdict']} — {o['ai_draft_text']}"
                f"\n  Declarado: {o['declared_value']} | Permitido: {o['allowed_value']}"
                f"\n  Normativa: {o['normative_reference']}"
            )

    # ── Published Acta ────────────────────────────────────────────────────────
    acta_text = ""
    acta = supabase.table("actas").select("content") \
        .eq("expedient_id", exp_id).eq("status", "published") \
        .order("created_at", desc=True).limit(1).execute()
    if acta.data and acta.data[0].get("content"):
        acta_text = acta.data[0]["content"].get("acta_text", "")

    # ── DOM guidance: past answered escalations for this zone (learning loop) ─
    past = supabase.table("escalations") \
        .select("architect_question, ai_attempted_answer, dom_answer, parameter_tags") \
        .eq("zone", zone).eq("status", "answered") \
        .order("answered_at", desc=True).limit(20).execute()

    dom_guidance = ""
    if past.data:
        lines = [
            "DOM_GUIDANCE — Preguntas anteriores de esta zona que el revisor DOM ya respondió.",
            "Úsalas para responder directamente sin escalar consultas similares:\n",
        ]
        for e in past.data:
            lines.append(f"P: {e['architect_question']}")
            if e.get("ai_attempted_answer"):
                lines.append(f"  (Intento del agente: {e['ai_attempted_answer'][:200]}...)")
            lines.append(f"  R (DOM): {e['dom_answer']}\n")
        dom_guidance = "\n".join(lines)

    p = exp.data.get("project_parameters", [{}])[0] if exp.data.get("project_parameters") else {}

    system_prompt = f"""Eres un asistente experto en normativa de edificación chilena para arquitectos de la DOM Las Condes.
Tu misión es ayudar al arquitecto a entender las observaciones y cómo subsanarlas.

HERRAMIENTA DISPONIBLE — escalate_to_dom:
Úsala ÚNICAMENTE cuando:
- La pregunta involucra una interpretación normativa ambigua que requiere criterio profesional del DOM
- La respuesta podría contradecir una decisión previa del revisor en este expediente
- El arquitecto solicita una excepción, varianza, o acuerdo especial
- No tienes suficiente certeza para dar una respuesta definitiva con consecuencias legales
NO la uses para preguntas factuales sobre el expediente, los valores declarados, o los artículos de la normativa.

EXPEDIENTE:
- N°: {exp.data.get('exp_number')} | Dirección: {exp.data.get('address')}
- Zona PRC: {zone} | Tipo: {exp.data.get('project_type')}
- Estado: {exp.data.get('status')} | Ronda: {exp.data.get('current_round')}

PARÁMETROS CIP (normativa):
Constructibilidad máx. {p.get('cip_constructibilidad_max')} | Ocupación suelo máx. {p.get('cip_ocupacion_suelo_max')}
Altura máx. {p.get('cip_altura_maxima_m')} m | Densidad máx. {p.get('cip_densidad_max_hab_ha')} hab/há
Estacionamientos mín. {p.get('cip_estacionamientos_min')} | Dist. lateral mín. {p.get('cip_distanciamiento_lateral_m')} m
Dist. fondo mín. {p.get('cip_distanciamiento_fondo_m')} m | Antejardín mín. {p.get('cip_antejardin_m')} m

PARÁMETROS DECLARADOS:
Constructibilidad {p.get('declared_constructibilidad')} | Ocupación suelo {p.get('declared_ocupacion_suelo')}
Altura {p.get('declared_altura_m')} m | Densidad {p.get('declared_densidad_hab_ha')} hab/há
Estacionamientos {p.get('declared_estacionamientos')} | Dist. lateral {p.get('declared_distanciamiento_lateral_m')} m
Dist. fondo {p.get('declared_distanciamiento_fondo_m')} m | Antejardín {p.get('declared_antejardin_m')} m
Superficie predio {p.get('declared_superficie_predio_m2')} m² | Total edificada {p.get('declared_superficie_total_edificada_m2')} m²
N° unidades: {p.get('declared_num_unidades_vivienda')}

OBSERVACIONES DE CUMPLIMIENTO (Ronda {exp.data.get('current_round')}):
{observations_text or '(Sin observaciones completadas aún)'}

ACTA PUBLICADA:
{acta_text or '(Sin acta publicada aún)'}

{dom_guidance}

INSTRUCCIONES DE RESPUESTA:
- Responde en español, de forma directa y profesional.
- Cita artículos específicos (ej: "Art. 2.6.3 OGUC") cuando sea relevante.
- Para cada infracción, explica exactamente qué valor corregir y cuánto.
- Sé conciso — máximo 3 párrafos por respuesta directa.
- Si escalas, explica brevemente al arquitecto por qué necesitas confirmación del DOM."""

    escalate_tool = {
        "name": "escalate_to_dom",
        "description": (
            "Escala una pregunta al revisor técnico DOM cuando no puedes responder "
            "con suficiente certeza. El arquitecto será notificado de que la consulta "
            "fue enviada al DOM y recibirá la respuesta cuando el revisor conteste."
        ),
        "input_schema": {
            "type": "object",
            "properties": {
                "question": {
                    "type": "string",
                    "description": "La pregunta exacta del arquitecto, reformulada claramente para el DOM",
                },
                "reason": {
                    "type": "string",
                    "description": "Por qué el agente no puede responder directamente",
                },
                "ai_attempted_answer": {
                    "type": "string",
                    "description": "Lo que el agente sabe o intentaría responder, como contexto para el DOM",
                },
                "parameter_tags": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Parámetros urbanísticos relacionados (ej: ['altura_m', 'constructibilidad'])",
                },
            },
            "required": ["question", "reason"],
        },
    }

    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in body.history
    ] + [{"role": "user", "content": body.message}]

    escalation_id: str | None = None
    max_turns = 6

    for _ in range(max_turns):
        response = claude.messages.create(
            model=settings.llm_model,
            max_tokens=1000,
            system=system_prompt,
            tools=[escalate_tool],
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            text = next((b.text for b in response.content if hasattr(b, "text")), "")
            return {"response": text, "escalated": False}

        if response.stop_reason == "tool_use":
            tool_results = []
            for block in response.content:
                if block.type == "tool_use" and block.name == "escalate_to_dom":
                    inp = block.input
                    esc = supabase.table("escalations").insert({
                        "expedient_id": exp_id,
                        "zone": zone,
                        "parameter_tags": inp.get("parameter_tags", []),
                        "architect_question": inp.get("question", body.message),
                        "ai_attempted_answer": inp.get("ai_attempted_answer"),
                        "ai_escalation_reason": inp.get("reason"),
                        "status": "pending",
                    }).execute()
                    escalation_id = esc.data[0]["id"] if esc.data else None

                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": f"Escalación registrada exitosamente. ID: {escalation_id}. "
                                   "El revisor DOM recibirá la consulta y responderá a la brevedad.",
                    })

            messages.append({"role": "assistant", "content": response.content})
            messages.append({"role": "user", "content": tool_results})
        else:
            break

    # Final response after tool use (Claude's message to the architect about the escalation)
    final_response = claude.messages.create(
        model=settings.llm_model,
        max_tokens=400,
        system=system_prompt,
        tools=[escalate_tool],
        messages=messages,
    )
    text = next((b.text for b in final_response.content if hasattr(b, "text")), "")
    return {"response": text, "escalated": True, "escalation_id": escalation_id}
