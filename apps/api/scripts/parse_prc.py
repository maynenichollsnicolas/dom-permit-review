"""
PRC Las Condes Parser — extracts zone norms from the Plan Regulador Comunal.

Source: data/raw/prc/Texto_Refundido_SEREMI_firmado.pdf
  (Texto Refundido Modificación N°11, December 2022, 96 pages)

Usage:
    python3 scripts/parse_prc.py
    python3 scripts/parse_prc.py --input data/raw/prc/Texto_Refundido_SEREMI_firmado.pdf

Output:
    data/processed/prc-chunks.json

IMPORTANT — Las Condes PRC zone naming:
  The PRC uses zone codes like E-Ab1, E-Aa1, E-Am4 (NOT ZHR1/ZHR2/ZHR3).
  E-Ab = Aislada Baja, E-Am = Aislada Media, E-Aa = Aislada Alta, E-e = Especial.

Table structure (pdfplumber extracts rotated headers as reversed text):
  Tables have 10 columns (9 for some base tables without densidad):
    Base (10 cols): densidad | subdivisión | constructibilidad | ocupación |
                    rasante | altura | antejardín | distanciamiento | adosamiento | agrupamiento
    Densification (10 cols): densidad | subdivisión | constructibilidad | ocupación |
                    área_libre | rasante | altura | antejardín | distanciamiento | agrupamiento+adosamiento
  Detect which by checking if col[4] header contains 'nerbiL' (="Libre" reversed).

Also parses Artículo 38 prose text for general rules per zone, and
Chapters II-III for general norms (antejardines, estacionamientos, etc.).
"""
import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

import pdfplumber

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

# Zone section header pattern: "1. Zona E-Ab1" or "2.a. Subzona E-Ab1-A"
ZONE_SECTION_PATTERN = re.compile(
    r"(\d+\.(?:[a-d]\.)?\s+(?:Zona|Subzona|Sector)\s+(E-[A-Za-z]+\d+(?:[.-][A-Za-z0-9]+)*))",
    re.IGNORECASE,
)

# Table header strings that indicate the Área Libre column is present (reversed Spanish text)
AREA_LIBRE_HEADER_FRAGMENTS = {"nerbiL", "nóicidnoC", "aerÁ"}

# Known Las Condes zones (for validation)
KNOWN_ZONES = {
    "E-Ab1", "E-Ab2", "E-Ab3", "E-Ab4",
    "E-Am1", "E-Am2", "E-Am4",
    "E-Aa1", "E-Aa2", "E-Aa3", "E-Aa4", "E-Aa",
    "E-e1", "E-e2", "E-e3", "E-e4", "E-e5",
}

# General article titles for general norm sections
GENERAL_ARTICLE_PATTERN = re.compile(
    r"Artículo\s+(\d{1,2})\.\s+(.{0,120}?)(?:\n|\.)",
    re.IGNORECASE,
)


def has_area_libre_column(header_row: list) -> bool:
    """Detect if this is a densification table (with Área Libre column at position 4)."""
    if len(header_row) < 5:
        return False
    col4_text = str(header_row[4]) if header_row[4] else ""
    return any(frag in col4_text for frag in AREA_LIBRE_HEADER_FRAGMENTS)


def parse_numeric(value: str | None) -> float | str | None:
    """Convert cell text to float or keep as string if it can't be converted."""
    if not value:
        return None
    value = value.strip().replace("\n", " ")
    if not value or value in ("O.G.U.C.", "Libre", "No aplica", "No se exige"):
        return value
    # Try to extract leading number
    m = re.match(r"^(\d+(?:[.,]\d+)?)", value.replace(".", "").replace(",", "."))
    if m:
        try:
            return float(m.group(1))
        except ValueError:
            pass
    return value


def parse_altura_cell(value: str | None) -> dict[str, Any]:
    """Extract pisos and meters from height cell text."""
    if not value:
        return {}
    text = value.replace("\n", " ").strip()
    result: dict[str, Any] = {"raw": text}

    # Pisos: "3 pisos", "12 pisos"
    m_pisos = re.search(r"(\d+)\s+piso", text, re.IGNORECASE)
    if m_pisos:
        result["pisos"] = int(m_pisos.group(1))

    # Meters: "10,5 m", "42.0 metros", "52,5 m"
    m_metros = re.search(r"(\d+(?:[.,]\d+)?)\s*m(?:etros|áxima)?(?:\s|$)", text, re.IGNORECASE)
    if m_metros:
        try:
            result["metros"] = float(m_metros.group(1).replace(",", "."))
        except ValueError:
            pass

    return result


