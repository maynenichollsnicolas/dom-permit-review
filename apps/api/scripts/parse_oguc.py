"""
OGUC PDF Parser — extracts articles from the official OGUC PDF and
saves them as structured JSON chunks ready for embedding.

Usage:
    python3 scripts/parse_oguc.py --input data/raw/oguc/OGUC-2024.pdf

Output:
    data/processed/oguc-chunks.json

The OGUC uses article numbering like "Artículo 1.4.4." or "ARTÍCULO 2.5.3."
Each article becomes one or more chunks depending on length.
Max chunk size: 800 tokens (to stay well within embedding model limits).
"""
import argparse
import json
import re
import sys
from pathlib import Path

import pdfplumber
import tiktoken

# Token counter for chunk size management
enc = tiktoken.get_encoding("cl100k_base")

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

# Regex to detect article boundaries in the OGUC
ARTICLE_PATTERN = re.compile(
    r"(?:Artículo|ARTÍCULO|Art\.)\s+(\d+\.\d+(?:\.\d+)?)\s*[.–-]?\s*(.{0,120}?)(?:\n|\.)",
    re.IGNORECASE,
)

# Parameter type mapping — which articles relate to which parameters
ARTICLE_PARAM_MAP = {
    "1.4.4": ["cip"],
    "2.1.28": ["altura"],
    "2.4.1": ["estacionamientos"],
    "2.4.2": ["estacionamientos"],
    "2.5.1": ["distanciamiento"],
    "2.5.3": ["distanciamiento"],
    "2.5.6": ["rasante"],
    "2.6.1": ["constructibilidad", "ocupacion_suelo"],
    "2.6.3": ["ocupacion_suelo"],
    "2.6.4": ["constructibilidad"],
    "4.1.10": ["acondicionamiento_termico"],
    "5.1.6": ["expediente", "documentacion"],
    "5.1.7": ["estructura", "documentacion"],
    "5.2.5": ["recepcion_definitiva"],
    "5.2.6": ["recepcion_definitiva"],
    "1.4.9": ["acta_observaciones"],
}


def count_tokens(text: str) -> int:
    return len(enc.encode(text))


def split_into_chunks(article_num: str, title: str, content: str, max_tokens: int = 800) -> list[dict]:
    """Split a long article into multiple chunks, each under max_tokens."""
    full_text = f"{title}\n\n{content}" if title else content

    if count_tokens(full_text) <= max_tokens:
        return [{
            "id": f"oguc-{article_num.replace('.', '-')}",
            "source": "OGUC",
            "article": article_num,
            "title": title or f"Artículo {article_num}",
            "content": full_text.strip(),
            "article_reference": f"OGUC art. {article_num}",
            "parameter_types": ARTICLE_PARAM_MAP.get(article_num, []),
            "zone_applicability": ["all"],
        }]

    # Split by paragraphs
    paragraphs = [p.strip() for p in content.split("\n\n") if p.strip()]
    chunks = []
    current = []
    current_tokens = count_tokens(title)

    for para in paragraphs:
        para_tokens = count_tokens(para)
        if current_tokens + para_tokens > max_tokens and current:
            chunk_idx = len(chunks) + 1
            chunks.append({
                "id": f"oguc-{article_num.replace('.', '-')}-p{chunk_idx}",
                "source": "OGUC",
                "article": article_num,
                "title": f"{title} (parte {chunk_idx})" if title else f"Artículo {article_num} (parte {chunk_idx})",
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
        chunks.append({
            "id": f"oguc-{article_num.replace('.', '-')}-p{chunk_idx}" if chunks else f"oguc-{article_num.replace('.', '-')}",
            "source": "OGUC",
            "article": article_num,
            "title": title or f"Artículo {article_num}",
            "content": (title + "\n\n" + "\n\n".join(current)).strip(),
            "article_reference": f"OGUC art. {article_num}",
            "parameter_types": ARTICLE_PARAM_MAP.get(article_num, []),
            "zone_applicability": ["all"],
        })

    return chunks


def extract_articles_from_pdf(pdf_path: Path) -> list[dict]:
    """Extract all articles from the OGUC PDF."""
    print(f"Opening {pdf_path.name}...")

    full_text = ""
    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text:
                full_text += text + "\n"
            if (i + 1) % 50 == 0:
                print(f"  Read {i + 1}/{total} pages...")

    print(f"Extracted {len(full_text):,} characters from PDF")

    # Find all article positions
    matches = list(ARTICLE_PATTERN.finditer(full_text))
    print(f"Found {len(matches)} articles")

    articles = []
    for i, match in enumerate(matches):
        article_num = match.group(1).strip()
        title = match.group(2).strip().rstrip(".")

        # Content is from this match to the next
        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        content = full_text[start:end].strip()

        # Skip very short articles (likely false matches)
        if len(content) < 50:
            continue

        chunks = split_into_chunks(article_num, title, content)
        articles.extend(chunks)

    return articles


def parse_oguc(input_path: Path, output_path: Path) -> None:
    chunks = extract_articles_from_pdf(input_path)

    print(f"\nGenerated {len(chunks)} chunks")
    print(f"Token counts: min={min(count_tokens(c['content']) for c in chunks)}, "
          f"max={max(count_tokens(c['content']) for c in chunks)}, "
          f"avg={sum(count_tokens(c['content']) for c in chunks) // len(chunks)}")

    output = {
        "_meta": {
            "source": "OGUC — Ordenanza General de Urbanismo y Construcciones",
            "version": "DS 22, D.O. 16.04.2024",
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
    parser.add_argument("--input", default="data/raw/oguc/OGUC-2024.pdf", help="Path to OGUC PDF")
    parser.add_argument("--output", default="data/processed/oguc-chunks.json", help="Output JSON path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"ERROR: File not found: {input_path}")
        print("Download the OGUC PDF from minvu.gob.cl and place it at:")
        print(f"  {input_path.resolve()}")
        sys.exit(1)

    parse_oguc(input_path, output_path)
