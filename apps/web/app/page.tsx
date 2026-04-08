"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Expedient } from "@/lib/api";
import { daysRemaining, deadlineColor, projectTypeLabel, statusLabel, statusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Clock, FileText, CheckCircle } from "lucide-react";

export default function QueuePage() {
  const [expedients, setExpedients] = useState<Expedient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.expedients.list().then(setExpedients).finally(() => setLoading(false));
  }, []);

  const critical = expedients.filter((e) => daysRemaining(e.legal_deadline_at) <= 3);
  const warning = expedients.filter(
    (e) => daysRemaining(e.legal_deadline_at) > 3 && daysRemaining(e.legal_deadline_at) <= 7
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">DOM Las Condes</h1>
            <p className="text-sm text-gray-500">Revisión de Expedientes — Revisor Técnico</p>
          </div>
          <div className="text-sm text-gray-500">Ana Martínez</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-900">{expedients.length}</p>
                  <p className="text-sm text-gray-500">Expedientes activos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{critical.length}</p>
                  <p className="text-sm text-gray-500">Plazo crítico (≤3 días)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">{warning.length}</p>
                  <p className="text-sm text-gray-500">Plazo cercano (≤7 días)</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">
                    {expedients.filter((e) => e.status === "aprobado").length}
                  </p>
                  <p className="text-sm text-gray-500">Aprobados este mes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cola de Revisión</CardTitle>
            <p className="text-sm text-gray-500">Ordenado por plazo legal (Ley 21.718)</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500 py-8 text-center">Cargando expedientes...</p>
            ) : expedients.length === 0 ? (
              <p className="text-sm text-gray-500 py-8 text-center">No hay expedientes asignados.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="pb-3 pr-4">Expediente</th>
                    <th className="pb-3 pr-4">Dirección</th>
                    <th className="pb-3 pr-4">Tipo</th>
                    <th className="pb-3 pr-4">Zona</th>
                    <th className="pb-3 pr-4">Estado</th>
                    <th className="pb-3 pr-4">Ronda</th>
                    <th className="pb-3">Plazo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expedients.map((exp) => {
                    const days = daysRemaining(exp.legal_deadline_at);
                    return (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <Link
                            href={`/expedients/${exp.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {exp.exp_number}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{exp.address}</td>
                        <td className="py-3 pr-4 text-gray-600">{projectTypeLabel(exp.project_type)}</td>
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                            {exp.zone}
                          </span>
                        </td>
                        <td className="py-3 pr-4">
                          <Badge className={statusColor(exp.status)}>{statusLabel(exp.status)}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">Ronda {exp.current_round}</td>
                        <td className={`py-3 ${deadlineColor(days)}`}>
                          {days > 0 ? `${days} días` : "VENCIDO"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
