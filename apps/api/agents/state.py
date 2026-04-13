"""
LangGraph State — shared state object for the DOM permit review pipeline.
Each node reads from and writes to this TypedDict.
"""
from __future__ import annotations

from typing import Optional
from typing_extensions import TypedDict


class PipelineState(TypedDict, total=False):
    # ── Input ──────────────────────────────────────────────────────────────────
    expedient_id: str

    # ── Loaded from DB (load_and_parse node) ───────────────────────────────────
    expedient: dict
    params_row: dict
    check_id: str

    # ── Input Parser output ────────────────────────────────────────────────────
    # Serialized ParamDelta list (dataclass → dict for JSON checkpointing)
    parsed_deltas: list[dict]   # [{parameter, cip_value, declared_value, delta, status, label}]
    parameters: list[str]       # parameter keys to check
    zone: str

    # ── Retriever output (updated each round) ──────────────────────────────────
    chunks_by_param: dict       # {param: [chunk, ...]}
    flat_chunks: list[dict]     # deduplicated flat list for the Reasoner
    retrieval_round: int        # 0 on first pass, incremented on each retry

    # ── Compliance Reasoner output ─────────────────────────────────────────────
    compliance_results: dict    # {"results": [{parameter, verdict, confidence, ...}]}
    sin_datos_params: list[str] # params where Reasoner returned SIN_DATOS (triggers retry)

    # ── Report Generator output ────────────────────────────────────────────────
    acta_draft: dict            # {acta_text, observations, has_observations}

    # ── Error state ────────────────────────────────────────────────────────────
    error: Optional[str]
