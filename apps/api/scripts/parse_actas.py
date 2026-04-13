"""
Actas de Observaciones Parser — processes real Actas from Chilean DOM offices
and converts them into structured examples for few-shot prompting.

Accepts:
  - PDF files (text-extractable: vitacura, etc.)
  - PDF files (scanned/image-based: conchali, paine, cabildo — uses Claude Vision)
  - PNG / JPG image files (scanned pages — uses Claude Vision)
  - .md files (Scribd-extracted text — strips UI boilerplate, parses text)
  - .txt files (plain text)

Usage:
    python3 scripts/parse_actas.py
    python3 scripts/parse_actas.py --input data/raw/actas/

Output:
    data/processed/actas-examples.json

Two Acta formats exist in the wild:
  1. Free-text: numbered observations with article citations (e.g. Vitacura, Pucón)
  2. Checklist (Formulario 5.12): C/NC/NA columns per normative item (e.g. Conchalí)
Claude handles both formats via the extraction prompt.
"""
import argparse
import base64
import json
import re
import sys
from pathlib import Path

import anthropic
import pdfplumber

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

# --- Scribd boilerplate detection ---
SCRIBD_BOILERPLATE_END_MARKERS = [
    "You are on page",
    "Fullscreen",
    "Search\nZoom",
]

EXTRACT_PROMPT = """Analiza este documento de Acta de Observaciones de la Dirección de Obras Municipales chilena.

DOCUMENTO:
{acta_text}

Extrae EXACTAMENTE la siguiente información en JSON válido. Si un campo no está disponible, usa null.

{{
  "municipality": "nombre del municipio",
  "expedient_ref": "número del expediente o solicitud",
  "date": "fecha del acta en formato DD/MM/YYYY o null",
  "project_type": "tipo de proyecto (Obra Nueva, Alteración, Ampliación, etc.)",
  "zone": "zona urbanística si se menciona (ej: E-Ab1, E-Aa1, ZHR2) o null",
  "round": 1,
  "format": "free_text o checklist",
  "full_text": "texto principal del acta (sin boilerplate)",
  "observations": [
    {{
      "number": 1,
      "parameter": "nombre_parametro_en_snake_case",
      "verdict": "VIOLATION",
      "declared_value": "valor declarado con unidades o null",
      "allowed_value": "valor permitido con unidades o null",
      "article": "artículo normativo citado (ej: Art. 5.1.6 OGUC)",
      "text": "texto exacto de la observación"
    }}
  ]
}}

Para "parameter" usa snake_case: altura, constructibilidad, ocupacion_suelo, densidad,
estacionamientos, distanciamiento_lateral, distanciamiento_fondo, antejardin, rasante,
documentacion, estructura, accesibilidad, resistencia_fuego, uso_suelo, u otro nombre descriptivo.

Para "format":
- "free_text": observaciones numeradas en prosa (el formato más común)
- "checklist": tabla con columnas C/NC/NA (Formulario 5.12 completo)

Responde SOLO con el JSON, sin texto adicional.
"""


# ─── Text extraction ──────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: Path) -> str:
    """Try to extract text from PDF. Returns empty string if scanned/image-based."""
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def is_scanned_pdf(pdf_path: Path) -> bool:
    """Return True if PDF has no extractable text (scanned)."""
    text = extract_text_from_pdf(pdf_path)
    return len(text) < 50


def strip_scribd_boilerplate(md_text: str) -> str:
    """Remove Scribd navigation UI boilerplate from .md files."""
    # Everything before "You are on page X" is UI boilerplate
    for marker in SCRIBD_BOILERPLATE_END_MARKERS:
        idx = md_text.find(marker)
        if idx != -1:
            # Skip past the marker line
            newline_after = md_text.find("\n", idx)
            if newline_after != -1:
                md_text = md_text[newline_after:].strip()
            break

    # Remove trailing Scribd footer patterns
    footer_patterns = [
        r"\n(?:Share|Print|Embed|Ask AI|Report)\n.*",
        r"\nUpload.*",
        r"\nSign in.*",
        r"Download free for 30 days.*",
        r"\[1\]\s*$",  # footnote markers
    ]
    for pattern in footer_patterns:
        md_text = re.sub(pattern, "", md_text, flags=re.DOTALL)

    return md_text.strip()


