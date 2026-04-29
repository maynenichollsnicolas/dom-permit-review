"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { statusLabel, statusColor } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, LogOut, Inbox, FileText, CheckCircle, AlertTriangle } from "lucide-react";
import { useUser } from "@/lib/useUser";
import { useT } from "@/lib/i18n";

export default function AdmisibilidadQueue() {
  const { user, signOut } = useUser({ redirectTo: "/dom/login" });
  const { t } = useT();
  const adm = t.admisibilidad;
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.intake.queue()
      .then((data) => setQueue(Array.isArray(data) ? data : []))
      .catch(() => setQueue([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-blue-600" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{adm.title}</h1>
              <p className="text-sm text-gray-500">{adm.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/dom" className="text-sm text-gray-500 hover:text-gray-700">
              {adm.backToReview}
            </Link>
            <span className="text-sm text-gray-500">{user?.user_metadata?.full_name ?? user?.email}</span>
            <button onClick={signOut} className="text-gray-400 hover:text-gray-600">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Inbox className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-2xl font-bold">{queue.length}</p>
                  <p className="text-xs text-gray-500">{adm.stats.inQueue}</p>
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
                    {queue.filter((e) => (e.admisibilidad_checklist ?? []).every((c: any) => c.final_status === "met")).length}
                  </p>
                  <p className="text-xs text-gray-500">{adm.stats.readyToAdmit}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-2xl font-bold text-amber-600">
                    {queue.filter((e) => (e.admisibilidad_checklist ?? []).some((c: any) => c.ai_status === "unmet")).length}
                  </p>
                  <p className="text-xs text-gray-500">{adm.stats.missingDocs}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Queue table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{adm.tableTitle}</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-gray-500 py-8 text-center">{adm.loading}</p>
            ) : queue.length === 0 ? (
              <div className="text-center py-12">
                <Inbox className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">{adm.empty}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-gray-500 uppercase tracking-wide">
                    <th className="pb-3 pr-4">{adm.col.number}</th>
                    <th className="pb-3 pr-4">{adm.col.address}</th>
                    <th className="pb-3 pr-4">{adm.col.zone}</th>
                    <th className="pb-3 pr-4">{adm.col.architect}</th>
                    <th className="pb-3 pr-4">{adm.col.submitted}</th>
                    <th className="pb-3 pr-4">{adm.col.docs}</th>
                    <th className="pb-3">{adm.col.status}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {queue.map((exp) => {
                    const checklist = exp.admisibilidad_checklist ?? [];
                    const met = checklist.filter((c: any) => c.ai_status === "met").length;
                    const unmet = checklist.filter((c: any) => c.ai_status === "unmet").length;
                    const pending = checklist.filter((c: any) => c.ai_status === "pending" || !c.ai_status).length;

                    return (
                      <tr key={exp.id} className="hover:bg-gray-50">
                        <td className="py-3 pr-4">
                          <Link
                            href={`/dom/admisibilidad/${exp.id}`}
                            className="font-medium text-blue-600 hover:underline"
                          >
                            {exp.exp_number}
                          </Link>
                        </td>
                        <td className="py-3 pr-4 text-gray-700">{exp.address}</td>
                        <td className="py-3 pr-4">
                          <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">{exp.zone}</span>
                        </td>
                        <td className="py-3 pr-4 text-gray-600">{exp.architect_name}</td>
                        <td className="py-3 pr-4 text-gray-500">
                          {exp.submitted_at
                            ? new Date(exp.submitted_at).toLocaleDateString(t.lang === "en" ? "en-US" : "es-CL")
                            : "—"}
                        </td>
                        <td className="py-3 pr-4">
                          <DocStatusBadge met={met} unmet={unmet} pending={pending} total={checklist.length} adm={adm} />
                        </td>
                        <td className="py-3">
                          <Badge className={statusColor(exp.status)}>{t.dom.statusPill[exp.status] ?? exp.status}</Badge>
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

function DocStatusBadge({ met, unmet, pending, total, adm }: {
  met: number; unmet: number; pending: number; total: number; adm: any;
}) {
  if (total === 0) return <span className="text-xs text-gray-400">{adm.docStatus.unanalyzed}</span>;
  if (pending > 0) return <span className="text-xs text-gray-500">{adm.docStatus.analyzed(met, total)}</span>;
  if (unmet > 0) return <span className="text-xs font-medium text-red-600">{adm.docStatus.missing(unmet)}</span>;
  return <span className="text-xs font-medium text-green-600">{adm.docStatus.complete}</span>;
}
