"""
LGUC PDF Parser — extracts articles from the Ley General de Urbanismo y Construcciones
(DFL 458/1975, Decreto 458 VIVIENDA).

Input file: data/raw/lguc/LGUC.pdf
  (NOTE: the file formerly named OGUC-2024.pdf is the LGUC — DFL 458/1975.
         Article numbers are integers: Artículo 1°, Artículo 116°, etc.)

Usage:
    python3 scripts/parse_lguc.py
    python3 scripts/parse_lguc.py --input data/raw/lguc/LGUC.pdf

Output:
    data/processed/lguc-chunks.json

Key LGUC articles for permit review (DOM process):
  - Art. 116°: Permisos de edificación (building permit requirement)
  - Art. 118°: Expedient documents
  - Art. 119°: Observations / Acta de Observaciones
  - Art. 120°: Silencio administrativo negativo (60-day rule)
  - Art. 143°: Certificate of conformity
  - Art. 144°: Final reception (Recepción Definitiva)
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

# Integer article pattern for LGUC: "Artículo 116°.-" or "Artículo 116."
ARTICLE_PATTERN = re.compile(
    r"Artículo\s+(\d{1,3})°?\s*[.–\-]\s*(.{0,150}?)(?:\n|\.\s)",
    re.IGNORECASE,
)

# Maps LGUC article numbers → compliance parameter_types
ARTICLE_PARAM_MAP = {
    # Planning instruments
    "55": ["subdivision", "rural"],
    "56": ["subdivision", "urban"],
    "57": ["urbanizacion"],
    "58": ["urbanizacion"],
    "65": ["zona_uso_suelo"],
    # Building permits — CORE for DOM review
    "116": ["permiso_edificacion", "expediente"],
    "117": ["permiso_edificacion", "expediente"],
    "118": ["permiso_edificacion", "documentacion"],
    "119": ["acta_observaciones", "observaciones"],
    "120": ["silencio_administrativo", "plazo"],
    # Certificados
    "116": ["cip", "expediente"],
    "143": ["certificado_conformidad"],
    "144": ["recepcion_definitiva"],
    "145": ["recepcion_definitiva"],
    # Obras menores
    "123": ["obra_menor"],
    "124": ["obra_menor"],
    # Infractions
    "157": ["infraccion"],
    "158": ["infraccion"],
}


def count_tokens(text: str) -> int:
    return len(enc.encode(text))


def split_into_chunks(article_num: str, title: str, content: str, max_tokens: int = 800) -> list[dict]:
    full_text = f"{title}\n\n{content}" if title else content

    if count_tokens(full_text) <= max_tokens:
        return [{
            "id": f"lguc-art-{article_num}",
            "source": "LGUC",
            "article": article_num,
            "title": title or f"Artículo {article_num} LGUC",
            "content": full_text.strip(),
            "article_reference": f"LGUC art. {article_num}",
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
            chunks.append({
                "id": f"lguc-art-{article_num}-p{chunk_idx}",
                "source": "LGUC",
                "article": article_num,
                "title": f"{title} (parte {chunk_idx})",
                "content": (title + "\n\n" + "\n\n".join(current)).strip(),
                "article_reference": f"LGUC art. {article_num}",
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
            f"lguc-art-{article_num}-p{chunk_idx}"
            if chunks
            else f"lguc-art-{article_num}"
        )
        chunks.append({
            "id": chunk_id,
            "source": "LGUC",
            "article": article_num,
            "title": title or f"Artículo {article_num} LGUC",
            "content": (title + "\n\n" + "\n\n".join(current)).strip(),
            "article_reference": f"LGUC art. {article_num}",
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
            if (i + 1) % 30 == 0:
                print(f"  Read {i + 1}/{total} pages...")

    print(f"Extracted {len(full_text):,} characters")

    matches = list(ARTICLE_PATTERN.finditer(full_text))
    print(f"Found {len(matches)} article matches")

    chunks = []
    seen_ids: set[str] = set()

    for i, match in enumerate(matches):
        article_num = match.group(1).strip()
        title_raw = match.group(2).strip().rstrip(".")
        title = f"Artículo {article_num}° LGUC. {title_raw}" if title_raw else f"Artículo {article_num}° LGUC"

        start = match.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(full_text)
        content = full_text[start:end].strip()

        if len(content) < 30:
            continue

        for chunk in split_into_chunks(article_num, title, content):
            if chunk["id"] not in seen_ids:
                seen_ids.add(chunk["id"])
                chunks.append(chunk)

    return chunks


def parse_lguc(input_path: Path, output_path: Path) -> None:
    chunks = extract_articles_from_pdf(input_path)

    if not chunks:
        print("ERROR: No chunks extracted. Check the PDF.")
        sys.exit(1)

    token_counts = [count_tokens(c["content"]) for c in chunks]
    print(f"\nGenerated {len(chunks)} chunks")
    print(f"Tokens — min:{min(token_counts)}, max:{max(token_counts)}, avg:{sum(token_counts)//len(token_counts)}")

    output = {
        "_meta": {
            "source": "LGUC — Ley General de Urbanismo y Construcciones (DFL 458/1975)",
            "note": "Integer article numbering: Artículo 116°, Artículo 120°, etc.",
            "parsed_from": input_path.name,
            "total_chunks": len(chunks),
        },
        "chunks": chunks,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"Saved to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse LGUC PDF into article chunks")
    parser.add_argument("--input", default="data/raw/lguc/LGUC.pdf", help="Path to LGUC PDF (DFL 458)")
    parser.add_argument("--output", default="data/processed/lguc-chunks.json", help="Output JSON path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"ERROR: File not found: {input_path}")
        print("Expected: data/raw/lguc/LGUC.pdf (DFL 458 — Ley General de Urbanismo)")
        print("NOTE: The file formerly at data/raw/oguc/OGUC-2024.pdf has been moved here.")
        sys.exit(1)

    parse_lguc(input_path, output_path)
