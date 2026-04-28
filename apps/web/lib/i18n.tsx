"use client";

import { createContext, useContext, useEffect, useState } from "react";

// ─── Translation dictionaries ─────────────────────────────────────────────────

const en = {
  lang: "en" as const,

  // ── Common ──────────────────────────────────────────────────────────────────
  common: {
    loading: "Loading...",
    days: "days",
    expired: "EXPIRED",
    cancel: "Cancel",
    open: "Open",
    round: "Round",
    optional: "Optional",
    noData: "—",
  },

  // ── Statuses (used in headers and pills) ────────────────────────────────────
  status: {
    pendiente_admision: "Pending Admission",
    admitido: "Admitted",
    en_revision: "Under Review",
    observado: "Observed",
    aprobado: "Approved",
    rechazado: "Rejected",
  } as Record<string, string>,

  // ── Project types ────────────────────────────────────────────────────────────
  projectType: {
    obra_nueva_residencial: "New Residential Construction",
    ampliacion_residencial: "Residential Addition",
    ampliacion: "Addition",
    cambio_de_destino: "Change of Use",
    regularizacion: "Regularization",
  } as Record<string, string>,

  // ── Parameters ───────────────────────────────────────────────────────────────
  param: {
    constructibilidad: "Floor Area Ratio",
    ocupacion_suelo: "Site Coverage",
    altura_m: "Building Height",
    densidad_hab_ha: "Density",
    estacionamientos: "Parking",
    distanciamiento_lateral_m: "Side Setback",
    distanciamiento_fondo_m: "Rear Setback",
    antejardin_m: "Front Setback",
  } as Record<string, string>,

  // ── Verdicts ─────────────────────────────────────────────────────────────────
  verdict: {
    VIOLATION: "Violation",
    COMPLIANT: "Compliant",
    NEEDS_REVIEW: "Needs Review",
    SIN_DATOS: "No Data",
  } as Record<string, string>,

  // ── DOM Queue page ───────────────────────────────────────────────────────────
  dom: {
    appName: "DOM Las Condes",
    technicalReview: "Technical Review",
    admisibilidad: "Admissibility",
    stats: {
      active: "Active Applications",
      critical: "Critical — ≤ 3 days",
      dueSoon: "Due this week",
      approved: "Approved this period",
    },
    queue: {
      title: "Review Queue",
      subtitle: "Sorted by legal deadline — Law 21.718",
      critical: (n: number) => `${n} critical application${n !== 1 ? "s" : ""}`,
      loading: "Loading applications...",
      empty: "No applications assigned.",
    },
    col: {
      expedient: "Application",
      address: "Address",
      type: "Type",
      zone: "Zone",
      status: "Status",
      round: "Round",
      deadline: "Deadline",
    },
    statusPill: {
      pendiente_admision: "Pending Admission",
      admitido: "Admitted",
      en_revision: "Under Review",
      observado: "Observed",
      aprobado: "Approved",
      rechazado: "Rejected",
    } as Record<string, string>,
  },

  // ── Architect portal ─────────────────────────────────────────────────────────
  arch: {
    portal: "Architect Portal",
    stats: {
      inAdmission: "In Admission",
      underReview: "Under Review",
      observed: "Observed",
      approved: "Approved",
    },
    table: {
      title: "My Applications",
      subtitle: "Building permit applications",
      newBtn: "New application",
      loading: "Loading...",
      empty: "You have no applications yet.",
      firstLink: "Submit first application",
    },
    col: {
      expedient: "Application",
      address: "Address",
      zone: "Zone",
      status: "Status",
      round: "Round",
      deadline: "Deadline",
    },
    statusPill: {
      pendiente_admision: "In Admission",
      admitido: "Under Review",
      en_revision: "Under Review",
      observado: "Observed",
      aprobado: "Approved",
      rechazado: "Rejected",
    } as Record<string, string>,
  },

  // ── Permit checklist ─────────────────────────────────────────────────────────
  checklist: {
    title: "Building Permit Requirements",
    completed: (done: number, total: number) => `${done}/${total} completed`,
    docs: {
      solicitud_firmada: "Signed Application",
      cip_vigente: "Valid CIP",
      fue: "FUE",
      planos_arquitectonicos: "Architectural Plans",
      cuadro_superficies: "Area Summary",
      memoria_calculo: "Structural Calculations",
      factibilidad_sanitaria: "Sanitary Feasibility",
      informe_ri: "Independent Reviewer Report",
    } as Record<string, string>,
    stages: {
      documentos: {
        label: "1. Required Documents",
        done: "Complete",
        progress: (u: number, t: number) => `${u}/${t} uploaded`,
        detailDone: "All mandatory documents received.",
        detailMissing: (n: number) => `${n} mandatory document${n !== 1 ? "s" : ""} missing.`,
        uploadDocs: "Upload documents →",
      },
      admisibilidad: {
        label: "2. Admissibility",
        approved: "Approved",
        pending: "Pending",
        detailDone: "Application admitted by the DOM.",
        detailPending: "DOM will verify document completeness before starting technical review.",
      },
      analisis: {
        label: "3. Normative Analysis",
        params: (n: number) => `${n} parameter${n !== 1 ? "s" : ""}`,
        running: "In Progress",
        pending: "Pending",
        detailDone: (ok: number, confirmed: number) =>
          `${ok} compliant — ${confirmed} observation${confirmed !== 1 ? "s" : ""} found.`,
        detailRunning: "AI agent is verifying urban parameters against OGUC and PRC.",
        detailPending: "Will start automatically once the application is admitted.",
        viewParams: "View parameters →",
      },
      revision: {
        label: "4. DOM Review",
        done: "Completed",
        pendingCount: (n: number) => `${n} pending`,
        pending: "Pending",
        detailDoneObs: (n: number) => `${n} observation${n !== 1 ? "s" : ""} confirmed for the Report.`,
        detailDoneClean: "All parameters approved. No observations.",
        detailPendingObs: (n: number) => `Reviewer must decide on ${n} parameter${n !== 1 ? "s" : ""}.`,
        detailPendingWait: "Will start once normative analysis is complete.",
        goReview: "Go to review →",
      },
      resolucion: {
        label: "5. Resolution",
        approved: "Approved",
        observed: "Observed",
        ready: "Ready to resolve",
        pending: "Pending",
        detailApproved: "Building permit approved. No observations.",
        detailObserved: (num: string, n: number) =>
          `Report No. ${num} issued with ${n} observation${n !== 1 ? "s" : ""}. Architect must remediate.`,
        detailReadyObs: "Ready to publish the Observations Report.",
        detailReadyClean: "Ready to approve the application.",
        detailPending: "Pending review of observations.",
        viewActa: "View Report →",
        approveBtn: "Approve application →",
      },
    },
  },

  // ── DOM expedient detail ─────────────────────────────────────────────────────
  domDetail: {
    header: {
      daysLabel: (n: number) => `${n} days`,
      legalLabel: "(Law 21.718)",
      expired: "EXPIRED",
    },
    tabs: {
      resumen: "Summary",
      analisis: "Compliance Analysis",
      acta: "Observations Report",
      documents: "Documents",
    },
    summary: {
      expedientTitle: "Application Data",
      paramsTitle: "Parameters — CIP vs. Declared",
      owner: "Owner",
      architect: "Architect",
      submitted: "Submitted",
      expires: "Expires",
      cipNumber: "CIP No.",
      cipDate: "CIP Date",
      ri: "Ind. Reviewer",
      riYes: "Yes (15 days)",
      riNo: "No (30 days)",
      cip: "CIP",
      declared: "Declared",
      delta: "Delta",
      rows: {
        constructibilidad: "Floor Area Ratio",
        ocupacion_suelo: "Site Coverage",
        altura: "Height (m)",
        densidad: "Density (inh/ha)",
        estacionamientos: "Parking",
        distLateral: "Side Setback (m)",
        distFondo: "Rear Setback (m)",
        antejardin: "Front Setback (m)",
      },
      noParams: "No parameters loaded.",
    },
    analysis: {
      summary: {
        parameters: (n: number) => `${n} parameter${n !== 1 ? "s" : ""} to verify`,
        pending: (n: number) => `${n} pending`,
        allReviewed: "All reviewed",
        observations: (n: number) => `${n} observation${n !== 1 ? "s" : ""}`,
        approved: (n: number) => `${n} approved`,
      },
      progress: {
        title: "Analyzing application with AI",
        subtitle: (n: number) =>
          `Verifying against OGUC, PRC Las Condes and DOM precedents. Analysis takes ~${n}s.`,
        stages: {
          params: "Retrieving application parameters",
          query: "Querying PRC and OGUC regulations",
          reason: "Evaluating compliance with AI agent",
          generate: "Generating observations and drafting",
          acta: "Preparing draft Report",
        },
      },
      runningTitle: "Analyzing application with AI...",
      runningSubtitle: "Verifying against OGUC and PRC Las Condes",
      failed: "Analysis failed.",
      retry: "Retry analysis",
      pendingWarning: (n: number) =>
        `${n} parameter${n !== 1 ? "s" : ""} pending decision. Review all items before approving or issuing the Report.`,
      viewActa: (n: number) => `View Observations Report (${n})`,
      approveBtn: "Approve application",
      approving: "Approving...",
      approved: "Application approved",
      confirmApprove:
        "Confirm that the application complies with all regulations and should be approved?",
    },
    documents: {
      title: "Application Documents",
      subtitle: "Documents submitted by the architect. Open directly in the browser.",
      empty: "No documents registered for this application.",
      open: "Open",
      openError: "Could not open the document.",
      labels: {
        cip_vigente: "Valid CIP",
        cuadro_superficies: "Area Summary",
        planos_arquitectonicos: "Architectural Plans",
        solicitud_firmada: "Signed Application",
        fue: "FUE",
        memoria_calculo: "Structural Calculations",
        factibilidad_sanitaria: "Sanitary Feasibility",
        informe_ri: "Independent Reviewer Report",
      } as Record<string, string>,
    },
  },

  // ── Observation card (ChecklistItem) ─────────────────────────────────────────
  obs: {
    unanalyzed: "Not analyzed",
    unanalyzedDetail: "AI could not verify — review manually against current regulations",
    aiApproved: "AI Approved",
    reviewerApproved: "Reviewer Approved",
    observationConfirmed: "Observation Confirmed",
    violation: "Violation",
    needsReview: "Needs Decision",
    noData: "No normative data",
    noDataDetail:
      "No applicable regulation found in RAG database. Verify manually against OGUC and PRC Las Condes.",
    declared: "Declared",
    allowed: "Allowed",
    verifyIn: "Verify in:",
    cipDoc: "Valid CIP",
    areaDoc: "Area Summary",
    planosDoc: "Plans",
    reasonLabel: "Reason:",
    discardTitle: "Discard reason",
    editPlaceholder: "Draft observation text...",
    reviewerNotes: "Reviewer notes (optional)",
    accept: "Accept observation",
    edit: "Edit",
    discard: "Discard",
    markCompliant: "Mark compliant",
    addObservation: "Add observation",
    addManual: "Add manual observation",
    reopen: "Reopen as observation",
    editText: "Edit text",
    discardMarkCompliant: "Discard → mark compliant",
    saving: "Saving...",
    savingDiscard: "Discarding...",
    saveObservation: "Save observation",
    confirmDiscard: "Confirm discard",
    cancel: "Cancel",
    viewDetails: "View details",
    discardReasons: [
      "AI calculation error",
      "Applicable normative exception",
      "Incorrect input data",
      "Parameter does not apply to this project",
      "Duplicate observation",
    ],
  },

  // ── Acta panel ───────────────────────────────────────────────────────────────
  acta: {
    draftLabel: "Draft — Observations Report",
    publishedLabel: (n: string) => `Report No. ${n} — Published`,
    lockedBadge: "Locked",
    draftBadge: "Draft",
    publishedBadge: "Published",
    editedBadge: "Edited",
    noObsTitle: "No confirmed observations",
    noObsDetail:
      "Accept or edit AI observations in the compliance analysis tab before generating the report.",
    noAnalysis: "The normative analysis has not been run yet.",
    publishBtn: (n: number) => `Publish Report (${n} observation${n !== 1 ? "s" : ""})`,
    publishing: "Publishing...",
    error: "Error publishing. Try again.",
    metaApp: "Application:",
    metaAddress: "Address:",
    metaType: "Type:",
    metaZone: "Zone:",
    metaOwner: "Owner:",
    metaArchitect: "Architect:",
    metaDate: "Review date:",
    metaRound: "Round:",
    intro: (n: number) =>
      `After technical review, the following ${n === 1 ? "observation has" : `${n} observations have`} been identified that must be remediated:`,
    closing:
      "The architect has 60 business days from the date of this report to submit the required corrections, pursuant to Article 118 of the LGUC and the applicable regulations.",
    obsBadge: "OBS.",
    docTitle: "OBSERVATIONS REPORT",
    docDom: "Municipality of Las Condes",
    docDept: "Municipal Works Department (DOM)",
  },

  // ── Architect expedient detail ────────────────────────────────────────────────
  archDetail: {
    tabs: {
      overview: "Overview",
      docs: "Documents",
      chat: "Assistant",
    },
    steps: {
      sub: {
        pendiente_admision: "In queue for admission",
        admitido: "Analysis in progress",
        en_revision: "DOM reviewing",
        observado: "Corrections required",
        aprobado: "Permit granted",
      },
    },
    projectData: "Project Data",
    cipVsDeclared: "CIP vs. Declared",
    params: {
      owner: "Owner",
      architect: "Architect",
      zone: "Zone",
      type: "Type",
      round: "Round",
      cipNumber: "CIP No.",
      cipDate: "CIP Date",
      constructibilidad: "Floor Area Ratio",
      ocupacion_suelo: "Site Coverage",
      altura: "Height (m)",
      distLateral: "Side Setback (m)",
      distFondo: "Rear Setback (m)",
      antejardin: "Front Setback (m)",
      densidad: "Density",
      estacionamientos: "Parking",
      supEdificada: "Built area",
      cip: "CIP",
      declared: "Declared",
      parameter: "Parameter",
    },
    acta: {
      title: (round: number) => `Observations Report — Round ${round}`,
      detail:
        "The DOM has identified the following observations. Please correct them and submit the remediation below.",
    },
    approvedCard: {
      title: "Permit Approved",
      detail: "Your building permit has been approved by DOM Las Condes.",
    },
    remediation: {
      title: (round: number) => `Remediation — Round ${round}`,
      subtitle: "Enter only the values you corrected. All others remain unchanged.",
      notes: "Remediation note",
      notesOptional: "(optional)",
      notesPlaceholder: "Briefly describe the changes made to the project...",
      submit: (round: number) => `Submit remediation — Round ${round}`,
      submitting: "Submitting corrections...",
      minOneParam: "Modify at least one parameter to submit the remediation.",
    },
    submitted: {
      title: "Corrections submitted",
      detail: "DOM will start Round 2 review. Redirecting...",
    },
    inAdmission: {
      title: "In queue for admission",
      detail: "The admissibility officer is verifying your documentation.",
      eta: (days: number) => `Once admitted, DOM has ${days} business days to review (Law 21.718).`,
    },
    inReview: {
      title: (round: number) => `Under technical review — Round ${round}`,
      detail: "DOM reviewers are evaluating your application. We will notify you when there are results.",
      etaLabel: "Legal deadline:",
      urgent: (days: number) => `${days} days remaining`,
    },
    docs: {
      title: "Application Documents",
      subtitle:
        "Documents uploaded when the application was submitted. Pending ones can be completed here at any time.",
      loading: "Loading documents...",
      open: "Open",
      replace: "Replace",
      uploadPdf: "Upload PDF",
    },
    chat: {
      title: "DOM Assistant",
      subtitle: "OGUC · PRC Las Condes · Law 21.718",
      online: "Online",
      clearChat: "Clear conversation",
      placeholder: "Type your question… (Enter to send, Shift+Enter for new line)",
      quickTitle: "Frequently asked questions",
      questions: [
        "Why are there violations in my application?",
        "How do I correctly calculate the floor area ratio?",
        "What documents should I include in the remediation?",
        "How long does DOM have to review my remediation?",
      ],
      welcome:
        "Hello. I am the **DOM Assistant**.\n\nI can help you understand the observations in your application, the applicable regulations (OGUC, PRC Las Condes, Law 21.718), and how to prepare the remediation.\n\nHow can I help you?",
      error: "Error connecting to the assistant. Please try again.",
    },
    correctionField: {
      current: "current",
      max: "max.",
      min: "min.",
      placeholder: "Correct ↑",
    },
    openDocError: "Could not open the document. Please try again.",
    errorResubmit: "Error submitting corrections",
    notFound: "Application not found.",
    rejected: "Rejected",
  },

  submit: {
    header: "New Application",
    steps: { info: "Project Data", documents: "Documents", review: "Review & Submit" },
    done: {
      title: "Application submitted",
      detail: "Your application is in the admissibility queue. DOM will review the documentation and notify you.",
      viewBtn: "View my applications",
    },
    info: {
      section: "Project Data",
      owner: "Property owner name",
      address: "Property address",
      addressHint: "— Google will validate and detect the PRC zone",
      addressPlaceholder: "E.g.: Av. Apoquindo 4700, Las Condes",
      zoneDetected: (zone: string) => `Zone ${zone} detected automatically`,
      zoneError: "No zone detected. Select manually.",
      geoError: "Error querying the zone.",
      zoneLabel: "PRC Zone",
      projectType: "Project type",
      projectTypes: {
        obra_nueva_residencial: "New residential construction",
        ampliacion_residencial: "Residential extension",
      } as Record<string, string>,
      subtypes: {
        unifamiliar: { label: "Single-family", desc: "House or villa — 1 unit" },
        multifamiliar: { label: "Multi-family", desc: "Building — 2+ units" },
      } as Record<string, { label: string; desc: string }>,
      ri: { label: "Has Independent Reviewer", desc: "Reduces deadline from 30 to 15 business days (Law 21.718)" },
      continueBtn: "Continue → Upload documents",
    },
    docs: {
      extractCallout: {
        title: "Automatic data extraction.",
        body: (cip: string, cuadro: string) => `When you upload the ${cip} and the ${cuadro}, AI will read the regulatory and declared parameters directly from the documents.`,
      },
      mandatory: { section: "Mandatory documents", subtitle: "If you don't have one yet, mark it — you can complete it before DOM reviews the application." },
      optional: { section: "Optional documents" },
      back: "← Back",
      analyzing: "Analyzing documents...",
      missing: (n: number) => `${n} document${n !== 1 ? "s" : ""} missing — upload or mark them`,
      continueBtn: "Review and submit →",
      types: {
        cip_vigente:          { label: "Valid CIP",                          description: "Prior Information Certificate — extracts regulatory parameters",      tooltip: "The CIP contains the PRC parameters for your property. Issued by DOM, valid for 1 year." },
        cuadro_superficies:   { label: "Area schedule",                      description: "Regulatory area schedule — extracts declared project parameters",     tooltip: "The area schedule contains the actual project values." },
        planos_arquitectonicos:{ label: "Architectural drawings",            description: "Site plan, floor plans, sections and elevations to scale",            tooltip: "Complete drawing set. Parameters can also be extracted from drawings if the area schedule is insufficient." },
        solicitud_firmada:    { label: "Signed application",                 description: "By owner and sponsoring architect",                                   tooltip: "Official DOM form signed by both parties." },
        fue:                  { label: "FUE",                                description: "Unique Building Statistics Form (INE)",                               tooltip: "Required by INE for building statistics." },
        memoria_calculo:      { label: "Structural calculation report",      description: "Signed by structural engineer",                                       tooltip: "Structural report signed by civil engineer." },
        factibilidad_sanitaria:{ label: "Sanitary feasibility certificate",  description: "Issued by SMAPA, Aguas Andinas or other utility",                    tooltip: "Certifies that the property can connect to sanitary networks." },
        informe_ri:           { label: "Independent Reviewer report",        description: "Reduces legal review period to 15 days (Law 21.718)",                 tooltip: "Only applicable if the project has an accredited Independent Reviewer." },
      } as Record<string, { label: string; description: string; tooltip: string }>,
      mandatoryBadge: "Mandatory",
      optionalBadge: "Optional",
      extractsBadge: "Extracts data",
      riRecommended: "Recommended (you have RI)",
      notAvailable: "Marked as not currently available",
      notAvailableCheck: "I don't have it yet — I'll submit it before the review",
      change: "Change",
      upload: "Upload PDF",
      analyzingDoc: "Analyzing document with AI...",
      extractLoading: (doc: string) => `Extracting data from ${doc}…`,
      extractDone: (doc: string, fields: string) => `${doc} analyzed — ${fields} extracted`,
      extractFields: {
        cip_vigente: ["Floor area ratio", "Height", "Density", "Front setback", "Setbacks"],
        cuadro_superficies: ["Declared parameters", "Areas", "Units"],
      } as Record<string, string[]>,
    },
    review: {
      extractedTitle: "Data extracted from documents.",
      extractedBody: "Fields marked with",
      extractedAi: "AI",
      extractedSuffix: "were filled automatically. Verify and correct if needed before submitting.",
      missingTitle: (n: number) => `${n} pending document${n !== 1 ? "s" : ""}`,
      missingNote: "The application will be in the admissibility queue. DOM cannot admit it until received — you can upload them later from your dashboard.",
      cipTitle: "CIP Parameters",
      cipSubtitle: "Regulatory values from the Prior Information Certificate issued by DOM. These fields are read-only — they come from the official document.",
      declaredTitle: "Declared Project Parameters",
      declaredSubtitle: "Actual project values from drawings and area schedule.",
      unitsLabel: "No. of housing units",
      unitsNote: "Housing units: automatically set to 1 for single-family projects.",
      readOnly: "Read-only",
      fillManually: "Fill in manually",
      back: "← Back",
      submitting: "Submitting application...",
      submitBtn: "Submit application to DOM",
      errorMsg: "Error submitting the application. Please verify the data and try again.",
    },
    fields: {
      cip: {
        number: "CIP No.", date: "Issue date",
        constructibilidad: "Max. floor area ratio", ocupacion_suelo: "Max. site coverage",
        altura: "Max. height", densidad: "Max. density", estacionamientos: "Min. parking",
        distLateral: "Min. side setback", distFondo: "Min. rear setback", antejardin: "Min. front setback",
      },
      declared: {
        constructibilidad: "Floor area ratio", ocupacion_suelo: "Site coverage",
        altura: "Height", densidad: "Density", estacionamientos: "Parking",
        distLateral: "Side setback", distFondo: "Rear setback", antejardin: "Front setback",
        superficiePredio: "Plot area", superficieEdificada: "Built area", numUnidades: "No. of housing units",
      },
    },
  },
};

