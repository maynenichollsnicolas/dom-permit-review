"use client";

import { CheckCircle, AlertTriangle, XCircle, Minus, ArrowRight } from "lucide-react";
import { RoundComparison, RoundComparisonParameter, ComparisonStatus } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useT } from "@/lib/i18n";

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ summary, round }: { summary: RoundComparison["summary"]; round: number }) {
  const { t } = useT();
  const c = t.comparison;
  const pills = [
    { label: c.status.FIXED,         count: summary.fixed,          cls: "bg-emerald-100 text-emerald-700" },
    { label: c.status.PERSISTS,      count: summary.persists,       cls: "bg-red-100 text-red-700" },
    { label: c.status.NEW,           count: summary.new_issues,     cls: "bg-amber-100 text-amber-700" },
    { label: c.status.STILL_COMPLIANT, count: summary.still_compliant, cls: "bg-secondary text-muted-foreground" },
  ];
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-card rounded-xl border border-border shadow-sm flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        {c.roundRange(round - 1, round)}
      </span>
      {pills.map((p) => (
        <span key={p.label} className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${p.cls}`}>
          {p.count} {p.label}
        </span>
      ))}
    </div>
  );
}

// ─── Verdict value display ─────────────────────────────────────────────────────

function ObsValues({ obs }: { obs: RoundComparisonParameter["r1_obs"] }) {
  const { t } = useT();
  const c = t.comparison;
  if (!obs) return <span className="text-muted-foreground/40 italic text-xs">—</span>;
  return (
    <div className="text-xs space-y-0.5">
      {obs.declared_value && (
        <div>
          <span className="text-muted-foreground">{c.declared} </span>
          <span className="font-medium text-foreground">{obs.declared_value}</span>
        </div>
      )}
      {obs.allowed_value && (
        <div>
          <span className="text-muted-foreground">{c.allowed} </span>
          <span className="font-medium text-foreground">{obs.allowed_value}</span>
        </div>
      )}
      {obs.delta && (
        <div>
          <span className="text-muted-foreground">{c.delta} </span>
          <span className="font-medium text-foreground">{obs.delta}</span>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string | undefined | null }) {
  const { t } = useT();
  if (!verdict) return null;
  const cls =
    verdict === "COMPLIANT"     ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    verdict === "VIOLATION"     ? "bg-red-100 text-red-700 border-red-200" :
    verdict === "NEEDS_REVIEW"  ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-secondary text-muted-foreground border-border";
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>
      {t.verdict[verdict] ?? verdict}
    </span>
  );
}

// ─── Single parameter row ─────────────────────────────────────────────────────

const STATUS_STYLE: Record<ComparisonStatus, { badge: string; row: string; icon: React.ReactNode }> = {
  FIXED:          { badge: "bg-emerald-100 text-emerald-700 border-emerald-200", row: "border-emerald-100", icon: <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" /> },
  PERSISTS:       { badge: "bg-red-100 text-red-700 border-red-200",             row: "border-red-100",    icon: <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" /> },
  NEW:            { badge: "bg-amber-100 text-amber-700 border-amber-200",       row: "border-amber-100",  icon: <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" /> },
  STILL_COMPLIANT:{ badge: "bg-secondary text-muted-foreground border-border",   row: "border-border/50",  icon: <Minus className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" /> },
};

function ComparisonRow({ item }: { item: RoundComparisonParameter }) {
  const { t } = useT();
  const c = t.comparison;
  const style = STATUS_STYLE[item.comparison_status];
  return (
    <div className={`p-4 rounded-lg border ${style.row} bg-card`}>
      <div className="flex items-start gap-3">
        {style.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">
              {c.params[item.parameter] ?? item.parameter.replace(/_/g, " ")}
            </span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${style.badge}`}>
              {c.status[item.comparison_status]}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{c.round(1)}</p>
              <VerdictBadge verdict={item.r1_obs?.ai_verdict} />
              <div className="mt-1.5">
                <ObsValues obs={item.r1_obs} />
              </div>
            </div>
            <div className="flex items-center justify-center pt-4">
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{c.round(item.r2_obs?.round_introduced ?? 2)}</p>
              <VerdictBadge verdict={item.r2_obs?.ai_verdict} />
              <div className="mt-1.5">
                <ObsValues obs={item.r2_obs} />
              </div>
            </div>
          </div>
          {item.r2_obs?.ai_draft_text && item.comparison_status !== "STILL_COMPLIANT" && (
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed border-t border-border/50 pt-2">
              {item.r2_obs.ai_draft_text}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

const SECTION_ORDER: ComparisonStatus[] = ["PERSISTS", "NEW", "FIXED", "STILL_COMPLIANT"];

export function RoundComparisonPanel({ comparison }: { comparison: RoundComparison }) {
  const { t } = useT();
  const c = t.comparison;

  if (!comparison.available) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {comparison.reason ?? c.notAvailable}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            {c.availableAfterCorrections}
          </p>
        </CardContent>
      </Card>
    );
  }

  const grouped = SECTION_ORDER.reduce<Record<ComparisonStatus, RoundComparisonParameter[]>>((acc, s) => {
    acc[s] = comparison.parameters.filter((p) => p.comparison_status === s);
    return acc;
  }, {} as Record<ComparisonStatus, RoundComparisonParameter[]>);

  return (
    <div className="space-y-5">
      <SummaryBar summary={comparison.summary} round={comparison.current_round} />

      {SECTION_ORDER.map((status) => {
        const items = grouped[status];
        if (items.length === 0) return null;
        return (
          <div key={status}>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {c.sections[status]} ({items.length})
            </h3>
            <div className="space-y-2">
              {items.map((item) => (
                <ComparisonRow key={item.parameter} item={item} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
