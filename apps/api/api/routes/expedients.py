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


@router.post("/{expedient_id}/chat")
async def chat_with_ai(expedient_id: str, body: ChatRequest):
    """
    Architect chat — Claude answers questions about the expedient using the
    project parameters, compliance observations, and published acta as context.
    """
    exp_id = _resolve_expedient_id(expedient_id)

    # Load context
    exp = supabase.table("expedients").select("*, project_parameters(*)").eq("id", exp_id).single().execute()
    if not exp.data:
        raise HTTPException(status_code=404, detail="Expedient not found")

    # Latest compliance check + observations
    check = supabase.table("compliance_checks").select("id, round_number, completed_at") \
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

    # Published acta
    acta_text = ""
    acta = supabase.table("actas").select("content, acta_number, round_number") \
        .eq("expedient_id", exp_id).eq("status", "published") \
        .order("created_at", desc=True).limit(1).execute()
    if acta.data and acta.data[0].get("content"):
        acta_text = acta.data[0]["content"].get("acta_text", "")

    p = exp.data.get("project_parameters", [{}])[0] if exp.data.get("project_parameters") else {}

    system_prompt = f"""Eres un asistente experto en normativa de edificación chilena, especializado en la DOM Las Condes.
Ayudas a arquitectos a comprender las observaciones de la DOM, los artículos normativos aplicables (OGUC, LGUC, PRC Las Condes, Ley 21.718), y cómo subsanar observaciones.

EXPEDIENTE EN CONTEXTO:
- N°: {exp.data.get('exp_number')}
- Dirección: {exp.data.get('address')}
- Zona PRC: {exp.data.get('zone')}
- Tipo: {exp.data.get('project_type')}
- Estado: {exp.data.get('status')}
- Ronda: {exp.data.get('current_round')}

PARÁMETROS CIP (permitidos por la normativa):
- Constructibilidad máx.: {p.get('cip_constructibilidad_max')}
- Ocupación suelo máx.: {p.get('cip_ocupacion_suelo_max')}
- Altura máx.: {p.get('cip_altura_maxima_m')} m
- Densidad máx.: {p.get('cip_densidad_max_hab_ha')} hab/há
- Estacionamientos mín.: {p.get('cip_estacionamientos_min')}
- Dist. lateral mín.: {p.get('cip_distanciamiento_lateral_m')} m
- Dist. fondo mín.: {p.get('cip_distanciamiento_fondo_m')} m
- Antejardín mín.: {p.get('cip_antejardin_m')} m

PARÁMETROS DECLARADOS POR EL ARQUITECTO:
- Constructibilidad: {p.get('declared_constructibilidad')}
- Ocupación suelo: {p.get('declared_ocupacion_suelo')}
- Altura: {p.get('declared_altura_m')} m
- Densidad: {p.get('declared_densidad_hab_ha')} hab/há
- Estacionamientos: {p.get('declared_estacionamientos')}
- Dist. lateral: {p.get('declared_distanciamiento_lateral_m')} m
- Dist. fondo: {p.get('declared_distanciamiento_fondo_m')} m
- Antejardín: {p.get('declared_antejardin_m')} m
- Superficie predio: {p.get('declared_superficie_predio_m2')} m²
- Superficie total edificada: {p.get('declared_superficie_total_edificada_m2')} m²
- N° unidades: {p.get('declared_num_unidades_vivienda')}

OBSERVACIONES DE CUMPLIMIENTO (Ronda {exp.data.get('current_round')}):
{observations_text if observations_text else '(Sin observaciones completadas aún)'}

ACTA PUBLICADA:
{acta_text if acta_text else '(Sin acta publicada aún)'}

INSTRUCCIONES:
- Responde en español, de forma directa y profesional.
- Cita artículos específicos (ej: "Art. 2.6.3 OGUC") cuando sea relevante.
- Para infracciones, explica exactamente qué valor debe corregirse y por qué.
- Para subsanación, da orientación práctica concreta.
- Si no tienes información para responder, indícalo claramente.
- Sé conciso — máximo 3-4 párrafos por respuesta."""

    messages = [
        {"role": msg.role, "content": msg.content}
        for msg in body.history
    ] + [{"role": "user", "content": body.message}]

    response = claude.messages.create(
        model=settings.llm_model,
        max_tokens=800,
        system=system_prompt,
        messages=messages,
    )

    return {"response": response.content[0].text}
