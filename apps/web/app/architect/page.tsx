"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@/lib/useUser";
import { daysRemaining } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { Building2, Plus, LogOut, FileText, AlertTriangle, CheckCircle, Clock, ChevronRight } from "lucide-react";

export default function ArchitectPortal() {
  const { user, signOut } = useUser({ redirectTo: "/architect/login" });
  const { t } = useT();
  const [expedients, setExpedients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.email) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/intake/architect/${encodeURIComponent(user.email)}/expedients`)
      .then((r) => r.json())
      .then((data) => setExpedients(Array.isArray(data) ? data : []))
      .catch(() => setExpedients([]))
      .finally(() => setLoading(false));
  }, [user?.email]);

  const pending  = expedients.filter((e) => e.status === "pendiente_admision").length;
  const inReview = expedients.filter((e) => ["admitido", "en_revision"].includes(e.status)).length;
  const observed = expedients.filter((e) => e.status === "observado").length;
  const approved = expedients.filter((e) => e.status === "aprobado").length;

  return (
    <div className="min-h-screen bg-grid flex flex-col">
      {/* ── Topbar ── */}
      <header className="bg-dom-header text-white px-6 sticky top-0 z-20 shadow-lg shadow-[oklch(0.225_0.095_252/0.25)]">
        <div className="max-w-5xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-white/70" />
            <span className="font-semibold text-sm tracking-tight">{t.dom.appName}</span>
            <ChevronRight className="h-3 w-3 text-white/30" />
            <span className="text-sm text-white/60 font-medium">{t.arch.portal}</span>
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

      <main className="max-w-5xl mx-auto w-full px-6 py-8 flex-1">
        {/* ── Stats ── */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <MiniStat icon={<Clock className="h-4 w-4 text-gray-400" />}         value={pending}  label={t.arch.stats.inAdmission} />
          <MiniStat icon={<FileText className="h-4 w-4 text-blue-500" />}      value={inReview} label={t.arch.stats.underReview}  color="text-blue-700" />
          <MiniStat icon={<AlertTriangle className="h-4 w-4 text-amber-500" />} value={observed} label={t.arch.stats.observed}    color="text-amber-700" urgent={observed > 0} />
          <MiniStat icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} value={approved} label={t.arch.stats.approved}    color="text-emerald-700" />
        </div>

        {/* ── Expedients table ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-secondary/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">{t.arch.table.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t.arch.table.subtitle}</p>
            </div>
            <Link
              href="/architect/submit"
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold px-4 py-2 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              {t.arch.table.newBtn}
            </Link>
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                <span className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin inline-block" />
                {t.arch.table.loading}
              </div>
            </div>
          ) : expedients.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="h-10 w-10 text-muted-foreground/20 mx-auto mb-4" />
              <p className="text-sm text-muted-foreground mb-4">{t.arch.table.empty}</p>
              <Link
                href="/architect/submit"
                className="inline-flex items-center gap-1.5 text-sm text-primary font-medium hover:underline"
              >
                {t.arch.table.firstLink} <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[t.arch.col.expedient, t.arch.col.address, t.arch.col.zone, t.arch.col.status, t.arch.col.round, t.arch.col.deadline].map((h, i) => (
                    <th key={h} className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-widest py-3 ${
                      i === 5 ? "text-right px-6 pr-6" : "text-left px-5 first:pl-6"
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expedients.map((exp) => {
                  const days = exp.legal_deadline_at ? daysRemaining(exp.legal_deadline_at) : null;
                  const isObserved = exp.status === "observado";

                  return (
                    <tr
                      key={exp.id}
                      className={`border-b border-border/50 transition-colors ${
                        isObserved ? "bg-amber-50/40 hover:bg-amber-50/70" : "hover:bg-secondary/60"
                      }`}
                      style={isObserved ? { boxShadow: "inset 3px 0 0 oklch(0.76 0.17 63)" } : undefined}
                    >
                      <td className="px-6 py-3.5">
                        <Link
                          href={`/architect/expedients/${exp.id}`}
                          className="font-mono text-sm font-semibold text-primary hover:text-primary/70 transition-colors"
                        >
                          {exp.exp_number}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-foreground/80 max-w-[200px] truncate">
                        {exp.address}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="font-mono text-xs bg-secondary border border-border px-2 py-0.5 rounded text-foreground/70">
                          {exp.zone}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <ArchStatusPill status={exp.status} label={t.arch.statusPill[exp.status] ?? exp.status} />
                      </td>
                      <td className="px-5 py-3.5 text-xs text-muted-foreground font-medium">
                        R{exp.current_round}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        {days !== null ? (
                          <div>
                            <p className={`text-sm font-semibold tabular-nums ${
                              days <= 3 ? "text-red-600" : days <= 7 ? "text-amber-600" : "text-emerald-700"
                            }`}>
                              {days > 0 ? `${days}d` : t.common.expired}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {new Date(exp.legal_deadline_at).toLocaleDateString(t.lang === "en" ? "en-US" : "es-CL")}
                            </p>
                          </div>
                        ) : <span className="text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
}

function MiniStat({ icon, value, label, color = "text-foreground", urgent = false }: {
  icon: React.ReactNode; value: number; label: string; color?: string; urgent?: boolean;
}) {
  return (
    <div className={`bg-card border border-border rounded-xl px-5 py-4 shadow-sm ${urgent ? "border-l-[3px] border-l-amber-500" : ""}`}>
      <div className="mb-3">{icon}</div>
      <p className={`text-3xl font-bold tracking-tight leading-none mb-1.5 ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
    </div>
  );
}

function ArchStatusPill({ status, label }: { status: string; label: string }) {
  const cls: Record<string, string> = {
    pendiente_admision: "bg-gray-100 text-gray-500 border-gray-200",
    admitido:           "bg-blue-50 text-blue-700 border-blue-200",
    en_revision:        "bg-blue-50 text-blue-700 border-blue-200",
    observado:          "bg-amber-50 text-amber-700 border-amber-200",
    aprobado:           "bg-emerald-50 text-emerald-700 border-emerald-200",
    rechazado:          "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {label}
    </span>
  );
}
