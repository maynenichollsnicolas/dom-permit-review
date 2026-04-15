"use client";

import { useState } from "react";
import { Acta, Observation, Expedient } from "@/lib/api";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { FileText, Send, Lock, CheckCircle } from "lucide-react";
import { useT } from "@/lib/i18n";

interface Props {
  acta: Acta | null;
  expedientId: string;
  expedient: Expedient;
  observations: Observation[];
  onPublish: () => void;
}

export function ActaPanel({ acta, expedientId, expedient, observations, onPublish }: Props) {
  const { t } = useT();
  const a = t.acta;
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setError(null);
    setPublishing(true);
    try {
      await api.expedients.publishActa(expedientId);
      onPublish();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : a.error);
    } finally {
      setPublishing(false);
    }
  };

  const confirmed = observations.filter(
    (o) => o.reviewer_action === "accepted" || o.reviewer_action === "edited"
  );

  const isPublished = acta?.status === "published";

  const locale = t.lang === "en" ? "en-US" : "es-CL";
  const reviewDate = isPublished && acta?.published_at
    ? new Date(acta.published_at).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });

  if (observations.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <FileText className="h-10 w-10 mx-auto mb-3 opacity-20" />
        <p className="text-sm font-medium mb-1">{a.noObsTitle}</p>
        <p className="text-xs">{a.noObsDetail}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status / action bar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-card rounded-xl border border-border shadow-sm flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {isPublished
            ? <Lock className="h-4 w-4 text-muted-foreground" />
            : <FileText className="h-4 w-4 text-primary" />
          }
          <span className="text-sm font-medium">
            {isPublished
              ? a.publishedLabel(acta!.acta_number ?? "—")
              : a.draftLabel
            }
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
            isPublished
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-amber-50 text-amber-700 border-amber-200"
          }`}>
            {isPublished ? a.publishedBadge : a.draftBadge}
          </span>
        </div>

        {!isPublished && (
          <div className="flex items-center gap-3 flex-wrap">
            {error && <p className="text-xs text-red-600">{error}</p>}
            {confirmed.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {a.noObsDetail}
              </p>
            ) : (
              <Button onClick={handlePublish} disabled={publishing} size="sm">
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {publishing ? a.publishing : a.publishBtn(confirmed.length)}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Acta document */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        {/* Official header */}
        <div className="bg-secondary/30 border-b border-border px-8 py-5 text-center space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
            {a.docDom}
          </p>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {a.docDept}
          </p>
          <p className="text-base font-bold text-foreground mt-2">
            {a.docTitle}{isPublished && acta?.acta_number ? ` N° ${acta.acta_number}` : ""}
          </p>
          <p className="text-xs text-muted-foreground/60 italic">
            {isPublished
              ? `${t.lang === "en" ? "Published" : "Publicada el"} ${reviewDate}`
              : t.lang === "en" ? "Draft — not yet published" : "Borrador — no publicada aún"
            }
          </p>
        </div>

        <div className="px-8 py-6 space-y-6 text-sm">
          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-10 gap-y-1.5 border-b border-border pb-5">
            <MetaRow label={a.metaApp}       value={expedient.exp_number} />
            <MetaRow label={a.metaDate}      value={reviewDate} />
            <MetaRow label={a.metaAddress}   value={expedient.address} />
            <MetaRow label={a.metaZone}      value={expedient.zone} />
            <MetaRow label={a.metaType}      value={expedient.project_type.replace(/_/g, " ")} />
            <MetaRow label={a.metaRound}     value={`${expedient.current_round}`} />
            <MetaRow label={a.metaOwner}     value={expedient.owner_name} />
            <MetaRow label={a.metaArchitect} value={expedient.architect_name} />
          </div>

          {/* Intro */}
          <p className="text-foreground/80 leading-relaxed">
            {a.intro(confirmed.length)}
          </p>

          {/* Observations */}
          {confirmed.length === 0 ? (
            <div className="flex items-center gap-2 py-2 text-emerald-600 font-medium">
              <CheckCircle className="h-4 w-4" />
              {t.lang === "en"
                ? "No observations — project complies with all reviewed parameters."
                : "Sin observaciones — el proyecto cumple con los parámetros revisados."
              }
            </div>
          ) : (
            <ol className="space-y-6">
              {confirmed.map((obs, i) => {
                const text = obs.reviewer_final_text || obs.ai_draft_text;
                // Use t.param for translated parameter name
                const paramName = t.param[obs.parameter] ?? obs.parameter.replace(/_/g, " ");
                return (
                  <li key={obs.id} className="space-y-2">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold tabular-nums">{i + 1}.</span>
                      <div>
                        <span className="font-bold uppercase tracking-wide">{paramName}</span>
                        {obs.declared_value && obs.allowed_value && (
                          <span className="text-xs text-muted-foreground font-normal normal-case ml-1.5">
                            ({t.lang === "en" ? "Declared" : "Declarado"}: {obs.declared_value} — {t.lang === "en" ? "Allowed" : "Permitido"}: {obs.allowed_value})
                          </span>
                        )}
                        {!isPublished && obs.reviewer_action === "edited" && (
                          <span className="ml-2 text-[10px] font-semibold text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded align-middle">
                            {a.editedBadge}
                          </span>
                        )}
                      </div>
                    </div>
                    {text && (
                      <p className="pl-5 text-foreground/80 leading-relaxed">{text}</p>
                    )}
                    {obs.normative_reference && (
                      <p className="pl-5 text-[11px] font-mono text-muted-foreground/60">
                        {t.lang === "en" ? "Applicable regulation:" : "Norma aplicable:"} {obs.normative_reference}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}

          {confirmed.length > 0 && (
            <div className="border-t border-border pt-5 text-foreground/80 leading-relaxed">
              <p>{a.closing}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 items-baseline">
      <span className="text-muted-foreground text-xs shrink-0 min-w-[140px]">{label}</span>
      <span className="text-xs font-medium text-foreground">{value}</span>
    </div>
  );
}
