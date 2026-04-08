const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}/api/v1${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || "API error");
  }
  return res.json();
}

export const api = {
  expedients: {
    list: () => apiFetch<Expedient[]>("/expedients"),
    get: (id: string) => apiFetch<Expedient>(`/expedients/${id}`),
    analyze: (id: string) =>
      apiFetch(`/expedients/${id}/analyze`, { method: "POST" }),
    getCompliance: (id: string) =>
      apiFetch<ComplianceResult>(`/expedients/${id}/compliance`),
    updateObservation: (expedientId: string, obsId: string, body: ObservationAction) =>
      apiFetch(`/expedients/${expedientId}/observations/${obsId}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    getActa: (id: string) => apiFetch<Acta>(`/expedients/${id}/acta`),
    publishActa: (id: string) =>
      apiFetch(`/expedients/${id}/acta/publish`, { method: "POST" }),
  },
};

// --- Types ---

export type ProjectType = "obra_nueva_residencial" | "ampliacion_residencial";
export type ExpedientStatus = "admitido" | "en_revision" | "observado" | "aprobado" | "rechazado";
export type ObservationVerdict = "VIOLATION" | "COMPLIANT" | "NEEDS_REVIEW" | "SIN_DATOS";
export type ObservationRoundStatus = "NUEVA" | "PENDIENTE" | "SUBSANADA" | "REABIERTA";
export type ReviewerAction = "pending" | "accepted" | "edited" | "discarded";

export interface Expedient {
  id: string;
  exp_number: string;
  address: string;
  municipality: string;
  project_type: ProjectType;
  zone: string;
  architect_name: string;
  owner_name: string;
  status: ExpedientStatus;
  admitted_at: string;
  legal_deadline_at: string;
  legal_deadline_days: number;
  current_round: number;
  has_revisor_independiente: boolean;
  project_parameters?: ProjectParameters[];
}

export interface ProjectParameters {
  id: string;
  cip_number: string;
  cip_date: string;
  cip_constructibilidad_max: number;
  cip_ocupacion_suelo_max: number;
  cip_altura_maxima_m: number;
  cip_densidad_max_hab_ha: number;
  cip_estacionamientos_min: number;
  cip_distanciamiento_lateral_m: number;
  cip_distanciamiento_fondo_m: number;
  cip_antejardin_m: number;
  declared_constructibilidad: number;
  declared_ocupacion_suelo: number;
  declared_altura_m: number;
  declared_densidad_hab_ha: number;
  declared_estacionamientos: number;
  declared_distanciamiento_lateral_m: number;
  declared_distanciamiento_fondo_m: number;
  declared_antejardin_m: number;
  declared_superficie_predio_m2: number;
  declared_superficie_total_edificada_m2: number;
  declared_num_unidades_vivienda: number;
}

export interface Observation {
  id: string;
  expedient_id: string;
  compliance_check_id: string;
  round_introduced: number;
  parameter: string;
  ai_verdict: ObservationVerdict;
  ai_confidence: "HIGH" | "MEDIUM" | "LOW";
  declared_value: string;
  allowed_value: string;
  delta: string;
  normative_reference: string;
  chunk_ids: string[];
  ai_draft_text: string;
  round_status: ObservationRoundStatus;
  reviewer_action: ReviewerAction;
  reviewer_final_text: string | null;
  reviewer_discard_reason: string | null;
  reviewer_notes: string | null;
}

export interface ComplianceResult {
  status: string;
  check?: { id: string; round_number: number; completed_at: string };
  observations: Observation[];
}

export interface Acta {
  id: string;
  expedient_id: string;
  round_number: number;
  acta_number: string | null;
  status: "draft" | "published";
  content: {
    acta_text: string;
    observations: ActaObservation[];
    has_observations: boolean;
  };
  published_at: string | null;
}

export interface ActaObservation {
  number: number;
  parameter: string;
  title: string;
  text: string;
  normative_reference: string;
}

export interface ObservationAction {
  action: ReviewerAction;
  reviewer_final_text?: string;
  reviewer_discard_reason?: string;
  reviewer_notes?: string;
}
