"""
Data ingestion script — embeds normative chunks and stores them in Supabase pgvector.

Run once (or re-run after adding new documents):
  python3 scripts/ingest_data.py

Source priority (uses processed/ over seed/ when available):
  1. data/processed/oguc-chunks.json    (from parse_oguc.py)   → source: OGUC
  2. data/processed/lguc-chunks.json    (from parse_lguc.py)   → source: LGUC
  3. data/processed/prc-chunks.json     (from parse_prc.py)    → source: PRC_LAS_CONDES
  4. data/oguc/key-articles.json        (seed fallback for OGUC)
  5. data/prc/zhr2.json                 (seed fallback — DEPRECATED zone names)

NOTE on file naming (files were previously misnamed):
  - data/raw/oguc/OGUC.pdf = Ordenanza General (Decreto 47/1992), decimal articles
  - data/raw/lguc/LGUC.pdf = Ley General (DFL 458/1975), integer articles

Requires .env with OPENAI_API_KEY and SUPABASE_* vars set.
"""
import json
import sys
import time
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).parent.parent))

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


def load_chunks() -> list[dict]:
    """
    Load all chunks from OGUC, LGUC, and PRC sources.
    Uses processed/ files when available, falls back to seed data.
    """
    all_chunks = []

    # OGUC: prefer processed, fall back to seed
    oguc_processed = DATA_DIR / "processed" / "oguc-chunks.json"
    oguc_seed = DATA_DIR / "oguc" / "key-articles.json"
    oguc_path = oguc_processed if oguc_processed.exists() else (oguc_seed if oguc_seed.exists() else None)
    if oguc_path:
        with open(oguc_path) as f:
            data = json.load(f)
        chunks = data.get("chunks", [])
        all_chunks.extend(chunks)
        label = "processed (full OGUC)" if oguc_processed.exists() else "seed (key articles only)"
        print(f"OGUC: {len(chunks)} chunks from {label}")
    else:
        print("OGUC: no data file — run parse_oguc.py first")

    # LGUC: processed only (no seed fallback)
    lguc_processed = DATA_DIR / "processed" / "lguc-chunks.json"
    if lguc_processed.exists():
        with open(lguc_processed) as f:
            data = json.load(f)
        chunks = data.get("chunks", [])
        all_chunks.extend(chunks)
        print(f"LGUC: {len(chunks)} chunks from processed")
    else:
        print("LGUC: no processed file — skipping (run parse_lguc.py to add LGUC articles)")

    # PRC: prefer processed, fall back to seed
    prc_processed = DATA_DIR / "processed" / "prc-chunks.json"
    prc_seed = DATA_DIR / "prc" / "zhr2.json"
    if prc_processed.exists():
        with open(prc_processed) as f:
            data = json.load(f)
        chunks = data.get("chunks", [])
        all_chunks.extend(chunks)
        print(f"PRC: {len(chunks)} chunks from processed (Las Condes zone norms)")
    elif prc_seed.exists():
        with open(prc_seed) as f:
            data = json.load(f)
        chunks = data.get("chunks", [])
        all_chunks.extend(chunks)
        print(f"PRC: {len(chunks)} chunks from seed (DEPRECATED ZHR zone names)")
        print("     Run parse_prc.py to replace with correct E-Ab1/E-Aa1 zone names")
    else:
        print("PRC: no data file — run parse_prc.py first")

    return all_chunks


def get_existing_ids() -> set[str]:
    """Fetch all chunk IDs already in Supabase (for resume support)."""
    existing: set[str] = set()
    page_size = 1000
    offset = 0
    while True:
        result = (
            supabase.table("regulatory_chunks")
            .select("id")
            .range(offset, offset + page_size - 1)
            .execute()
        )
        rows = result.data or []
        for row in rows:
            existing.add(row["id"])
        if len(rows) < page_size:
            break
        offset += page_size
    return existing


def ingest_chunks(chunks: list[dict], batch_size: int = 10) -> None:
    """Embed chunks and upsert into Supabase regulatory_chunks table."""
    # Skip already-ingested chunks so we can resume interrupted runs
    existing_ids = get_existing_ids()
    pending = [c for c in chunks if c["id"] not in existing_ids]
    print(f"\n{len(existing_ids)} chunks already in Supabase, {len(pending)} remaining to ingest")

    if not pending:
        print("Nothing to do — all chunks already ingested.")
        return

    chunks = pending
    print(f"Ingesting {len(chunks)} chunks into Supabase...")

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        records = []

        for chunk in batch:
            print(f"  Embedding: {chunk['id']}")

            embedding = embed_text(chunk["content"])

            record = {
                "id": chunk["id"],
                "source": chunk["source"],
                "article": chunk.get("article"),
                "zone": chunk.get("zone"),
                "parameter_types": chunk.get("parameter_types", []),
                "title": chunk["title"],
                "content": chunk["content"],
                "article_reference": chunk.get("article_reference"),
                "embedding": embedding,
                "metadata": {
                    "zone_applicability": chunk.get("zone_applicability", []),
                },
            }
            records.append(record)

        result = supabase.table("regulatory_chunks").upsert(records).execute()
        print(f"  Batch {i // batch_size + 1} upserted ({len(batch)} chunks)")

        if i + batch_size < len(chunks):
            time.sleep(0.5)

    print("\nIngestion complete.")


def create_match_function() -> None:
    """Print the pgvector RPC SQL. Run once in Supabase SQL Editor."""
    sql = """
-- Run in Supabase SQL Editor:
CREATE OR REPLACE FUNCTION match_regulatory_chunks(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.25,
  match_count INT DEFAULT 10,
  filter_zone TEXT DEFAULT NULL
)
RETURNS TABLE (
  id TEXT,
  source TEXT,
  article TEXT,
  zone TEXT,
  parameter_types TEXT[],
  title TEXT,
  content TEXT,
  article_reference TEXT,
  similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
  SELECT
    rc.id,
    rc.source,
    rc.article,
    rc.zone,
    rc.parameter_types,
    rc.title,
    rc.content,
    rc.article_reference,
    1 - (rc.embedding <=> query_embedding) AS similarity
  FROM regulatory_chunks rc
  WHERE
    (filter_zone IS NULL OR rc.zone = filter_zone OR rc.zone IS NULL)
    AND 1 - (rc.embedding <=> query_embedding) > match_threshold
  ORDER BY rc.embedding <=> query_embedding
  LIMIT match_count;
$$;
"""
    print("NOTE: Run the following SQL in your Supabase SQL Editor:")
    print(sql)


if __name__ == "__main__":
    print("DOM Permit Review AI — Regulatory Data Ingestion")
    print("=" * 55)

    create_match_function()
    print("\n" + "=" * 55)
    input("Press Enter after you've updated the match function in Supabase...")

    chunks = load_chunks()

    # Deduplicate by id (last occurrence wins)
    seen: dict[str, dict] = {}
    for c in chunks:
        seen[c["id"]] = c
    chunks = list(seen.values())
    print(f"\nTotal chunks to ingest (after dedup): {len(chunks)}")

    if not chunks:
        print("No chunks to ingest. Run the parse scripts first:")
        print("  python3 scripts/parse_oguc.py")
        print("  python3 scripts/parse_lguc.py")
        print("  python3 scripts/parse_prc.py")
        sys.exit(1)

    ingest_chunks(chunks)
