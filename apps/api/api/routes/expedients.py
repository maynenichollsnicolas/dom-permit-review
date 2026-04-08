from __future__ import annotations

from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from supabase import create_client

from config import settings
from agents.pipeline import run_pipeline

router = APIRouter(prefix="/expedients", tags=["expedients"])
supabase = create_client(settings.supabase_url, settings.supabase_service_key)


# --- Request / Response models ---

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


@router.post("/{expedient_id}/analyze")
async def trigger_analysis(expedient_id: str, background_tasks: BackgroundTasks):
    """
    Trigger the AI compliance pipeline for an expedient.
    Runs asynchronously in the background.
    Auto-triggered when expedient is admitted.
    """
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
    """Publish the Acta de Observaciones — makes it official and locks it."""
    # Get draft acta
    acta = (
        supabase.table("actas")
        .select("*")
        .eq("expedient_id", expedient_id)
        .eq("status", "draft")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not acta.data:
        raise HTTPException(status_code=404, detail="No draft Acta found")

    acta_id = acta.data[0]["id"]

    # Check all non-compliant observations have been reviewed
    pending = (
        supabase.table("observations")
        .select("id")
        .eq("expedient_id", expedient_id)
        .in_("ai_verdict", ["VIOLATION", "NEEDS_REVIEW"])
        .eq("reviewer_action", "pending")
        .execute()
    )
    if pending.data:
        raise HTTPException(
            status_code=400,
            detail=f"{len(pending.data)} observation(s) still pending reviewer action. Review all before publishing."
        )

    # Generate acta number
    from datetime import date
    year = date.today().year
    count = supabase.table("actas").select("id", count="exact").eq("status", "published").execute()
    acta_number = f"OBS-{year}-{(count.count or 0) + 1:04d}"

    # Publish
    result = (
        supabase.table("actas")
        .update({
            "status": "published",
            "acta_number": acta_number,
            "published_at": "NOW()",
        })
        .eq("id", acta_id)
        .execute()
    )

    # Update expedient status
    supabase.table("expedients").update({"status": "observado"}).eq("id", expedient_id).execute()

    return result.data[0]