def parse_table_row(row: list, has_area_libre: bool) -> dict[str, Any]:
    """Map a data row (list of cell strings) to named parameters."""
    cells = [str(c).strip().replace("\n", " ") if c else "" for c in row]

    if has_area_libre:
        # 10-col densification table
        # [densidad, subdivisión, constructibilidad, ocupación, área_libre, rasante, altura, antejardín, distanciamiento, agrupamiento]
        col_map = {
            "densidad_bruta": 0,
            "subdivision_predial_min_m2": 1,
            "constructibilidad": 2,
            "ocupacion_suelo": 3,
            "area_libre": 4,
            "rasante": 5,
            "altura": 6,
            "antejardin": 7,
            "distanciamiento": 8,
            "sistema_agrupamiento": 9,
        }
    elif len(cells) == 10:
        # 10-col base table (no área libre)
        # [densidad, subdivisión, constructibilidad, ocupación, rasante, altura, antejardín, distanciamiento, adosamiento, agrupamiento]
        col_map = {
            "densidad_bruta": 0,
            "subdivision_predial_min_m2": 1,
            "constructibilidad": 2,
            "ocupacion_suelo": 3,
            "rasante": 4,
            "altura": 5,
            "antejardin": 6,
            "distanciamiento": 7,
            "adosamiento": 8,
            "sistema_agrupamiento": 9,
        }
    elif len(cells) == 9:
        # 9-col base table (no densidad column)
        col_map = {
            "subdivision_predial_min_m2": 0,
            "constructibilidad": 1,
            "ocupacion_suelo": 2,
            "rasante": 3,
            "altura": 4,
            "antejardin": 5,
            "distanciamiento": 6,
            "adosamiento": 7,
            "sistema_agrupamiento": 8,
        }
    else:
        return {}

    result: dict[str, Any] = {}
    for param, idx in col_map.items():
        if idx < len(cells) and cells[idx]:
            val = cells[idx]
            if param == "altura":
                result[param] = parse_altura_cell(val)
            elif param in ("constructibilidad", "ocupacion_suelo", "area_libre"):
                result[param] = parse_numeric(val)
            elif param in ("antejardin", "distanciamiento"):
                result[param] = parse_numeric(val)
            elif param == "rasante":
                # "70°" → 70
                m = re.search(r"(\d+(?:[.,]\d+)?)\s*°", val)
                result[param] = float(m.group(1)) if m else val
            elif param in ("densidad_bruta", "subdivision_predial_min_m2"):
                result[param] = parse_numeric(val)
            else:
                result[param] = val if val not in ("", "None") else None

    return result


