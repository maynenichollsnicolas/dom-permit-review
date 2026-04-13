"""
Regulatory Retriever — retrieves normative chunks from Supabase pgvector.

Two retrieval strategies:
  1. Direct metadata query — for PRC zone-specific parameters (exact match, no embedding).
     Fast and precise: "give me constructibilidad for zone E-Ab1".
  2. Semantic vector search — for OGUC/LGUC content (semantic similarity).
     Needed because OGUC articles cover broad topics, not single parameters.

For a compliance check, use retrieve_for_compliance_check() which combines both.
"""
from __future__ import annotations

from typing import Optional

from openai import OpenAI
from supabase import create_client

from config import settings

openai_client = OpenAI(api_key=settings.openai_api_key)
supabase = create_client(settings.supabase_url, settings.supabase_service_key)


def embed_text(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


# ─── Strategy 1: Direct metadata query (PRC) ─────────────────────────────────

def retrieve_prc_direct(
    zone: str,
    parameter_types: Optional[list[str]] = None,
) -> list[dict]:
    """
    Retrieve PRC chunks for a specific zone via exact metadata match.
    No embedding needed — the PRC has one chunk per zone/parameter combination.

    Example: retrieve_prc_direct("E-Ab1", ["constructibilidad", "altura"])
    """
    query = (
        supabase.table("regulatory_chunks")
        .select("id, source, article, zone, parameter_types, title, content, article_reference")
        .eq("source", "PRC_LAS_CONDES")
        .eq("zone", zone)
    )

    result = query.execute()
    chunks = result.data or []

    if parameter_types:
        chunks = [
            c for c in chunks
            if any(pt in (c.get("parameter_types") or []) for pt in parameter_types)
        ]

    return chunks


def retrieve_prc_general(parameter_types: Optional[list[str]] = None) -> list[dict]:
    """
    Retrieve general PRC articles (zone=null) — antejardines, estacionamientos, etc.
    """
    query = (
        supabase.table("regulatory_chunks")
        .select("id, source, article, zone, parameter_types, title, content, article_reference")
        .eq("source", "PRC_LAS_CONDES")
        .is_("zone", "null")
    )
    result = query.execute()
    chunks = result.data or []

    if parameter_types:
        chunks = [
            c for c in chunks
            if any(pt in (c.get("parameter_types") or []) for pt in parameter_types)
        ]

    return chunks


# ─── Strategy 2: Semantic vector search (OGUC / LGUC) ────────────────────────

def retrieve_semantic(
    query: str,
    sources: list[str],
    parameter_types: Optional[list[str]] = None,
    k: int = 5,
    similarity_threshold: float = 0.25,
) -> list[dict]:
    """
    Semantic vector search filtered to specific source(s).
    Use for OGUC and LGUC where full-text semantic matching is needed.
    """
    query_embedding = embed_text(query)

    result = supabase.rpc(
        "match_regulatory_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": similarity_threshold,
            "match_count": k * 2,  # Fetch extra to filter by source
            "filter_zone": None,
        },
    ).execute()

    chunks = result.data or []

    # Filter by source
    chunks = [c for c in chunks if c.get("source") in sources]

    # Filter by parameter_type
    if parameter_types:
        chunks = [
            c for c in chunks
            if any(pt in (c.get("parameter_types") or []) for pt in parameter_types)
        ]

    return chunks[:k]


# ─── Combined compliance retrieval ────────────────────────────────────────────

