"""
Data ingestion script — embeds normative chunks and stores them in Supabase pgvector.

Run once (or re-run after adding new documents):
  python3 scripts/ingest_data.py

Source priority (uses processed/ over seed/ when available):
  1. data/processed/oguc-chunks.json    (from parse_oguc.py)
  2. data/processed/prc-chunks.json     (from parse_prc.py)
  3. data/oguc/key-articles.json        (seed fallback)
  4. data/prc/zhr2.json                 (seed fallback)

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
    Load all chunks. Uses processed/ files when available, falls back to seed data.
    This means you can re-run ingest_data.py after adding new documents and it will
    automatically use the richer parsed data.
    """
    all_chunks = []

    # OGUC: prefer processed, fall back to seed
    oguc_processed = DATA_DIR / "processed" / "oguc-chunks.json"
    oguc_seed = DATA_DIR / "oguc" / "key-articles.json"
    oguc_path = oguc_processed if oguc_processed.exists() else oguc_seed
    with open(oguc_path) as f:
        data = json.load(f)
    chunks = data.get("chunks", [])
    all_chunks.extend(chunks)
    source_label = "processed (full OGUC)" if oguc_processed.exists() else "seed (key articles only)"
    print(f"OGUC: {len(chunks)} chunks from {source_label}")

    # PRC: prefer processed, fall back to seed
    prc_processed = DATA_DIR / "processed" / "prc-chunks.json"
    prc_seed = DATA_DIR / "prc" / "zhr2.json"
    prc_path = prc_processed if prc_processed.exists() else prc_seed
    with open(prc_path) as f:
        data = json.load(f)
    chunks = data.get("chunks", [])
    all_chunks.extend(chunks)
    source_label = "processed (full PRC)" if prc_processed.exists() else "seed (ZHR2 only)"
    print(f"PRC: {len(chunks)} chunks from {source_label}")

    return all_chunks


def ingest_chunks(chunks: list[dict], batch_size: int = 10) -> None:
    """Embed chunks and upsert into Supabase regulatory_chunks table."""
    print(f"\nIngesting {len(chunks)} chunks into Supabase...")

    for i in range(0, len(chunks), batch_size):
        batch = chunks[i:i + batch_size]
        records = []

        for chunk in batch:
            print(f"  Embedding: {chunk['id']}")

            # Embed the content
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

        # Upsert batch
        result = supabase.table("regulatory_chunks").upsert(records).execute()
        print(f"  Batch {i // batch_size + 1} upserted ({len(batch)} chunks)")

        # Small delay to avoid rate limits
        if i + batch_size < len(chunks):
            time.sleep(0.5)

    print("\nIngestion complete.")


def create_match_function() -> None:
    """
    Create the pgvector similarity search RPC function in Supabase.
    Run this once after creating the regulatory_chunks table.
    """
    sql = """
    CREATE OR REPLACE FUNCTION match_regulatory_chunks(
      query_embedding VECTOR(1536),
      match_threshold FLOAT DEFAULT 0.3,
      match_count INT DEFAULT 5,
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
    print("NOTE: Run the following SQL in your Supabase SQL Editor to create the match function:")
    print(sql)


if __name__ == "__main__":
    print("DOM Permit Review AI — Regulatory Data Ingestion")
    print("=" * 50)

    # Print the SQL function to create (user runs this in Supabase)
    create_match_function()
    print("\n" + "=" * 50)
    input("Press Enter after you've created the match function in Supabase...")

    # Load and ingest chunks
    chunks = load_chunks()
    print(f"\nTotal chunks to ingest: {len(chunks)}")
    ingest_chunks(chunks)
