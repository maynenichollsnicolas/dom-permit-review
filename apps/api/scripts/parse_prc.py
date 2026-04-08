"""
PRC Las Condes Parser — extracts zone parameters from the Plan Regulador Comunal.

The PRC's key data is the "Tabla de Normas Urbanísticas" — a table with one row
per zone and columns for each parameter (constructibilidad, ocupación, altura, etc.)

Two modes:
  --mode pdf    Parse directly from PRC PDF (requires pdfplumber table extraction)
  --mode manual Use the interactive CLI to enter zone parameters by hand

Usage:
    python3 scripts/parse_prc.py --mode pdf --input data/raw/prc/PRC-LasCondes.pdf
    python3 scripts/parse_prc.py --mode manual

Output:
    data/processed/prc-chunks.json
"""
import argparse
import json
import sys
from pathlib import Path

import pdfplumber

DATA_DIR = Path(__file__).parent.parent.parent.parent / "data"

# Known zones in Las Condes PRC
ZONES = ["ZHR1", "ZHR2", "ZHR3", "ZHR4", "ZC1", "ZC2", "ZE", "ZEQ", "ZI"]

# Parameter definitions
PARAMETERS = [
    ("uso_suelo", "Usos de suelo permitidos"),
    ("sistema_agrupamiento", "Sistema de agrupamiento"),
    ("constructibilidad_max", "Coeficiente de constructibilidad máximo"),
    ("ocupacion_suelo_max", "Coeficiente de ocupación de suelo máximo"),
    ("altura_maxima_m", "Altura máxima de edificación (metros)"),
    ("altura_maxima_pisos", "Altura máxima (pisos)"),
    ("densidad_max_hab_ha", "Densidad máxima (hab/há)"),
    ("distanciamiento_lateral_m", "Distanciamiento lateral mínimo (metros)"),
    ("distanciamiento_fondo_m", "Distanciamiento de fondo mínimo (metros)"),
    ("antejardin_m", "Antejardín mínimo (metros)"),
    ("superficie_predial_min_m2", "Superficie predial mínima (m²)"),
    ("estacionamientos_habitacional", "Estacionamientos por vivienda (mínimo)"),
    ("estacionamientos_visitas", "Estacionamientos de visitas por vivienda"),
]


def build_zone_chunks(zone: str, params: dict) -> list[dict]:
    """Convert a zone parameter dict into normative chunks for RAG."""
    chunks = []

    # One chunk for the full zone summary
    lines = [f"Zona {zone} — Plan Regulador Comunal de Las Condes\n"]
    for key, label in PARAMETERS:
        val = params.get(key)
        if val is not None:
            lines.append(f"{label}: {val}")

    chunks.append({
        "id": f"prc-lc-{zone.lower()}-resumen",
        "source": "PRC_LAS_CONDES",
        "zone": zone,
        "parameter_types": ["resumen"],
        "title": f"{zone} — Resumen de Normas Urbanísticas",
        "content": "\n".join(lines),
        "article_reference": f"PRC Las Condes, Tabla de Normas Urbanísticas, Zona {zone}",
    })

    # Individual chunks per parameter (for precise retrieval)
    param_chunks = [
        ("constructibilidad_max", "constructibilidad",
         lambda v: f"Zona {zone}, Las Condes. Coeficiente de constructibilidad máximo: {v}. "
                   f"La superficie total edificada no puede superar {v} veces la superficie del predio."),
        ("ocupacion_suelo_max", "ocupacion_suelo",
         lambda v: f"Zona {zone}, Las Condes. Coeficiente de ocupación de suelo máximo: {v}. "
                   f"La huella de la edificación no puede superar {v} veces la superficie del predio."),
        ("altura_maxima_m", "altura",
         lambda v: f"Zona {zone}, Las Condes. Altura máxima de edificación: {v} metros"
                   + (f" ({params.get('altura_maxima_pisos')} pisos)" if params.get("altura_maxima_pisos") else "") + "."),
        ("densidad_max_hab_ha", "densidad",
         lambda v: f"Zona {zone}, Las Condes. Densidad habitacional máxima: {v} habitantes por hectárea."),
        ("distanciamiento_lateral_m", "distanciamiento",
         lambda v: f"Zona {zone}, Las Condes. Distanciamiento mínimo a deslindes laterales: {v} metros. "
                   f"Sistema de agrupamiento: {params.get('sistema_agrupamiento', 'aislado')}."),
        ("distanciamiento_fondo_m", "distanciamiento",
         lambda v: f"Zona {zone}, Las Condes. Distanciamiento mínimo a deslinde de fondo: {v} metros."),
        ("antejardin_m", "distanciamiento",
         lambda v: f"Zona {zone}, Las Condes. Antejardín mínimo desde línea oficial: {v} metros."),
        ("estacionamientos_habitacional", "estacionamientos",
         lambda v: f"Zona {zone}, Las Condes. Estacionamientos mínimos para uso habitacional: {v} por unidad de vivienda."
                   + (f" Más {params.get('estacionamientos_visitas')} de visitas por unidad." if params.get("estacionamientos_visitas") else "")),
    ]

    for param_key, param_type, text_fn in param_chunks:
        val = params.get(param_key)
        if val is not None:
            chunks.append({
                "id": f"prc-lc-{zone.lower()}-{param_type.replace('_', '-')}",
                "source": "PRC_LAS_CONDES",
                "zone": zone,
                "parameter_types": [param_type],
                "title": f"{zone} — {dict(PARAMETERS).get(param_key, param_key)}",
                "content": text_fn(val),
                "article_reference": f"PRC Las Condes, Tabla de Normas Urbanísticas, Zona {zone}",
            })

    return chunks


