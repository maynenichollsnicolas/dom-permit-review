"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Expedient } from "@/lib/api";
import { daysRemaining } from "@/lib/utils";
import { useUser } from "@/lib/useUser";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import {
  AlertTriangle, Clock, FileText, CheckCircle,
  LogOut, Building2, ChevronRight, CircleDot,
} from "lucide-react";

export default function QueuePage() {
  const [expedients, setExpedients] = useState<Expedient[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, signOut } = useUser();
  const { t } = useT();

  useEffect(() => {
    api.expedients.list().then(setExpedients).finally(() => setLoading(false));
  }, []);

  const critical = expedients.filter((e) => daysRemaining(e.legal_deadline_at) <= 3);
  const warning = expedients.filter(
    (e) => daysRemaining(e.legal_deadline_at) > 3 && daysRemaining(e.legal_deadline_at) <= 7
  );
  const approved = expedients.filter((e) => e.status === "aprobado");

  return (
    <div className="min-h-screen bg-grid flex flex-col">
      {/* ── Topbar ── */}
      <header className="bg-dom-header text-white px-6 py-0 sticky top-0 z-20 shadow-lg shadow-[oklch(0.225_0.095_252/0.25)]">
        <div className="max-w-7xl mx-auto flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2.5">
              <Building2 className="h-4 w-4 text-white/70" />
              <span className="font-semibold text-sm tracking-tight">{t.dom.appName}</span>
              <ChevronRight className="h-3 w-3 text-white/30" />
              <span className="text-sm text-white/60 font-medium">{t.dom.technicalReview}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
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

      <main className="max-w-7xl mx-auto w-full px-6 py-8 flex-1">
        {/* ── Stat row ── */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            value={expedients.length}
            label={t.dom.stats.active}
            icon={<FileText className="h-4 w-4" />}
            accentClass="text-[oklch(0.225_0.095_252)]"
            borderClass="border-l-[3px] border-l-[oklch(0.225_0.095_252)]"
          />
          <StatCard
            value={critical.length}
            label={t.dom.stats.critical}
            icon={<AlertTriangle className="h-4 w-4" />}
            accentClass="text-red-600"
            borderClass="border-l-[3px] border-l-red-500"
            urgent={critical.length > 0}
          />
          <StatCard
            value={warning.length}
            label={t.dom.stats.dueSoon}
            icon={<Clock className="h-4 w-4" />}
            accentClass="text-amber-600"
            borderClass="border-l-[3px] border-l-amber-500"
          />
          <StatCard
            value={approved.length}
            label={t.dom.stats.approved}
            icon={<CheckCircle className="h-4 w-4" />}
            accentClass="text-emerald-600"
            borderClass="border-l-[3px] border-l-emerald-500"
          />
        </div>

        {/* ── Queue ── */}
        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-secondary/40 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground tracking-tight">{t.dom.queue.title}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">{t.dom.queue.subtitle}</p>
            </div>
            {critical.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-red-600 font-medium bg-red-50 border border-red-100 px-3 py-1.5 rounded-full">
                <CircleDot className="h-3 w-3 animate-pulse" />
                {t.dom.queue.critical(critical.length)}
              </div>
            )}
          </div>

          {loading ? (
            <div className="py-16 text-center">
              <div className="inline-flex items-center gap-2 text-muted-foreground text-sm">
                <span className="h-4 w-4 rounded-full border-2 border-primary/30 border-t-primary animate-spin inline-block" />
                {t.dom.queue.loading}
              </div>
            </div>
          ) : expedients.length === 0 ? (
            <div className="py-16 text-center">
              <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t.dom.queue.empty}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  {[
                    t.dom.col.expedient, t.dom.col.address, t.dom.col.type,
                    t.dom.col.zone, t.dom.col.status, t.dom.col.round, t.dom.col.deadline,
                  ].map((h, i) => (
                    <th key={h} className={`text-[10px] font-semibold text-muted-foreground uppercase tracking-widest py-3 ${
                      i === 0 ? "text-left px-6" : i === 6 ? "text-right px-6" : "text-left px-4"
                    }`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {expedients.map((exp) => {
                  const days = daysRemaining(exp.legal_deadline_at);
                  const isCritical = days <= 3;
                  const isWarning = !isCritical && days <= 7;

                  return (
                    <tr
                      key={exp.id}
                      className={`border-b border-border/50 transition-colors group ${
                        isCritical
                          ? "bg-red-50/50 hover:bg-red-50"
                          : isWarning
                          ? "bg-amber-50/30 hover:bg-amber-50/60"
                          : "hover:bg-secondary/60"
                      }`}
                      style={
                        isCritical
                          ? { boxShadow: "inset 3px 0 0 oklch(0.545 0.235 27.3)" }
                          : isWarning
                          ? { boxShadow: "inset 3px 0 0 oklch(0.76 0.17 63)" }
                          : undefined
                      }
                    >
                      <td className="px-6 py-3.5">
                        <Link
                          href={`/expedients/${exp.id}`}
                          className="font-mono text-sm font-semibold text-primary hover:text-primary/70 transition-colors tracking-tight"
                        >
                          {exp.exp_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 text-sm text-foreground/80 max-w-[220px] truncate">
                        {exp.address}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        {t.projectType[exp.project_type] ?? exp.project_type}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="font-mono text-xs bg-secondary border border-border px-2 py-0.5 rounded text-foreground/70">
                          {exp.zone}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill status={exp.status} label={t.dom.statusPill[exp.status] ?? exp.status} />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-muted-foreground font-medium">
                        R{exp.current_round}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <DeadlineCell days={days} deadline={exp.legal_deadline_at} t={t} />
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

/* ─── Sub-components ─────────────────────────────────────────────────────────── */

function StatCard({
  value, label, icon, accentClass, borderClass, urgent = false,
}: {
  value: number; label: string; icon: React.ReactNode;
  accentClass: string; borderClass: string; urgent?: boolean;
}) {
  return (
    <div className={`bg-card rounded-xl border border-border ${borderClass} shadow-sm px-5 py-4 ${urgent ? "shadow-red-100" : ""}`}>
      <div className={`${accentClass} mb-3`}>{icon}</div>
      <p className={`text-3xl font-bold tracking-tight leading-none mb-1.5 ${accentClass}`}>{value}</p>
      <p className="text-xs text-muted-foreground font-medium leading-tight">{label}</p>
    </div>
  );
}

function StatusPill({ status, label }: { status: string; label: string }) {
  const cls: Record<string, string> = {
    pendiente_admision: "bg-gray-100 text-gray-600 border-gray-200",
    admitido: "bg-blue-50 text-blue-700 border-blue-200",
    en_revision: "bg-indigo-50 text-indigo-700 border-indigo-200",
    observado: "bg-amber-50 text-amber-700 border-amber-200",
    aprobado: "bg-emerald-50 text-emerald-700 border-emerald-200",
    rechazado: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${cls[status] ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
      {label}
    </span>
  );
}

function DeadlineCell({ days, deadline, t }: { days: number; deadline: string; t: ReturnType<typeof useT>["t"] }) {
  if (!deadline) return <span className="text-muted-foreground text-xs">—</span>;

  const dateStr = new Date(deadline).toLocaleDateString(t.lang === "en" ? "en-US" : "es-CL", {
    day: "2-digit", month: "2-digit", year: "2-digit",
  });

  if (days <= 0) {
    return (
      <div>
        <span className="inline-block text-xs font-bold text-white bg-red-600 px-2 py-0.5 rounded">
          {t.common.expired}
        </span>
        <p className="text-[10px] text-muted-foreground mt-1">{dateStr}</p>
      </div>
    );
  }

  const colorCls =
    days <= 3 ? "text-red-600 font-bold" :
    days <= 7 ? "text-amber-600 font-semibold" :
    "text-emerald-700 font-medium";

  return (
    <div>
      <p className={`text-sm tabular-nums ${colorCls}`}>{days} {t.common.days}</p>
      <p className="text-[10px] text-muted-foreground">{dateStr}</p>
    </div>
  );
}