def build_zone_chunks(zone_name: str, tables_data: list[dict], prose_text: str) -> list[dict]:
    """Build RAG chunks for a zone from extracted table data and prose."""
    chunks = []

    # Summary chunk from prose + first base table
    base_data = next((t for t in tables_data if not t.get("is_densification")), None)
    dense_data = [t for t in tables_data if t.get("is_densification")]

    # Build a human-readable summary
    summary_lines = [f"Zona {zone_name} — Plan Regulador Comunal de Las Condes (PRC)\n"]

    if base_data:
        params = base_data.get("params", {})
        if params.get("constructibilidad"):
            summary_lines.append(f"Coeficiente de constructibilidad máximo: {params['constructibilidad']}")
        if params.get("ocupacion_suelo"):
            summary_lines.append(f"Coeficiente de ocupación de suelo máximo: {params['ocupacion_suelo']}")
        if params.get("altura"):
            h = params["altura"]
            if isinstance(h, dict):
                pisos = h.get("pisos", "")
                metros = h.get("metros", "")
                altura_str = f"{pisos} pisos" if pisos else ""
                if metros:
                    altura_str += f" ({metros} m)"
                summary_lines.append(f"Altura máxima: {altura_str or h.get('raw', 'ver tabla')}")
        if params.get("densidad_bruta"):
            summary_lines.append(f"Densidad máxima: {params['densidad_bruta']} hab/há")
        if params.get("subdivision_predial_min_m2"):
            summary_lines.append(f"Subdivisión predial mínima: {params['subdivision_predial_min_m2']} m²")
        if params.get("rasante"):
            summary_lines.append(f"Rasante máxima: {params['rasante']}°")
        if params.get("antejardin"):
            summary_lines.append(f"Antejardín mínimo: {params['antejardin']} m")
        if params.get("distanciamiento"):
            summary_lines.append(f"Distanciamiento mínimo: {params['distanciamiento']} m")
        if params.get("sistema_agrupamiento"):
            summary_lines.append(f"Sistema de agrupamiento: {params['sistema_agrupamiento']}")

    if prose_text:
        summary_lines.append(f"\nNormas adicionales:\n{prose_text[:500]}")

    chunks.append({
        "id": f"prc-lc-{zone_name.lower().replace('-', '')}-resumen",
        "source": "PRC_LAS_CONDES",
        "zone": zone_name,
        "parameter_types": ["resumen"],
        "title": f"Zona {zone_name} — Resumen de Normas Urbanísticas",
        "content": "\n".join(summary_lines),
        "article_reference": f"PRC Las Condes, Art. 38, Zona {zone_name}",
    })

    # Individual parameter chunks for precise retrieval
    if base_data:
        params = base_data.get("params", {})

        param_chunks = [
            ("constructibilidad", ["constructibilidad"],
             lambda p: f"Zona {zone_name}, Las Condes. Coeficiente de constructibilidad máximo: {p.get('constructibilidad')}. "
                       f"La superficie total edificada no puede superar {p.get('constructibilidad')} veces la superficie del predio."),
            ("ocupacion_suelo", ["ocupacion_suelo"],
             lambda p: f"Zona {zone_name}, Las Condes. Coeficiente de ocupación de suelo máximo: {p.get('ocupacion_suelo')}. "
                       f"La huella de la edificación no puede superar {p.get('ocupacion_suelo')} veces la superficie del predio."),
            ("altura", ["altura"],
             lambda p: _build_altura_text(zone_name, p)),
            ("densidad_bruta", ["densidad"],
             lambda p: f"Zona {zone_name}, Las Condes. Densidad habitacional máxima: {p.get('densidad_bruta')} hab/há."),
            ("rasante", ["rasante"],
             lambda p: f"Zona {zone_name}, Las Condes. Rasante máxima: {p.get('rasante')}°."),
            ("antejardin", ["distanciamiento"],
             lambda p: f"Zona {zone_name}, Las Condes. Antejardín mínimo desde línea oficial: {p.get('antejardin')} metros."),
            ("distanciamiento", ["distanciamiento"],
             lambda p: f"Zona {zone_name}, Las Condes. Distanciamiento mínimo a deslindes: {p.get('distanciamiento')} metros. "
                       f"Sistema de agrupamiento: {p.get('sistema_agrupamiento', 'ver tabla')}."),
            ("subdivision_predial_min_m2", ["subdivision_predial"],
             lambda p: f"Zona {zone_name}, Las Condes. Superficie de subdivisión predial mínima: {p.get('subdivision_predial_min_m2')} m²."),
        ]

        for param_key, param_types, text_fn in param_chunks:
            val = params.get(param_key)
            if val is not None and val != "" and val != "O.G.U.C.":
                try:
                    content = text_fn(params)
                    chunks.append({
                        "id": f"prc-lc-{zone_name.lower().replace('-', '')}-{param_key.replace('_', '-')}",
                        "source": "PRC_LAS_CONDES",
                        "zone": zone_name,
                        "parameter_types": param_types,
                        "title": f"Zona {zone_name} — {param_key.replace('_', ' ').title()}",
                        "content": content,
                        "article_reference": f"PRC Las Condes, Art. 38, Zona {zone_name}",
                    })
                except Exception:
                    pass

    # Densification table chunk
    if dense_data:
        for i, dt in enumerate(dense_data):
            p = dt.get("params", {})
            lines = [f"Zona {zone_name}, Las Condes — Normas de Densificación (Tabla {chr(66+i)})"]
            for k, v in p.items():
                if v and v != "O.G.U.C.":
                    lines.append(f"  {k}: {v}")
            chunks.append({
                "id": f"prc-lc-{zone_name.lower().replace('-', '')}-densificacion-{i+1}",
                "source": "PRC_LAS_CONDES",
                "zone": zone_name,
                "parameter_types": ["densificacion", "constructibilidad", "altura"],
                "title": f"Zona {zone_name} — Normas de Densificación",
                "content": "\n".join(lines),
                "article_reference": f"PRC Las Condes, Art. 38, Zona {zone_name} (Tabla Densificación)",
            })

    return chunks