def extract_text_from_file(file_path: Path) -> str | None:
    """Extract text from .md, .txt, or digital PDF. Returns None for images/scanned PDFs."""
    suffix = file_path.suffix.lower()

    if suffix == ".pdf":
        if is_scanned_pdf(file_path):
            return None  # Caller will use Vision
        return extract_text_from_pdf(file_path)

    if suffix in (".md", ".txt"):
        raw = file_path.read_text(encoding="utf-8")
        if suffix == ".md" and "scribd.com" in file_path.name.lower():
            return strip_scribd_boilerplate(raw)
        return raw

    return None  # Image files — caller uses Vision


# ─── Vision API extraction ────────────────────────────────────────────────────

def encode_image_base64(image_path: Path) -> tuple[str, str]:
    """Return (base64_data, media_type)."""
    data = image_path.read_bytes()
    b64 = base64.standard_b64encode(data).decode("utf-8")
    ext = image_path.suffix.lower()
    media_type = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".gif": "image/gif",
        ".webp": "image/webp",
    }.get(ext, "image/png")
    return b64, media_type


def encode_pdf_pages_as_images(pdf_path: Path) -> list[tuple[str, str]]:
    """
    For scanned PDFs: extract pages as PNG images using pdfplumber.
    Falls back to rendering pages via page.to_image() if available.
    """
    images = []
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                img = page.to_image(resolution=150)
                import io
                buf = io.BytesIO()
                img.save(buf, format="PNG")
                b64 = base64.standard_b64encode(buf.getvalue()).decode("utf-8")
                images.append((b64, "image/png"))
    except Exception as e:
        print(f"    WARNING: Could not render PDF pages as images: {e}")
    return images


def extract_with_vision(images: list[tuple[str, str]], file_name: str) -> str:
    """Use Claude Vision to OCR images and return combined text."""
    content = [{"type": "text", "text": (
        "Eres un asistente especializado en documentos chilenos de urbanismo. "
        "Transcribe el texto completo visible en estas imágenes de un Acta de Observaciones DOM. "
        "Mantén la estructura original (números de observaciones, artículos citados, etc.). "
        "Si hay múltiples páginas, sepáralas con '--- PÁGINA X ---'."
    )}]

    for i, (b64_data, media_type) in enumerate(images[:10]):  # Max 10 pages
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": media_type,
                "data": b64_data,
            }
        })

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=4096,
        messages=[{"role": "user", "content": content}],
    )
    return response.content[0].text


# ─── Structured extraction ────────────────────────────────────────────────────

def parse_acta_with_claude(acta_text: str, file_name: str) -> dict | None:
    """Use Claude to extract structured data from Acta text."""
    prompt = EXTRACT_PROMPT.format(acta_text=acta_text[:10000])

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=6000,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content[0].text.strip()

    # Strip markdown fences if present
    if "```" in content:
        parts = content.split("```")
        for part in parts[1:]:
            if part.startswith("json"):
                content = part[4:].strip()
                break
            elif part.strip().startswith(("{", "[")):
                content = part.strip()
                break

    content = content.strip()

    try:
        parsed = json.loads(content)
        # Claude occasionally returns a list — take first element
        if isinstance(parsed, list):
            if not parsed:
                return None
            parsed = parsed[0]
        if not isinstance(parsed, dict):
            print(f"    Unexpected JSON type ({type(parsed)}) for {file_name}")
            return None
        parsed["id"] = f"acta-{re.sub(r'[^a-z0-9]', '-', file_name.lower())}"
        parsed["source_file"] = file_name
        parsed["num_observations"] = len(parsed.get("observations", []))
        return parsed
    except json.JSONDecodeError as e:
        print(f"    Failed to parse JSON for {file_name}: {e}")
        print(f"    Response start: {content[:200]}")
        return None


