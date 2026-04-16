// In production, API calls go to /api/v1/... (relative) which Vercel rewrites
// to Railway server-side — no CORS. In local dev, NEXT_PUBLIC_API_URL=http://localhost:8000.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

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
    approve: (id: string) =>
      apiFetch<{ status: string }>(`/expedients/${id}/approve`, { method: "POST" }),
    chat: (id: string, message: string, history: { role: string; content: string }[]) =>
      apiFetch<{ response: string }>(`/expedients/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message, history }),
      }),
  },
  intake: {
    queue: () => apiFetch<any[]>("/intake/queue"),
    getChecklist: (id: string) => apiFetch<ChecklistResult>(`/intake/${id}/checklist`),
    analyzeDocuments: (id: string) =>
      apiFetch<{ results: ChecklistItem[] }>(`/intake/${id}/analyze-documents`, { method: "POST" }),
    overrideChecklist: (id: string, requirement: string, finalStatus: "met" | "unmet") =>
      apiFetch(`/intake/${id}/checklist`, {
        method: "PATCH",
        body: JSON.stringify({ requirement, final_status: finalStatus }),
      }),
    getDocuments: (id: string) =>
      apiFetch<{ document_type: string; file_name: string; ai_status: string; [key: string]: string }[]>(`/intake/${id}/documents`),
    getDocumentUrl: (id: string, docType: string) =>
      apiFetch<{ url: string; file_name: string }>(`/intake/${id}/documents/${encodeURIComponent(docType)}/url`),
    admit: (id: string) => apiFetch(`/intake/${id}/admit`, { method: "POST" }),
    resubmit: (id: string, body: ResubmitRequest) =>
      apiFetch(`/intake/${id}/resubmit`, {
        method: "POST",
        body: JSON.stringify(body),
      }),
    architectExpedients: (email: string) =>
      apiFetch<any[]>(`/intake/architect/${encodeURIComponent(email)}/expedients`),
    extractFromDoc: async (docType: string, file: File): Promise<ExtractedParams> => {
      const fd = new FormData();
      fd.append("doc_type", docType);
      fd.append("file", file);
      const res = await fetch(`${API_URL}/api/v1/intake/extract-from-doc`, { method: "POST", body: fd });
      if (!res.ok) {
        const error = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(error.detail || "Extraction error");
      }
      return res.json();
    },
  },
  geo: {
    zoneFromCoords: (lat: number, lng: number) =>
      apiFetch<{ zone: string | null; source: string; error: string | null }>("/geo/zone-from-coords", {
        method: "POST",
        body: JSON.stringify({ lat, lng }),
      }),
    zoneParams: (zone: string) =>
      apiFetch<ZoneParamsResult>(`/geo/zone-params/${encodeURIComponent(zone)}`),
  },
};

// --- Types ---

export type ProjectType = "obra_nueva_residencial" | "ampliacion_residencial";
export type ExpedientStatus = "pendiente_admision" | "admitido" | "en_revision" | "observado" | "aprobado" | "rechazado";
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

export interface ChecklistItem {
  id?: string;
  requirement: string;
  ai_status: "pending" | "met" | "unmet" | "uncertain" | null;
  ai_confidence: "HIGH" | "MEDIUM" | "LOW" | null;
  ai_notes: string | null;
  final_status: "met" | "unmet" | null;
  officer_notes: string | null;
}

export interface ChecklistResult {
  checklist: ChecklistItem[];
  documents: { id: string; document_type: string; file_name: string; ai_status: string }[];
}

export interface ExtractedParams {
  // CIP fields
  cip_number?: string | null;
  cip_date?: string | null;
  zone?: string | null;
  cip_constructibilidad_max?: number | null;
  cip_ocupacion_suelo_max?: number | null;
  cip_altura_maxima_m?: number | null;
  cip_densidad_max_hab_ha?: number | null;
  cip_estacionamientos_min?: number | null;
  cip_distanciamiento_lateral_m?: number | null;
  cip_distanciamiento_fondo_m?: number | null;
  cip_antejardin_m?: number | null;
  // Declared fields
  declared_constructibilidad?: number | null;
  declared_ocupacion_suelo?: number | null;
  declared_altura_m?: number | null;
  declared_densidad_hab_ha?: number | null;
  declared_estacionamientos?: number | null;
  declared_distanciamiento_lateral_m?: number | null;
  declared_distanciamiento_fondo_m?: number | null;
  declared_antejardin_m?: number | null;
  declared_superficie_predio_m2?: number | null;
  declared_superficie_total_edificada_m2?: number | null;
  declared_num_unidades_vivienda?: number | null;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
}

export interface ZoneParamsResult {
  zone: string;
  source: string;
  disclaimer: string;
  params: {
    constructibilidad: number;
    ocupacion_suelo: number;
    altura_m: number;
    densidad: number;
    estacionamientos: number;
    distanciamiento_lateral_m: number;
    distanciamiento_fondo_m: number;
    antejardin_m: number;
  };
}

export interface ResubmitRequest {
  declared_constructibilidad?: number;
  declared_ocupacion_suelo?: number;
  declared_altura_m?: number;
  declared_densidad_hab_ha?: number;
  declared_estacionamientos?: number;
  declared_distanciamiento_lateral_m?: number;
  declared_distanciamiento_fondo_m?: number;
  declared_antejardin_m?: number;
  declared_superficie_total_edificada_m2?: number;
  declared_num_unidades_vivienda?: number;
  correction_notes?: string;
}
