"""
Data ingestion script — embeds normative chunks and stores them in Supabase pgvector.

Run once to seed the regulatory_chunks table:
  python3 scripts/ingest_data.py

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
    """Load all chunks from data/ JSON files."""
    all_chunks = []

    sources = [
        DATA_DIR / "oguc" / "key-articles.json",
        DATA_DIR / "prc" / "zhr2.json",
    ]

    for path in sources:
        with open(path) as f:
            data = json.load(f)
        chunks = data.get("chunks", [])
        all_chunks.extend(chunks)
        print(f"Loaded {len(chunks)} chunks from {path.name}")

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
