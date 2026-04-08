"""
Regulatory Retriever — loads normative chunks and retrieves relevant ones
via pgvector similarity search.

For each query, embeds the query text with OpenAI and returns the top-k
most similar regulatory chunks from Supabase.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from openai import OpenAI
from supabase import create_client

from config import settings

openai_client = OpenAI(api_key=settings.openai_api_key)
supabase = create_client(settings.supabase_url, settings.supabase_service_key)

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"


def embed_text(text: str) -> list[float]:
    response = openai_client.embeddings.create(
        model=settings.embedding_model,
        input=text,
    )
    return response.data[0].embedding


def retrieve_chunks(
    query: str,
    zone: str = "ZHR2",
    parameter_types: Optional[list[str]] = None,
    k: int = 5,
    similarity_threshold: float = 0.3,
) -> list[dict]:
    """
    Retrieve top-k normative chunks most relevant to the query.
    Filters by zone (or 'all') and optionally by parameter_type.
    Returns chunks with similarity score.
    """
    query_embedding = embed_text(query)

    # Use Supabase RPC for pgvector similarity search
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

    # Filter by parameter_type if specified
    if parameter_types:
        chunks = [
            c for c in chunks
            if any(pt in (c.get("parameter_types") or []) for pt in parameter_types)
        ]

    return chunks


def retrieve_all_zone_chunks(zone: str = "ZHR2") -> list[dict]:
    """
    Load all normative chunks relevant to a given zone.
    Used for the MVP context-stuffing approach alongside vector search.
    Returns all chunks where zone matches or zone_applicability is 'all'.
    """
    result = (
        supabase.table("regulatory_chunks")
        .select("*")
        .or_(f"zone.eq.{zone},zone.is.null")
        .execute()
    )
    return result.data or []


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
