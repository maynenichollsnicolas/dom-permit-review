"""
OGUC PDF Parser — extracts articles from the official OGUC (Ordenanza General de
Urbanismo y Construcciones, Decreto 47/1992).

Input file: data/raw/oguc/OGUC.pdf
  (NOTE: the file formerly named LGUC.pdf is the OGUC — Decreto 47/1992,
         Última Versión 16-MAR-2026. Article numbers follow decimal format: 1.1.1, 5.1.6, etc.)

Usage:
    python3 scripts/parse_oguc.py
    python3 scripts/parse_oguc.py --input data/raw/oguc/OGUC.pdf

Output:
    data/processed/oguc-chunks.json

Each article becomes one or more chunks (max 800 tokens).
"""
import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber
import tiktoken

enc = tiktoken.get_encoding("cl100k_base")

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

# Decimal article pattern: "Artículo 1.4.9." or "ARTÍCULO 2.5.3."
ARTICLE_PATTERN = re.compile(
    r"(?:Artículo|ARTÍCULO|Art\.)\s+(\d+\.\d+(?:\.\d+)?)\s*[.–\-]?\s*(.{0,150}?)(?:\n|\.\s)",
    re.IGNORECASE,
)

# Maps OGUC article numbers → compliance parameter_types
ARTICLE_PARAM_MAP = {
    # Procedural
    "1.1.1": ["general"],
    "1.4.4": ["cip"],
    "1.4.9": ["acta_observaciones"],
    "1.4.10": ["silencio_administrativo"],
    # Urban parameters
    "2.1.12": ["uso_suelo"],
    "2.1.17": ["uso_suelo"],
    "2.1.28": ["altura"],
    "2.4.1": ["estacionamientos"],
    "2.4.2": ["estacionamientos"],
    "2.5.1": ["distanciamiento"],
    "2.5.3": ["distanciamiento"],
    "2.5.6": ["rasante"],
    "2.5.7": ["rasante"],
    "2.6.1": ["constructibilidad", "ocupacion_suelo"],
    "2.6.2": ["adosamiento", "distanciamiento"],
    "2.6.3": ["ocupacion_suelo"],
    "2.6.4": ["constructibilidad"],
    "2.7.1": ["antejardin"],
    # Construction
    "4.1.10": ["acondicionamiento_termico"],
    "4.3.1": ["resistencia_fuego"],
    "4.3.3": ["resistencia_fuego"],
    "4.3.4": ["resistencia_fuego"],
    "4.3.5": ["resistencia_fuego"],
    "4.3.6": ["resistencia_fuego"],
    # Permit requirements
    "5.1.4": ["expediente", "documentacion"],
    "5.1.6": ["expediente", "documentacion"],
    "5.1.7": ["estructura", "documentacion"],
    "5.1.10": ["planos", "documentacion"],
    "5.1.11": ["planos", "documentacion"],
    "5.1.12": ["planos", "documentacion"],
    "5.1.17": ["accesibilidad", "documentacion"],
    "5.1.18": ["accesibilidad"],
    "5.1.20": ["documentacion"],
    "5.2.5": ["recepcion_definitiva"],
    "5.2.6": ["recepcion_definitiva"],
}


def count_tokens(text: str) -> int:
    return len(enc.encode(text))


EMBED_MAX_TOKENS = 7500  # OpenAI text-embedding-3-small hard limit is 8191


def truncate_to_tokens(text: str, max_tokens: int = EMBED_MAX_TOKENS) -> str:
    """Truncate text to max_tokens, keeping full sentences where possible."""
    tokens = enc.encode(text)
    if len(tokens) <= max_tokens:
        return text
    truncated_tokens = tokens[:max_tokens]
    return enc.decode(truncated_tokens)