// ─── Spanish (source of truth — mirrors existing hardcoded strings) ───────────

const es: typeof en = {
  lang: "es" as unknown as "en",

  common: {
    loading: "Cargando...",
    days: "días",
    expired: "VENCIDO",
    cancel: "Cancelar",
    open: "Abrir",
    round: "Ronda",
    optional: "Opcional",
    noData: "—",
  },

  status: {
    pendiente_admision: "Pendiente Admisión",
    admitido: "Admitido",
    en_revision: "En Revisión",
    observado: "Observado",
    aprobado: "Aprobado",
    rechazado: "Rechazado",
  },

  projectType: {
    obra_nueva_residencial: "Obra Nueva Residencial",
    ampliacion_residencial: "Ampliación Residencial",
    ampliacion: "Ampliación",
    cambio_de_destino: "Cambio de Destino",
    regularizacion: "Regularización",
  },

  param: {
    constructibilidad: "Constructibilidad",
    ocupacion_suelo: "Ocupación de Suelo",
    altura_m: "Altura de Edificación",
    densidad_hab_ha: "Densidad",
    estacionamientos: "Estacionamientos",
    distanciamiento_lateral_m: "Distanciamiento Lateral",
    distanciamiento_fondo_m: "Distanciamiento de Fondo",
    antejardin_m: "Antejardín",
  },

  verdict: {
    VIOLATION: "Infracción",
    COMPLIANT: "Cumple",
    NEEDS_REVIEW: "Revisar",
    SIN_DATOS: "Sin datos",
  },

  dom: {
    appName: "DOM Las Condes",
    technicalReview: "Revisión Técnica",
    admisibilidad: "Admisibilidad",
    stats: {
      active: "Expedientes activos",
      critical: "Plazo crítico — ≤ 3 días",
      dueSoon: "Vence esta semana",
      approved: "Aprobados este período",
    },
    queue: {
      title: "Cola de Revisión",
      subtitle: "Ordenada por plazo legal — Ley 21.718",
      critical: (n: number) => `${n} expediente${n !== 1 ? "s" : ""} crítico${n !== 1 ? "s" : ""}`,
      loading: "Cargando expedientes...",
      empty: "No hay expedientes asignados.",
    },
    col: {
      expedient: "Expediente",
      address: "Dirección",
      type: "Tipo",
      zone: "Zona",
      status: "Estado",
      round: "Ronda",
      deadline: "Plazo",
    },
    statusPill: {
      pendiente_admision: "Pendiente admisión",
      admitido: "Admitido",
      en_revision: "En revisión",
      observado: "Observado",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    },
  },

  arch: {
    portal: "Portal del Arquitecto",
    stats: {
      inAdmission: "En admisión",
      underReview: "En revisión",
      observed: "Observados",
      approved: "Aprobados",
    },
    table: {
      title: "Mis Expedientes",
      subtitle: "Permisos de edificación ingresados",
      newBtn: "Nuevo expediente",
      loading: "Cargando...",
      empty: "No tienes expedientes ingresados aún.",
      firstLink: "Ingresar primer expediente",
    },
    col: {
      expedient: "Expediente",
      address: "Dirección",
      zone: "Zona",
      status: "Estado",
      round: "Ronda",
      deadline: "Plazo",
    },
    statusPill: {
      pendiente_admision: "En admisión",
      admitido: "En revisión",
      en_revision: "En revisión",
      observado: "Observado",
      aprobado: "Aprobado",
      rechazado: "Rechazado",
    },
  },

  checklist: {
    title: "Requisitos para el permiso de edificación",
    completed: (done: number, total: number) => `${done}/${total} completados`,
    docs: {
      solicitud_firmada: "Solicitud firmada",
      cip_vigente: "CIP vigente",
      fue: "FUE",
      planos_arquitectonicos: "Planos arquitectónicos",
      cuadro_superficies: "Cuadro de superficies",
      memoria_calculo: "Memoria de cálculo",
      factibilidad_sanitaria: "Factibilidad sanitaria",
      informe_ri: "Informe Revisor Independiente",
    },
    stages: {
      documentos: {
        label: "1. Documentación requerida",
        done: "Completa",
        progress: (u: number, t: number) => `${u}/${t} subidos`,
        detailDone: "Todos los documentos obligatorios fueron recibidos.",
        detailMissing: (n: number) => `Faltan ${n} documento${n !== 1 ? "s" : ""} obligatorio${n !== 1 ? "s" : ""}.`,
        uploadDocs: "Subir documentos →",
      },
      admisibilidad: {
        label: "2. Admisibilidad",
        approved: "Aprobada",
        pending: "Pendiente",
        detailDone: "El expediente fue admitido por la DOM.",
        detailPending: "La DOM verificará que los documentos estén completos antes de iniciar la revisión técnica.",
      },
      analisis: {
        label: "3. Análisis normativo",
        params: (n: number) => `${n} parámetro${n !== 1 ? "s" : ""}`,
        running: "En proceso",
        pending: "Pendiente",
        detailDone: (ok: number, confirmed: number) =>
          `${ok} cumplen — ${confirmed} observación${confirmed !== 1 ? "es" : ""} detectada${confirmed !== 1 ? "s" : ""}.`,
        detailRunning: "El agente IA está verificando los parámetros urbanísticos contra la OGUC y el PRC.",
        detailPending: "Se iniciará automáticamente una vez admitido el expediente.",
        viewParams: "Ver parámetros →",
      },
      revision: {
        label: "4. Revisión DOM",
        done: "Completada",
        pendingCount: (n: number) => `${n} pendiente${n !== 1 ? "s" : ""}`,
        pending: "Pendiente",
        detailDoneObs: (n: number) =>
          `${n} observación${n !== 1 ? "es" : ""} confirmada${n !== 1 ? "s" : ""} para incluir en el Acta.`,
        detailDoneClean: "Todos los parámetros aprobados. Sin observaciones.",
        detailPendingObs: (n: number) =>
          `El revisor debe decidir sobre ${n} parámetro${n !== 1 ? "s" : ""}.`,
        detailPendingWait: "Comenzará una vez finalizado el análisis normativo.",
        goReview: "Ir a revisión →",
      },
      resolucion: {
        label: "5. Resolución",
        approved: "Aprobado",
        observed: "Observado",
        ready: "Listo para resolver",
        pending: "Pendiente",
        detailApproved: "Permiso de edificación aprobado. Sin observaciones.",
        detailObserved: (num: string, n: number) =>
          `Acta N° ${num} emitida con ${n} observación${n !== 1 ? "es" : ""}. El arquitecto debe subsanar.`,
        detailReadyObs: "Listo para publicar el Acta de Observaciones.",
        detailReadyClean: "Listo para aprobar el expediente.",
        detailPending: "Pendiente de la revisión de observaciones.",
        viewActa: "Ver Acta →",
        approveBtn: "Aprobar expediente →",
      },
    },
  },

  domDetail: {
    header: {
      daysLabel: (n: number) => `${n} días`,
      legalLabel: "(Ley 21.718)",
      expired: "VENCIDO",
    },
    tabs: {
      resumen: "Resumen",
      analisis: "Análisis de Cumplimiento",
      acta: "Acta de Observaciones",
      documents: "Documentos",
    },
    summary: {
      expedientTitle: "Datos del Expediente",
      paramsTitle: "Parámetros — CIP vs. Declarado",
      owner: "Propietario",
      architect: "Arquitecto",
      submitted: "Ingresado",
      expires: "Vence",
      cipNumber: "CIP N°",
      cipDate: "Fecha CIP",
      ri: "RI",
      riYes: "Sí (15 días)",
      riNo: "No (30 días)",
      cip: "CIP",
      declared: "Declarado",
      delta: "Delta",
      rows: {
        constructibilidad: "Constructibilidad",
        ocupacion_suelo: "Ocupación suelo",
        altura: "Altura (m)",
        densidad: "Densidad (hab/há)",
        estacionamientos: "Estacionamientos",
        distLateral: "Dist. lateral (m)",
        distFondo: "Dist. fondo (m)",
        antejardin: "Antejardín (m)",
      },
      noParams: "No hay parámetros cargados.",
    },
    analysis: {
      summary: {
        parameters: (n: number) => `${n} parámetro${n !== 1 ? "s" : ""} a verificar`,
        pending: (n: number) => `${n} pendiente${n !== 1 ? "s" : ""}`,
        allReviewed: "Todo revisado",
        observations: (n: number) => `${n} observación${n !== 1 ? "es" : ""}`,
        approved: (n: number) => `${n} aprobado${n !== 1 ? "s" : ""}`,
      },
      progress: {
        title: "Analizando expediente con IA",
        subtitle: (n: number) =>
          `Verificando contra OGUC, PRC Las Condes y jurisprudencia DOM. El análisis tarda ~${n}s.`,
        stages: {
          params: "Recuperando parámetros del expediente",
          query: "Consultando normativa PRC y OGUC",
          reason: "Evaluando cumplimiento con agente IA",
          generate: "Generando observaciones y redacción",
          acta: "Preparando borrador de Acta",
        },
      },
      runningTitle: "Analizando expediente con IA...",
      runningSubtitle: "Verificando contra OGUC y PRC Las Condes",
      failed: "El análisis falló.",
      retry: "Reintentar análisis",
      pendingWarning: (n: number) =>
        `Hay ${n} parámetro${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""} de decisión. Revisa todos los ítems antes de aprobar o emitir el Acta.`,
      viewActa: (n: number) => `Ver Acta de Observaciones (${n})`,
      approveBtn: "Aprobar expediente",
      approving: "Aprobando...",
      approved: "Expediente aprobado",
      confirmApprove: "¿Confirmas que el expediente cumple con toda la normativa y debe ser aprobado?",
    },
    documents: {
      title: "Documentos del expediente",
      subtitle: "Documentos ingresados por el arquitecto. Ábrelos directamente en el navegador.",
      empty: "No hay documentos registrados para este expediente.",
      open: "Abrir",
      openError: "No se pudo abrir el documento.",
      labels: {
        cip_vigente: "CIP vigente",
        cuadro_superficies: "Cuadro de superficies",
        planos_arquitectonicos: "Planos arquitectónicos",
        solicitud_firmada: "Solicitud firmada",
        fue: "FUE",
        memoria_calculo: "Memoria de cálculo estructural",
        factibilidad_sanitaria: "Certificado de factibilidad sanitaria",
        informe_ri: "Informe Revisor Independiente",
      },
    },
  },

  obs: {
    unanalyzed: "No analizado",
    unanalyzedDetail: "IA no pudo verificar — revisar manualmente contra normativa vigente",
    aiApproved: "Aprobado por IA",
    reviewerApproved: "Aprobado por revisor",
    observationConfirmed: "Observación confirmada",
    violation: "Infracción",
    needsReview: "Requiere decisión",
    noData: "Sin datos normativos",
    noDataDetail:
      "No se encontró normativa aplicable en la base RAG. Verifique manualmente contra OGUC y PRC Las Condes.",
    declared: "Declarado",
    allowed: "Permitido",
    verifyIn: "Verificar en:",
    cipDoc: "CIP vigente",
    areaDoc: "Cuadro de superficies",
    planosDoc: "Planos",
    reasonLabel: "Motivo:",
    discardTitle: "Motivo del descarte",
    editPlaceholder: "Redactar texto de la observación...",
    reviewerNotes: "Notas del revisor (opcional)",
    accept: "Aceptar observación",
    edit: "Editar",
    discard: "Descartar",
    markCompliant: "Marcar conforme",
    addObservation: "Agregar observación",
    addManual: "Agregar observación manual",
    reopen: "Reabrir como observación",
    editText: "Editar texto",
    discardMarkCompliant: "Descartar → marcar conforme",
    saving: "Guardando...",
    savingDiscard: "Descartando...",
    saveObservation: "Guardar observación",
    confirmDiscard: "Confirmar descarte",
    cancel: "Cancelar",
    viewDetails: "Ver detalles",
    discardReasons: [
      "Error de cálculo del AI",
      "Excepción normativa aplicable",
      "Dato de entrada incorrecto",
      "Parámetro no aplica a este proyecto",
      "Observación duplicada",
    ],
  },

  acta: {
    draftLabel: "Borrador — Acta de Observaciones",
    publishedLabel: (n: string) => `Acta N° ${n} — Publicada`,
    lockedBadge: "Bloqueada",
    draftBadge: "Borrador",
    publishedBadge: "Publicada",
    editedBadge: "Editado",
    noObsTitle: "Sin observaciones confirmadas",
    noObsDetail:
      "Acepta o edita las observaciones del análisis de cumplimiento antes de generar el Acta.",
    noAnalysis: "El análisis normativo aún no se ha ejecutado.",
    publishBtn: (n: number) => `Publicar Acta (${n} observación${n !== 1 ? "es" : ""})`,
    publishing: "Publicando...",
    error: "Error al publicar. Intenta de nuevo.",
    metaApp: "Expediente:",
    metaAddress: "Dirección:",
    metaType: "Tipo de permiso:",
    metaZone: "Zona:",
    metaOwner: "Propietario:",
    metaArchitect: "Arquitecto:",
    metaDate: "Fecha de revisión:",
    metaRound: "Ronda:",
    intro: (n: number) =>
      `Luego de la revisión técnica, se han detectado las siguientes ${n === 1 ? "observación que debe" : `${n} observaciones que deben`} ser subsanadas:`,
    closing:
      "El arquitecto tiene un plazo de 60 días hábiles desde la fecha de esta Acta para presentar las correcciones requeridas, conforme al Artículo 118 de la LGUC y la normativa aplicable.",
    obsBadge: "OBS.",
    docTitle: "ACTA DE OBSERVACIONES",
    docDom: "Municipalidad de Las Condes",
    docDept: "Dirección de Obras Municipales (DOM)",
  },

  archDetail: {
    tabs: {
      overview: "Resumen",
      docs: "Documentos",
      chat: "Asistente",
    },
    steps: {
      sub: {
        pendiente_admision: "En cola de admisión",
        admitido: "Análisis en curso",
        en_revision: "DOM revisando",
        observado: "Correcciones requeridas",
        aprobado: "Permiso otorgado",
      },
    },
    projectData: "Datos del Proyecto",
    cipVsDeclared: "CIP vs. Declarado",
    params: {
      owner: "Propietario",
      architect: "Arquitecto",
      zone: "Zona",
      type: "Tipo",
      round: "Ronda",
      cipNumber: "CIP N°",
      cipDate: "Fecha CIP",
      constructibilidad: "Constructibilidad",
      ocupacion_suelo: "Ocup. suelo",
      altura: "Altura (m)",
      distLateral: "Dist. lateral (m)",
      distFondo: "Dist. fondo (m)",
      antejardin: "Antejardín (m)",
      densidad: "Densidad",
      estacionamientos: "Estacionamientos",
      supEdificada: "Sup. edificada",
      cip: "CIP",
      declared: "Declarado",
      parameter: "Parámetro",
    },
    acta: {
      title: (round: number) => `Acta de Observaciones — Ronda ${round}`,
      detail:
        "La DOM ha detectado las siguientes observaciones. Corrígelas y envía la subsanación abajo.",
    },
    approvedCard: {
      title: "Permiso aprobado",
      detail: "Tu permiso de edificación fue aprobado por la DOM Las Condes.",
    },
    remediation: {
      title: (round: number) => `Subsanación — Ronda ${round}`,
      subtitle: "Ingresa solo los valores que corregiste. Los demás se mantienen sin cambio.",
      notes: "Nota de subsanación",
      notesOptional: "(opcional)",
      notesPlaceholder: "Explica brevemente los cambios realizados en el proyecto...",
      submit: (round: number) => `Enviar subsanación — Ronda ${round}`,
      submitting: "Enviando correcciones...",
      minOneParam: "Modifica al menos un parámetro para poder enviar la subsanación.",
    },
    submitted: {
      title: "Correcciones enviadas",
      detail: "La DOM iniciará la Ronda 2 de revisión. Redirigiendo...",
    },
    inAdmission: {
      title: "En cola de admisión",
      detail: "El oficial de admisibilidad está verificando tu documentación.",
      eta: (days: number) =>
        `Una vez admitido, la DOM tiene ${days} días hábiles para revisar (Ley 21.718).`,
    },
    inReview: {
      title: (round: number) => `En revisión técnica — Ronda ${round}`,
      detail: "Los revisores de la DOM están evaluando tu expediente. Te notificaremos cuando haya resultados.",
      etaLabel: "Plazo legal:",
      urgent: (days: number) => `${days} días restantes`,
    },
    docs: {
      title: "Documentos del expediente",
      subtitle:
        "Documentos subidos al ingresar el expediente. Los pendientes pueden completarse aquí en cualquier momento.",
      loading: "Cargando documentos...",
      open: "Abrir",
      replace: "Reemplazar",
      uploadPdf: "Subir PDF",
    },
    chat: {
      title: "Asistente DOM",
      subtitle: "Normativa OGUC · PRC Las Condes · Ley 21.718",
      online: "En línea",
      clearChat: "Limpiar conversación",
      placeholder: "Escribe tu consulta… (Enter para enviar, Shift+Enter para nueva línea)",
      quickTitle: "Preguntas frecuentes",
      questions: [
        "¿Por qué hay infracciones en mi expediente?",
        "¿Cómo calculo la constructibilidad correctamente?",
        "¿Qué documentos debo incluir en la subsanación?",
        "¿Cuánto tiempo tiene la DOM para revisar mi subsanación?",
      ],
      welcome:
        "Hola. Soy el **Asistente DOM**.\n\nPuedo ayudarte a entender las observaciones de tu expediente, la normativa aplicable (OGUC, PRC Las Condes, Ley 21.718), y cómo preparar la subsanación.\n\n¿En qué puedo ayudarte?",
      error: "Error al conectar con el asistente. Intenta nuevamente.",
    },
    correctionField: {
      current: "actual",
      max: "máx.",
      min: "mín.",
      placeholder: "Corregir ↑",
    },
    openDocError: "No se pudo abrir el documento. Intenta de nuevo.",
    errorResubmit: "Error al enviar correcciones",
    notFound: "Expediente no encontrado.",
    rejected: "Rechazado",
  },

  submit: {
    header: "Nuevo Expediente",
    steps: { info: "Datos del proyecto", documents: "Documentos", review: "Revisar y enviar" },
    done: {
      title: "Expediente ingresado",
      detail: "Tu solicitud está en cola de admisibilidad. La DOM revisará la documentación y te notificará.",
      viewBtn: "Ver mis expedientes",
    },
    info: {
      section: "Datos del Proyecto",
      owner: "Nombre del propietario",
      address: "Dirección del predio",
      addressHint: "— Google validará y detectará la zona PRC",
      addressPlaceholder: "Ej: Av. Apoquindo 4700, Las Condes",
      zoneDetected: (zone: string) => `Zona ${zone} detectada automáticamente`,
      zoneError: "No se detectó zona. Selecciónala manualmente.",
      geoError: "Error al consultar la zona.",
      zoneLabel: "Zona PRC",
      projectType: "Tipo de proyecto",
      projectTypes: {
        obra_nueva_residencial: "Obra nueva residencial",
        ampliacion_residencial: "Ampliación residencial",
      } as Record<string, string>,
      subtypes: {
        unifamiliar: { label: "Unifamiliar", desc: "Casa o villa — 1 unidad" },
        multifamiliar: { label: "Multifamiliar", desc: "Edificio — 2+ unidades" },
      } as Record<string, { label: string; desc: string }>,
      ri: { label: "Tiene Revisor Independiente", desc: "Reduce el plazo de 30 a 15 días hábiles (Ley 21.718)" },
      continueBtn: "Continuar → Subir documentos",
    },
    docs: {
      extractCallout: {
        title: "Extracción automática de datos.",
        body: (cip: string, cuadro: string) => `Al subir el ${cip} y el ${cuadro}, la IA leerá los parámetros normativos y declarados directamente de los documentos.`,
      },
      mandatory: { section: "Documentos obligatorios", subtitle: "Si aún no tienes alguno, márcalo — podrás completarlo antes de que la DOM revise el expediente." },
      optional: { section: "Documentos opcionales" },
      back: "← Atrás",
      analyzing: "Analizando documentos...",
      missing: (n: number) => `Faltan ${n} documento${n !== 1 ? "s" : ""} — súbelos o márcalos`,
      continueBtn: "Revisar y enviar →",
      types: {
        cip_vigente:           { label: "CIP vigente",                          description: "Certificado de Informaciones Previas — extrae parámetros normativos",      tooltip: "El CIP contiene los parámetros del PRC para tu predio. Lo emite la DOM y tiene vigencia de 1 año." },
        cuadro_superficies:    { label: "Cuadro de superficies",                description: "Cuadro de cabida normativa — extrae parámetros declarados del proyecto",   tooltip: "El cuadro de superficies y cabida normativa contiene los valores reales del proyecto." },
        planos_arquitectonicos:{ label: "Planos arquitectónicos",               description: "Emplazamiento, plantas, cortes y elevaciones a escala",                    tooltip: "Juego completo de planos. Si el cuadro de superficies no alcanza, también puede extraerse de los planos." },
        solicitud_firmada:     { label: "Solicitud firmada",                    description: "Por propietario y arquitecto patrocinante",                                 tooltip: "Formulario oficial DOM firmado por ambas partes." },
        fue:                   { label: "FUE",                                  description: "Formulario Único de Estadísticas de Edificación (INE)",                    tooltip: "Requerido por el INE para estadísticas de edificación." },
        memoria_calculo:       { label: "Memoria de cálculo estructural",       description: "Firmada por ingeniero calculista",                                          tooltip: "Memoria estructural firmada por ingeniero civil." },
        factibilidad_sanitaria:{ label: "Certificado de factibilidad sanitaria", description: "Emitido por SMAPA, Aguas Andinas u otra empresa concesionaria",           tooltip: "Certifica que el predio puede conectarse a redes sanitarias." },
        informe_ri:            { label: "Informe Revisor Independiente",        description: "Reduce el plazo legal de revisión a 15 días (Ley 21.718)",                 tooltip: "Solo aplica si el proyecto cuenta con RI acreditado." },
      } as Record<string, { label: string; description: string; tooltip: string }>,
      mandatoryBadge: "Obligatorio",
      optionalBadge: "Opcional",
      extractsBadge: "Extrae datos",
      riRecommended: "Recomendado (tienes RI)",
      notAvailable: "Marcado como no disponible actualmente",
      notAvailableCheck: "No lo tengo actualmente — lo entregaré antes de la revisión",
      change: "Cambiar",
      upload: "Subir PDF",
      analyzingDoc: "Analizando documento con IA...",
      extractLoading: (doc: string) => `Extrayendo datos del ${doc}…`,
      extractDone: (doc: string, fields: string) => `${doc} analizado — ${fields} extraídos`,
      extractFields: {
        cip_vigente: ["Constructibilidad", "Altura", "Densidad", "Antejardín", "Distanciamientos"],
        cuadro_superficies: ["Parámetros declarados", "Superficies", "Unidades"],
      } as Record<string, string[]>,
    },
    review: {
      extractedTitle: "Datos extraídos de los documentos.",
      extractedBody: "Los campos marcados con",
      extractedAi: "IA",
      extractedSuffix: "fueron completados automáticamente. Verifícalos y corrige si es necesario antes de enviar.",
      missingTitle: (n: number) => `${n} documento${n !== 1 ? "s" : ""} pendiente${n !== 1 ? "s" : ""}`,
      missingNote: "El expediente quedará en cola de admisibilidad. La DOM no podrá admitirlo hasta recibirlos — puedes subirlos más tarde desde tu panel.",
      cipTitle: "Parámetros del CIP",
      cipSubtitle: "Valores normativos según el Certificado de Informaciones Previas emitido por la DOM. Estos campos son de solo lectura — provienen del documento oficial.",
      declaredTitle: "Parámetros Declarados del Proyecto",
      declaredSubtitle: "Valores reales del proyecto según planos y cuadro de superficies.",
      unitsLabel: "N° unidades de vivienda",
      unitsNote: "Unidades de vivienda: se establece automáticamente como 1 para proyectos unifamiliares.",
      readOnly: "Solo lectura",
      fillManually: "Completar manualmente",
      back: "← Atrás",
      submitting: "Enviando expediente...",
      submitBtn: "Enviar expediente a la DOM",
      errorMsg: "Error al enviar el expediente. Verifica los datos e intenta nuevamente.",
    },
    fields: {
      cip: {
        number: "N° CIP", date: "Fecha de emisión",
        constructibilidad: "Constructibilidad máx.", ocupacion_suelo: "Ocupación suelo máx.",
        altura: "Altura máx.", densidad: "Densidad máx.", estacionamientos: "Estacionamientos mín.",
        distLateral: "Dist. lateral mín.", distFondo: "Dist. fondo mín.", antejardin: "Antejardín mín.",
      },
      declared: {
        constructibilidad: "Constructibilidad", ocupacion_suelo: "Ocupación suelo",
        altura: "Altura", densidad: "Densidad", estacionamientos: "Estacionamientos",
        distLateral: "Dist. lateral", distFondo: "Dist. fondo", antejardin: "Antejardín",
        superficiePredio: "Superficie predio", superficieEdificada: "Superficie edificada", numUnidades: "N° unidades de vivienda",
      },
    },
  },
};

// ─── Context ──────────────────────────────────────────────────────────────────

type Lang = "es" | "en";
type T = typeof en;

interface I18nCtx {
  t: T;
  lang: Lang;
  setLang: (l: Lang) => void;
}

const I18nContext = createContext<I18nCtx>({
  t: es,
  lang: "es",
  setLang: () => {},
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("es");

  useEffect(() => {
    const saved = localStorage.getItem("dom_lang") as Lang | null;
    if (saved === "en" || saved === "es") setLangState(saved);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("dom_lang", l);
  };

  const t = lang === "en" ? en : es;
  return <I18nContext.Provider value={{ t, lang, setLang }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext);
}