def _build_altura_text(zone_name: str, params: dict) -> str:
    h = params.get("altura", {})
    if isinstance(h, dict):
        pisos = h.get("pisos")
        metros = h.get("metros")
        parts = []
        if pisos:
            parts.append(f"{pisos} pisos")
        if metros:
            parts.append(f"{metros} m de altura")
        altura_str = " / ".join(parts) if parts else h.get("raw", "ver tabla")
    else:
        altura_str = str(h)
    return (
        f"Zona {zone_name}, Las Condes. Altura máxima de edificación: {altura_str}. "
        f"Sistema de agrupamiento: {params.get('sistema_agrupamiento', 'Aislado')}."
    )


def extract_prc_data(pdf_path: Path) -> tuple[list[dict], list[dict]]:
    """
    Extract zone-specific norms (Art. 38) and general norm articles.
    Returns (zone_chunks, general_chunks).
    """
    print(f"Opening {pdf_path.name} ...")
    all_zone_chunks: list[dict] = []
    general_chunks: list[dict] = []

    with pdfplumber.open(pdf_path) as pdf:
        total = len(pdf.pages)
        print(f"  {total} pages total")

        # Phase 1: Find Artículo 38 start page (Chapter VI)
        art38_start = 18  # Known from document structure (page 19 = index 18)

        # Phase 2: Process pages from Chapter VI onward
        current_zone: str | None = None
        current_prose_lines: list[str] = []
        current_tables: list[dict] = []

        # Track what table type is "current" (base vs densification)
        # A table right after "Tabla A) Base" header = base, after "Tabla B/C/D)" = densification
        current_table_type = "base"

        def flush_zone():
            """Save accumulated zone data as chunks."""
            if current_zone and (current_tables or current_prose_lines):
                prose = " ".join(current_prose_lines).strip()
                chunks = build_zone_chunks(current_zone, current_tables, prose)
                all_zone_chunks.extend(chunks)
                print(f"  Zone {current_zone}: {len(chunks)} chunks from {len(current_tables)} table(s)")

        for page_idx in range(art38_start, total):
            page = pdf.pages[page_idx]
            text = page.extract_text() or ""
            tables = page.extract_tables()

            # Detect zone section headers on this page
            zone_matches = list(ZONE_SECTION_PATTERN.finditer(text))

            if zone_matches:
                # New zone(s) start on this page — flush previous zone first
                flush_zone()
                current_zone = zone_matches[-1].group(2).strip()
                current_prose_lines = []
                current_tables = []

                # Extract prose between zone header and table
                # Use text after last zone match
                last_match_end = zone_matches[-1].end()
                prose_segment = text[last_match_end:].strip()
                if prose_segment:
                    current_prose_lines = [prose_segment]

            elif current_zone and text:
                # Accumulate prose (only short snippets — skip pure-table pages)
                text_stripped = text.strip()
                if len(text_stripped) > 50 and not text_stripped.startswith("aturB"):
                    current_prose_lines.append(text_stripped[:400])

            # Detect table type hint from page text
            if "Tabla A)" in text or "Tabla A) Base" in text:
                current_table_type = "base"
            elif re.search(r"Tabla [B-D]\)", text):
                current_table_type = "densification"

            # Process tables on this page
            for table in tables:
                if not table or len(table) < 2:
                    continue

                header_row = table[0]
                data_rows = table[1:]

                # Validate: must look like a normas table (reversed header text pattern)
                first_header = str(header_row[0]) if header_row[0] else ""
                if not any(frag in first_header for frag in ("aturB", "aminíM", "dadilibitcurtsnoC")):
                    continue

                is_densification = has_area_libre_column(header_row)

                for data_row in data_rows:
                    if not any(c for c in data_row if c):
                        continue
                    params = parse_table_row(data_row, is_densification)
                    if params and params.get("constructibilidad"):
                        current_tables.append({
                            "is_densification": is_densification
                            or current_table_type == "densification",
                            "params": params,
                        })
                        break  # Only take first valid data row per table

        flush_zone()  # Save last zone

        # Phase 3: Extract general articles (Ch. II-III: Art. 5-15)
        print("\n  Extracting general norm articles (Art. 5-15)...")
        gen_text = ""
        for page_idx in range(8, art38_start):  # Pages 9-19 cover Ch. II-III
            t = pdf.pages[page_idx].extract_text()
            if t:
                gen_text += t + "\n"

        gen_matches = list(GENERAL_ARTICLE_PATTERN.finditer(gen_text))
        seen_gen: set[str] = set()
        for i, match in enumerate(gen_matches):
            art_num = match.group(1)
            art_title = match.group(2).strip()
            start = match.end()
            end = gen_matches[i + 1].start() if i + 1 < len(gen_matches) else len(gen_text)
            content = gen_text[start:end].strip()

            if len(content) < 30 or art_num in seen_gen:
                continue
            seen_gen.add(art_num)

            param_map = {
                "5": ["antejardin"],
                "6": ["cierros"],
                "7": ["sistema_agrupamiento"],
                "8": ["rasante", "distanciamiento"],
                "9": ["distanciamiento"],
                "14": ["densidad"],
                "15": ["estacionamientos"],
                "16": ["densificacion"],
            }
            chunk_content = f"PRC Las Condes, Artículo {art_num}. {art_title}\n\n{content[:600]}"
            general_chunks.append({
                "id": f"prc-lc-art{art_num}",
                "source": "PRC_LAS_CONDES",
                "zone": None,
                "parameter_types": param_map.get(art_num, ["general"]),
                "title": f"PRC Las Condes Art. {art_num} — {art_title}",
                "content": chunk_content,
                "article_reference": f"PRC Las Condes, Artículo {art_num}",
            })

    return all_zone_chunks, general_chunks


