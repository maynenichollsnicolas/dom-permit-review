"use client";

import { CheckCircle, AlertTriangle, XCircle, Minus, ArrowRight } from "lucide-react";
import { RoundComparison, RoundComparisonParameter, ComparisonStatus } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// ─── Label helpers ────────────────────────────────────────────────────────────

const PARAM_LABELS: Record<string, string> = {
  constructibilidad:            "Constructibilidad",
  ocupacion_suelo:              "Ocupación de suelo",
  altura_maxima:                "Altura máxima",
  densidad:                     "Densidad",
  estacionamientos:             "Estacionamientos",
  distanciamiento_lateral:      "Distanciamiento lateral",
  distanciamiento_fondo:        "Distanciamiento fondo",
  antejardin:                   "Antejardín",
  superficie_predio:            "Superficie predio",
  superficie_total_edificada:   "Superficie edificada total",
  num_unidades_vivienda:        "N° unidades de vivienda",
};

function paramLabel(param: string): string {
  return PARAM_LABELS[param] ?? param.replace(/_/g, " ");
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ComparisonStatus, {
  label: string;
  badge: string;
  row: string;
  icon: React.ReactNode;
}> = {
  FIXED: {
    label: "Subsanado",
    badge: "bg-emerald-100 text-emerald-700 border-emerald-200",
    row: "border-emerald-100",
    icon: <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />,
  },
  PERSISTS: {
    label: "Persiste",
    badge: "bg-red-100 text-red-700 border-red-200",
    row: "border-red-100",
    icon: <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />,
  },
  NEW: {
    label: "Nueva observación",
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    row: "border-amber-100",
    icon: <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />,
  },
  STILL_COMPLIANT: {
    label: "Conforme",
    badge: "bg-secondary text-muted-foreground border-border",
    row: "border-border/50",
    icon: <Minus className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />,
  },
};

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({ summary, round }: { summary: RoundComparison["summary"]; round: number }) {
  const pills = [
    { label: "Subsanadas", count: summary.fixed,         cls: "bg-emerald-100 text-emerald-700" },
    { label: "Persisten",  count: summary.persists,      cls: "bg-red-100 text-red-700" },
    { label: "Nuevas",     count: summary.new_issues,    cls: "bg-amber-100 text-amber-700" },
    { label: "Conformes",  count: summary.still_compliant, cls: "bg-secondary text-muted-foreground" },
  ];
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 bg-card rounded-xl border border-border shadow-sm flex-wrap">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mr-1">
        Ronda {round - 1} → {round}
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
  if (!obs) return <span className="text-muted-foreground/40 italic text-xs">—</span>;
  return (
    <div className="text-xs space-y-0.5">
      {obs.declared_value && (
        <div>
          <span className="text-muted-foreground">Declarado: </span>
          <span className="font-medium text-foreground">{obs.declared_value}</span>
        </div>
      )}
      {obs.allowed_value && (
        <div>
          <span className="text-muted-foreground">Permitido: </span>
          <span className="font-medium text-foreground">{obs.allowed_value}</span>
        </div>
      )}
      {obs.delta && (
        <div>
          <span className="text-muted-foreground">Δ: </span>
          <span className="font-medium text-foreground">{obs.delta}</span>
        </div>
      )}
    </div>
  );
}

function VerdictBadge({ verdict }: { verdict: string | undefined | null }) {
  if (!verdict) return null;
  const cls =
    verdict === "COMPLIANT"     ? "bg-emerald-100 text-emerald-700 border-emerald-200" :
    verdict === "VIOLATION"     ? "bg-red-100 text-red-700 border-red-200" :
    verdict === "NEEDS_REVIEW"  ? "bg-amber-100 text-amber-700 border-amber-200" :
    "bg-secondary text-muted-foreground border-border";
  const label =
    verdict === "COMPLIANT"    ? "Conforme" :
    verdict === "VIOLATION"    ? "Infracción" :
    verdict === "NEEDS_REVIEW" ? "Revisar" :
    verdict;
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cls}`}>
      {label}
    </span>
  );
}

// ─── Single parameter row ─────────────────────────────────────────────────────

function ComparisonRow({ item }: { item: RoundComparisonParameter }) {
  const cfg = STATUS_CONFIG[item.comparison_status];
  return (
    <div className={`p-4 rounded-lg border ${cfg.row} bg-card`}>
      <div className="flex items-start gap-3">
        {cfg.icon}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground">{paramLabel(item.parameter)}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${cfg.badge}`}>
              {cfg.label}
            </span>
          </div>
          <div className="mt-2 grid grid-cols-[1fr_auto_1fr] gap-2 items-start">
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ronda 1</p>
              <VerdictBadge verdict={item.r1_obs?.ai_verdict} />
              <div className="mt-1.5">
                <ObsValues obs={item.r1_obs} />
              </div>
            </div>
            <div className="flex items-center justify-center pt-4">
              <ArrowRight className="h-4 w-4 text-muted-foreground/40" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Ronda {item.r2_obs?.round_introduced ?? "2"}</p>
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

interface RoundComparisonPanelProps {
  comparison: RoundComparison;
}

const SECTION_ORDER: ComparisonStatus[] = ["PERSISTS", "NEW", "FIXED", "STILL_COMPLIANT"];
const SECTION_LABELS: Record<ComparisonStatus, string> = {
  PERSISTS:        "Observaciones que persisten",
  NEW:             "Nuevas observaciones",
  FIXED:           "Observaciones subsanadas",
  STILL_COMPLIANT: "Parámetros conformes en ambas rondas",
};

export function RoundComparisonPanel({ comparison }: RoundComparisonPanelProps) {
  if (!comparison.available) {
    return (
      <Card className="shadow-sm">
        <CardContent className="py-12 text-center">
          <AlertTriangle className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {comparison.reason ?? "La comparación no está disponible para este expediente."}
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Estará disponible después de que el arquitecto presente una corrección (Ronda 2).
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
              {SECTION_LABELS[status]} ({items.length})
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
