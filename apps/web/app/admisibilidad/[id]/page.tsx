"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api, ChecklistItem } from "@/lib/api";
import { statusLabel, statusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Building2, CheckCircle, XCircle, HelpCircle,
  Loader2, FileText, Scan, ThumbsUp, ThumbsDown,
} from "lucide-react";

const REQUIREMENT_LABELS: Record<string, string> = {
  solicitud_firmada: "Solicitud firmada (propietario + arquitecto)",
  cip_vigente: "CIP vigente",
  fue: "FUE (Formulario Único de Estadísticas)",
  planos_arquitectonicos: "Planos arquitectónicos",
  cuadro_superficies: "Cuadro de superficies y cabida normativa",
  memoria_calculo: "Memoria de cálculo estructural",
  factibilidad_sanitaria: "Certificado de factibilidad sanitaria",
  informe_ri: "Informe Revisor Independiente (si aplica)",
};

export default function AdmisibilidadDetail() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [expedient, setExpedient] = useState<any | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [admitting, setAdmitting] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, "met" | "unmet">>({});
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const [expRes, clRes] = await Promise.all([
        api.expedients.get(id),
        api.intake.getChecklist(id),
      ]);
      setExpedient(expRes);
      setChecklist(clRes.checklist);
      setDocuments(clRes.documents);
    } catch (e) {
      setError("Error al cargar el expediente.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [id]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);
    try {
      await api.intake.analyzeDocuments(id);
      await load();
    } catch (e: any) {
      setError(e.message || "Error al analizar documentos.");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleAdmit = async () => {
    setAdmitting(true);
    setError(null);
    try {
      await api.intake.admit(id);
      router.push("/admisibilidad");
    } catch (e: any) {
      setError(e.message || "Error al admitir expediente.");
      setAdmitting(false);
    }
  };

  const toggleOverride = async (req: string, newStatus: "met" | "unmet") => {
    const current = overrides[req];
    if (current === newStatus) {
      // Click same button again → remove local override (revert to AI result)
      setOverrides((prev) => { const n = { ...prev }; delete n[req]; return n; });
      return;
    }
    setOverrides((prev) => ({ ...prev, [req]: newStatus }));

    // Persist to DB (non-fatal)
    try {
      await api.intake.overrideChecklist(id, req, newStatus);
    } catch {
      // UI override still works even if DB save fails
    }
  };

  const effectiveStatus = (item: ChecklistItem): "met" | "unmet" | "uncertain" | "pending" => {
    if (overrides[item.requirement]) return overrides[item.requirement];
    if (item.final_status) return item.final_status;
    if (item.ai_status) return item.ai_status as any;
    return "pending";
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Cargando...</p>
      </div>
    );
  }

  if (error && !expedient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  const params = expedient?.project_parameters?.[0];
  const hasDocuments = documents.length > 0;
  const hasAiResults = checklist.some((c) => c.ai_status && c.ai_status !== "pending");

  // Determine readiness: all items (with overrides) must be "met" or "uncertain"
  const effectiveStatuses = checklist.map((item) => effectiveStatus(item));
  const allMet = effectiveStatuses.every((s) => s === "met" || s === "uncertain");
  const anyUnmet = effectiveStatuses.some((s) => s === "unmet");

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/admisibilidad" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex items-center gap-3">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900">
                    Exp. #{expedient?.exp_number}
                  </span>
                  {expedient && (
                    <Badge className={statusColor(expedient.status)}>
                      {statusLabel(expedient.status)}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-gray-500">{expedient?.address}</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Project summary */}
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader><CardTitle className="text-sm">Datos del proyecto</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-2">
              <Row label="Propietario" value={expedient?.owner_name ?? "—"} />
              <Row label="Arquitecto" value={expedient?.architect_name ?? "—"} />
              <Row label="Zona" value={expedient?.zone ?? "—"} />
              <Row label="Ingresado" value={
                expedient?.submitted_at
                  ? new Date(expedient.submitted_at).toLocaleDateString("es-CL")
                  : "—"
              } />
              {params && (
                <>
                  <Row label="CIP N°" value={params.cip_number ?? "—"} />
                  <Row label="Revisor Independiente" value={expedient?.has_revisor_independiente ? "Sí" : "No"} />
                </>
              )}
            </CardContent>
          </Card>

          {/* Document inventory */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Documentos subidos</CardTitle>
                <span className="text-xs text-gray-400">{documents.length} archivo{documents.length !== 1 ? "s" : ""}</span>
              </div>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-gray-400">Sin documentos adjuntos aún.</p>
              ) : (
                <ul className="space-y-1.5">
                  {documents.map((doc) => (
                    <li key={doc.id} className="flex items-center gap-2 text-xs text-gray-600">
                      <FileText className="h-3 w-3 text-gray-400 flex-shrink-0" />
                      <span className="font-medium">{REQUIREMENT_LABELS[doc.document_type] ?? doc.document_type}</span>
                      <span className="text-gray-400 truncate">— {doc.file_name}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Checklist */}
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm">Checklist Art. 5.1.6 OGUC</CardTitle>
                <p className="text-xs text-gray-500 mt-1">
                  {hasAiResults
                    ? "Resultados del análisis de IA. Puedes aprobar o rechazar manualmente."
                    : hasDocuments
                    ? "Documentos subidos. Ejecuta el análisis de IA para verificar automáticamente."
                    : "Sin documentos. El arquitecto no ha subido archivos aún."}
                </p>
              </div>
              {hasDocuments && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleAnalyze}
                  disabled={analyzing}
                >
                  {analyzing
                    ? <><Loader2 className="h-3 w-3 animate-spin mr-2" />Analizando...</>
                    : <><Scan className="h-3 w-3 mr-2" />{hasAiResults ? "Re-analizar" : "Analizar con IA"}</>
                  }
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-2">
            {checklist.map((item) => {
              const status = effectiveStatus(item);
              const overrideSet = overrides[item.requirement];

              return (
                <div key={item.requirement}
                  className={`flex items-start gap-3 p-3 rounded-lg border ${
                    status === "met" ? "border-green-200 bg-green-50/40"
                    : status === "unmet" ? "border-red-200 bg-red-50/40"
                    : status === "uncertain" ? "border-amber-200 bg-amber-50/40"
                    : "border-gray-200 bg-white"
                  }`}
                >
                  <StatusIcon status={status} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800">
                      {REQUIREMENT_LABELS[item.requirement] ?? item.requirement}
                    </p>
                    {item.ai_notes && (
                      <p className="text-xs text-gray-500 mt-0.5">{item.ai_notes}</p>
                    )}
                    {item.ai_confidence && (
                      <span className="text-xs text-gray-400">
                        Confianza IA: {item.ai_confidence}
                        {overrideSet && " · Anulado por revisor"}
                      </span>
                    )}
                    {!hasAiResults && (
                      <p className="text-xs text-gray-400">Pendiente de análisis</p>
                    )}
                  </div>
                  {/* Manual override buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    <button
                      onClick={() => toggleOverride(item.requirement, "met")}
                      title="Marcar como cumplido"
                      className={`p-1.5 rounded-md transition-colors ${
                        overrideSet === "met"
                          ? "bg-green-100 text-green-700"
                          : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                      }`}
                    >
                      <ThumbsUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => toggleOverride(item.requirement, "unmet")}
                      title="Marcar como faltante"
                      className={`p-1.5 rounded-md transition-colors ${
                        overrideSet === "unmet"
                          ? "bg-red-100 text-red-700"
                          : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                      }`}
                    >
                      <ThumbsDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Decision area */}
        <Card className={anyUnmet ? "border-red-200" : "border-green-200"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                {anyUnmet ? (
                  <div>
                    <p className="font-medium text-red-800">Documentación incompleta</p>
                    <p className="text-sm text-red-600">
                      Faltan documentos requeridos. Debes devolver el expediente al arquitecto.
                    </p>
                  </div>
                ) : allMet ? (
                  <div>
                    <p className="font-medium text-green-800">Documentación completa</p>
                    <p className="text-sm text-green-700">
                      Todos los requisitos están cubiertos. Puedes admitir el expediente.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="font-medium text-gray-700">Pendiente de verificación</p>
                    <p className="text-sm text-gray-500">
                      Analiza los documentos con IA o marca manualmente cada requisito.
                    </p>
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => router.push("/admisibilidad")}
                  className="text-gray-600"
                >
                  Volver
                </Button>
                <Button
                  onClick={handleAdmit}
                  disabled={admitting || anyUnmet || !allMet}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  {admitting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Admitiendo...</>
                    : <><CheckCircle className="h-4 w-4 mr-2" />Admitir expediente</>
                  }
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatusIcon({ status }: { status: string }) {
  if (status === "met") return <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />;
  if (status === "unmet") return <XCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />;
  if (status === "uncertain") return <HelpCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />;
  return <div className="h-4 w-4 mt-0.5 flex-shrink-0 rounded-full border-2 border-gray-300" />;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
