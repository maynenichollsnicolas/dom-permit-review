"""
LangGraph Pipeline — DOM permit review as a directed state graph.

Graph structure:

    START
      ↓
    load_and_parse   [deterministic: DB load + InputParser]
      ↓
    retrieve         [RegulatorRetriever: PRC direct SQL + OGUC/LGUC pgvector]
      ↓
    reason           [Compliance Reasoner: Claude with tool use — true ReAct agent]
      ↓  ← conditional edge ─────────────────────────────────────────────┐
      │  SIN_DATOS > 2 params AND retrieval_round < 3 → back to "retrieve" │
      │  otherwise ↓                                                        │
    generate         [ReportGenerator: Claude drafts Acta de Observaciones]  │
      ↓                                                                      │
    save             [persists observations + Acta to Supabase]              │
      ↓                                                                      │
    END                                                                      │
                                                                             │
    retrieve ────────────────────────────────────────────────────────────────┘
    (on retry: focuses on SIN_DATOS params, merges new chunks with existing)
"""
from __future__ import annotations

import asyncio
from typing import Literal

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from supabase import create_client

from config import settings
from agents.state import PipelineState
from agents.input_parser import parse_and_validate, build_from_db_row, ParsedProject, ParamDelta
from agents.compliance_reasoner import run_compliance_check
from agents.report_generator import generate_acta
from rag.retriever import retrieve_for_compliance_check

supabase = create_client(settings.supabase_url, settings.supabase_service_key)


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _flatten_chunks(chunks_by_param: dict) -> list[dict]:
    """Deduplicate and flatten a {param: [chunks]} dict into a single list."""
    seen: set[str] = set()
    flat: list[dict] = []
    for param_chunks in chunks_by_param.values():
        for c in param_chunks:
            if c["id"] not in seen:
                seen.add(c["id"])
                flat.append(c)
    return flat


def _serialize_parsed(parsed: ParsedProject) -> tuple[list[dict], list[str]]:
    """Convert ParsedProject to JSON-serializable dicts for graph state storage."""
    deltas = [
        {
            "parameter": d.parameter,
            "cip_value": d.cip_value,
            "declared_value": d.declared_value,
            "delta": d.delta,
            "status": d.status,
            "label": d.label,
        }
        for d in parsed.deltas
    ]
    parameters = [d.parameter for d in parsed.deltas]
    return deltas, parameters


def _deserialize_parsed(state: PipelineState) -> ParsedProject:
    """Reconstruct a ParsedProject from the serialized graph state."""
    deltas = [
        ParamDelta(
            parameter=d["parameter"],
            cip_value=d["cip_value"],
            declared_value=d["declared_value"],
            delta=d["delta"],
            status=d["status"],
            label=d["label"],
        )
        for d in state["parsed_deltas"]
    ]
    expedient = state["expedient"]
    return ParsedProject(
        expedient_id=state["expedient_id"],
        zone=state["zone"],
        project_type=expedient.get("project_type", "obra_nueva_residencial"),
        cip_params={},
        declared_params={},
        deltas=deltas,
        missing_params=[],
    )


# ─── Node 1: load_and_parse ───────────────────────────────────────────────────

async def load_and_parse_node(state: PipelineState) -> dict:
    """
    Load the expedient from Supabase, create a compliance_check record,
    then run the deterministic Input Parser to compute CIP vs declared deltas.
    """
    expedient_id = state["expedient_id"]

    exp_result = (
        supabase.table("expedients")
        .select("*, project_parameters(*)")
        .eq("id", expedient_id)
        .single()
        .execute()
    )
    expedient = exp_result.data
    if not expedient:
        return {"error": f"Expedient {expedient_id} not found"}

    params_rows = expedient.get("project_parameters", [])
    if not params_rows:
        return {"error": f"No project parameters for expedient {expedient_id}"}

    params_row = params_rows[0] if isinstance(params_rows, list) else params_rows
    params_row["zone"] = expedient["zone"]
    params_row["project_type"] = expedient["project_type"]

    # Create the compliance check record (status=running)
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

    # Input Parser: deterministic CIP vs declared comparison
    project_dict = build_from_db_row(expedient_id, params_row)
    parsed = parse_and_validate(project_dict)
    parsed_deltas, parameters = _serialize_parsed(parsed)

    return {
        "expedient": expedient,
        "params_row": params_row,
        "check_id": check_id,
        "parsed_deltas": parsed_deltas,
        "parameters": parameters,
        "zone": expedient["zone"],
        "retrieval_round": 0,
        "sin_datos_params": [],
    }


# ─── Node 2: retrieve ─────────────────────────────────────────────────────────