def parse_prc(input_path: Path, output_path: Path) -> None:
    zone_chunks, general_chunks = extract_prc_data(input_path)
    all_chunks = general_chunks + zone_chunks

    if not all_chunks:
        print("ERROR: No chunks extracted. Check the PDF.")
        sys.exit(1)

    # Summary stats
    zones_found = list({c["zone"] for c in zone_chunks if c["zone"]})
    print(f"\nExtracted:")
    print(f"  Zones: {len(zones_found)} → {sorted(zones_found)}")
    print(f"  Zone chunks: {len(zone_chunks)}")
    print(f"  General article chunks: {len(general_chunks)}")
    print(f"  Total: {len(all_chunks)} chunks")

    output = {
        "_meta": {
            "source": "PRC Las Condes — Plan Regulador Comunal, Texto Refundido Modificación N°11",
            "municipality": "Las Condes",
            "parsed_from": input_path.name,
            "zones_found": sorted(zones_found),
            "total_chunks": len(all_chunks),
            "note": (
                "Zone codes: E-Ab=Aislada Baja, E-Am=Aislada Media, "
                "E-Aa=Aislada Alta, E-e=Especial"
            ),
        },
        "chunks": all_chunks,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(all_chunks)} chunks to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse PRC Las Condes into zone parameter chunks")
    parser.add_argument(
        "--input",
        default="data/raw/prc/Texto_Refundido_SEREMI_firmado.pdf",
        help="Path to PRC Texto Refundido PDF",
    )
    parser.add_argument("--output", default="data/processed/prc-chunks.json", help="Output JSON path")
    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    if not input_path.exists():
        print(f"ERROR: File not found: {input_path}")
        print("Place the PRC Texto Refundido at:")
        print(f"  {input_path.resolve()}")
        sys.exit(1)

    parse_prc(input_path, output_path)
