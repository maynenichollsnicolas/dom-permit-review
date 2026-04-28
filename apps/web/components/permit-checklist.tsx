"use client";

import { CheckCircle, Clock, Circle, AlertTriangle, FileText, Loader2, ExternalLink } from "lucide-react";
import { Expedient, ComplianceResult, Acta } from "@/lib/api";
import { useT } from "@/lib/i18n";

// ─── Required documents ──────────────────────────────────────────────────────

export const REQUIRED_DOCS: { key: string; mandatory: boolean }[] = [
  { key: "solicitud_firmada",      mandatory: true  },
  { key: "cip_vigente",            mandatory: true  },
  { key: "fue",                    mandatory: true  },
  { key: "planos_arquitectonicos", mandatory: true  },
  { key: "cuadro_superficies",     mandatory: true  },
  { key: "memoria_calculo",        mandatory: true  },
  { key: "factibilidad_sanitaria", mandatory: true  },
  { key: "informe_ri",             mandatory: false },
];

// ─── Stage status ─────────────────────────────────────────────────────────────

type StageStatus = "done" | "in_progress" | "warning" | "pending";

function statusIcon(s: StageStatus) {
  if (s === "done")        return <CheckCircle className="h-5 w-5 text-emerald-500 flex-shrink-0" />;
  if (s === "in_progress") return <Loader2 className="h-5 w-5 text-primary animate-spin flex-shrink-0" />;
  if (s === "warning")     return <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />;
  return <Circle className="h-5 w-5 text-border flex-shrink-0" />;
}

