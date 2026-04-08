"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Expedient, ComplianceResult, Acta, Observation } from "@/lib/api";
import {
  daysRemaining, deadlineColor, projectTypeLabel, statusLabel,
  statusColor, verdictColor, verdictLabel, parameterLabel,
} from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, AlertTriangle, CheckCircle, HelpCircle, Database, RefreshCw } from "lucide-react";
import { ObservationCard } from "@/components/observation-card";
import { ActaPanel } from "@/components/acta-panel";

export default function ExpedientPage() {
  const { id } = useParams<{ id: string }>();
  const [expedient, setExpedient] = useState<Expedient | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [acta, setActa] = useState<Acta | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  const load = async () => {
    const [exp, comp, actaData] = await Promise.allSettled([
      api.expedients.get(id),
      api.expedients.getCompliance(id),
      api.expedients.getActa(id),
    ]);
    if (exp.status === "fulfilled") setExpedient(exp.value);
    if (comp.status === "fulfilled") setCompliance(comp.value);
    if (actaData.status === "fulfilled") setActa(actaData.value);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  // Poll for compliance results if analysis is running
  useEffect(() => {
    if (compliance?.status === "running") {
      const interval = setInterval(async () => {
        const comp = await api.expedients.getCompliance(id);
        setCompliance(comp);
        if (comp.status === "completed" || comp.status === "failed") {
          clearInterval(interval);
          setAnalyzing(false);
          load(); // Reload acta too
        }
      }, 3000);
      setPollInterval(interval);
      return () => clearInterval(interval);
    }
  }, [compliance?.status]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    await api.expedients.analyze(id);
    setCompliance({ status: "running", observations: [] });
  };

  const handleObservationUpdate = async (
    obsId: string,
    action: string,
    text?: string,
    reason?: string,
    notes?: string
  ) => {
    await api.expedients.updateObservation(id, obsId, {
      action: action as "accepted" | "edited" | "discarded",
      reviewer_final_text: text,
      reviewer_discard_reason: reason,
      reviewer_notes: notes,
    });
    // Reload compliance and acta
    const [comp, actaData] = await Promise.all([
      api.expedients.getCompliance(id),
      api.expedients.getActa(id),
    ]);
    setCompliance(comp);
    setActa(actaData);
  };

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Cargando...</div>;
  }

  if (!expedient) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-500">Expediente no encontrado.</div>;
  }

  const days = daysRemaining(expedient.legal_deadline_at);
  const params = expedient.project_parameters?.[0];
  const violations = compliance?.observations?.filter((o) => o.ai_verdict === "VIOLATION") ?? [];
  const needsReview = compliance?.observations?.filter((o) => o.ai_verdict === "NEEDS_REVIEW") ?? [];
  const compliant = compliance?.observations?.filter((o) => o.ai_verdict === "COMPLIANT") ?? [];
  const sinDatos = compliance?.observations?.filter((o) => o.ai_verdict === "SIN_DATOS") ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <span className="font-semibold text-gray-900">Exp. #{expedient.exp_number}</span>
                <Badge className={statusColor(expedient.status)}>{statusLabel(expedient.status)}</Badge>
                <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{expedient.zone}</span>
                <span className="text-sm text-gray-500">Ronda {expedient.current_round}</span>
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{expedient.address} — {projectTypeLabel(expedient.project_type)}</p>
            </div>
          </div>
          <div className={`text-sm font-medium ${deadlineColor(days)}`}>
            {days > 0 ? `${days} días restantes` : "PLAZO VENCIDO"}
            <span className="text-xs text-gray-400 font-normal ml-1">(Ley 21.718)</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6">
        <Tabs defaultValue="resumen">
          <TabsList className="mb-6">
            <TabsTrigger value="resumen">Resumen del Proyecto</TabsTrigger>
            <TabsTrigger value="analisis">
              Análisis de Cumplimiento
              {violations.length > 0 && (
                <span className="ml-2 bg-red-100 text-red-700 text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {violations.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="acta">Acta de Observaciones</TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Resumen ── */}
          <TabsContent value="resumen">
            <div className="grid grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Datos del Expediente</CardTitle>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <Row label="Propietario" value={expedient.owner_name} />
                  <Row label="Arquitecto" value={expedient.architect_name} />
                  <Row label="Ingresado" value={new Date(expedient.admitted_at).toLocaleDateString("es-CL")} />
                  <Row label="CIP N°" value={params?.cip_number ?? "—"} />
                  <Row label="Fecha CIP" value={params?.cip_date ? new Date(params.cip_date).toLocaleDateString("es-CL") : "—"} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Parámetros — CIP vs. Declarado</CardTitle>
                </CardHeader>
                <CardContent>
                  {params ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-500 border-b">
                          <th className="text-left pb-2">Parámetro</th>
                          <th className="text-right pb-2">CIP (máx/mín)</th>
                          <th className="text-right pb-2">Declarado</th>
                          <th className="text-right pb-2">Delta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        <ParamRow label="Constructibilidad" cip={params.cip_constructibilidad_max} declared={params.declared_constructibilidad} direction="max" />
                        <ParamRow label="Ocupación suelo" cip={params.cip_ocupacion_suelo_max} declared={params.declared_ocupacion_suelo} direction="max" />
                        <ParamRow label="Altura (m)" cip={params.cip_altura_maxima_m} declared={params.declared_altura_m} direction="max" />
                        <ParamRow label="Densidad (hab/há)" cip={params.cip_densidad_max_hab_ha} declared={params.declared_densidad_hab_ha} direction="max" />
                        <ParamRow label="Estacionamientos/viv." cip={params.cip_estacionamientos_min} declared={params.declared_estacionamientos} direction="min" />
                        <ParamRow label="Dist. lateral (m)" cip={params.cip_distanciamiento_lateral_m} declared={params.declared_distanciamiento_lateral_m} direction="min" />
                        <ParamRow label="Dist. fondo (m)" cip={params.cip_distanciamiento_fondo_m} declared={params.declared_distanciamiento_fondo_m} direction="min" />
                        <ParamRow label="Antejardín (m)" cip={params.cip_antejardin_m} declared={params.declared_antejardin_m} direction="min" />
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-gray-500">No hay parámetros cargados.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TAB 2: Análisis ── */}
          <TabsContent value="analisis">
            {compliance?.status === "not_started" && (
              <div className="text-center py-16">
                <p className="text-gray-500 mb-4">El análisis aún no se ha ejecutado.</p>
                <Button onClick={handleAnalyze} disabled={analyzing}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Ejecutar análisis de IA
                </Button>
              </div>
            )}

            {(compliance?.status === "running" || analyzing) && (
              <div className="text-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">Analizando expediente con IA...</p>
                <p className="text-sm text-gray-400 mt-1">Verificando cumplimiento normativo contra OGUC y PRC Las Condes</p>
              </div>
            )}

            {compliance?.status === "completed" && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex items-center gap-4 p-4 bg-white rounded-lg border text-sm">
                  <span className="text-gray-500 font-medium">Análisis completado:</span>
                  <span className="flex items-center gap-1.5 text-red-600">
                    <AlertTriangle className="h-4 w-4" />
                    {violations.length} infracciones
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-600">
                    <HelpCircle className="h-4 w-4" />
                    {needsReview.length} revisar
                  </span>
                  <span className="flex items-center gap-1.5 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    {compliant.length} cumplen
                  </span>
                  {sinDatos.length > 0 && (
                    <span className="flex items-center gap-1.5 text-gray-400">
                      <Database className="h-4 w-4" />
                      {sinDatos.length} sin datos
                    </span>
                  )}
                </div>

                {/* NEEDS_REVIEW first (require action) */}
                {needsReview.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-2">
                      Requieren tu decisión
                    </p>
                    {needsReview.map((obs) => (
                      <ObservationCard key={obs.id} observation={obs} onAction={handleObservationUpdate} />
                    ))}
                  </div>
                )}

                {/* VIOLATIONS */}
                {violations.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-red-700 uppercase tracking-wide mb-2">
                      Infracciones detectadas
                    </p>
                    {violations.map((obs) => (
                      <ObservationCard key={obs.id} observation={obs} onAction={handleObservationUpdate} />
                    ))}
                  </div>
                )}

                {/* COMPLIANT (muted) */}
                {compliant.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-green-700 uppercase tracking-wide mb-2">
                      Parámetros que cumplen
                    </p>
                    {compliant.map((obs) => (
                      <ObservationCard key={obs.id} observation={obs} onAction={handleObservationUpdate} />
                    ))}
                  </div>
                )}

                {/* SIN_DATOS */}
                {sinDatos.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Sin datos normativos — requieren revisión manual
                    </p>
                    {sinDatos.map((obs) => (
                      <ObservationCard key={obs.id} observation={obs} onAction={handleObservationUpdate} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          {/* ── TAB 3: Acta ── */}
          <TabsContent value="acta">
            <ActaPanel acta={acta} expedientId={id} onPublish={load} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}

function ParamRow({
  label, cip, declared, direction,
}: {
  label: string;
  cip: number | null;
  declared: number | null;
  direction: "max" | "min";
}) {
  if (cip == null || declared == null) {
    return (
      <tr>
        <td className="py-1.5 text-gray-600">{label}</td>
        <td className="py-1.5 text-right text-gray-400">{cip ?? "—"}</td>
        <td className="py-1.5 text-right text-gray-400">{declared ?? "—"}</td>
        <td className="py-1.5 text-right text-gray-400">—</td>
      </tr>
    );
  }

  const isOk = direction === "max" ? declared <= cip : declared >= cip;
  const delta = declared - cip;

  return (
    <tr>
      <td className="py-1.5 text-gray-600">{label}</td>
      <td className="py-1.5 text-right text-gray-500">{cip}</td>
      <td className={`py-1.5 text-right font-medium ${isOk ? "text-green-700" : "text-red-600"}`}>
        {declared}
      </td>
      <td className={`py-1.5 text-right text-xs ${isOk ? "text-green-600" : "text-red-600"}`}>
        {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
      </td>
    </tr>
  );
}