def extract_from_pdf(pdf_path: Path) -> dict[str, dict]:
    """
    Extract zone parameters from PRC PDF using table detection.
    The PRC typically has a "Tabla de Normas Urbanísticas" with zones as rows.
    """
    print(f"Opening {pdf_path.name}...")
    zone_data = {}

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            for table in tables:
                if not table or len(table) < 2:
                    continue

                # Look for zone table by checking if first column contains zone names
                first_col = [str(row[0]).strip().upper() if row[0] else "" for row in table]
                has_zones = any(z in first_col for z in ZONES)

                if not has_zones:
                    continue

                print(f"  Found zone table on page {page_num + 1} ({len(table)} rows)")

                # Parse header row
                header = [str(h).strip().lower() if h else "" for h in table[0]]

                for row in table[1:]:
                    if not row or not row[0]:
                        continue
                    zone_name = str(row[0]).strip().upper()
                    if zone_name not in ZONES:
                        continue

                    params = {}
                    for j, cell in enumerate(row[1:], 1):
                        if j < len(header) and cell:
                            params[header[j]] = str(cell).strip()

                    zone_data[zone_name] = params
                    print(f"  Parsed zone {zone_name}: {len(params)} parameters")

    return zone_data


def manual_entry() -> dict[str, dict]:
    """Interactive CLI for entering zone parameters by hand."""
    print("\nManual PRC data entry")
    print("Enter parameters for each zone. Press Enter to skip a parameter.\n")

    zone_data = {}
    zones_to_enter = input(f"Which zones to enter? (comma-separated, options: {', '.join(ZONES)})\n> ").strip().upper().split(",")
    zones_to_enter = [z.strip() for z in zones_to_enter if z.strip() in ZONES]

    for zone in zones_to_enter:
        print(f"\n--- Zone {zone} ---")
        params = {}
        for key, label in PARAMETERS:
            val = input(f"  {label}: ").strip()
            if val:
                # Convert numeric values
                try:
                    params[key] = float(val) if "." in val else int(val)
                except ValueError:
                    params[key] = val
        zone_data[zone] = params
        print(f"  Saved {len(params)} parameters for {zone}")

    return zone_data


def parse_prc(mode: str, input_path: Path | None, output_path: Path) -> None:
    if mode == "pdf":
        if not input_path or not input_path.exists():
            print(f"ERROR: File not found: {input_path}")
            print("Place the PRC Las Condes PDF at:")
            print(f"  {(input_path or Path('data/raw/prc/PRC-LasCondes.pdf')).resolve()}")
            sys.exit(1)
        zone_data = extract_from_pdf(input_path)
    else:
        zone_data = manual_entry()

    if not zone_data:
        print("No zone data extracted.")
        sys.exit(1)

    # Build chunks for all zones
    all_chunks = []
    for zone, params in zone_data.items():
        chunks = build_zone_chunks(zone, params)
        all_chunks.extend(chunks)
        print(f"Built {len(chunks)} chunks for zone {zone}")

    output = {
        "_meta": {
            "source": "PRC Las Condes — Plan Regulador Comunal",
            "municipality": "Las Condes",
            "mode": mode,
            "zones_parsed": list(zone_data.keys()),
            "total_chunks": len(all_chunks),
        },
        "zone_data": zone_data,
        "chunks": all_chunks,
    }

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\nSaved {len(all_chunks)} chunks to {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Parse PRC Las Condes into zone parameter chunks")
    parser.add_argument("--mode", choices=["pdf", "manual"], default="manual",
                        help="pdf: extract from PDF | manual: enter by hand")
    parser.add_argument("--input", default="data/raw/prc/PRC-LasCondes.pdf",
                        help="Path to PRC PDF (only for --mode pdf)")
    parser.add_argument("--output", default="data/processed/prc-chunks.json",
                        help="Output JSON path")
    args = parser.parse_args()

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    parse_prc(
        mode=args.mode,
        input_path=Path(args.input) if args.mode == "pdf" else None,
        output_path=output_path,
    )
