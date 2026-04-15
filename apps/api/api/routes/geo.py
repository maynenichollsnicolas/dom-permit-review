from __future__ import annotations

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/geo", tags=["geo"])

# ── PRC Las Condes — hardcoded zone parameter table ───────────────────────────
# Source: PRC Las Condes, Texto Refundido Modificación N°11 (parsed from PDF)
# Values are base/Tabla-A parameters. Densification tables (B/C) not included.
# estacionamientos_min: OGUC Art. 2.4.1 baseline (1 per unit). PRC may raise it.
# distanciamiento_m: 0 means governed by rasante formula (OGUC), no fixed PRC setback.

PRC_ZONE_PARAMS: dict[str, dict] = {
    "E-Aa1": {
        "constructibilidad": 1.0, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 6.0, "distanciamiento_fondo_m": 6.0,
        "antejardin_m": 7.0,
    },
    "E-Aa3-A": {
        "constructibilidad": 1.0, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 6.0, "distanciamiento_fondo_m": 6.0,
        "antejardin_m": 7.0,
    },
    "E-Aa4": {
        "constructibilidad": 1.0, "ocupacion_suelo": 0.6, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 6.0, "distanciamiento_fondo_m": 6.0,
        "antejardin_m": 7.0,
    },
    "E-Ab1-A": {
        "constructibilidad": 0.6, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 40.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
    "E-Ab2-A": {
        "constructibilidad": 1.6, "ocupacion_suelo": 0.3, "altura_m": 17.5,
        "densidad": 150.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 11.0, "distanciamiento_fondo_m": 11.0,
        "antejardin_m": 10.0,
    },
    "E-Ab3": {
        "constructibilidad": 1.6, "ocupacion_suelo": 0.35, "altura_m": 17.5,
        "densidad": 190.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 7.0, "distanciamiento_fondo_m": 7.0,
        "antejardin_m": 7.0,
    },
    "E-Ab4": {
        "constructibilidad": 0.8, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 120.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 11.0, "distanciamiento_fondo_m": 11.0,
        "antejardin_m": 5.0,
    },
    "E-Am1": {
        "constructibilidad": 0.6, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
    "E-Am1-A": {
        "constructibilidad": 0.6, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 40.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
    "E-Am2": {
        "constructibilidad": 0.6, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
    "E-Am4": {
        "constructibilidad": 0.6, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
    "E-Am4-A": {
        "constructibilidad": 0.6, "ocupacion_suelo": 0.4, "altura_m": 10.5,
        "densidad": 20.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
    "E-e1": {
        "constructibilidad": 0.8, "ocupacion_suelo": 0.5, "altura_m": 10.5,
        "densidad": 0.0, "estacionamientos": 1.0,
        "distanciamiento_lateral_m": 0.0, "distanciamiento_fondo_m": 0.0,
        "antejardin_m": 5.0,
    },
}

SPECIAL_ZONES = {"E-e2", "E-e3", "E-e5"}  # parks, heritage, stadiums — no standard params

# ── Models ────────────────────────────────────────────────────────────────────

class CoordsRequest(BaseModel):
    lat: float
    lng: float


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/zone-from-coords")
async def zone_from_coords(body: CoordsRequest):
    """
    Detect the PRC zone for a coordinate by querying the MINVU IDE WFS.
    Returns { zone: str | null, source: str, error: str | null }.
    Falls back gracefully if the WFS is unreachable.
    """
    lat, lng = body.lat, body.lng

    # Quick bounding-box sanity check — Las Condes approximate extent
    if not (-33.50 < lat < -33.30 and -70.70 < lng < -70.45):
        return {
            "zone": None,
            "source": "out_of_bounds",
            "error": "Coordenadas fuera del área de Las Condes",
        }

    zone = await _query_minvu_wfs(lat, lng)
    if zone:
        return {"zone": zone, "source": "minvu_ide", "error": None}

    return {
        "zone": None,
        "source": "unavailable",
        "error": "No se pudo obtener la zona desde MINVU IDE. Selecciónala manualmente.",
    }


@router.get("/zone-params/{zone}")
async def get_zone_params(zone: str):
    """
    Return PRC normative parameters for a given zone code.
    Source: PRC Las Condes, Texto Refundido Modificación N°11.
    """
    # Normalize: "e-aa1" → "E-Aa1"
    zone_upper = zone.upper()
    # Try exact match first, then case-insensitive scan
    params = PRC_ZONE_PARAMS.get(zone_upper)
    if params is None:
        for k, v in PRC_ZONE_PARAMS.items():
            if k.upper() == zone_upper:
                params = v
                zone_upper = k
                break

    if params is None:
        if zone_upper in {z.upper() for z in SPECIAL_ZONES}:
            raise HTTPException(
                status_code=422,
                detail=f"Zona {zone} es una zona especial (parque/patrimonio/equipamiento). Sin parámetros estándar de edificación."
            )
        raise HTTPException(status_code=404, detail=f"Zona '{zone}' no encontrada en el PRC Las Condes")

    return {
        "zone": zone_upper,
        "source": "PRC Las Condes, Texto Refundido Modificación N°11",
        "disclaimer": "Valores de Tabla A (base). Verifique contra el CIP emitido por la DOM antes de presentar.",
        "params": params,
    }


# ── MINVU IDE WFS helper ──────────────────────────────────────────────────────

async def _query_minvu_wfs(lat: float, lng: float) -> Optional[str]:
    """
    Query MINVU IDE GeoServer WFS to get the PRC zone at (lat, lng).
    MINVU uses EPSG:4326. Point notation: POINT(lng lat).
    Returns zone code string or None on failure.

    DEBUG: If this returns None, check the logs for the actual WFS response.
    The layer name "planiregulador:prc_las_condes_zonificacion" is best-effort.
    To discover the correct layer name, query:
      GET https://ide.minvu.cl/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities
    and search for "las_condes" or "lascondes" in the response.
    """
    import logging
    logger = logging.getLogger(__name__)

    wfs_url = "https://ide.minvu.cl/geoserver/ows"
    params = {
        "service": "WFS",
        "version": "2.0.0",
        "request": "GetFeature",
        "typeName": "planiregulador:prc_las_condes_zonificacion",
        "outputFormat": "application/json",
        "count": "1",
        "CQL_FILTER": f"INTERSECTS(geom,POINT({lng} {lat}))",
    }

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(wfs_url, params=params)
            if resp.status_code != 200:
                logger.warning(f"MINVU WFS returned HTTP {resp.status_code}: {resp.text[:500]}")
                return None
            data = resp.json()

        features = data.get("features", [])
        if not features:
            logger.info(f"MINVU WFS: no features at ({lat},{lng}). Full response: {data}")
            return None

        props = features[0].get("properties", {})
        logger.info(f"MINVU WFS properties: {props}")
        # Try common field names the MINVU layer might use
        zone = (
            props.get("zona")
            or props.get("ZONA")
            or props.get("cod_zona")
            or props.get("COD_ZONA")
            or props.get("nombre_zona")
            or props.get("zone_code")
        )
        return str(zone).strip() if zone else None

    except Exception as e:
        logger.warning(f"MINVU WFS error for ({lat},{lng}): {e}")
        return None
