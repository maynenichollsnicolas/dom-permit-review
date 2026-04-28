"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { api, Escalation } from "@/lib/api";
import { useUser } from "@/lib/useUser";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import {
  Building2, ChevronRight, LogOut, HelpCircle, Send,
  Loader2, CheckCircle, Clock, ExternalLink,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type EscalationWithExp = Escalation & {
  expedients?: { exp_number: string; address: string; zone: string; architect_name: string };
};

export default function EscalacionesPage() {
  const [escalations, setEscalations] = useState<EscalationWithExp[]>([]);
  const [loading, setLoading] = useState(true);
  const [answerDraft, setAnswerDraft] = useState<Record<string, string>>({});
  const [answering, setAnswering] = useState<Record<string, boolean>>({});
  const { user, signOut } = useUser();
  const { t } = useT();
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = async () => {
    try {
      const data = await api.escalations.domPending();
      setEscalations(data as EscalationWithExp[]);
    } catch {
      // silently keep stale data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    pollRef.current = setInterval(load, 10_000);
    return () => clearInterval(pollRef.current!);
  }, []);

  const handleAnswer = async (escalationId: string) => {
    const answer = answerDraft[escalationId]?.trim();
    if (!answer) return;
    setAnswering((prev) => ({ ...prev, [escalationId]: true }));
    try {
      await api.escalations.domAnswer(escalationId, answer);
      setAnswerDraft((prev) => { const n = { ...prev }; delete n[escalationId]; return n; });
      await load();
    } catch (e: any) {
      alert(e?.message ?? "Error al guardar la respuesta.");
    } finally {
      setAnswering((prev) => ({ ...prev, [escalationId]: false }));
    }
  };

  return (
    <div className="min-h-screen bg-grid flex flex-col">
      {/* ── Topbar ── */}
      <header className="bg-dom-header text-white px-6 py-0 sticky top-0 z-20 shadow-lg shadow-[oklch(0.225_0.095_252/0.25)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-white/70" />
            <Link href="/" className="font-semibold text-sm tracking-tight hover:text-white/80 transition-colors">
              {t.dom.appName}
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <span className="text-sm text-white/60 font-medium">Consultas escaladas</span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-xs text-white/60 hover:text-white/90 transition-colors font-medium tracking-wide uppercase"
            >
              {t.dom.technicalReview}
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <Link
              href="/admisibilidad"
              className="text-xs text-white/60 hover:text-white/90 transition-colors font-medium tracking-wide uppercase"
            >
              {t.dom.admisibilidad}
            </Link>
            <div className="h-4 w-px bg-white/20" />
            <LangToggle />
            <div className="h-4 w-px bg-white/20" />
            <span className="text-xs text-white/60">
              {user?.user_metadata?.full_name ?? user?.email}
            </span>
            <button onClick={signOut} className="text-white/40 hover:text-white/80 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto w-full px-6 py-8 flex-1">
        {/* ── Header ── */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Consultas escaladas por el agente</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Preguntas de arquitectos que el agente no pudo responder con certeza. Tu respuesta alimenta el aprendizaje del agente.
            </p>
          </div>
          {!loading && escalations.length > 0 && (
            <div className="flex items-center gap-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full">
              <Clock className="h-3.5 w-3.5" />
              {escalations.length} pendiente{escalations.length !== 1 ? "s" : ""}
            </div>
          )}
        </div>

        {/* ── List ── */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
              <span className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin inline-block" />
              Cargando consultas...
            </div>
          </div>
        ) : escalations.length === 0 ? (
          <div className="py-20 text-center">
            <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground">Sin consultas pendientes</p>
            <p className="text-xs text-muted-foreground mt-1">
              El agente pudo resolver todas las preguntas de los arquitectos directamente.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {escalations.map((esc) => {
              const exp = esc.expedients;
              return (
                <Card key={esc.id} className="shadow-sm border-amber-200">
                  <CardHeader className="border-b border-amber-100 bg-amber-50/60 pb-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-2.5 min-w-0">
                        <HelpCircle className="h-4 w-4 flex-shrink-0 mt-0.5 text-amber-500" />
                        <div className="min-w-0">
                          <CardTitle className="text-sm leading-snug text-foreground">
                            {esc.architect_question}
                          </CardTitle>
                          <div className="flex items-center flex-wrap gap-2 mt-1.5">
                            <span className="text-[11px] text-muted-foreground">
                              {new Date(esc.created_at).toLocaleString("es-CL")}
                            </span>
                            {esc.parameter_tags?.map((tag) => (
                              <span
                                key={tag}
                                className="inline-block bg-secondary border border-border px-1.5 py-0.5 rounded text-[10px] text-muted-foreground font-medium"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                      {exp && (
                        <Link
                          href={`/expedients/${esc.expedient_id}`}
                          className="flex-shrink-0 flex items-center gap-1.5 text-[11px] text-primary hover:text-primary/70 font-semibold bg-card border border-border px-2.5 py-1 rounded-lg transition-colors"
                        >
                          <span className="font-mono">{exp.exp_number}</span>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    {exp && (
                      <div className="ml-6.5 mt-1 flex items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{exp.address}</span>
                        <span className="font-mono bg-secondary border border-border px-1.5 py-0.5 rounded text-[10px]">
                          {exp.zone}
                        </span>
                        <span>{exp.architect_name}</span>
                      </div>
                    )}
                  </CardHeader>

                  <CardContent className="pt-4 space-y-3">
                    {esc.ai_attempted_answer && (
                      <div className="p-3 bg-secondary/40 rounded-lg border border-border">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                          Lo que el agente intentó responder
                        </p>
                        <p className="text-sm text-muted-foreground leading-relaxed">{esc.ai_attempted_answer}</p>
                      </div>
                    )}
                    {esc.ai_escalation_reason && (
                      <p className="text-xs text-amber-700 italic">
                        Motivo de escalación: {esc.ai_escalation_reason}
                      </p>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-foreground block">
                        Tu respuesta autoritativa
                        <span className="text-muted-foreground font-normal ml-1">
                          — el agente la usará para responder preguntas similares en esta zona automáticamente
                        </span>
                      </label>
                      <textarea
                        value={answerDraft[esc.id] ?? ""}
                        onChange={(e) =>
                          setAnswerDraft((prev) => ({ ...prev, [esc.id]: e.target.value }))
                        }
                        rows={3}
                        placeholder="Escribe tu respuesta técnica aquí..."
                        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                      />
                      <Button
                        size="sm"
                        disabled={!answerDraft[esc.id]?.trim() || answering[esc.id]}
                        onClick={() => handleAnswer(esc.id)}
                      >
                        {answering[esc.id] ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                            Guardando
                          </>
                        ) : (
                          <>
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Responder
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