def retrieve_for_compliance_check(
    parameters: list[str],
    zone: str,
    include_sources: list[str] | None = None,
) -> dict[str, list[dict]]:
    """
    Per-parameter retrieval for compliance checks.

    For each parameter:
      - PRC: direct metadata query (zone + parameter_type)
      - OGUC: semantic search with parameter_type hint
      - LGUC: semantic search for procedural parameters

    Returns: {parameter_type: [chunks]}

    Example:
        chunks = retrieve_for_compliance_check(
            parameters=["constructibilidad", "altura", "documentacion"],
            zone="E-Ab1",
        )
    """
    if include_sources is None:
        include_sources = ["PRC_LAS_CONDES", "OGUC", "LGUC"]

    result: dict[str, list[dict]] = {}

    for param in parameters:
        param_chunks: list[dict] = []

        if "PRC_LAS_CONDES" in include_sources:
            prc_chunks = retrieve_prc_direct(zone, parameter_types=[param])
            if not prc_chunks:
                # Also try general PRC articles (zone-independent rules)
                prc_chunks = retrieve_prc_general(parameter_types=[param])
            param_chunks.extend(prc_chunks)

        if "OGUC" in include_sources:
            oguc_chunks = retrieve_semantic(
                query=f"{param} norma urbanística OGUC",
                sources=["OGUC"],
                parameter_types=[param],
                k=3,
            )
            param_chunks.extend(oguc_chunks)

        if "LGUC" in include_sources:
            # LGUC mainly relevant for procedural parameters
            procedural_params = {
                "documentacion", "expediente", "acta_observaciones",
                "silencio_administrativo", "permiso_edificacion",
            }
            if param in procedural_params:
                lguc_chunks = retrieve_semantic(
                    query=f"{param} LGUC procedimiento",
                    sources=["LGUC"],
                    parameter_types=[param],
                    k=2,
                )
                param_chunks.extend(lguc_chunks)

        # Deduplicate by chunk id
        seen: set[str] = set()
        deduped: list[dict] = []
        for c in param_chunks:
            if c["id"] not in seen:
                seen.add(c["id"])
                deduped.append(c)

        result[param] = deduped

    return result


# ─── Legacy / convenience functions ──────────────────────────────────────────

def retrieve_chunks(
    query: str,
    zone: str = "E-Ab1",
    parameter_types: Optional[list[str]] = None,
    k: int = 5,
    similarity_threshold: float = 0.25,
) -> list[dict]:
    """
    Single semantic query across all sources.
    For backward compatibility — prefer retrieve_for_compliance_check() for new code.
    """
    query_embedding = embed_text(query)

    result = supabase.rpc(
        "match_regulatory_chunks",
        {
            "query_embedding": query_embedding,
            "match_threshold": similarity_threshold,
            "match_count": k,
            "filter_zone": zone,
        },
    ).execute()

    chunks = result.data or []

    if parameter_types:
        chunks = [
            c for c in chunks
            if any(pt in (c.get("parameter_types") or []) for pt in parameter_types)
        ]

    return chunks


def retrieve_all_zone_chunks(zone: str) -> list[dict]:
    """Load all chunks for a zone (PRC direct + general PRC articles)."""
    prc_zone = retrieve_prc_direct(zone)
    prc_general = retrieve_prc_general()
    return prc_zone + prc_general


def format_chunks_for_prompt(chunks: list[dict]) -> str:
    """Format retrieved chunks into a structured string for the LLM prompt."""
    if not chunks:
        return "No normative chunks retrieved."

    lines = []
    for chunk in chunks:
        lines.append(f"[{chunk['id']}] {chunk['title']}")
        lines.append(f"Source: {chunk['source']} — {chunk.get('article_reference', chunk.get('article', ''))}")
        lines.append(chunk["content"])
        lines.append("")

    return "\n".join(lines)


def format_compliance_chunks_for_prompt(chunks_by_param: dict[str, list[dict]]) -> str:
    """
    Format per-parameter chunks dict into a structured prompt section.
    Groups chunks by parameter for clear LLM consumption.
    """
    if not chunks_by_param:
        return "No normative chunks retrieved."

    sections = []
    for param, chunks in chunks_by_param.items():
        if not chunks:
            continue
        section_lines = [f"=== {param.upper()} ==="]
        for chunk in chunks:
            section_lines.append(f"[{chunk['id']}] {chunk['title']}")
            section_lines.append(f"  Fuente: {chunk['source']} — {chunk.get('article_reference', '')}")
            section_lines.append(f"  {chunk['content'][:400]}")
        sections.append("\n".join(section_lines))

    return "\n\n".join(sections)
