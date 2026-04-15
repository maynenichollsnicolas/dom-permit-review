"use client";

import { useState } from "react";
import { Observation } from "@/lib/api";
import { useT } from "@/lib/i18n";
import {
  Check, Pencil, X, AlertTriangle, HelpCircle, Database,
  ChevronDown, ChevronUp, CircleDashed, Plus, ExternalLink, BookOpen,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

type ItemState =
  | "unanalyzed"
  | "ai_approved"
  | "needs_decision"
  | "reviewer_approved"
  | "observation_confirmed";

function getItemState(obs: Observation | null): ItemState {
  if (!obs) return "unanalyzed";
  if (obs.ai_verdict === "COMPLIANT" && obs.reviewer_action === "pending") return "ai_approved";
  if (obs.reviewer_action === "pending") return "needs_decision";
  if (obs.reviewer_action === "discarded") return "reviewer_approved";
  return "observation_confirmed";
}

// ─── Normative source parser ─────────────────────────────────────────────────

function parseNormativeSource(ref: string | null | undefined): { label: string; color: string } | null {
  if (!ref) return null;
  const r = ref.toUpperCase();
  if (r.includes("OGUC"))        return { label: "OGUC",          color: "bg-blue-50 text-blue-700 border-blue-200" };
  if (r.includes("LGUC"))        return { label: "LGUC",          color: "bg-indigo-50 text-indigo-700 border-indigo-200" };
  if (r.includes("LEY"))         return { label: "Ley 21.718",    color: "bg-purple-50 text-purple-700 border-purple-200" };
  if (r.includes("PRC") || r.includes("LAS CONDES") || r.includes("TABLA"))
                                  return { label: "PRC Las Condes", color: "bg-teal-50 text-teal-700 border-teal-200" };
  return null;
}

const CIP_PARAMS = new Set([
  "constructibilidad", "ocupacion_suelo", "altura_m", "densidad_hab_ha",
  "estacionamientos", "distanciamiento_lateral_m", "distanciamiento_fondo_m", "antejardin_m",
]);
const CUADRO_PARAMS = new Set([
  "constructibilidad", "ocupacion_suelo", "densidad_hab_ha", "estacionamientos",
]);
const PLANOS_PARAMS = new Set([
  "altura_m", "distanciamiento_lateral_m", "distanciamiento_fondo_m", "antejardin_m",
]);

// Spanish reason values are stored in the DB regardless of display language
const DISCARD_REASON_KEYS = [
  "Error de cálculo del AI",
  "Excepción normativa aplicable",
  "Dato de entrada incorrecto",
  "Parámetro no aplica a este proyecto",
  "Observación duplicada",
];

// ─── ChecklistItem ────────────────────────────────────────────────────────────

interface ChecklistItemProps {
  parameter: string;
  label: string;
  observation: Observation | null;
  onAction: (id: string, action: string, text?: string, reason?: string, notes?: string) => Promise<void>;
  documents?: { document_type: string; file_name: string }[];
  onOpenDoc?: (docType: string) => Promise<void>;
}

export function ChecklistItem({ parameter, label, observation: obs, onAction, documents = [], onOpenDoc }: ChecklistItemProps) {
  const { t } = useT();
  const o = t.obs;

  const state = getItemState(obs);
  const [mode, setMode] = useState<"view" | "edit" | "discard">("view");
  const [expanded, setExpanded] = useState(false);
  const [editText, setEditText] = useState(obs?.reviewer_final_text ?? obs?.ai_draft_text ?? "");
  const [discardReasonIdx, setDiscardReasonIdx] = useState(-1);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isViolation   = obs?.ai_verdict === "VIOLATION";
  const isNeedsReview = obs?.ai_verdict === "NEEDS_REVIEW";
  const isSinDatos    = obs?.ai_verdict === "SIN_DATOS";

  const handleAccept = async () => {
    if (!obs) return;
    setSaving(true);
    await onAction(obs.id, "accepted", obs.ai_draft_text ?? "");
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!obs || !editText.trim()) return;
    setSaving(true);
    await onAction(obs.id, "edited", editText, undefined, notes || undefined);
    setMode("view");
    setExpanded(false);
    setSaving(false);
  };

  const handleDiscard = async (reasonIdx: number) => {
    if (!obs) return;
    setSaving(true);
    // Always store Spanish reason key in DB for consistency
    await onAction(obs.id, "discarded", undefined, DISCARD_REASON_KEYS[reasonIdx], notes || undefined);
    setMode("view");
    setExpanded(false);
    setSaving(false);
  };

  const handleManualApprove = async () => {
    if (!obs) return;
    setSaving(true);
    await onAction(obs.id, "discarded", undefined, "Revisado manualmente — sin infracción detectada");
    setSaving(false);
  };

  const cancelEdit = () => {
    setMode("view");
    setEditText(obs?.reviewer_final_text ?? obs?.ai_draft_text ?? "");
    setNotes("");
  };

  const cancelDiscard = () => {
    setMode("view");
    setDiscardReasonIdx(-1);
    setNotes("");
  };

  // ── Compact rows ────────────────────────────────────────────────────────────

  if (state === "unanalyzed") {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-card border border-dashed border-border rounded-xl">
        <CircleDashed className="h-4 w-4 text-orange-400/60 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground/70">{label}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-orange-600 bg-orange-50 border border-orange-100 px-1.5 py-0.5 rounded-full">
              {o.unanalyzed}
            </span>
          </div>
          <p className="text-xs text-muted-foreground/60 mt-0.5">{o.unanalyzedDetail}</p>
        </div>
      </div>
    );
  }

  if (state === "ai_approved" && !expanded) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl">
        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Check className="h-3 w-3 text-white" />
        </div>
        <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground/80">{label}</span>
          <span className="text-[10px] text-emerald-600 font-semibold">{o.aiApproved}</span>
          {obs?.declared_value && (
            <span className="text-xs font-mono text-muted-foreground ml-auto">{obs.declared_value}</span>
          )}
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="text-muted-foreground/30 hover:text-muted-foreground transition-colors ml-1"
          title={o.viewDetails}
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (state === "reviewer_approved" && !expanded) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-card border border-border rounded-xl">
        <div className="h-5 w-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
          <Check className="h-3 w-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground/80">{label}</span>
            <span className="text-[10px] text-emerald-600 font-semibold">{o.reviewerApproved}</span>
          </div>
          {obs?.reviewer_discard_reason && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{obs.reviewer_discard_reason}</p>
          )}
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="text-muted-foreground/30 hover:text-muted-foreground transition-colors ml-1"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (state === "observation_confirmed" && !expanded) {
    return (
      <div className="flex items-start gap-3 px-4 py-2.5 bg-card border border-red-100 rounded-xl">
        <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
          <AlertTriangle className="h-3 w-3 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-foreground/80">{label}</span>
            <span className="text-[10px] text-red-600 font-semibold">{o.observationConfirmed}</span>
            {obs?.reviewer_action === "edited" && (
              <span className="text-[10px] text-primary font-semibold bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                {t.acta.editedBadge}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1 leading-relaxed">
            {obs?.reviewer_final_text || obs?.ai_draft_text}
          </p>
        </div>
        <button
          onClick={() => setExpanded(true)}
          className="text-muted-foreground/30 hover:text-muted-foreground transition-colors flex-shrink-0"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  // ── Full card ───────────────────────────────────────────────────────────────

  const accentCls =
    state === "needs_decision" && isViolation   ? "bg-red-500" :
    state === "needs_decision" && isNeedsReview ? "bg-amber-400" :
    state === "needs_decision" && isSinDatos    ? "bg-muted-foreground/25" :
    state === "observation_confirmed"            ? "bg-red-400" :
    "bg-emerald-400";

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      <div className={`h-[3px] ${accentCls}`} />

      <div className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 min-w-0">
            <div>
              {state === "needs_decision" && isViolation && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />{o.violation}
                </span>
              )}
              {state === "needs_decision" && isNeedsReview && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                  <HelpCircle className="h-2.5 w-2.5" />{o.needsReview}
                </span>
              )}
              {state === "needs_decision" && isSinDatos && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-secondary text-muted-foreground border border-border px-2 py-0.5 rounded-full">
                  <Database className="h-2.5 w-2.5" />{o.noData}
                </span>
              )}
              {state === "ai_approved" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Check className="h-2.5 w-2.5" />{o.aiApproved}
                </span>
              )}
              {state === "reviewer_approved" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  <Check className="h-2.5 w-2.5" />{o.reviewerApproved}
                </span>
              )}
              {state === "observation_confirmed" && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full">
                  <AlertTriangle className="h-2.5 w-2.5" />{o.observationConfirmed}
                </span>
              )}
            </div>
            <p className="text-sm font-semibold text-foreground leading-snug">{label}</p>
          </div>

          <div className="flex items-start gap-3 flex-shrink-0">
            {obs?.declared_value && obs?.allowed_value && (
              <div className="text-right text-xs space-y-0.5">
                <p className="text-muted-foreground">{o.declared}</p>
                <p className="font-mono font-semibold text-foreground">{obs.declared_value}</p>
                <p className="text-muted-foreground mt-1">{o.allowed}</p>
                <p className="font-mono text-muted-foreground">{obs.allowed_value}</p>
              </div>
            )}
            {expanded && state !== "needs_decision" && (
              <button
                onClick={() => { setExpanded(false); setMode("view"); }}
                className="text-muted-foreground/30 hover:text-muted-foreground transition-colors mt-0.5"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {mode === "edit" ? (
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            rows={4}
            placeholder={isSinDatos ? o.editPlaceholder : undefined}
            className="w-full text-sm bg-secondary/40 border border-border rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
          />
        ) : (
          <>
            {isSinDatos && state === "needs_decision" && (
              <p className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2.5 leading-relaxed">
                {o.noDataDetail}
              </p>
            )}
            {!isSinDatos && (obs?.ai_draft_text || obs?.reviewer_final_text) && (
              <p className="text-sm text-foreground/80 bg-secondary/30 rounded-lg px-3 py-2.5 leading-relaxed">
                {(state === "observation_confirmed" && obs?.reviewer_final_text)
                  ? obs.reviewer_final_text
                  : obs?.ai_draft_text}
              </p>
            )}
            {obs?.normative_reference && (
              <div className="flex items-start gap-2 flex-wrap">
                {(() => {
                  const src = parseNormativeSource(obs.normative_reference);
                  return src ? (
                    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide border px-1.5 py-0.5 rounded flex-shrink-0 ${src.color}`}>
                      <BookOpen className="h-2.5 w-2.5" />
                      {src.label}
                    </span>
                  ) : null;
                })()}
                <p className="text-[10px] text-muted-foreground/60 font-mono leading-relaxed">
                  {obs.normative_reference}
                </p>
              </div>
            )}

            {onOpenDoc && (state === "needs_decision" || state === "observation_confirmed") && (
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-muted-foreground/50 uppercase tracking-wide font-semibold">
                  {o.verifyIn}
                </span>
                {CIP_PARAMS.has(parameter) && documents.some(d => d.document_type === "cip_vigente") && (
                  <button
                    onClick={() => onOpenDoc("cip_vigente")}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/70 hover:text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />{o.cipDoc}
                  </button>
                )}
                {CUADRO_PARAMS.has(parameter) && documents.some(d => d.document_type === "cuadro_superficies") && (
                  <button
                    onClick={() => onOpenDoc("cuadro_superficies")}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/70 hover:text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />{o.areaDoc}
                  </button>
                )}
                {PLANOS_PARAMS.has(parameter) && documents.some(d => d.document_type === "planos_arquitectonicos") && (
                  <button
                    onClick={() => onOpenDoc("planos_arquitectonicos")}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-primary/70 hover:text-primary bg-primary/5 border border-primary/10 hover:bg-primary/10 px-1.5 py-0.5 rounded transition-colors"
                  >
                    <ExternalLink className="h-2.5 w-2.5" />{o.planosDoc}
                  </button>
                )}
              </div>
            )}
            {state === "reviewer_approved" && obs?.reviewer_discard_reason && (
              <p className="text-xs text-muted-foreground bg-secondary/20 rounded px-2.5 py-2">
                {o.reasonLabel} {obs.reviewer_discard_reason}
                {obs.reviewer_notes && <span className="opacity-60"> — {obs.reviewer_notes}</span>}
              </p>
            )}
          </>
        )}

        {/* Notes */}
        {(mode === "edit" || mode === "discard") && (
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder={o.reviewerNotes}
            className="w-full text-sm bg-secondary/40 border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        )}

        {/* Discard reason picker */}
        {mode === "discard" && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-foreground">
              {o.discardTitle} <span className="text-red-500">*</span>
            </p>
            <div className="space-y-1.5">
              {o.discardReasons.map((displayReason, idx) => (
                <label
                  key={idx}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-sm ${
                    discardReasonIdx === idx
                      ? "border-foreground/30 bg-secondary"
                      : "border-border hover:border-foreground/20 hover:bg-secondary/40"
                  }`}
                >
                  <input
                    type="radio"
                    name={`discard-${obs?.id}`}
                    value={idx}
                    checked={discardReasonIdx === idx}
                    onChange={() => setDiscardReasonIdx(idx)}
                    className="sr-only"
                  />
                  <div className={`h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 transition-colors ${
                    discardReasonIdx === idx ? "border-foreground bg-foreground" : "border-muted-foreground/30"
                  }`} />
                  {displayReason}
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 pt-0.5 flex-wrap">
          {state === "needs_decision" && mode === "view" && !isSinDatos && (
            <>
              <button
                onClick={handleAccept}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />{o.accept}
              </button>
              <button
                onClick={() => { setEditText(obs?.ai_draft_text ?? ""); setMode("edit"); }}
                className="flex items-center gap-1.5 border border-border hover:border-primary/40 hover:bg-secondary/50 text-foreground text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />{o.edit}
              </button>
              <button
                onClick={() => setMode("discard")}
                className="flex items-center gap-1.5 border border-border hover:border-red-200 hover:bg-red-50/40 text-muted-foreground hover:text-red-600 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <X className="h-3.5 w-3.5" />{o.discard}
              </button>
            </>
          )}

          {state === "needs_decision" && mode === "view" && isSinDatos && (
            <>
              <button
                onClick={handleManualApprove}
                disabled={saving}
                className="flex items-center gap-1.5 border border-border hover:border-emerald-300 hover:bg-emerald-50/50 text-foreground hover:text-emerald-700 text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" />{o.markCompliant}
              </button>
              <button
                onClick={() => { setEditText(""); setMode("edit"); }}
                className="flex items-center gap-1.5 border border-border hover:border-primary/40 hover:bg-secondary/50 text-foreground text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />{o.addObservation}
              </button>
            </>
          )}

          {state === "ai_approved" && mode === "view" && expanded && (
            <button
              onClick={() => { setEditText(""); setMode("edit"); }}
              className="flex items-center gap-1.5 border border-border hover:border-amber-300 hover:bg-amber-50/40 text-muted-foreground hover:text-amber-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />{o.addManual}
            </button>
          )}

          {state === "reviewer_approved" && mode === "view" && expanded && (
            <button
              onClick={() => { setEditText(obs?.ai_draft_text ?? ""); setMode("edit"); }}
              className="flex items-center gap-1.5 border border-border hover:border-amber-300 hover:bg-amber-50/40 text-muted-foreground hover:text-amber-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />{o.reopen}
            </button>
          )}

          {state === "observation_confirmed" && mode === "view" && expanded && (
            <>
              <button
                onClick={() => { setEditText(obs?.reviewer_final_text ?? obs?.ai_draft_text ?? ""); setMode("edit"); }}
                className="flex items-center gap-1.5 border border-border hover:border-primary/40 hover:bg-secondary/50 text-foreground text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <Pencil className="h-3.5 w-3.5" />{o.editText}
              </button>
              <button
                onClick={() => setMode("discard")}
                className="flex items-center gap-1.5 border border-border hover:border-emerald-300 hover:bg-emerald-50/40 text-muted-foreground hover:text-emerald-700 text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                <X className="h-3.5 w-3.5" />{o.discardMarkCompliant}
              </button>
            </>
          )}

          {mode === "edit" && (
            <>
              <button
                onClick={handleSaveEdit}
                disabled={saving || !editText.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? o.saving : o.saveObservation}
              </button>
              <button
                onClick={cancelEdit}
                className="border border-border text-muted-foreground hover:text-foreground text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {o.cancel}
              </button>
            </>
          )}

          {mode === "discard" && (
            <>
              <button
                onClick={() => handleDiscard(discardReasonIdx)}
                disabled={saving || discardReasonIdx === -1}
                className="flex-1 flex items-center justify-center gap-1.5 bg-foreground hover:bg-foreground/90 text-background text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
              >
                {saving ? o.savingDiscard : o.confirmDiscard}
              </button>
              <button
                onClick={cancelDiscard}
                className="border border-border text-muted-foreground hover:text-foreground text-xs font-medium px-3 py-2 rounded-lg transition-colors"
              >
                {o.cancel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
