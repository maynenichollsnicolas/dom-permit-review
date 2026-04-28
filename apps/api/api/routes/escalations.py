"""
Escalation routes — architect questions the agent couldn't answer confidently.

GET  /escalations/expedient/{expedient_id}   — architect polls for answered escalations
GET  /escalations/dom/pending                — DOM sees all pending questions (all expedients)
POST /escalations/dom/{escalation_id}/answer — DOM submits their answer
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from supabase import create_client

from config import settings

router = APIRouter(prefix="/escalations", tags=["escalations"])
supabase = create_client(settings.supabase_url, settings.supabase_service_key)


class DomAnswerRequest(BaseModel):
    dom_answer: str


@router.get("/expedient/{expedient_id}")
async def get_expedient_escalations(expedient_id: str):
    """Architect polls — returns all escalations for their expedient."""
    result = (
        supabase.table("escalations")
        .select("*")
        .eq("expedient_id", expedient_id)
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.get("/dom/pending")
async def get_pending_escalations():
    """DOM inbox — all pending questions across all expedients, with expedient context."""
    result = (
        supabase.table("escalations")
        .select("*, expedients(exp_number, address, zone, architect_name)")
        .eq("status", "pending")
        .order("created_at", desc=False)
        .execute()
    )
    return result.data or []


@router.post("/dom/{escalation_id}/answer")
async def answer_escalation(escalation_id: str, body: DomAnswerRequest):
    """DOM submits their authoritative answer to an escalated question."""
    if not body.dom_answer.strip():
        raise HTTPException(status_code=400, detail="Answer cannot be empty")

    result = (
        supabase.table("escalations")
        .update({
            "dom_answer": body.dom_answer.strip(),
            "status": "answered",
            "answered_at": datetime.now(timezone.utc).isoformat(),
        })
        .eq("id", escalation_id)
        .execute()
    )

    if not result.data:
        raise HTTPException(status_code=404, detail="Escalation not found")

    return result.data[0]
