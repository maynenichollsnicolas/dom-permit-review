"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { api, Expedient, Acta, ResubmitRequest, ComplianceResult } from "@/lib/api";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowLeft, Building2, LogOut, CheckCircle, AlertTriangle,
  Clock, FileText, Loader2, Send, Upload, ChevronRight,
  MessageCircle, CornerDownLeft, Bot, User, Trash2, ExternalLink,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PermitChecklist } from "@/components/permit-checklist";

// ─── Step IDs (no hardcoded labels) ───────────────────────────────────────────

const STEP_IDS = [
  "pendiente_admision",
  "admitido",
  "en_revision",
  "observado",
  "aprobado",
] as const;

// ─── Progress stepper ─────────────────────────────────────────────────────────

function ProgressStepper({ status }: { status: string }) {
  const { t } = useT();
  const ad = t.archDetail;
  const currentIdx = STEP_IDS.findIndex((id) => id === status);
  const isRejected = status === "rechazado";

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start gap-0">
        {STEP_IDS.map((id, i) => {
          const isDone    = i < currentIdx && !isRejected;
          const isCurrent = i === currentIdx && !isRejected;

          return (
            <div key={id} className={`flex-1 flex ${i < STEP_IDS.length - 1 ? "items-start" : "items-start justify-end"}`}>
              <div className="flex flex-col items-center flex-1">
                {/* Dot + line */}
                <div className="flex items-center w-full">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2 transition-all ${
                    isDone    ? "bg-emerald-500 border-emerald-500" :
                    isCurrent
                      ? id === "observado" ? "bg-amber-500 border-amber-500 animate-pulse"
                        : "bg-primary border-primary"
                    : "bg-card border-border"
                  }`}>
                    {isDone ? (
                      <CheckCircle className="h-3.5 w-3.5 text-white" />
                    ) : isCurrent ? (
                      <div className="h-2 w-2 rounded-full bg-white" />
                    ) : (
                      <div className="h-2 w-2 rounded-full bg-muted-foreground/20" />
                    )}
                  </div>
                  {i < STEP_IDS.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 transition-colors ${isDone ? "bg-emerald-400" : "bg-border"}`} />
                  )}
                </div>
                {/* Labels */}
                <div className="mt-2 text-center px-1">
                  <p className={`text-xs font-semibold leading-tight ${
                    isCurrent ? id === "observado" ? "text-amber-700" : "text-primary" :
                    isDone ? "text-emerald-700" :
                    "text-muted-foreground/40"
                  }`}>
                    {t.status[id as keyof typeof t.status] ?? id}
                  </p>
                  {isCurrent && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {ad.steps.sub[id as keyof typeof ad.steps.sub]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {isRejected && (
          <div className="flex flex-col items-center ml-2">
            <div className="h-6 w-6 rounded-full bg-red-500 border-2 border-red-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">✕</span>
            </div>
            <p className="text-xs font-semibold text-red-600 mt-2">{ad.rejected}</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Chat panel ───────────────────────────────────────────────────────────────

interface ChatMsg { role: "user" | "assistant"; content: string; id?: string }

const WELCOME_ID = "welcome";

function ChatPanel({ expedientId }: { expedientId: string }) {
  const { t } = useT();
  const ch = t.archDetail.chat;
  const storageKey = `dom-chat-${expedientId}`;

  const welcome: ChatMsg = {
    id: WELCOME_ID,
    role: "assistant",
    content: ch.welcome,
  };

  const [messages, setMessages] = useState<ChatMsg[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed: ChatMsg[] = JSON.parse(saved);
        const withoutWelcome = parsed.filter((m) => m.id !== WELCOME_ID);
        return [{ ...welcome }, ...withoutWelcome];
      }
    } catch {}
    return [{ ...welcome }];
  });
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Persist history excluding welcome
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.filter((m) => m.id !== WELCOME_ID)));
    } catch {}
  }, [messages, storageKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const history = messages
      .filter((m) => m.id !== WELCOME_ID)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setLoading(true);

    try {
      const res = await api.expedients.chat(expedientId, text, history);
      setMessages((prev) => [...prev, { role: "assistant", content: res.response }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: ch.error }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([{ ...welcome }]);
    try { localStorage.removeItem(storageKey); } catch {}
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  const hasUserMessages = messages.some((m) => m.role === "user");

  return (
    <Card className="shadow-sm overflow-hidden flex flex-col" style={{ minHeight: 480 }}>
      {/* Header */}
      <CardHeader className="border-b border-border py-3 px-5 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
            <Bot className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-sm leading-none">{ch.title}</CardTitle>
            <p className="text-[10px] text-muted-foreground mt-0.5">{ch.subtitle}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {ch.online}
            </span>
            {hasUserMessages && (
              <button
                onClick={clearHistory}
                title={ch.clearChat}
                className="text-muted-foreground/50 hover:text-muted-foreground transition-colors p-1 rounded"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-secondary/10">
        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${
              m.role === "user" ? "bg-primary" : "bg-foreground"
            }`}>
              {m.role === "user"
                ? <User className="h-3.5 w-3.5 text-primary-foreground" />
                : <Bot className="h-3.5 w-3.5 text-background" />
              }
            </div>
            <div className={`max-w-[82%] ${m.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
              }`}>
                {m.role === "user" ? (
                  <span className="whitespace-pre-wrap">{m.content}</span>
                ) : (
                  <div className="prose prose-sm max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-0.5 prose-headings:text-foreground prose-strong:text-foreground prose-strong:font-semibold prose-p:leading-relaxed prose-ul:pl-4 prose-li:leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="h-7 w-7 rounded-full bg-foreground flex items-center justify-center flex-shrink-0">
              <Bot className="h-3.5 w-3.5 text-background" />
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm">
              <div className="flex gap-1.5 items-center">
                {[0, 150, 300].map((delay) => (
                  <div key={delay} className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick questions */}
      {!hasUserMessages && (
        <div className="px-5 py-3 border-t border-border bg-card flex-shrink-0">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">{ch.quickTitle}</p>
          <div className="flex flex-col gap-1.5">
            {ch.questions.map((q) => (
              <button key={q} onClick={() => send(q)}
                className="text-xs text-left text-muted-foreground border border-border rounded-lg px-3 py-2 hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors bg-secondary/30">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex gap-2.5 p-4 border-t border-border bg-card flex-shrink-0">
        <textarea
          ref={inputRef}
          value={input}
          onChange={handleInputChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); }
          }}
          placeholder={ch.placeholder}
          rows={1}
          className="flex-1 text-sm bg-secondary/40 border border-border rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-ring resize-none leading-relaxed"
          style={{ minHeight: 42 }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="h-10 w-10 flex items-center justify-center bg-primary text-primary-foreground rounded-xl disabled:opacity-30 hover:bg-primary/90 transition-colors flex-shrink-0 self-end"
        >
          <CornerDownLeft className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}

// ─── Document upload ──────────────────────────────────────────────────────────

const ALL_DOC_KEYS = [
  { key: "solicitud_firmada",       mandatory: true  },
  { key: "cip_vigente",             mandatory: true  },
  { key: "fue",                     mandatory: true  },
  { key: "planos_arquitectonicos",  mandatory: true  },
  { key: "cuadro_superficies",      mandatory: true  },
  { key: "memoria_calculo",         mandatory: true  },
  { key: "factibilidad_sanitaria",  mandatory: true  },
  { key: "informe_ri",              mandatory: false },
];

function SupplementalDocUpload({
  expedientId,
  uploaded,
  onUploaded,
}: {
  expedientId: string;
  uploaded: Record<string, string>;
  onUploaded: (docType: string, fileName: string) => void;
}) {
  const { t } = useT();
  const dc = t.archDetail.docs;
  const [opening, setOpening] = useState<Record<string, boolean>>({});

  const upload = async (docType: string, file: File) => {
    const fd = new FormData();
    fd.append("document_type", docType);
    fd.append("file", file);
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/intake/${expedientId}/documents`, {
      method: "POST", body: fd,
    });
    onUploaded(docType, file.name);
  };

  const openDoc = async (docType: string) => {
    setOpening((prev) => ({ ...prev, [docType]: true }));
    try {
      const { url } = await api.intake.getDocumentUrl(expedientId, docType);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch {
      alert(t.archDetail.openDocError);
    } finally {
      setOpening((prev) => ({ ...prev, [docType]: false }));
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="border-b border-border pb-3">
        <CardTitle className="text-sm">{dc.title}</CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">{dc.subtitle}</p>
      </CardHeader>
      <CardContent className="pt-4 space-y-2">
        {ALL_DOC_KEYS.map((doc) => {
          const filename = uploaded[doc.key];
          const isUploaded = !!filename;
          const label = t.checklist.docs[doc.key] ?? doc.key;
          return (
            <div key={doc.key} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
              isUploaded ? "border-emerald-200 bg-emerald-50/40" : "border-border"
            }`}>
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {isUploaded
                  ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0" />
                  : <Upload className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                }
                <div className="min-w-0">
                  <p className="text-sm">{label}</p>
                  {isUploaded && (
                    <p className="text-xs text-emerald-700 font-mono truncate mt-0.5">{filename}</p>
                  )}
                </div>
                {!doc.mandatory && (
                  <span className="text-[10px] text-muted-foreground bg-secondary border border-border px-1.5 py-0.5 rounded flex-shrink-0 ml-2">
                    {t.common.optional}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                {isUploaded && (
                  <button
                    onClick={() => openDoc(doc.key)}
                    disabled={opening[doc.key]}
                    className="text-xs bg-primary/10 border border-primary/20 hover:bg-primary/20 text-primary px-3 py-1.5 rounded-lg font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {opening[doc.key]
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <ExternalLink className="h-3 w-3" />
                    }
                    {dc.open}
                  </button>
                )}
                <label className="cursor-pointer">
                  <span className={`text-xs border px-3 py-1.5 rounded-lg font-medium transition-colors inline-block ${
                    isUploaded
                      ? "bg-secondary border-border hover:border-primary/40 text-foreground"
                      : "bg-primary border-primary text-primary-foreground hover:bg-primary/90"
                  }`}>
                    {isUploaded ? dc.replace : dc.uploadPdf}
                  </span>
                  <input
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => { if (e.target.files?.[0]) upload(doc.key, e.target.files[0]); }}
                  />
                </label>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArchitectExpedientPage() {
  const { id } = useParams<{ id: string }>();
  const { user, signOut } = useUser({ redirectTo: "/architect/login" });
  const { t } = useT();
  const ad = t.archDetail;
  const locale = t.lang === "en" ? "en-US" : "es-CL";
  const router = useRouter();

  const [expedient, setExpedient] = useState<Expedient | null>(null);
  const [acta, setActa] = useState<Acta | null>(null);
  const [compliance, setCompliance] = useState<ComplianceResult | null>(null);
  const [docMap, setDocMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [corrections, setCorrections] = useState<Partial<ResubmitRequest>>({});
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [activeSection, setActiveSection] = useState<"overview" | "docs" | "chat">("overview");

  const load = async () => {
    const [expRes, actaRes, compRes, docsRes] = await Promise.allSettled([
      api.expedients.get(id),
      api.expedients.getActa(id),
      api.expedients.getCompliance(id),
      api.intake.getDocuments(id),
    ]);
    if (expRes.status === "fulfilled") setExpedient(expRes.value);
    if (actaRes.status === "fulfilled") setActa(actaRes.value);
    if (compRes.status === "fulfilled") setCompliance(compRes.value);
    if (docsRes.status === "fulfilled") {
      const map: Record<string, string> = {};
      for (const d of docsRes.value) map[d.document_type] = d.file_name;
      setDocMap(map);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const handleResubmit = async () => {
    setSubmitting(true);
    try {
      await api.intake.resubmit(id, {
        ...corrections,
        correction_notes: correctionNotes || undefined,
      });
      setSubmitted(true);
      setTimeout(() => router.push("/architect"), 2500);
    } catch (e: any) {
      alert(e.message || ad.errorResubmit);
    } finally {
      setSubmitting(false);
    }
  };

  const setCorrection = (key: keyof ResubmitRequest, val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setCorrections((prev) => ({ ...prev, [key]: num }));
    } else if (val === "") {
      setCorrections((prev) => { const n = { ...prev }; delete n[key]; return n; });
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
        {ad.notFound}
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <div className="text-center bg-card border border-border rounded-2xl p-12 shadow-sm max-w-md">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">{ad.submitted.title}</h2>
          <p className="text-muted-foreground text-sm">{ad.submitted.detail}</p>
        </div>
      </div>
    );
  }

  const params = expedient.project_parameters?.[0];
  const isObservado = expedient.status === "observado";
  const isAprobado  = expedient.status === "aprobado";
  const actaObs     = acta?.content?.observations ?? [];

  return (
    <div className="min-h-screen bg-grid flex flex-col">
      {/* Header */}
      <header className="bg-dom-header text-white px-6 sticky top-0 z-20 shadow-lg">
        <div className="max-w-4xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <Link href="/architect" className="text-white/50 hover:text-white/90 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <Building2 className="h-4 w-4 text-white/60" />
            <div className="flex items-center gap-2">
              <span className="font-mono font-semibold text-sm">{expedient.exp_number}</span>
              <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                isObservado ? "bg-amber-400/20 text-amber-200 border-amber-400/30" :
                isAprobado  ? "bg-emerald-400/20 text-emerald-200 border-emerald-400/30" :
                "bg-white/10 text-white/70 border-white/20"
              }`}>
                {t.status[expedient.status as keyof typeof t.status] ?? expedient.status}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <LangToggle />
            <div className="h-4 w-px bg-white/20" />
            <span className="text-xs text-white/50">{user?.user_metadata?.full_name ?? user?.email}</span>
            <button onClick={signOut} className="text-white/40 hover:text-white/80 transition-colors">
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto w-full px-6 py-7 space-y-5">

        {/* ── Progress stepper ── */}
        <ProgressStepper status={expedient.status} />

        {/* ── Permit checklist (central element) ── */}
        <PermitChecklist
          expedient={expedient}
          compliance={compliance}
          documents={Object.entries(docMap).map(([document_type, file_name]) => ({ document_type, file_name }))}
          acta={acta}
          variant="architect"
        />

        {/* ── Section tabs ── */}
        <div className="flex gap-1 bg-secondary border border-border rounded-lg p-1 w-fit">
          {([
            { id: "overview", label: ad.tabs.overview, icon: <FileText className="h-3.5 w-3.5" /> },
            { id: "docs",     label: ad.tabs.docs,     icon: <Upload className="h-3.5 w-3.5" /> },
            { id: "chat",     label: ad.tabs.chat,     icon: <MessageCircle className="h-3.5 w-3.5" /> },
          ] as const).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                activeSection === tab.id
                  ? "bg-card text-foreground shadow-sm border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {activeSection === "overview" && (
          <div className="space-y-5">
            {/* Project info */}
            <div className="grid grid-cols-2 gap-4">
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border pb-3">
                  <CardTitle className="text-sm">{ad.projectData}</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 text-sm space-y-2.5">
                  <Row label={ad.params.owner}    value={expedient.owner_name} />
                  <Row label={ad.params.architect} value={expedient.architect_name} />
                  <Row label={ad.params.zone}      value={expedient.zone} />
                  <Row label={ad.params.type}      value={t.projectType[expedient.project_type as keyof typeof t.projectType] ?? expedient.project_type} />
                  <Row label={ad.params.round}     value={`${t.common.round} ${expedient.current_round}`} />
                  {params && (
                    <>
                      <Row label={ad.params.cipNumber} value={params.cip_number} />
                      <Row label={ad.params.cipDate}   value={params.cip_date ? new Date(params.cip_date).toLocaleDateString(locale) : t.common.noData} />
                    </>
                  )}
                </CardContent>
              </Card>

              {params && (
                <Card className="shadow-sm">
                  <CardHeader className="border-b border-border pb-3">
                    <CardTitle className="text-sm">{ad.cipVsDeclared}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-muted-foreground border-b border-border">
                          <th className="text-left pb-2 font-medium">{ad.params.parameter}</th>
                          <th className="text-right pb-2 font-medium">{ad.params.cip}</th>
                          <th className="text-right pb-2 font-medium">{ad.params.declared}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {[
                          { l: ad.params.constructibilidad, cip: params.cip_constructibilidad_max, dec: params.declared_constructibilidad, dir: "max" },
                          { l: ad.params.ocupacion_suelo,   cip: params.cip_ocupacion_suelo_max,   dec: params.declared_ocupacion_suelo,   dir: "max" },
                          { l: ad.params.altura,            cip: params.cip_altura_maxima_m,       dec: params.declared_altura_m,          dir: "max" },
                          { l: ad.params.distLateral,       cip: params.cip_distanciamiento_lateral_m, dec: params.declared_distanciamiento_lateral_m, dir: "min" },
                          { l: ad.params.distFondo,         cip: params.cip_distanciamiento_fondo_m,   dec: params.declared_distanciamiento_fondo_m,   dir: "min" },
                          { l: ad.params.antejardin,        cip: params.cip_antejardin_m,         dec: params.declared_antejardin_m,     dir: "min" },
                        ].map(({ l, cip, dec, dir }) => {
                          if (cip == null || dec == null) return null;
                          const ok = dir === "max" ? dec <= cip : dec >= cip;
                          return (
                            <tr key={l}>
                              <td className="py-1.5 text-foreground/70">{l}</td>
                              <td className="py-1.5 text-right text-muted-foreground tabular-nums">{cip}</td>
                              <td className={`py-1.5 text-right font-semibold tabular-nums ${ok ? "text-emerald-600" : "text-red-600"}`}>{dec}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Published acta */}
            {acta?.status === "published" && actaObs.length > 0 && (
              <Card className="border-amber-200 shadow-sm">
                <CardHeader className="border-b border-amber-100 bg-amber-50/60 pb-3 rounded-t-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      <CardTitle className="text-sm text-amber-800">
                        {ad.acta.title(acta.round_number)}
                      </CardTitle>
                    </div>
                    {acta.acta_number && (
                      <span className="font-mono text-xs text-amber-600">#{acta.acta_number}</span>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                  <p className="text-sm text-muted-foreground">{ad.acta.detail}</p>
                  {actaObs.map((obs: any) => (
                    <div key={obs.number} className="p-4 rounded-xl border border-amber-100 bg-amber-50/40 space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          OBS. {obs.number}
                        </span>
                        <span className="text-sm font-semibold text-foreground">
                          {t.param[obs.parameter as keyof typeof t.param] ?? obs.parameter}
                        </span>
                      </div>
                      <p className="text-sm text-foreground/80 leading-relaxed">{obs.text}</p>
                      <p className="text-xs text-muted-foreground font-mono">{obs.normative_reference}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Approved */}
            {isAprobado && (
              <Card className="border-emerald-200 shadow-sm">
                <CardContent className="pt-5 pb-5">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="h-7 w-7 text-emerald-500 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-emerald-800">{ad.approvedCard.title}</p>
                      <p className="text-sm text-emerald-700 mt-0.5">{ad.approvedCard.detail}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Remediation form */}
            {isObservado && (
              <Card className="shadow-sm">
                <CardHeader className="border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm">{ad.remediation.title(expedient.current_round + 1)}</CardTitle>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{ad.remediation.subtitle}</p>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { key: "declared_constructibilidad"             as const, label: ad.params.constructibilidad, current: params?.declared_constructibilidad,             limit: params?.cip_constructibilidad_max,         dir: "max", unit: "índice" },
                      { key: "declared_ocupacion_suelo"               as const, label: ad.params.ocupacion_suelo,   current: params?.declared_ocupacion_suelo,               limit: params?.cip_ocupacion_suelo_max,           dir: "max", unit: "índice" },
                      { key: "declared_altura_m"                      as const, label: ad.params.altura,            current: params?.declared_altura_m,                      limit: params?.cip_altura_maxima_m,               dir: "max", unit: "m" },
                      { key: "declared_densidad_hab_ha"               as const, label: ad.params.densidad,          current: params?.declared_densidad_hab_ha,               limit: params?.cip_densidad_max_hab_ha,           dir: "max", unit: "hab/há" },
                      { key: "declared_estacionamientos"              as const, label: ad.params.estacionamientos,  current: params?.declared_estacionamientos,              limit: params?.cip_estacionamientos_min,          dir: "min", unit: "ratio" },
                      { key: "declared_distanciamiento_lateral_m"     as const, label: ad.params.distLateral,       current: params?.declared_distanciamiento_lateral_m,     limit: params?.cip_distanciamiento_lateral_m,     dir: "min", unit: "m" },
                      { key: "declared_distanciamiento_fondo_m"       as const, label: ad.params.distFondo,         current: params?.declared_distanciamiento_fondo_m,       limit: params?.cip_distanciamiento_fondo_m,       dir: "min", unit: "m" },
                      { key: "declared_antejardin_m"                  as const, label: ad.params.antejardin,        current: params?.declared_antejardin_m,                  limit: params?.cip_antejardin_m,                  dir: "min", unit: "m" },
                      { key: "declared_superficie_total_edificada_m2" as const, label: ad.params.supEdificada,      current: params?.declared_superficie_total_edificada_m2, dir: "none", unit: "m²" },
                    ].map(({ key, label, current, limit, dir, unit }) => (
                      <CorrectionField
                        key={key}
                        label={label}
                        current={current}
                        limit={limit}
                        dir={dir as any}
                        unit={unit}
                        onChange={(v) => setCorrection(key, v)}
                      />
                    ))}
                  </div>

                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                      {ad.remediation.notes}{" "}
                      <span className="text-muted-foreground/50">{ad.remediation.notesOptional}</span>
                    </label>
                    <textarea
                      value={correctionNotes}
                      onChange={(e) => setCorrectionNotes(e.target.value)}
                      rows={3}
                      placeholder={ad.remediation.notesPlaceholder}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>

                  <Button
                    onClick={handleResubmit}
                    disabled={submitting || Object.keys(corrections).length === 0}
                    className="w-full h-11"
                  >
                    {submitting
                      ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{ad.remediation.submitting}</>
                      : <><Send className="h-4 w-4 mr-2" />{ad.remediation.submit(expedient.current_round + 1)}</>
                    }
                  </Button>
                  {Object.keys(corrections).length === 0 && (
                    <p className="text-xs text-center text-muted-foreground">
                      {ad.remediation.minOneParam}
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Status messages for non-actionable states */}
            {!isObservado && !isAprobado && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border ${
                expedient.status === "pendiente_admision"
                  ? "bg-secondary/40 border-border"
                  : "bg-primary/5 border-primary/20"
              }`}>
                {expedient.status === "pendiente_admision"
                  ? <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  : <FileText className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {expedient.status === "pendiente_admision"
                      ? ad.inAdmission.title
                      : ad.inReview.title(expedient.current_round)
                    }
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {expedient.status === "pendiente_admision"
                      ? ad.inAdmission.detail
                      : ad.inReview.detail
                    }
                  </p>
                  {expedient.status === "pendiente_admision" && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
                      <Clock className="h-3 w-3 flex-shrink-0" />
                      {ad.inAdmission.eta(expedient.has_revisor_independiente ? 15 : 30)}
                    </p>
                  )}
                  {(expedient.status === "admitido" || expedient.status === "en_revision") && expedient.legal_deadline_at && (() => {
                    const deadline = new Date(expedient.legal_deadline_at);
                    const now = new Date();
                    const diffDays = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const isUrgent = diffDays <= 5;
                    return (
                      <p className={`text-xs mt-2 flex items-center gap-1.5 ${isUrgent ? "text-amber-700" : "text-muted-foreground"}`}>
                        <Clock className="h-3 w-3 flex-shrink-0" />
                        {ad.inReview.etaLabel}{" "}
                        <span className="font-semibold text-foreground">
                          {deadline.toLocaleDateString(locale)}
                        </span>
                        {" "}·{" "}
                        <span className={`font-semibold ${isUrgent ? "text-amber-700" : ""}`}>
                          {diffDays > 0 ? ad.inReview.urgent(diffDays) : t.common.expired}
                        </span>
                      </p>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSection === "docs" && (
          <SupplementalDocUpload
            expedientId={id}
            uploaded={docMap}
            onUploaded={(type, name) => setDocMap((prev) => ({ ...prev, [type]: name }))}
          />
        )}

        {activeSection === "chat" && (
          <ChatPanel expedientId={id} />
        )}
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

function CorrectionField({ label, current, limit, dir, unit, onChange }: {
  label: string;
  current?: number | null;
  limit?: number | null;
  dir?: "max" | "min" | "none";
  unit?: string;
  onChange: (val: string) => void;
}) {
  const { t } = useT();
  const cf = t.archDetail.correctionField;
  const isViolation = dir && dir !== "none" && current != null && limit != null && (
    dir === "max" ? current > limit : current < limit
  );

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
        {label}
        {current != null && (
          <span className={`ml-1.5 font-mono ${isViolation ? "text-red-600 font-semibold" : "text-muted-foreground/60"}`}>
            {cf.current}: {current}
          </span>
        )}
        {limit != null && dir && dir !== "none" && (
          <span className="ml-1 text-muted-foreground/50">
            · {dir === "max" ? cf.max : cf.min} {limit}
          </span>
        )}
      </label>
      <div className="relative">
        <input
          type="number"
          step="0.1"
          onChange={(e) => onChange(e.target.value)}
          placeholder={isViolation ? cf.placeholder : current?.toString() ?? ""}
          className={`w-full border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-shadow ${
            isViolation ? "border-red-300 bg-red-50/40 pr-16" : "border-border pr-16"
          }`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}
