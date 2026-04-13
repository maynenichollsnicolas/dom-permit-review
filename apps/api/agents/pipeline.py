"""
Agent Pipeline — thin entry point that invokes the LangGraph state machine.

The full orchestration logic lives in agents/graph.py.
This module exists so the FastAPI route doesn't need to know about LangGraph internals.
"""
from __future__ import annotations

from supabase import create_client

from config import settings
from agents.graph import pipeline_graph

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


async def run_pipeline(expedient_id: str) -> dict:
    """
    Invoke the LangGraph pipeline for a single expedient.

    Each run uses the expedient_id as the thread_id for checkpointing,
    so graph state is recoverable if the run is interrupted.

    Returns summary counts for the API response.
    Raises RuntimeError on pipeline failure (compliance_check is marked failed).
    """
    config = {"configurable": {"thread_id": expedient_id}}

    try:
        final_state = await pipeline_graph.ainvoke(
            {"expedient_id": expedient_id},
            config=config,
        )
    except Exception as e:
        # Mark any running compliance check as failed
        supabase.table("compliance_checks").update(
            {"status": "failed"}
        ).eq("expedient_id", expedient_id).eq("status", "running").execute()
        raise RuntimeError(f"Pipeline failed for {expedient_id}: {e}") from e

    if final_state.get("error"):
        supabase.table("compliance_checks").update(
            {"status": "failed"}
        ).eq("expedient_id", expedient_id).eq("status", "running").execute()
        raise RuntimeError(final_state["error"])

    compliance_results = final_state.get("compliance_results", {})
    acta_draft = final_state.get("acta_draft", {})
    results = compliance_results.get("results", [])

    return {
        "check_id": final_state.get("check_id"),
        "retrieval_rounds": final_state.get("retrieval_round", 1),
        "num_violations": sum(1 for r in results if r["verdict"] == "VIOLATION"),
        "num_needs_review": sum(1 for r in results if r["verdict"] == "NEEDS_REVIEW"),
        "num_compliant": sum(1 for r in results if r["verdict"] == "COMPLIANT"),
        "num_sin_datos": sum(1 for r in results if r["verdict"] == "SIN_DATOS"),
        "has_observations": acta_draft.get("has_observations", False),
    }