# ─── Main parser ─────────────────────────────────────────────────────────────

def get_all_acta_files(input_dir: Path) -> list[Path]:
    """Return all processable Acta files, excluding known non-Acta files."""
    SKIP_FILES = {
        "findings.md",
        "Actas de Observaciones from Chilean Municipalities.md",
    }
    files = []
    for pattern in ("*.pdf", "*.png", "*.jpg", "*.jpeg", "*.md", "*.txt"):
        files.extend(input_dir.glob(pattern))

    return sorted([f for f in files if f.name not in SKIP_FILES])


def _save(examples: list[dict], output_path: Path) -> None:
    output = {
        "_meta": {
            "source": "Real Actas de Observaciones — Multiple Chilean Municipalities",
            "note": "Processed with Claude. Sensitive data anonymized.",
            "count": len(examples),
            "vision_count": sum(1 for e in examples if e.get("vision_used")),
        },
        "examples": examples,
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)


def parse_actas(input_dir: Path, output_path: Path) -> None:
    files = get_all_acta_files(input_dir)

    if not files:
        print(f"No files found in {input_dir}")
        sys.exit(1)

    # Resume: load existing output and skip already-processed files
    examples: list[dict] = []
    already_done: set[str] = set()
    if output_path.exists():
        with open(output_path) as f:
            existing = json.load(f)
        examples = existing.get("examples", [])
        already_done = {e["source_file"] for e in examples}
        print(f"Resuming: {len(already_done)} files already processed, {len(files) - len(already_done)} remaining")
    else:
        print(f"Found {len(files)} file(s) to process")

    for file_path in files:
        if file_path.name in already_done:
            print(f"Skipping (done): {file_path.name}")
            continue

        print(f"\nProcessing: {file_path.name}")
        suffix = file_path.suffix.lower()

        acta_text: str | None = None
        used_vision = False

        if suffix in (".png", ".jpg", ".jpeg"):
            # Image file → Vision
            print("  Using Claude Vision (image file)")
            b64, media_type = encode_image_base64(file_path)
            acta_text = extract_with_vision([(b64, media_type)], file_path.name)
            used_vision = True

        elif suffix == ".pdf":
            if is_scanned_pdf(file_path):
                print("  Scanned PDF detected → using Claude Vision")
                images = encode_pdf_pages_as_images(file_path)
                if images:
                    acta_text = extract_with_vision(images, file_path.name)
                    used_vision = True
                else:
                    print(f"  Could not render pages — skipping {file_path.name}")
                    continue
            else:
                acta_text = extract_text_from_pdf(file_path)
                print(f"  Extracted {len(acta_text)} characters from digital PDF")

        else:
            # .md or .txt
            acta_text = extract_text_from_file(file_path)
            if acta_text:
                print(f"  Extracted {len(acta_text)} characters from {suffix.upper()}")

        if not acta_text or len(acta_text) < 50:
            print(f"  No usable text — skipping")
            continue

        parsed = parse_acta_with_claude(acta_text, file_path.stem)

        if parsed:
            parsed["vision_used"] = used_vision
            examples.append(parsed)
            already_done.add(file_path.name)
            n_obs = parsed.get("num_observations", 0)
            fmt = parsed.get("format", "unknown")
            print(f"  OK — {n_obs} observation(s), format: {fmt}")
            # Save after every successful file so we can resume if interrupted
            _save(examples, output_path)
        else:
            print(f"  Extraction failed — skipped")

    _save(examples, output_path)
    print(f"\nDone. {len(examples)} examples saved to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse real Actas de Observaciones")
    _data_dir = Path(__file__).parent.parent.parent.parent / "data"
    parser.add_argument("--input", default=str(_data_dir / "raw" / "actas"), help="Directory with Acta files")
    parser.add_argument("--output", default=str(_data_dir / "processed" / "actas-examples.json"), help="Output JSON path")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f"ERROR: Directory not found: {input_dir}")
        sys.exit(1)

    parse_actas(input_dir, output_path)
