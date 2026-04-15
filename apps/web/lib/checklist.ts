/**
 * Compliance checklist configuration.
 *
 * Defines which parameters the DOM must verify for each project type.
 * Parameters not analyzed by the AI pipeline show as "No analizado" so the
 * inspector knows to verify them manually before approving the inspection.
 */

export interface ChecklistParam {
  parameter: string;
  label: string;
}

const ALL_PARAMS: ChecklistParam[] = [
  { parameter: "constructibilidad",       label: "Constructibilidad" },
  { parameter: "ocupacion_suelo",         label: "Ocupación de suelo" },
  { parameter: "altura_m",               label: "Altura máxima (m)" },
  { parameter: "densidad_hab_ha",         label: "Densidad (hab/há)" },
  { parameter: "estacionamientos",        label: "Estacionamientos mínimos" },
  { parameter: "distanciamiento_lateral_m", label: "Distanciamiento lateral (m)" },
  { parameter: "distanciamiento_fondo_m",   label: "Distanciamiento fondo (m)" },
  { parameter: "antejardin_m",            label: "Antejardín (m)" },
];

const CHECKLIST: Record<string, ChecklistParam[]> = {
  obra_nueva_residencial: ALL_PARAMS,

  ampliacion: [
    { parameter: "constructibilidad",         label: "Constructibilidad" },
    { parameter: "ocupacion_suelo",           label: "Ocupación de suelo" },
    { parameter: "altura_m",                 label: "Altura máxima (m)" },
    { parameter: "estacionamientos",          label: "Estacionamientos mínimos" },
    { parameter: "distanciamiento_lateral_m", label: "Distanciamiento lateral (m)" },
    { parameter: "distanciamiento_fondo_m",   label: "Distanciamiento fondo (m)" },
  ],

  cambio_de_destino: [
    { parameter: "estacionamientos",  label: "Estacionamientos mínimos" },
    { parameter: "densidad_hab_ha",   label: "Densidad (hab/há)" },
    { parameter: "ocupacion_suelo",   label: "Ocupación de suelo" },
  ],

  regularizacion: [
    { parameter: "constructibilidad", label: "Constructibilidad" },
    { parameter: "ocupacion_suelo",   label: "Ocupación de suelo" },
    { parameter: "altura_m",         label: "Altura máxima (m)" },
    { parameter: "estacionamientos",  label: "Estacionamientos mínimos" },
  ],
};

/** Returns the ordered parameter checklist for a given project type. */
export function getChecklist(projectType: string): ChecklistParam[] {
  return CHECKLIST[projectType] ?? ALL_PARAMS;
}
