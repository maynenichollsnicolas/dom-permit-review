"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api, Expedient, ComplianceResult, Acta, Observation } from "@/lib/api";
import { daysRemaining } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import {
  ArrowLeft, AlertTriangle, CheckCircle, ChevronRight, Loader2, FileText, ExternalLink,
} from "lucide-react";
import { ChecklistItem } from "@/components/observation-card";
import { ActaPanel } from "@/components/acta-panel";
import { PermitChecklist } from "@/components/permit-checklist";
import { getChecklist } from "@/lib/checklist";

// ─── Analysis stages ─────────────────────────────────────────────────────────

const STAGE_IDS = [
  { id: "params",   seconds: 2  },
  { id: "query",    seconds: 8  },
  { id: "reason",   seconds: 25 },
  { id: "generate", seconds: 10 },
  { id: "acta",     seconds: 8  },
];

function AnalysisProgress({ startedAt }: { startedAt: number }) {
  const { t } = useT();
  const p = t.domDetail.analysis.progress;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setElapsed((Date.now() - startedAt) / 1000), 500);
    return () => clearInterval(iv);
  }, [startedAt]);

  let cumulative = 0;
  const stageData = STAGE_IDS.map((s) => {
    const start = cumulative;
    cumulative += s.seconds;
    const end = cumulative;
    const status =
      elapsed >= end ? "done" :
      elapsed >= start ? "running" :
      "pending";
    const pct = status === "running" ? Math.min(100, ((elapsed - start) / s.seconds) * 100) : 0;
    const label = p.stages[s.id as keyof typeof p.stages];
    return { ...s, label, status, pct, end };
  });

  const totalSeconds = STAGE_IDS.reduce((a, s) => a + s.seconds, 0);
  const overallPct = Math.min(99, (elapsed / totalSeconds) * 100);

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className="px-6 py-4 border-b border-border bg-primary/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-primary animate-spin" />
            <span className="text-sm font-semibold text-foreground">{p.title}</span>
          </div>
          <span className="text-xs font-mono text-muted-foreground">{Math.round(overallPct)}%</span>
        </div>
        <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${overallPct}%` }} />
        </div>
      </div>

      <div className="divide-y divide-border/50">
        {stageData.map((stage) => (
          <div key={stage.id} className={`flex items-center gap-3 px-6 py-3 transition-colors ${stage.status === "running" ? "bg-primary/[0.03]" : ""}`}>
            <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
              {stage.status === "done" ? (
                <CheckCircle className="h-4 w-4 text-emerald-500" />
              ) : stage.status === "running" ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin" />
              ) : (
                <div className="h-4 w-4 rounded-full border-2 border-border" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${
                stage.status === "done" ? "text-muted-foreground line-through decoration-1" :
                stage.status === "running" ? "text-foreground font-medium" :
                "text-muted-foreground/50"
              }`}>
                {stage.label}
              </p>
              {stage.status === "running" && (
                <div className="mt-1.5 h-0.5 bg-secondary rounded-full overflow-hidden w-full max-w-xs">
                  <div className="h-full bg-primary/60 rounded-full transition-all duration-500" style={{ width: `${stage.pct}%` }} />
                </div>
              )}
            </div>
            {stage.status === "done" && (
              <span className="text-[10px] font-mono text-muted-foreground/50">{stage.seconds}s</span>
            )}
            {stage.status === "running" && (
              <span className="text-[10px] font-mono text-primary/60 animate-pulse">~{Math.ceil(stage.end - elapsed)}s</span>
            )}
          </div>
        ))}
      </div>

      <div className="px-6 py-3 bg-secondary/30 border-t border-border">
        <p className="text-xs text-muted-foreground">{p.subtitle(totalSeconds)}</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExpedientPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useT();
  const dd = t.domDetail;
  const [expedient, setExpedient] = useState<Expedient | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [acta, setActa] = useState<Acta | null>(null);
  const [documents, setDocuments] = useState<{ document_type: string; file_name: string; [key: string]: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [openingDoc, setOpeningDoc] = useState<Record<string, boolean>>({});
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStartedAt, setAnalysisStartedAt] = useState<number | null>(null);
  const [approving, setApproving] = useState(false);
  const [activeTab, setActiveTab] = useState("resumen");
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const autoTriggered = useRef(false);

  const load = async () => {
    const [exp, comp, actaData, docs] = await Promise.allSettled([
      api.expedients.get(id),
      api.expedients.getCompliance(id),
      api.expedients.getActa(id),
      api.intake.getDocuments(id),
    ]);
    if (exp.status === "fulfilled") setExpedient(exp.value);
    if (comp.status === "fulfilled") setCompliance(comp.value);
    if (actaData.status === "fulfilled") setActa(actaData.value);
    if (docs.status === "fulfilled") setDocuments(docs.value);
    setLoading(false);
  };

  const openDoc = async (docType: string) => {
    setOpeningDoc((prev) => ({ ...prev, [docType]: true }));
    try {
      const { url } = await api.intake.getDocumentUrl(id, docType);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert(dd.documents.openError);
    } finally {
      setOpeningDoc((prev) => ({ ...prev, [docType]: false }));
    }
  };

  useEffect(() => { load(); }, [id]);

  // Auto-trigger when not started
  useEffect(() => {
    if (
      compliance?.status === "not_started" &&
      !analyzing &&
      !autoTriggered.current
    ) {
      autoTriggered.current = true;
      handleAnalyze();
    }
  }, [compliance?.status]);

  // Poll while running
  useEffect(() => {
    if (compliance?.status === "running" || analyzing) {
      pollRef.current = setInterval(async () => {
        const comp = await api.expedients.getCompliance(id);
        setCompliance(comp);
        if (comp.status === "completed" || comp.status === "failed") {
          clearInterval(pollRef.current!);
          setAnalyzing(false);
          setAnalysisStartedAt(null);
          load();
        }
      }, 3000);
      return () => clearInterval(pollRef.current!);
    }
  }, [compliance?.status, analyzing]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisStartedAt(Date.now());
    await api.expedients.analyze(id);
    setCompliance({ status: "running", observations: [] });
  };

  const handleObservationUpdate = async (
    obsId: string, action: string, text?: string, reason?: string, notes?: string
  ) => {
    await api.expedients.updateObservation(id, obsId, {
      action: action as "accepted" | "edited" | "discarded",
      reviewer_final_text: text,
      reviewer_discard_reason: reason,
      reviewer_notes: notes,
    });
    const [comp, actaResult] = await Promise.all([
      api.expedients.getCompliance(id),
      api.expedients.getActa(id).catch(() => null),
    ]);
    setCompliance(comp);
    if (actaResult) setActa(actaResult);
  };

  const handleApprove = async () => {
    if (!confirm(dd.analysis.confirmApprove)) return;
    setApproving(true);
    try {
      await api.expedients.approve(id);
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Error al aprobar el expediente.");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t.common.loading}
        </div>
      </div>
    );
  }

  if (!expedient) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center text-muted-foreground">
        {t.lang === "en" ? "Application not found." : "Expediente no encontrado."}
      </div>
    );
  }

  const days = daysRemaining(expedient.legal_deadline_at);
  const params = expedient.project_parameters?.[0];
  const isRunning = compliance?.status === "running" || analyzing;

  // Build observation map: parameter → observation (for checklist rendering)
  const obsMap = Object.fromEntries(
    (compliance?.observations ?? []).map((o) => [o.parameter, o])
  );

  // Checklist for this project type
  const checklist = expedient ? getChecklist(expedient.project_type) : [];

  // Derive counts for summary bar + approval gate
  const allObs = compliance?.observations ?? [];
  const unreviewedCount = allObs.filter(
    (o) => o.reviewer_action === "pending" && o.ai_verdict !== "COMPLIANT"
  ).length;
  const confirmedCount = allObs.filter(
    (o) => o.reviewer_action === "accepted" || o.reviewer_action === "edited"
  ).length;
  const approvedCount = allObs.filter(
    (o) => o.reviewer_action === "discarded" || o.ai_verdict === "COMPLIANT"
  ).length;
  const canFinalize = unreviewedCount === 0;

  return (
    <div className="min-h-screen bg-grid flex flex-col">
      {/* Header */}
      <header className="bg-dom-header text-white px-6 sticky top-0 z-20 shadow-lg">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-white/50 hover:text-white/90 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <div className="flex items-center gap-2.5">
              <span className="font-mono font-semibold text-sm">{expedient.exp_number}</span>
              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                expedient.status === "observado"  ? "bg-amber-400/20 text-amber-200 border-amber-400/30" :
                expedient.status === "aprobado"   ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/30" :
                "bg-white/10 text-white/70 border-white/20"
              }`}>
                {t.status[expedient.status as keyof typeof t.status] ?? expedient.status}
              </span>
              <span className="font-mono text-xs bg-white/10 border border-white/15 px-2 py-0.5 rounded text-white/60">
                {expedient.zone}
              </span>
              <span className="text-xs text-white/40">{t.common.round} {expedient.current_round}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LangToggle />
            <div className={`text-sm font-semibold tabular-nums ${
              days <= 3 ? "text-red-300" : days <= 7 ? "text-amber-300" : "text-white/60"
            }`}>
              {days > 0 ? dd.header.daysLabel(days) : dd.header.expired}
              <span className="text-[11px] font-normal ml-1 opacity-70">{dd.header.legalLabel}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full px-6 py-6">
        {/* Sub-header */}
        <div className="mb-5">
          <p className="text-sm text-muted-foreground">{expedient.address} — {t.projectType[expedient.project_type] ?? expedient.project_type}</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            {expedient.architect_name} · {expedient.owner_name}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-5">
            <TabsTrigger value="resumen">{dd.tabs.resumen}</TabsTrigger>
            <TabsTrigger value="analisis">
              {dd.tabs.analisis}
              {unreviewedCount > 0 && (
                <span className="ml-2 bg-amber-100 text-amber-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreviewedCount}
                </span>
              )}
              {isRunning && (
                <Loader2 className="ml-2 h-3 w-3 animate-spin text-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="acta">{dd.tabs.acta}</TabsTrigger>
            <TabsTrigger value="documentos">
              {dd.tabs.documents}
              {documents.length > 0 && (
                <span className="ml-2 bg-secondary text-muted-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {documents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── TAB 1: Resumen ── */}
          <TabsContent value="resumen">
            <div className="space-y-5">
            <PermitChecklist
              expedient={expedient}
              compliance={compliance}
              documents={documents}
              acta={acta}
              variant="dom"
              onOpenDoc={openDoc}
              onGoToAnalysis={() => setActiveTab("analisis")}
              onGoToActa={() => setActiveTab("acta")}
            />
            <div className="grid grid-cols-2 gap-5">
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="text-sm">{dd.summary.expedientTitle}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-sm space-y-2.5">
                  <Row label={dd.summary.owner}     value={expedient.owner_name} />
                  <Row label={dd.summary.architect}  value={expedient.architect_name} />
                  <Row label={dd.summary.submitted}  value={new Date(expedient.admitted_at).toLocaleDateString(t.lang === "en" ? "en-US" : "es-CL")} />
                  <Row label={dd.summary.expires}    value={new Date(expedient.legal_deadline_at).toLocaleDateString(t.lang === "en" ? "en-US" : "es-CL")} />
                  <Row label={dd.summary.cipNumber}  value={params?.cip_number ?? "—"} />
                  <Row label={dd.summary.cipDate}    value={params?.cip_date ? new Date(params.cip_date).toLocaleDateString(t.lang === "en" ? "en-US" : "es-CL") : "—"} />
                  <Row label={dd.summary.ri}         value={expedient.has_revisor_independiente ? dd.summary.riYes : dd.summary.riNo} />
                </CardContent>
              </Card>

              <Card className="shadow-sm">
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="text-sm">{dd.summary.paramsTitle}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4">
                  {params ? (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left pb-2 font-medium">{t.lang === "en" ? "Parameter" : "Parámetro"}</th>
                          <th className="text-right pb-2 font-medium">{dd.summary.cip}</th>
                          <th className="text-right pb-2 font-medium">{dd.summary.declared}</th>
                          <th className="text-right pb-2 font-medium">{dd.summary.delta}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        <ParamRow l={dd.summary.rows.constructibilidad} cip={params.cip_constructibilidad_max} dec={params.declared_constructibilidad} dir="max" />
                        <ParamRow l={dd.summary.rows.ocupacion_suelo}   cip={params.cip_ocupacion_suelo_max}   dec={params.declared_ocupacion_suelo}   dir="max" />
                        <ParamRow l={dd.summary.rows.altura}            cip={params.cip_altura_maxima_m}       dec={params.declared_altura_m}          dir="max" />
                        <ParamRow l={dd.summary.rows.densidad}          cip={params.cip_densidad_max_hab_ha}   dec={params.declared_densidad_hab_ha}   dir="max" />
                        <ParamRow l={dd.summary.rows.estacionamientos}  cip={params.cip_estacionamientos_min}  dec={params.declared_estacionamientos}  dir="min" />
                        <ParamRow l={dd.summary.rows.distLateral}       cip={params.cip_distanciamiento_lateral_m} dec={params.declared_distanciamiento_lateral_m} dir="min" />
                        <ParamRow l={dd.summary.rows.distFondo}         cip={params.cip_distanciamiento_fondo_m}   dec={params.declared_distanciamiento_fondo_m}   dir="min" />
                        <ParamRow l={dd.summary.rows.antejardin}        cip={params.cip_antejardin_m}         dec={params.declared_antejardin_m}     dir="min" />
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-sm text-muted-foreground">{dd.summary.noParams}</p>
                  )}
                </CardContent>
              </Card>
            </div>
            </div>
          </TabsContent>

          {/* ── TAB 2: Análisis ── */}
          <TabsContent value="analisis">
            {isRunning && analysisStartedAt && (
              <AnalysisProgress startedAt={analysisStartedAt} />
            )}

            {isRunning && !analysisStartedAt && (
              <div className="text-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-sm font-medium text-foreground">{dd.analysis.runningTitle}</p>
                <p className="text-xs text-muted-foreground mt-1">{dd.analysis.runningSubtitle}</p>
              </div>
            )}

            {compliance?.status === "completed" && (
              <div className="space-y-4">
                {/* Summary bar */}
                <div className="flex items-center gap-4 px-5 py-3.5 bg-card rounded-xl border border-border text-sm shadow-sm flex-wrap">
                  <span className="text-muted-foreground font-medium text-xs uppercase tracking-wide">
                    {dd.analysis.summary.parameters(checklist.length)}
                  </span>
                  <div className="h-3 w-px bg-border" />
                  {unreviewedCount > 0 ? (
                    <span className="flex items-center gap-1.5 text-amber-600 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {dd.analysis.summary.pending(unreviewedCount)}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-emerald-600 font-medium">
                      <CheckCircle className="h-3.5 w-3.5" />
                      {dd.analysis.summary.allReviewed}
                    </span>
                  )}
                  {confirmedCount > 0 && (
                    <span className="flex items-center gap-1.5 text-red-600 font-medium">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      {confirmedCount} observación{confirmedCount !== 1 ? "es" : ""}
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    {dd.analysis.summary.approved(approvedCount)}
                  </span>
                </div>

                {/* Checklist — one row per parameter */}
                <div className="space-y-2">
                  {checklist.map(({ parameter, label }) => (
                    <ChecklistItem
                      key={parameter}
                      parameter={parameter}
                      label={label}
                      observation={obsMap[parameter] ?? null}
                      onAction={handleObservationUpdate}
                      documents={documents}
                      onOpenDoc={openDoc}
                    />
                  ))}
                </div>

                {/* Approval section */}
                <div className="border-t border-border pt-5 mt-2">
                  {expedient.status === "aprobado" ? (
                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                      <CheckCircle className="h-4 w-4" />
                      {dd.analysis.approved}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {unreviewedCount > 0 && (
                        <p className="text-xs text-amber-600">{dd.analysis.pendingWarning(unreviewedCount)}</p>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {confirmedCount > 0 ? (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={unreviewedCount > 0 || approving}
                            onClick={() => setActiveTab("acta")}
                          >
                            <CheckCircle className="h-4 w-4 mr-1.5" />
                            {dd.analysis.viewActa(confirmedCount)}
                          </Button>
                        ) : (
                          <Button
                            variant="default"
                            size="sm"
                            disabled={unreviewedCount > 0 || approving}
                            onClick={handleApprove}
                          >
                            {approving
                              ? <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{dd.analysis.approving}</>
                              : <><CheckCircle className="h-4 w-4 mr-1.5" />{dd.analysis.approveBtn}</>
                            }
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {compliance?.status === "failed" && (
              <div className="text-center py-16">
                <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto mb-3" />
                <p className="text-sm font-medium">{dd.analysis.failed}</p>
                <Button onClick={handleAnalyze} variant="outline" className="mt-4" size="sm">
                  {dd.analysis.retry}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ── TAB 3: Acta ── */}
          <TabsContent value="acta">
            <ActaPanel
              acta={acta}
              expedientId={id}
              expedient={expedient}
              observations={compliance?.observations ?? []}
              onPublish={load}
            />
          </TabsContent>

          {/* ── TAB 4: Documentos ── */}
          <TabsContent value="documentos">
            <Card className="shadow-sm">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-sm">{dd.documents.title}</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">{dd.documents.subtitle}</p>
              </CardHeader>
              <CardContent className="pt-4">
                {documents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">{dd.documents.empty}</p>
                ) : (
                  <div className="space-y-2">
                    {documents.map((doc) => {
                      const label = dd.documents.labels[doc.document_type] ?? doc.document_type.replace(/_/g, " ");
                      return (
                        <div key={doc.document_type} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{label}</p>
                              <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">{doc.file_name}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => openDoc(doc.document_type)}
                            disabled={openingDoc[doc.document_type]}
                            className="flex-shrink-0 ml-4 flex items-center gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                          >
                            {openingDoc[doc.document_type]
                              ? <Loader2 className="h-3 w-3 animate-spin" />
                              : <ExternalLink className="h-3 w-3" />
                            }
                            {dd.documents.open}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right">{value}</span>
    </div>
  );
}

function ParamRow({ l, cip, dec, dir }: {
  l: string; cip: number | null; dec: number | null; dir: "max" | "min";
}) {
  if (cip == null || dec == null) {
    return (
      <tr>
        <td className="py-1.5 text-muted-foreground">{l}</td>
        <td className="py-1.5 text-right text-muted-foreground/50">—</td>
        <td className="py-1.5 text-right text-muted-foreground/50">—</td>
        <td className="py-1.5 text-right text-muted-foreground/50">—</td>
      </tr>
    );
  }
  const ok = dir === "max" ? dec <= cip : dec >= cip;
  const delta = dec - cip;
  return (
    <tr>
      <td className="py-1.5 text-foreground/70">{l}</td>
      <td className="py-1.5 text-right text-muted-foreground tabular-nums">{cip}</td>
      <td className={`py-1.5 text-right font-semibold tabular-nums ${ok ? "text-emerald-600" : "text-red-600"}`}>{dec}</td>
      <td className={`py-1.5 text-right text-[11px] font-mono tabular-nums ${ok ? "text-emerald-500" : "text-red-500"}`}>
        {delta > 0 ? `+${delta.toFixed(2)}` : delta.toFixed(2)}
      </td>
    </tr>
  );
}