async def retrieve_node(state: PipelineState) -> dict:
    """
    Regulatory Retriever: fetch normative chunks for each parameter.

    First pass: all parameters — PRC direct SQL + OGUC/LGUC semantic search.
    Retry pass: focuses on SIN_DATOS parameters and merges with existing chunks.
    """
    zone = state["zone"]
    retrieval_round = state.get("retrieval_round", 0)
    sin_datos = state.get("sin_datos_params", [])

    # On retry, target only the parameters that returned no normative data
    parameters_to_fetch = (
        sin_datos if (retrieval_round > 0 and sin_datos) else state["parameters"]
    )

    new_chunks_by_param = await asyncio.to_thread(
        retrieve_for_compliance_check,
        parameters_to_fetch,
        zone,
    )

    # Merge with existing chunks, deduplicating by chunk id
    existing = dict(state.get("chunks_by_param", {}))
    for param, new_chunks in new_chunks_by_param.items():
        if param in existing:
            seen = {c["id"] for c in existing[param]}
            for c in new_chunks:
                if c["id"] not in seen:
                    existing[param].append(c)
                    seen.add(c["id"])
        else:
            existing[param] = new_chunks

    flat_chunks = _flatten_chunks(existing)

    return {
        "chunks_by_param": existing,
        "flat_chunks": flat_chunks,
        "retrieval_round": retrieval_round + 1,
    }


# ─── Node 3: reason ───────────────────────────────────────────────────────────

async def reason_node(state: PipelineState) -> dict:
    """
    Compliance Reasoner Agent: Claude with tool use.

    Receives the project parameters and retrieved normative chunks.
    Autonomously calls retrieve_regulation() for any parameter where
    the provided chunks are insufficient — a genuine ReAct agent loop.
    Produces structured VIOLATION / COMPLIANT / NEEDS_REVIEW / SIN_DATOS verdicts.
    """
    parsed = _deserialize_parsed(state)
    flat_chunks = state.get("flat_chunks", [])
    zone = state["zone"]

    compliance_results = await run_compliance_check(parsed, flat_chunks, zone)

    # Track which parameters got no normative data (to trigger graph-level retry)
    sin_datos = [
        r["parameter"]
        for r in compliance_results.get("results", [])
        if r.get("verdict") == "SIN_DATOS"
    ]

    return {
        "compliance_results": compliance_results,
        "sin_datos_params": sin_datos,
    }


# ─── Conditional edge: should we retry retrieval? ─────────────────────────────

def route_after_reason(state: PipelineState) -> Literal["retrieve", "generate"]:
    """
    Graph-level quality gate after the Compliance Reasoner.

    If more than 2 parameters returned SIN_DATOS and we haven't exceeded
    the retry limit, route back to the Retriever for a broader second pass.
    Otherwise proceed to report generation.

    Note: the Reasoner's built-in tool use already handles fine-grained
    per-parameter retrieval. This graph-level retry is a coarser safety net
    for cases where the initial retrieval returned zero chunks for many params.
    """
    sin_datos = state.get("sin_datos_params", [])
    retrieval_round = state.get("retrieval_round", 0)

    if len(sin_datos) > 2 and retrieval_round < 3:
        return "retrieve"
    return "generate"


# ─── Node 4: generate ─────────────────────────────────────────────────────────

async def generate_node(state: PipelineState) -> dict:
    """
    Report Generator: Claude drafts a full Acta de Observaciones
    in official DOM format using few-shot examples from real Actas.
    """
    acta_draft = await generate_acta(state["expedient"], state["compliance_results"])
    return {"acta_draft": acta_draft}


# ─── Node 5: save ─────────────────────────────────────────────────────────────

async def save_node(state: PipelineState) -> dict:
    """
    Persist all results to Supabase:
    - observations table (one row per parameter)
    - actas table (draft Acta text)
    - compliance_checks (status → completed)
    - expedients (status → en_revision)
    """
    expedient_id = state["expedient_id"]
    expedient = state["expedient"]
    check_id = state["check_id"]
    compliance_results = state["compliance_results"]
    acta_draft = state["acta_draft"]

    # Save per-parameter observations
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

    # Save draft Acta
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

    # Update compliance check status
    supabase.table("compliance_checks").update({
        "status": "completed",
        "ai_raw_output": compliance_results,
    }).eq("id", check_id).execute()

    # Update expedient status
    supabase.table("expedients").update({
        "status": "en_revision",
    }).eq("id", expedient_id).execute()

    return {}


# ─── Graph compilation ────────────────────────────────────────────────────────

def build_pipeline_graph():
    """Build and compile the LangGraph state machine."""
    workflow = StateGraph(PipelineState)

    # Register nodes
    workflow.add_node("load_and_parse", load_and_parse_node)
    workflow.add_node("retrieve", retrieve_node)
    workflow.add_node("reason", reason_node)
    workflow.add_node("generate", generate_node)
    workflow.add_node("save", save_node)

    # Entry point
    workflow.set_entry_point("load_and_parse")

    # Linear edges
    workflow.add_edge("load_and_parse", "retrieve")
    workflow.add_edge("retrieve", "reason")

    # Conditional edge: retry retrieval or proceed to generation
    workflow.add_conditional_edges(
        "reason",
        route_after_reason,
        {"retrieve": "retrieve", "generate": "generate"},
    )

    workflow.add_edge("generate", "save")
    workflow.add_edge("save", END)

    # Compile with in-memory checkpointing (state persisted per thread_id)
    return workflow.compile(checkpointer=MemorySaver())


# Singleton — compiled once at import time
pipeline_graph = build_pipeline_graph()
