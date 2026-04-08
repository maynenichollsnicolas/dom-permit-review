"""
Actas de Observaciones Parser — processes real Actas from Las Condes DOM
and converts them into structured examples for few-shot prompting.

Accepts:
  - PDF files (extracts text)
  - .txt files (plain text)

Usage:
    python3 scripts/parse_actas.py --input data/raw/actas/

Output:
    data/processed/actas-examples.json

The script uses Claude to extract structured data from each Acta —
observation text, parameter, article cited, declared value, allowed value.
This ensures consistent extraction even from varied formatting.
"""
import argparse
import json
import sys
from pathlib import Path

import anthropic
import pdfplumber

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import settings

client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

EXTRACT_PROMPT = """Analiza esta Acta de Observaciones de la Dirección de Obras Municipales y extrae la información estructurada.

ACTA:
{acta_text}

Extrae EXACTAMENTE la siguiente información en JSON:
{{
  "expedient_ref": "número del expediente o 'ANONIMIZADO'",
  "project_type": "tipo de proyecto",
  "zone": "zona urbanística (ej: ZHR2)",
  "round": 1,
  "full_text": "texto completo del acta tal como aparece",
  "observations": [
    {{
      "number": 1,
      "parameter": "nombre_parametro_en_snake_case",
      "verdict": "VIOLATION",
      "declared_value": "valor declarado con unidades",
      "allowed_value": "valor permitido con unidades",
      "article": "artículo normativo citado",
      "text": "texto exacto de la observación"
    }}
  ]
}}

Para el campo "parameter" usa snake_case: altura, constructibilidad, ocupacion_suelo, densidad, estacionamientos, distanciamiento_lateral, distanciamiento_fondo, antejardin, rasante, u otro nombre descriptivo.
"""


def extract_text_from_pdf(pdf_path: Path) -> str:
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text.strip()


def extract_text_from_file(file_path: Path) -> str:
    if file_path.suffix.lower() == ".pdf":
        return extract_text_from_pdf(file_path)
    else:
        return file_path.read_text(encoding="utf-8")


def parse_acta_with_claude(acta_text: str, file_name: str) -> dict | None:
    """Use Claude to extract structured data from an Acta."""
    prompt = EXTRACT_PROMPT.format(acta_text=acta_text[:8000])  # Limit to avoid token overflow

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=2048,
        messages=[{"role": "user", "content": prompt}],
    )

    content = response.content[0].text

    # Strip markdown fences if present
    if "```" in content:
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
    content = content.strip()

    try:
        parsed = json.loads(content)
        parsed["id"] = f"acta-{file_name.replace('.', '-').replace(' ', '-').lower()}"
        parsed["source_file"] = file_name
        parsed["num_observations"] = len(parsed.get("observations", []))
        return parsed
    except json.JSONDecodeError as e:
        print(f"  Failed to parse JSON for {file_name}: {e}")
        return None


def parse_actas(input_dir: Path, output_path: Path) -> None:
    # Find all PDF and text files
    files = list(input_dir.glob("*.pdf")) + list(input_dir.glob("*.txt"))

    if not files:
        print(f"No PDF or .txt files found in {input_dir}")
        print("Place Acta files (PDF or .txt) in:")
        print(f"  {input_dir.resolve()}")
        sys.exit(1)

    print(f"Found {len(files)} Acta file(s)")

    examples = []
    for file_path in sorted(files):
        print(f"\nProcessing: {file_path.name}")

        text = extract_text_from_file(file_path)
        if not text:
            print(f"  Could not extract text from {file_path.name}")
            continue

        print(f"  Extracted {len(text)} characters")
        parsed = parse_acta_with_claude(text, file_path.stem)

        if parsed:
            examples.append(parsed)
            print(f"  Extracted {parsed['num_observations']} observation(s)")
        else:
            print(f"  Skipped {file_path.name}")

    output = {
        "_meta": {
            "source": "Real Actas de Observaciones — Las Condes DOM",
            "note": "Anonymized. Processed with Claude for structured extraction.",
            "count": len(examples),
        },
        "examples": examples,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(examples)} examples to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse real Actas de Observaciones")
    parser.add_argument("--input", default="data/raw/actas/", help="Directory with Acta PDF/txt files")
    parser.add_argument("--output", default="data/processed/actas-examples.json", help="Output JSON path")
    args = parser.parse_args()

    input_dir = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_dir.exists():
        print(f"ERROR: Directory not found: {input_dir}")
        sys.exit(1)

    parse_actas(input_dir, output_path)
