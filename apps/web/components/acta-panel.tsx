"use client";

import { useState } from "react";
import { Acta } from "@/lib/api";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Send, Lock } from "lucide-react";

interface Props {
  acta: Acta | null;
  expedientId: string;
  onPublish: () => void;
}

export function ActaPanel({ acta, expedientId, onPublish }: Props) {
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePublish = async () => {
    setError(null);
    setPublishing(true);
    try {
      await api.expedients.publishActa(expedientId);
      onPublish();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Error al publicar el Acta");
    } finally {
      setPublishing(false);
    }
  };

  if (!acta) {
    return (
      <div className="text-center py-16 text-gray-500">
        <FileText className="h-10 w-10 mx-auto mb-3 text-gray-300" />
        <p>El Acta se generará automáticamente una vez completado el análisis.</p>
      </div>
    );
  }

  const isPublished = acta.status === "published";

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex items-center justify-between p-4 bg-white rounded-lg border">
        <div className="flex items-center gap-3">
          {isPublished ? (
            <Lock className="h-4 w-4 text-gray-500" />
          ) : (
            <FileText className="h-4 w-4 text-blue-500" />
          )}
          <span className="font-medium text-sm text-gray-800">
            {isPublished
              ? `Acta N° ${acta.acta_number} — Publicada`
              : "Borrador del Acta de Observaciones"}
          </span>
          <Badge className={isPublished ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}>
            {isPublished ? "Publicada" : "Borrador"}
          </Badge>
        </div>
        {!isPublished && (
          <div className="flex items-center gap-3">
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button
              onClick={handlePublish}
              disabled={publishing}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Send className="h-4 w-4 mr-2" />
              {publishing ? "Publicando..." : "Publicar Acta"}
            </Button>
          </div>
        )}
      </div>

      {/* Acta content — rendered in official format */}
      <Card>
        <CardContent className="p-0">
          <pre className="font-mono text-xs text-gray-800 whitespace-pre-wrap p-6 leading-relaxed bg-white rounded-lg">
            {acta.content?.acta_text ?? "Sin contenido."}
          </pre>
        </CardContent>
      </Card>

      {/* Structured observations list */}
      {acta.content?.observations && acta.content.observations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Observaciones incluidas en el Acta</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {acta.content.observations.map((obs) => (
                <div key={obs.number} className="border-l-2 border-red-300 pl-4 py-1">
                  <p className="text-xs font-semibold text-gray-700 uppercase">
                    {obs.number}. {obs.title}
                  </p>
                  <p className="text-sm text-gray-600 mt-1">{obs.text}</p>
                  <p className="text-xs text-gray-400 mt-1">Norma: {obs.normative_reference}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