def split_into_chunks(article_num: str, title: str, content: str, max_tokens: int = 800) -> list[dict]:
    full_text = f"{title}\n\n{content}" if title else content

    if count_tokens(full_text) <= max_tokens:
        return [{
            "id": f"oguc-{article_num.replace('.', '-')}",
            "source": "OGUC",
            "article": article_num,
            "title": title or f"Artículo {article_num} OGUC",
            "content": full_text.strip(),
            "article_reference": f"OGUC art. {article_num}",
            "parameter_types": ARTICLE_PARAM_MAP.get(article_num, []),
            "zone_applicability": ["all"],
        }]

    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    chunks = []
    current: list[str] = []
    current_tokens = count_tokens(title)

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if current_tokens + para_tokens > max_tokens and current:
            chunk_idx = len(chunks) + 1
            chunk_id = f"oguc-{article_num.replace('.', '-')}-p{chunk_idx}"
            chunks.append({
                "id": chunk_id,
                "source": "OGUC",
                "article": article_num,
                "title": f"{title} (parte {chunk_idx})" if title else f"Artículo {article_num} OGUC (parte {chunk_idx})",
                "content": (title + "\n\n" + "\n\n".join(current)).strip(),
                "article_reference": f"OGUC art. {article_num}",
                "parameter_types": ARTICLE_PARAM_MAP.get(article_num, []),
                "zone_applicability": ["all"],
            })
            current = [para]
            current_tokens = count_tokens(para)
        else:
            current.append(para)
            current_tokens += para_tokens

    if current:
        chunk_idx = len(chunks) + 1
        chunk_id = (
            f"oguc-{article_num.replace('.', '-')}-p{chunk_idx}"
            if chunks
            else f"oguc-{article_num.replace('.', '-')}"
        )
        chunks.append({
            "id": chunk_id,
            "source": "OGUC",
            "article": article_num,
            "title": title or f"Artículo {article_num} OGUC",
            "content": (title + "\n\n" + "\n\n".join(current)).strip(),
            "article_reference": f"OGUC art. {article_num}",
            "parameter_types": ARTICLE_PARAM_MAP.get(article_num, []),
            "zone_applicability": ["all"],
        })

    return chunks


def extract_articles_from_pdf(pdf_path: Path) -> list[dict]:
    print(f"Opening {pdf_path.name} ...")
    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                full_text += text + "\n"
            if (i + 1) % 50 == 0:
                print(f"  Read {i + 1}/{total} pages...")

    print(f"Extracted {len(full_text):,} characters")

    matches = list(ARTICLE_PATTERN.finditer(full_text))
    print(f"Found {len(matches)} article matches")

    chunks = []
    seen_ids: set[str] = set()

    for i, match in enumerate(matches):
        article_num = match.group(1).strip()
        title_raw = match.group(2).strip().rstrip(".")
        title = f"Artículo {article_num} OGUC. {title_raw}" if title_raw else f"Artículo {article_num} OGUC"

        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        content = full_text[start:end].strip()

        if len(content) < 30:
            continue

        for chunk in split_into_chunks(article_num, title, content):
            if chunk["id"] not in seen_ids:
                seen_ids.add(chunk["id"])
                # Hard-cap content for embedding model (8191 token limit)
                chunk["content"] = truncate_to_tokens(chunk["content"])
                chunks.append(chunk)

    return chunks


def parse_oguc(input_path: Path, output_path: Path) -> None:
    chunks = extract_articles_from_pdf(input_path)

    if not chunks:
        print("ERROR: No chunks extracted. Check the PDF.")
        sys.exit(1)

    token_counts = [count_tokens(c["content"]) for c in chunks]
    print(f"\nGenerated {len(chunks)} chunks")
    print(f"Tokens — min:{min(token_counts)}, max:{max(token_counts)}, avg:{sum(token_counts)//len(token_counts)}")

    output = {
        "_meta": {
            "source": "OGUC — Ordenanza General de Urbanismo y Construcciones (Decreto 47/1992)",
            "note": "Decimal article numbering: 1.1.1, 5.1.6, etc.",
            "parsed_from": input_path.name,
            "total_chunks": len(chunks),
        },
        "chunks": chunks,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Saved to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse OGUC PDF into article chunks")
    parser.add_argument("--input", default="data/raw/oguc/OGUC.pdf", help="Path to OGUC PDF (Decreto 47)")
    parser.add_argument("--output", default="data/processed/oguc-chunks.json", help="Output JSON path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"ERROR: File not found: {input_path}")
        print("Expected: data/raw/oguc/OGUC.pdf (Decreto 47 — Ordenanza General)")
        sys.exit(1)

    parse_oguc(input_path, output_path)
