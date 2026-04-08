"""
Supabase SQL schema definitions and Python dataclasses.
Run the SQL in db/migrations/001_initial.sql against your Supabase project.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from enum import Enum


class ProjectType(str, Enum):
    OBRA_NUEVA_RESIDENCIAL = "obra_nueva_residencial"
    AMPLIACION_RESIDENCIAL = "ampliacion_residencial"


class ExpedientStatus(str, Enum):
    ADMITIDO = "admitido"
    EN_REVISION = "en_revision"
    OBSERVADO = "observado"
    APROBADO = "aprobado"
    RECHAZADO = "rechazado"


class ObservationVerdict(str, Enum):
    VIOLATION = "VIOLATION"
    COMPLIANT = "COMPLIANT"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    SIN_DATOS = "SIN_DATOS"


class ObservationRoundStatus(str, Enum):
    NUEVA = "NUEVA"
    PENDIENTE = "PENDIENTE"
    SUBSANADA = "SUBSANADA"
    REABIERTA = "REABIERTA"


class ReviewerAction(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    EDITED = "edited"
    DISCARDED = "discarded"


class ActaStatus(str, Enum):
    DRAFT = "draft"
    PUBLISHED = "published"


@dataclass
class CIPParams:
    constructibilidad_max: float
    ocupacion_suelo_max: float
    altura_maxima_m: float
    densidad_max_hab_ha: float
    estacionamientos_min_per_vivienda: float
    distanciamiento_lateral_m: float
    distanciamiento_fondo_m: float
    antejardin_m: float


@dataclass
class DeclaredParams:
    constructibilidad: Optional[float]
    ocupacion_suelo: Optional[float]
    altura_m: Optional[float]
    densidad_hab_ha: Optional[float]
    estacionamientos_per_vivienda: Optional[float]
    distanciamiento_lateral_m: Optional[float]
    distanciamiento_fondo_m: Optional[float]
    antejardin_m: Optional[float]
    superficie_predio_m2: Optional[float]
    superficie_total_edificada_m2: Optional[float]
    num_unidades_vivienda: Optional[int]
