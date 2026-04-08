"""
Input Parser Agent — deterministic, no LLM.
Validates CIP parameters vs. architect declarations and computes deltas.
"""
from __future__ import annotations
from dataclasses import dataclass
from typing import Optional


@dataclass
class ParamDelta:
    parameter: str
    cip_value: Optional[float]
    declared_value: Optional[float]
    delta: Optional[float]
    status: str  # "ok" | "over" | "under" | "missing"
    label: str   # Human-readable label


@dataclass
class ParsedProject:
    expedient_id: str
    zone: str
    project_type: str
    cip_params: dict
    declared_params: dict
    deltas: list[ParamDelta]
    missing_params: list[str]


def parse_and_validate(project_params: dict) -> ParsedProject:
    """
    Compare CIP-allowed values against architect declarations.
    Returns a ParsedProject with per-parameter deltas and status flags.
    """
    cip = project_params.get("cip", {})
    declared = project_params.get("declared", {})
    expedient_id = project_params.get("expedient_id", "")
    zone = project_params.get("zone", "ZHR2")
    project_type = project_params.get("project_type", "obra_nueva_residencial")

    # Define checks: (param_key, label, direction)
    # direction: "max" means declared must be <= cip, "min" means declared must be >=  cip
    checks = [
        ("constructibilidad", "Coeficiente de Constructibilidad", "max"),
        ("ocupacion_suelo", "Coeficiente de Ocupación de Suelo", "max"),
        ("altura_m", "Altura de Edificación (m)", "max"),
        ("densidad_hab_ha", "Densidad (hab/há)", "max"),
        ("estacionamientos", "Estacionamientos por Vivienda", "min"),
        ("distanciamiento_lateral_m", "Distanciamiento Lateral (m)", "min"),
        ("distanciamiento_fondo_m", "Distanciamiento de Fondo (m)", "min"),
        ("antejardin_m", "Antejardín (m)", "min"),
    ]

    deltas: list[ParamDelta] = []
    missing_params: list[str] = []

    for key, label, direction in checks:
        cip_val = cip.get(key)
        dec_val = declared.get(key)

        if cip_val is None:
            missing_params.append(f"CIP missing: {key}")
            continue

        if dec_val is None:
            missing_params.append(f"Declared missing: {key}")
            deltas.append(ParamDelta(
                parameter=key,
                cip_value=cip_val,
                declared_value=None,
                delta=None,
                status="missing",
                label=label,
            ))
            continue

        delta = dec_val - cip_val  # positive = declared exceeds CIP limit (bad for "max")

        if direction == "max":
            if dec_val > cip_val:
                status = "over"
            else:
                status = "ok"
        else:  # "min"
            if dec_val < cip_val:
                status = "under"
            else:
                status = "ok"

        deltas.append(ParamDelta(
            parameter=key,
            cip_value=cip_val,
            declared_value=dec_val,
            delta=round(delta, 4),
            status=status,
            label=label,
        ))

    return ParsedProject(
        expedient_id=expedient_id,
        zone=zone,
        project_type=project_type,
        cip_params=cip,
        declared_params=declared,
        deltas=deltas,
        missing_params=missing_params,
    )


def build_from_db_row(expedient_id: str, params_row: dict) -> dict:
    """
    Convert a Supabase project_parameters row into the dict format
    expected by parse_and_validate().
    """
    return {
        "expedient_id": expedient_id,
        "zone": params_row.get("zone", "ZHR2"),
        "project_type": params_row.get("project_type", "obra_nueva_residencial"),
        "cip": {
            "constructibilidad": params_row.get("cip_constructibilidad_max"),
            "ocupacion_suelo": params_row.get("cip_ocupacion_suelo_max"),
            "altura_m": params_row.get("cip_altura_maxima_m"),
            "densidad_hab_ha": params_row.get("cip_densidad_max_hab_ha"),
            "estacionamientos": params_row.get("cip_estacionamientos_min"),
            "distanciamiento_lateral_m": params_row.get("cip_distanciamiento_lateral_m"),
            "distanciamiento_fondo_m": params_row.get("cip_distanciamiento_fondo_m"),
            "antejardin_m": params_row.get("cip_antejardin_m"),
        },
        "declared": {
            "constructibilidad": params_row.get("declared_constructibilidad"),
            "ocupacion_suelo": params_row.get("declared_ocupacion_suelo"),
            "altura_m": params_row.get("declared_altura_m"),
            "densidad_hab_ha": params_row.get("declared_densidad_hab_ha"),
            "estacionamientos": params_row.get("declared_estacionamientos"),
            "distanciamiento_lateral_m": params_row.get("declared_distanciamiento_lateral_m"),
            "distanciamiento_fondo_m": params_row.get("declared_distanciamiento_fondo_m"),
            "antejardin_m": params_row.get("declared_antejardin_m"),
        },
    }
