import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function daysRemaining(deadlineAt: string): number {
  const deadline = new Date(deadlineAt);
  const now = new Date();
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function deadlineColor(days: number): string {
  if (days <= 3) return "text-red-600 font-bold";
  if (days <= 7) return "text-amber-600 font-semibold";
  return "text-green-700";
}

export function projectTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    obra_nueva_residencial: "Obra Nueva Residencial",
    ampliacion_residencial: "Ampliación Residencial",
  };
  return labels[type] || type;
}

export function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    pendiente_admision: "Pendiente Admisión",
    admitido: "Admitido",
    en_revision: "En Revisión",
    observado: "Observado",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  };
  return labels[status] || status;
}

export function statusColor(status: string): string {
  const colors: Record<string, string> = {
    pendiente_admision: "bg-gray-100 text-gray-600",
    admitido: "bg-blue-100 text-blue-800",
    en_revision: "bg-yellow-100 text-yellow-800",
    observado: "bg-orange-100 text-orange-800",
    aprobado: "bg-green-100 text-green-800",
    rechazado: "bg-red-100 text-red-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export function verdictColor(verdict: string): string {
  const colors: Record<string, string> = {
    VIOLATION: "bg-red-100 text-red-800 border-red-200",
    COMPLIANT: "bg-green-100 text-green-800 border-green-200",
    NEEDS_REVIEW: "bg-amber-100 text-amber-800 border-amber-200",
    SIN_DATOS: "bg-gray-100 text-gray-600 border-gray-200",
  };
  return colors[verdict] || "bg-gray-100 text-gray-600";
}

export function verdictLabel(verdict: string): string {
  const labels: Record<string, string> = {
    VIOLATION: "Infracción",
    COMPLIANT: "Cumple",
    NEEDS_REVIEW: "Revisar",
    SIN_DATOS: "Sin datos",
  };
  return labels[verdict] || verdict;
}

export function parameterLabel(param: string): string {
  const labels: Record<string, string> = {
    constructibilidad: "Constructibilidad",
    ocupacion_suelo: "Ocupación de Suelo",
    altura_m: "Altura de Edificación",
    densidad_hab_ha: "Densidad",
    estacionamientos: "Estacionamientos",
    distanciamiento_lateral_m: "Distanciamiento Lateral",
    distanciamiento_fondo_m: "Distanciamiento de Fondo",
    antejardin_m: "Antejardín",
  };
  return labels[param] || param;
}
