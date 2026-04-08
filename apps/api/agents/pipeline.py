"""
Agent Pipeline — orchestrates the four agents in sequence.
Triggered automatically when an expedient is admitted.
"""
from __future__ import annotations

from supabase import create_client

from config import settings
from agents.input_parser import parse_and_validate, build_from_db_row
from agents.compliance_reasoner import run_compliance_check
from agents.report_generator import generate_acta
from rag.retriever import retrieve_all_zone_chunks

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


async def run_pipeline(expedient_id: str) -> dict:
    """
    Run the full compliance pipeline for an expedient.

    1. Input Parser: load and validate project parameters
    2. Regulatory Retriever: load normative chunks for the zone
    3. Compliance Reasoner: evaluate each parameter via Claude
    4. Report Generator: draft the Acta de Observaciones via Claude

    Saves results to compliance_checks and observations tables.
    Returns the compliance check record.
    """

    # --- Load expedient ---
    exp_result = (
        supabase.table("expedients")
        .select("*, project_parameters(*)")
        .eq("id", expedient_id)
        .single()
        .execute()
    )
    expedient = exp_result.data
    if not expedient:
        raise ValueError(f"Expedient {expedient_id} not found")

    params_rows = expedient.get("project_parameters", [])
    if not params_rows:
        raise ValueError(f"No project parameters found for expedient {expedient_id}")

    params_row = params_rows[0] if isinstance(params_rows, list) else params_rows
    # Add zone and project_type from expedient to params_row for build_from_db_row
    params_row["zone"] = expedient["zone"]
    params_row["project_type"] = expedient["project_type"]

    # --- Create compliance_check record ---
    check_result = (
        supabase.table("compliance_checks")
        .insert({
            "expedient_id": expedient_id,
            "round_number": expedient["current_round"],
            "status": "running",
        })
        .execute()
    )
    check_id = check_result.data[0]["id"]

    try:
        # --- Step 1: Input Parser ---
        project_dict = build_from_db_row(expedient_id, params_row)
        parsed = parse_and_validate(project_dict)

        # --- Step 2: Regulatory Retriever ---
        chunks = retrieve_all_zone_chunks(zone=expedient["zone"])

        # --- Step 3: Compliance Reasoner ---
        compliance_results = await run_compliance_check(parsed, chunks)

        # --- Step 4: Report Generator ---
        acta_draft = await generate_acta(expedient, compliance_results)

        # --- Save observations to DB ---
        observation_records = []
        for result in compliance_results.get("results", []):
            observation_records.append({
                "expedient_id": expedient_id,
                "compliance_check_id": check_id,
                "round_introduced": expedient["current_round"],
                "parameter": result["parameter"],
                "ai_verdict": result["verdict"],
                "ai_confidence": result.get("confidence"),
                "declared_value": result.get("declared_value"),
                "allowed_value": result.get("allowed_value"),
                "delta": result.get("excess_or_deficit"),
                "normative_reference": result.get("normative_reference"),
                "chunk_ids": result.get("chunk_ids_used", []),
                "ai_draft_text": result.get("draft_observation"),
                "round_status": "NUEVA",
                "reviewer_action": "pending",
            })

        if observation_records:
            supabase.table("observations").insert(observation_records).execute()

        # --- Save draft acta ---
        supabase.table("actas").insert({
            "expedient_id": expedient_id,
            "round_number": expedient["current_round"],
            "status": "draft",
            "content": {
                "acta_text": acta_draft.get("acta_text"),
                "observations": acta_draft.get("observations", []),
                "has_observations": acta_draft.get("has_observations", False),
            },
        }).execute()

        # --- Update compliance_check status ---
        supabase.table("compliance_checks").update({
            "status": "completed",
            "ai_raw_output": compliance_results,
        }).eq("id", check_id).execute()

        # --- Update expedient status ---
        supabase.table("expedients").update({
            "status": "en_revision",
        }).eq("id", expedient_id).execute()

        return {
            "check_id": check_id,
            "num_violations": sum(
                1 for r in compliance_results.get("results", [])
                if r["verdict"] == "VIOLATION"
            ),
            "num_needs_review": sum(
                1 for r in compliance_results.get("results", [])
                if r["verdict"] == "NEEDS_REVIEW"
            ),
            "num_compliant": sum(
                1 for r in compliance_results.get("results", [])
                if r["verdict"] == "COMPLIANT"
            ),
            "has_observations": acta_draft.get("has_observations", False),
        }

    except Exception as e:
        # Mark check as failed
        supabase.table("compliance_checks").update({
            "status": "failed",
        }).eq("id", check_id).execute()
        raise e