function statusBadge(s: StageStatus, label: string) {
  const cls =
    s === "done"        ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
    s === "in_progress" ? "bg-primary/10 text-primary border-primary/20" :
    s === "warning"     ? "bg-amber-50 text-amber-700 border-amber-200" :
    "bg-secondary text-muted-foreground border-border";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PermitChecklistProps {
  expedient: Expedient;
  compliance?: ComplianceResult | null;
  documents?: { document_type: string; file_name: string }[];
  acta?: Acta | null;
  variant: "dom" | "architect";
  onOpenDoc?: (docType: string) => void;
  onGoToDocs?: () => void;
  onGoToAnalysis?: () => void;
  onGoToActa?: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function PermitChecklist({
  expedient,
  compliance,
  documents = [],
  acta,
  variant,
  onOpenDoc,
  onGoToDocs,
  onGoToAnalysis,
  onGoToActa,
}: PermitChecklistProps) {
  const { t } = useT();
  const cl = t.checklist;

  const status = expedient.status;
  const uploadedTypes = new Set(documents.map((d) => d.document_type));
  const mandatoryDocs = REQUIRED_DOCS.filter((d) => d.mandatory);
  const uploadedMandatory = mandatoryDocs.filter((d) => uploadedTypes.has(d.key));
  const allMandatoryUploaded = uploadedMandatory.length === mandatoryDocs.length;

  const admitted = status !== "pendiente_admision";
  const compStatus = compliance?.status ?? "not_started";
  const compDone = compStatus === "completed";
  const compRunning = compStatus === "running";

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

  const allReviewed = compDone && unreviewedCount === 0;
  const resolved = status === "aprobado" || (status === "observado" && acta?.status === "published");

  const stages: {
    id: string;
    label: string;
    status: StageStatus;
    statusLabel: string;
    detail: string;
    sub?: React.ReactNode;
    action?: React.ReactNode;
  }[] = [
    {
      id: "documentos",
      label: cl.stages.documentos.label,
      status: allMandatoryUploaded ? "done" : admitted ? "warning" : "in_progress",
      statusLabel: allMandatoryUploaded
        ? cl.stages.documentos.done
        : cl.stages.documentos.progress(uploadedMandatory.length, mandatoryDocs.length),
      detail: allMandatoryUploaded
        ? cl.stages.documentos.detailDone
        : cl.stages.documentos.detailMissing(mandatoryDocs.length - uploadedMandatory.length),
      action: !allMandatoryUploaded && onGoToDocs && variant === "architect" ? (
        <button onClick={onGoToDocs} className="text-xs text-primary hover:underline font-medium">
          {cl.stages.documentos.uploadDocs}
        </button>
      ) : undefined,
      sub: (
        <div className="mt-2 grid grid-cols-2 gap-1">
          {mandatoryDocs.map((doc) => {
            const uploaded = uploadedTypes.has(doc.key);
            return (
              <div key={doc.key} className="flex items-center gap-1.5 text-xs">
                {uploaded
                  ? <CheckCircle className="h-3 w-3 text-emerald-500 flex-shrink-0" />
                  : <Circle className="h-3 w-3 text-border flex-shrink-0" />
                }
                <span className={uploaded ? "text-foreground/70" : "text-muted-foreground/50"}>
                  {cl.docs[doc.key] ?? doc.key}
                </span>
                {uploaded && onOpenDoc && variant === "dom" && (
                  <button
                    onClick={() => onOpenDoc(doc.key)}
                    className="ml-auto text-primary/60 hover:text-primary transition-colors"
                    title={`${cl.docs[doc.key] ?? doc.key}`}
                  >
                    <ExternalLink className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ),
    },
    {
      id: "admisibilidad",
      label: cl.stages.admisibilidad.label,
      status: admitted ? "done" : "in_progress",
      statusLabel: admitted ? cl.stages.admisibilidad.approved : cl.stages.admisibilidad.pending,
      detail: admitted ? cl.stages.admisibilidad.detailDone : cl.stages.admisibilidad.detailPending,
    },
    {
      id: "analisis",
      label: cl.stages.analisis.label,
      status: compDone ? "done" : compRunning ? "in_progress" : "pending",
      statusLabel: compDone
        ? cl.stages.analisis.params(allObs.length)
        : compRunning ? cl.stages.analisis.running : cl.stages.analisis.pending,
      detail: compDone
        ? cl.stages.analisis.detailDone(approvedCount, confirmedCount)
        : compRunning
        ? cl.stages.analisis.detailRunning
        : cl.stages.analisis.detailPending,
      action: compDone && onGoToAnalysis ? (
        <button onClick={onGoToAnalysis} className="text-xs text-primary hover:underline font-medium">
          {cl.stages.analisis.viewParams}
        </button>
      ) : undefined,
    },
    {
      id: "revision",
      label: cl.stages.revision.label,
      status: allReviewed ? "done" : compDone ? "in_progress" : "pending",
      statusLabel: allReviewed
        ? cl.stages.revision.done
        : compDone
        ? cl.stages.revision.pendingCount(unreviewedCount)
        : cl.stages.revision.pending,
      detail: allReviewed
        ? confirmedCount > 0
          ? cl.stages.revision.detailDoneObs(confirmedCount)
          : cl.stages.revision.detailDoneClean
        : compDone
        ? cl.stages.revision.detailPendingObs(unreviewedCount)
        : cl.stages.revision.detailPendingWait,
      action: compDone && !allReviewed && onGoToAnalysis ? (
        <button onClick={onGoToAnalysis} className="text-xs text-primary hover:underline font-medium">
          {cl.stages.revision.goReview}
        </button>
      ) : undefined,
    },
    {
      id: "resolucion",
      label: cl.stages.resolucion.label,
      status: resolved ? "done" : allReviewed ? "in_progress" : "pending",
      statusLabel: status === "aprobado"
        ? cl.stages.resolucion.approved
        : status === "observado"
        ? cl.stages.resolucion.observed
        : allReviewed ? cl.stages.resolucion.ready : cl.stages.resolucion.pending,
      detail: status === "aprobado"
        ? cl.stages.resolucion.detailApproved
        : status === "observado" && acta?.status === "published"
        ? cl.stages.resolucion.detailObserved(acta.acta_number ?? "—", confirmedCount)
        : allReviewed
        ? confirmedCount > 0
          ? cl.stages.resolucion.detailReadyObs
          : cl.stages.resolucion.detailReadyClean
        : cl.stages.resolucion.detailPending,
      action: allReviewed && !resolved && onGoToActa ? (
        <button onClick={onGoToActa} className="text-xs text-primary hover:underline font-medium">
          {confirmedCount > 0 ? cl.stages.resolucion.viewActa : cl.stages.resolucion.approveBtn}
        </button>
      ) : undefined,
    },
  ];

  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 border-b border-border bg-secondary/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">{cl.title}</span>
        </div>
        {(() => {
          const doneCount = stages.filter((s) => s.status === "done").length;
          return (
            <span className="text-xs text-muted-foreground font-medium">
              {cl.completed(doneCount, stages.length)}
            </span>
          );
        })()}
      </div>

      <div className="divide-y divide-border/50">
        {stages.map((stage) => (
          <div key={stage.id} className={`px-5 py-4 ${stage.status === "in_progress" ? "bg-primary/[0.02]" : ""}`}>
            <div className="flex items-start gap-3">
              {statusIcon(stage.status)}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${
                    stage.status === "done"        ? "text-foreground/80" :
                    stage.status === "in_progress" ? "text-foreground" :
                    stage.status === "warning"     ? "text-foreground" :
                    "text-muted-foreground/50"
                  }`}>
                    {stage.label}
                  </span>
                  {statusBadge(stage.status, stage.statusLabel)}
                  {stage.action}
                </div>
                <p className={`text-xs mt-0.5 leading-relaxed ${
                  stage.status === "pending" ? "text-muted-foreground/40" : "text-muted-foreground"
                }`}>
                  {stage.detail}
                </p>
                {stage.sub}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
