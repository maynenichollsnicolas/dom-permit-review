"use client";

import { useState } from "react";
import { Observation } from "@/lib/api";
import { verdictColor, verdictLabel, parameterLabel } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ChevronUp, Check, Pencil, X } from "lucide-react";

interface Props {
  observation: Observation;
  onAction: (
    obsId: string,
    action: string,
    text?: string,
    reason?: string,
    notes?: string
  ) => Promise<void>;
}

const DISCARD_REASONS = [
  "Error de cálculo del AI",
  "Excepción normativa aplicable",
  "Dato de entrada incorrecto",
  "Parámetro no aplica a este proyecto",
  "Observación duplicada",
];

export function ObservationCard({ observation: obs, onAction }: Props) {
  const [expanded, setExpanded] = useState(obs.ai_verdict === "NEEDS_REVIEW");
  const [mode, setMode] = useState<"view" | "edit" | "discard">("view");
  const [editText, setEditText] = useState(obs.ai_draft_text ?? "");
  const [discardReason, setDiscardReason] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const isActioned = obs.reviewer_action !== "pending";
  const isCompliant = obs.ai_verdict === "COMPLIANT";

  const handleAccept = async () => {
    setSaving(true);
    await onAction(obs.id, "accepted", obs.ai_draft_text ?? "");
    setSaving(false);
  };

  const handleSaveEdit = async () => {
    if (!editText.trim()) return;
    setSaving(true);
    await onAction(obs.id, "edited", editText, undefined, notes || undefined);
    setMode("view");
    setSaving(false);
  };

  const handleDiscard = async () => {
    if (!discardReason) return;
    setSaving(true);
    await onAction(obs.id, "discarded", undefined, discardReason, notes || undefined);
    setMode("view");
    setSaving(false);
  };

  return (
    <Card className={`mb-3 border ${verdictColor(obs.ai_verdict)} ${isCompliant ? "opacity-70" : ""}`}>
      <CardContent className="p-4">
        {/* Header row */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center gap-3">
            <Badge className={`text-xs ${verdictColor(obs.ai_verdict)}`}>
              {verdictLabel(obs.ai_verdict)}
            </Badge>
            {obs.ai_confidence && obs.ai_verdict !== "COMPLIANT" && (
              <span className="text-xs text-gray-400">
                {obs.ai_confidence === "HIGH" ? "Alta confianza" : obs.ai_confidence === "MEDIUM" ? "Confianza media" : "Baja confianza"}
              </span>
            )}
            <span className="font-medium text-sm text-gray-800">
              {parameterLabel(obs.parameter)}
            </span>
            {isActioned && (
              <Badge className="text-xs bg-gray-100 text-gray-500">
                {obs.reviewer_action === "accepted" ? "✓ Aceptado" :
                  obs.reviewer_action === "edited" ? "✎ Editado" : "✗ Descartado"}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-4 text-xs text-gray-500">
            {obs.declared_value && obs.allowed_value && (
              <span>
                Declarado: <strong>{obs.declared_value}</strong> · Permitido: <strong>{obs.allowed_value}</strong>
              </span>
            )}
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="mt-4 space-y-3">
            {obs.normative_reference && (
              <div className="text-xs text-gray-500">
                <span className="font-medium">Norma: </span>
                {obs.normative_reference}
              </div>
            )}

            {/* AI draft / final text */}
            {(obs.ai_draft_text || obs.reviewer_final_text) && !isCompliant && (
              <div className="bg-white rounded border border-gray-200 p-3">
                <p className="text-xs text-gray-400 mb-1">
                  {obs.reviewer_action === "edited" ? "Texto editado por revisor:" : "Borrador de observación:"}
                </p>
                {mode === "edit" ? (
                  <Textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="text-sm min-h-[80px]"
                  />
                ) : (
                  <p className="text-sm text-gray-800">
                    {obs.reviewer_final_text || obs.ai_draft_text}
                  </p>
                )}
              </div>
            )}

            {/* NEEDS_REVIEW reason */}
            {obs.ai_verdict === "NEEDS_REVIEW" && obs.ai_draft_text && (
              <div className="bg-amber-50 rounded border border-amber-200 p-3 text-xs text-amber-800">
                {obs.ai_draft_text}
              </div>
            )}

            {/* Discard form */}
            {mode === "discard" && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-600">Motivo del descarte (obligatorio):</p>
                <select
                  className="w-full text-sm border rounded p-2"
                  value={discardReason}
                  onChange={(e) => setDiscardReason(e.target.value)}
                >
                  <option value="">Seleccionar motivo...</option>
                  {DISCARD_REASONS.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
                <Textarea
                  placeholder="Notas adicionales (opcional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-sm min-h-[60px]"
                />
              </div>
            )}

            {/* Notes for edit mode */}
            {mode === "edit" && (
              <Textarea
                placeholder="Notas del revisor (opcional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm min-h-[60px]"
              />
            )}

            {/* Action buttons — only for non-COMPLIANT and not yet actioned */}
            {!isCompliant && !isActioned && mode === "view" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={handleAccept} disabled={saving}>
                  <Check className="h-3 w-3 mr-1" /> Aceptar
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50" onClick={() => setMode("discard")}>
                  <X className="h-3 w-3 mr-1" /> Descartar
                </Button>
              </div>
            )}

            {mode === "edit" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={handleSaveEdit} disabled={saving || !editText.trim()}>
                  Guardar edición
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("view")}>Cancelar</Button>
              </div>
            )}

            {mode === "discard" && (
              <div className="flex gap-2 pt-1">
                <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white" onClick={handleDiscard} disabled={saving || !discardReason}>
                  Confirmar descarte
                </Button>
                <Button size="sm" variant="outline" onClick={() => setMode("view")}>Cancelar</Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
