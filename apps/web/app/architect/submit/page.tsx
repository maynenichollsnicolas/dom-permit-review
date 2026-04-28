"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useUser } from "@/lib/useUser";
import { useT } from "@/lib/i18n";
import { LangToggle } from "@/components/lang-toggle";
import { api, API_URL, ExtractedParams } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft, CheckCircle, Loader2, AlertCircle, Info,
  MapPin, Sparkles, FileText, Upload, Lock,
} from "lucide-react";
import Link from "next/link";

// ─── Structural doc definitions (no display strings) ─────────────────────────

const DOCUMENT_TYPES: {
  key: string;
  mandatory: boolean;
  extractsParams: boolean;
  extractType: "cip" | "declared" | null;
}[] = [
  { key: "cip_vigente",           mandatory: true,  extractsParams: true,  extractType: "cip"      },
  { key: "cuadro_superficies",    mandatory: true,  extractsParams: true,  extractType: "declared" },
  { key: "planos_arquitectonicos",mandatory: true,  extractsParams: false, extractType: null       },
  { key: "solicitud_firmada",     mandatory: true,  extractsParams: false, extractType: null       },
  { key: "fue",                   mandatory: true,  extractsParams: false, extractType: null       },
  { key: "memoria_calculo",       mandatory: true,  extractsParams: false, extractType: null       },
  { key: "factibilidad_sanitaria",mandatory: true,  extractsParams: false, extractType: null       },
  { key: "informe_ri",            mandatory: false, extractsParams: false, extractType: null       },
];

// ─── CIP / Declared field key+unit (labels come from t) ──────────────────────

const CIP_FIELD_KEYS = [
  { key: "cip_constructibilidad_max", tKey: "constructibilidad", unit: "índice" },
  { key: "cip_ocupacion_suelo_max",   tKey: "ocupacion_suelo",   unit: "índice" },
  { key: "cip_altura_maxima_m",       tKey: "altura",            unit: "m"      },
  { key: "cip_densidad_max_hab_ha",   tKey: "densidad",          unit: "hab/há" },
  { key: "cip_estacionamientos_min",  tKey: "estacionamientos",  unit: "ratio"  },
  { key: "cip_distanciamiento_lateral_m", tKey: "distLateral",   unit: "m"      },
  { key: "cip_distanciamiento_fondo_m",   tKey: "distFondo",     unit: "m"      },
  { key: "cip_antejardin_m",          tKey: "antejardin",        unit: "m"      },
] as const;

const DECLARED_FIELD_KEYS = [
  { key: "declared_constructibilidad",          tKey: "constructibilidad",  unit: "índice" },
  { key: "declared_ocupacion_suelo",            tKey: "ocupacion_suelo",    unit: "índice" },
  { key: "declared_altura_m",                   tKey: "altura",             unit: "m"      },
  { key: "declared_densidad_hab_ha",            tKey: "densidad",           unit: "hab/há" },
  { key: "declared_estacionamientos",           tKey: "estacionamientos",   unit: "ratio"  },
  { key: "declared_distanciamiento_lateral_m",  tKey: "distLateral",        unit: "m"      },
  { key: "declared_distanciamiento_fondo_m",    tKey: "distFondo",          unit: "m"      },
  { key: "declared_antejardin_m",               tKey: "antejardin",         unit: "m"      },
  { key: "declared_superficie_predio_m2",       tKey: "superficiePredio",   unit: "m²"     },
  { key: "declared_superficie_total_edificada_m2", tKey: "superficieEdificada", unit: "m²" },
] as const;

const ZONES = [
  "E-Aa1","E-Aa3-A","E-Aa4",
  "E-Ab1-A","E-Ab2-A","E-Ab3","E-Ab4",
  "E-Am1","E-Am1-A","E-Am2","E-Am4","E-Am4-A",
  "E-e1","E-e2","E-e3","E-e5",
];

type SubmitStep = "info" | "documents" | "review" | "done";

type ParamsState = {
  cip_number: string; cip_date: string;
  cip_constructibilidad_max: string; cip_ocupacion_suelo_max: string;
  cip_altura_maxima_m: string; cip_densidad_max_hab_ha: string;
  cip_estacionamientos_min: string; cip_distanciamiento_lateral_m: string;
  cip_distanciamiento_fondo_m: string; cip_antejardin_m: string;
  declared_constructibilidad: string; declared_ocupacion_suelo: string;
  declared_altura_m: string; declared_densidad_hab_ha: string;
  declared_estacionamientos: string; declared_distanciamiento_lateral_m: string;
  declared_distanciamiento_fondo_m: string; declared_antejardin_m: string;
  declared_superficie_predio_m2: string; declared_superficie_total_edificada_m2: string;
  declared_num_unidades_vivienda: string;
};

const EMPTY_PARAMS: ParamsState = {
  cip_number: "", cip_date: "",
  cip_constructibilidad_max: "", cip_ocupacion_suelo_max: "",
  cip_altura_maxima_m: "", cip_densidad_max_hab_ha: "",
  cip_estacionamientos_min: "", cip_distanciamiento_lateral_m: "",
  cip_distanciamiento_fondo_m: "", cip_antejardin_m: "",
  declared_constructibilidad: "", declared_ocupacion_suelo: "",
  declared_altura_m: "", declared_densidad_hab_ha: "",
  declared_estacionamientos: "", declared_distanciamiento_lateral_m: "",
  declared_distanciamiento_fondo_m: "", declared_antejardin_m: "",
  declared_superficie_predio_m2: "", declared_superficie_total_edificada_m2: "",
  declared_num_unidades_vivienda: "",
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function SubmitApplicationPage() {
  const { user } = useUser();
  const { t } = useT();
  const su = t.submit;
  const router = useRouter();
  const [step, setStep] = useState<SubmitStep>("info");
  const [submitting, setSubmitting] = useState(false);

  const [info, setInfo] = useState({
    owner_name: "", address: "", zone: "E-Aa1",
    project_type: "obra_nueva_residencial",
    residential_subtype: "unifamiliar" as "unifamiliar" | "multifamiliar",
    has_revisor_independiente: false,
  });

  const [files, setFiles] = useState<Record<string, File>>({});
  const [notAvailable, setNotAvailable] = useState<Record<string, boolean>>({});
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});
  const [extractErr, setExtractErr] = useState<Record<string, string>>({});
  const [aiFields, setAiFields] = useState<Set<string>>(new Set());
  const [params, setParams] = useState<ParamsState>(EMPTY_PARAMS);

  const [mapsReady, setMapsReady] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [detectedZone, setDetectedZone] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  // Stable ref for translated error strings — avoids recreating the autocomplete on language change
  const geoErrRef = useRef({ zoneError: su.info.zoneError, geoError: su.info.geoError });
  useEffect(() => {
    geoErrRef.current = { zoneError: su.info.zoneError, geoError: su.info.geoError };
  }, [su.info.zoneError, su.info.geoError]);

  const isMultifamiliar =
    info.project_type === "obra_nueva_residencial" && info.residential_subtype === "multifamiliar";

  const fi = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setInfo((prev) => ({ ...prev, [key]: e.target.value }));
  const fp = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setParams((prev) => ({ ...prev, [key]: e.target.value }));

  // ── Google Maps autocomplete ───────────────────────────────────────────────

  const initAutocomplete = useCallback(() => {
    if (!addressInputRef.current || !window.google?.maps?.places?.Autocomplete) return;
    // Guard: don't create a second instance (e.g. on language change)
    if (autocompleteRef.current) return;

    const ac = new window.google.maps.places.Autocomplete(addressInputRef.current, {
      componentRestrictions: { country: "cl" },
      bounds: new window.google.maps.LatLngBounds(
        { lat: -33.50, lng: -70.70 },
        { lat: -33.30, lng: -70.45 },
      ),
      strictBounds: false,
      fields: ["formatted_address", "geometry"],
    });

    ac.addListener("place_changed", async () => {
      const place = ac.getPlace();
      if (!place.geometry?.location || !place.formatted_address) return;

      const lat = place.geometry.location.lat();
      const lng = place.geometry.location.lng();

      setInfo((prev) => ({ ...prev, address: place.formatted_address! }));
      setGeoError(null);
      setGeoLoading(true);
      setDetectedZone(null);

      try {
        const zoneResult = await api.geo.zoneFromCoords(lat, lng);
        if (zoneResult.zone) {
          setDetectedZone(zoneResult.zone);
          setInfo((prev) => ({ ...prev, zone: zoneResult.zone! }));

          const paramsResult = await api.geo.zoneParams(zoneResult.zone);
          const p = paramsResult.params;
          setParams((prev) => ({
            ...prev,
            cip_constructibilidad_max: String(p.constructibilidad),
            cip_ocupacion_suelo_max: String(p.ocupacion_suelo),
            cip_altura_maxima_m: String(p.altura_m),
            cip_densidad_max_hab_ha: String(p.densidad),
            cip_estacionamientos_min: String(p.estacionamientos),
            cip_distanciamiento_lateral_m: p.distanciamiento_lateral_m > 0 ? String(p.distanciamiento_lateral_m) : "",
            cip_distanciamiento_fondo_m: p.distanciamiento_fondo_m > 0 ? String(p.distanciamiento_fondo_m) : "",
            cip_antejardin_m: String(p.antejardin_m),
          }));
          setAiFields((prev) => new Set([
            ...prev,
            "cip_constructibilidad_max", "cip_ocupacion_suelo_max",
            "cip_altura_maxima_m", "cip_densidad_max_hab_ha", "cip_estacionamientos_min",
            ...(p.distanciamiento_lateral_m > 0 ? ["cip_distanciamiento_lateral_m"] : []),
            ...(p.distanciamiento_fondo_m > 0 ? ["cip_distanciamiento_fondo_m"] : []),
            "cip_antejardin_m",
          ]));
        } else {
          setGeoError(zoneResult.error ?? geoErrRef.current.zoneError);
        }
      } catch {
        setGeoError(geoErrRef.current.geoError);
      } finally {
        setGeoLoading(false);
      }
    });

    autocompleteRef.current = ac;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mapsReady) initAutocomplete();
  }, [mapsReady, initAutocomplete]);

  // ── Document upload + extraction ──────────────────────────────────────────

  const toggleNotAvailable = (docKey: string, checked: boolean) => {
    setNotAvailable((prev) => ({ ...prev, [docKey]: checked }));
    if (checked) setFiles((prev) => { const next = { ...prev }; delete next[docKey]; return next; });
  };

  const handleFileSelect = async (docKey: string, file: File) => {
    setFiles((prev) => ({ ...prev, [docKey]: file }));
    setNotAvailable((prev) => ({ ...prev, [docKey]: false }));

    const doc = DOCUMENT_TYPES.find((d) => d.key === docKey);
    if (!doc?.extractsParams) return;

    setExtracting((prev) => ({ ...prev, [docKey]: true }));
    setExtractErr((prev) => ({ ...prev, [docKey]: "" }));

    try {
      const result: ExtractedParams = await api.intake.extractFromDoc(docKey, file);
      const newAiFields = new Set(aiFields);

      const applyNum = (k: string, v: number | null | undefined) => {
        if (v != null) {
          setParams((prev) => ({ ...prev, [k]: String(v) }));
          newAiFields.add(k);
        }
      };
      const applyStr = (k: string, v: string | null | undefined) => {
        if (v) {
          setParams((prev) => ({ ...prev, [k]: v }));
          newAiFields.add(k);
        }
      };

      if (doc.extractType === "cip") {
        applyStr("cip_number", result.cip_number);
        applyStr("cip_date", result.cip_date);
        if (result.zone) {
          setInfo((prev) => ({ ...prev, zone: result.zone! }));
          setDetectedZone(result.zone!);
        }
        applyNum("cip_constructibilidad_max", result.cip_constructibilidad_max);
        applyNum("cip_ocupacion_suelo_max", result.cip_ocupacion_suelo_max);
        applyNum("cip_altura_maxima_m", result.cip_altura_maxima_m);
        applyNum("cip_densidad_max_hab_ha", result.cip_densidad_max_hab_ha);
        applyNum("cip_estacionamientos_min", result.cip_estacionamientos_min);
        applyNum("cip_distanciamiento_lateral_m", result.cip_distanciamiento_lateral_m);
        applyNum("cip_distanciamiento_fondo_m", result.cip_distanciamiento_fondo_m);
        applyNum("cip_antejardin_m", result.cip_antejardin_m);
      } else {
        applyNum("declared_constructibilidad", result.declared_constructibilidad);
        applyNum("declared_ocupacion_suelo", result.declared_ocupacion_suelo);
        applyNum("declared_altura_m", result.declared_altura_m);
        applyNum("declared_densidad_hab_ha", result.declared_densidad_hab_ha);
        applyNum("declared_estacionamientos", result.declared_estacionamientos);
        applyNum("declared_distanciamiento_lateral_m", result.declared_distanciamiento_lateral_m);
        applyNum("declared_distanciamiento_fondo_m", result.declared_distanciamiento_fondo_m);
        applyNum("declared_antejardin_m", result.declared_antejardin_m);
        applyNum("declared_superficie_predio_m2", result.declared_superficie_predio_m2);
        applyNum("declared_superficie_total_edificada_m2", result.declared_superficie_total_edificada_m2);
        applyNum("declared_num_unidades_vivienda", result.declared_num_unidades_vivienda);
      }

      setAiFields(newAiFields);
    } catch (e: any) {
      setExtractErr((prev) => ({ ...prev, [docKey]: e.message || "Error" }));
    } finally {
      setExtracting((prev) => ({ ...prev, [docKey]: false }));
    }
  };

  // ── Final submission ───────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const pf = (k: keyof ParamsState) => parseFloat(params[k]) || 0;
      const pi = (k: keyof ParamsState) => parseInt(params[k]) || 1;

      const res = await fetch(`${API_URL}/api/v1/intake/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          architect_email: user?.email,
          architect_name: user?.user_metadata?.full_name ?? user?.email,
          owner_name: info.owner_name,
          address: info.address,
          zone: info.zone,
          project_type: info.project_type,
          has_revisor_independiente: info.has_revisor_independiente,
          cip_number: params.cip_number || "—",
          cip_date: params.cip_date || new Date().toISOString().slice(0, 10),
          cip_constructibilidad_max: pf("cip_constructibilidad_max"),
          cip_ocupacion_suelo_max: pf("cip_ocupacion_suelo_max"),
          cip_altura_maxima_m: pf("cip_altura_maxima_m"),
          cip_densidad_max_hab_ha: pf("cip_densidad_max_hab_ha"),
          cip_estacionamientos_min: pf("cip_estacionamientos_min"),
          cip_distanciamiento_lateral_m: pf("cip_distanciamiento_lateral_m"),
          cip_distanciamiento_fondo_m: pf("cip_distanciamiento_fondo_m"),
          cip_antejardin_m: pf("cip_antejardin_m"),
          declared_constructibilidad: pf("declared_constructibilidad"),
          declared_ocupacion_suelo: pf("declared_ocupacion_suelo"),
          declared_altura_m: pf("declared_altura_m"),
          declared_densidad_hab_ha: pf("declared_densidad_hab_ha"),
          declared_estacionamientos: pf("declared_estacionamientos"),
          declared_distanciamiento_lateral_m: pf("declared_distanciamiento_lateral_m"),
          declared_distanciamiento_fondo_m: pf("declared_distanciamiento_fondo_m"),
          declared_antejardin_m: pf("declared_antejardin_m"),
          declared_superficie_predio_m2: pf("declared_superficie_predio_m2"),
          declared_superficie_total_edificada_m2: pf("declared_superficie_total_edificada_m2"),
          declared_num_unidades_vivienda: isMultifamiliar ? pi("declared_num_unidades_vivienda") : 1,
        }),
      });

      const data = await res.json();
      const expedientId = data.expedient_id;

      await Promise.all(
        Object.entries(files).map(async ([docType, file]) => {
          const fd = new FormData();
          fd.append("document_type", docType);
          fd.append("file", file);
          await fetch(`${API_URL}/api/v1/intake/${expedientId}/documents`, {
            method: "POST", body: fd,
          });
        })
      );

      setStep("done");
    } catch {
      alert(su.review.errorMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const mandatoryKeys = DOCUMENT_TYPES.filter((d) => d.mandatory).map((d) => d.key);
  const mandatoryResolved = mandatoryKeys.filter((k) => !!files[k] || !!notAvailable[k]);
  const missingDocs = DOCUMENT_TYPES.filter((d) => d.mandatory && !files[d.key] && !!notAvailable[d.key]);
  const cipUploaded = !!files["cip_vigente"];
  const cuadroUploaded = !!files["cuadro_superficies"];
  const anyExtracting = Object.values(extracting).some(Boolean);
  const mapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const STEPS: { id: SubmitStep; label: string }[] = [
    { id: "info",      label: su.steps.info      },
    { id: "documents", label: su.steps.documents  },
    { id: "review",    label: su.steps.review     },
  ];
  const currentIdx = STEPS.findIndex((s) => s.id === step);

  // ── Step: done ─────────────────────────────────────────────────────────────
  if (step === "done") {
    return (
      <div className="min-h-screen bg-grid flex items-center justify-center">
        <div className="text-center bg-card border border-border rounded-2xl p-12 shadow-sm max-w-md">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2 tracking-tight">{su.done.title}</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">{su.done.detail}</p>
          <Button onClick={() => router.push("/architect")} className="w-full">
            {su.done.viewBtn}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {mapsApiKey && (
        <Script
          src={`https://maps.googleapis.com/maps/api/js?key=${mapsApiKey}&libraries=places`}
          onLoad={() => setMapsReady(true)}
          strategy="afterInteractive"
        />
      )}

      <div className="min-h-screen bg-grid flex flex-col">
        {/* Header */}
        <header className="bg-arch-header text-white px-6 sticky top-0 z-20 shadow-lg shadow-[oklch(0.22_0.09_170/0.25)]">
          <div className="max-w-3xl mx-auto flex items-center gap-4 h-14">
            <Link href="/architect" className="text-white/50 hover:text-white/90 transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <h1 className="text-sm font-semibold">{su.header}</h1>
            <div className="ml-auto flex items-center gap-4">
              <LangToggle />
              <div className="flex items-center gap-2">
                {STEPS.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-2">
                    {i > 0 && <div className="h-px w-5 bg-white/20" />}
                    <div className="flex items-center gap-1.5">
                      <div className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-colors ${
                        i < currentIdx ? "bg-white/30 text-white" :
                        i === currentIdx ? "bg-white text-primary" :
                        "border border-white/30 text-white/40"
                      }`}>
                        {i < currentIdx ? "✓" : i + 1}
                      </div>
                      <span className={`text-xs hidden sm:block ${i === currentIdx ? "text-white font-medium" : "text-white/40"}`}>
                        {s.label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto w-full px-6 py-8 space-y-5">

          {/* ── Step: info ── */}
          {step === "info" && (
            <>
              <FormSection title={su.info.section}>
                <Field label={su.info.owner} value={info.owner_name}
                  onChange={(e) => setInfo((p) => ({ ...p, owner_name: e.target.value }))} />

                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" />
                    {su.info.address}
                    {mapsApiKey && <span className="text-muted-foreground/60">{su.info.addressHint}</span>}
                  </label>
                  <div className="relative">
                    <input
                      ref={addressInputRef}
                      type="text"
                      defaultValue={info.address}
                      onBlur={(e) => setInfo((p) => ({ ...p, address: e.target.value }))}
                      placeholder={su.info.addressPlaceholder}
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-shadow pr-10"
                    />
                    {geoLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                    {!geoLoading && detectedZone && <CheckCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />}
                  </div>
                  {detectedZone && !geoLoading && (
                    <p className="mt-1.5 flex items-center gap-1.5 text-xs text-emerald-700">
                      <Sparkles className="h-3 w-3" />
                      {su.info.zoneDetected(detectedZone)}
                    </p>
                  )}
                  {geoError && <p className="mt-1.5 text-xs text-amber-600 flex items-center gap-1.5"><AlertCircle className="h-3 w-3" />{geoError}</p>}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <SelectField label={su.info.zoneLabel} value={info.zone} onChange={fi("zone")}>
                    {ZONES.map((z) => <option key={z} value={z}>{z}</option>)}
                  </SelectField>
                  <SelectField label={su.info.projectType} value={info.project_type} onChange={fi("project_type")}>
                    {Object.entries(su.info.projectTypes).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </SelectField>
                </div>

                {info.project_type === "obra_nueva_residencial" && (
                  <div className="flex gap-3">
                    {(["unifamiliar", "multifamiliar"] as const).map((subtype) => {
                      const st = su.info.subtypes[subtype];
                      return (
                        <label key={subtype} className={`flex-1 flex items-center gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors ${
                          info.residential_subtype === subtype ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"
                        }`}>
                          <input type="radio" name="residential_subtype" value={subtype}
                            checked={info.residential_subtype === subtype}
                            onChange={() => setInfo((p) => ({ ...p, residential_subtype: subtype }))}
                            className="sr-only" />
                          <div className={`h-3.5 w-3.5 rounded-full border-2 flex-shrink-0 ${
                            info.residential_subtype === subtype ? "border-primary bg-primary" : "border-muted-foreground/30"
                          }`} />
                          <div>
                            <p className="text-sm font-medium">{st.label}</p>
                            <p className="text-xs text-muted-foreground">{st.desc}</p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  info.has_revisor_independiente ? "border-primary bg-primary/5" : "border-border"
                }`}>
                  <input type="checkbox" checked={info.has_revisor_independiente}
                    onChange={(e) => setInfo((p) => ({ ...p, has_revisor_independiente: e.target.checked }))}
                    className="h-4 w-4 rounded border-border accent-primary" />
                  <div>
                    <p className="text-sm font-medium">{su.info.ri.label}</p>
                    <p className="text-xs text-muted-foreground">{su.info.ri.desc}</p>
                  </div>
                </label>
              </FormSection>

              <Button
                onClick={() => setStep("documents")}
                disabled={!info.owner_name || !info.address}
                className="w-full h-11"
              >
                {su.info.continueBtn}
              </Button>
            </>
          )}

          {/* ── Step: documents ── */}
          {step === "documents" && (
            <>
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-start gap-3">
                <Sparkles className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                <div className="text-sm leading-relaxed">
                  <span className="font-semibold text-primary">{su.docs.extractCallout.title}</span>
                  {" "}{su.docs.extractCallout.body(
                    su.docs.types["cip_vigente"]?.label ?? "CIP",
                    su.docs.types["cuadro_superficies"]?.label ?? "Cuadro de superficies"
                  )}
                </div>
              </div>

              <FormSection title={su.docs.mandatory.section} subtitle={su.docs.mandatory.subtitle}>
                <div className="space-y-2">
                  {DOCUMENT_TYPES.filter((d) => d.mandatory).map((doc) => (
                    <DocUploadRow
                      key={doc.key}
                      doc={doc}
                      file={files[doc.key]}
                      isExtracting={!!extracting[doc.key]}
                      extractErr={extractErr[doc.key]}
                      isRi={info.has_revisor_independiente}
                      notAvailable={!!notAvailable[doc.key]}
                      onSelect={(f) => handleFileSelect(doc.key, f)}
                      onToggleNotAvailable={(v) => toggleNotAvailable(doc.key, v)}
                    />
                  ))}
                </div>
              </FormSection>

              <FormSection title={su.docs.optional.section}>
                <div className="space-y-2">
                  {DOCUMENT_TYPES.filter((d) => !d.mandatory).map((doc) => (
                    <DocUploadRow
                      key={doc.key}
                      doc={doc}
                      file={files[doc.key]}
                      isExtracting={!!extracting[doc.key]}
                      extractErr={extractErr[doc.key]}
                      isRi={info.has_revisor_independiente}
                      notAvailable={false}
                      onSelect={(f) => handleFileSelect(doc.key, f)}
                      onToggleNotAvailable={() => {}}
                    />
                  ))}
                </div>
              </FormSection>

              {(cipUploaded || cuadroUploaded) && (
                <div className="space-y-2">
                  {cipUploaded && (
                    <ExtractionBadge docKey="cip_vigente" loading={!!extracting["cip_vigente"]} error={extractErr["cip_vigente"]} />
                  )}
                  {cuadroUploaded && (
                    <ExtractionBadge docKey="cuadro_superficies" loading={!!extracting["cuadro_superficies"]} error={extractErr["cuadro_superficies"]} />
                  )}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("info")} className="h-11 px-6">
                  {su.docs.back}
                </Button>
                <Button
                  onClick={() => setStep("review")}
                  disabled={anyExtracting || mandatoryResolved.length < mandatoryKeys.length}
                  className="flex-1 h-11"
                >
                  {anyExtracting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{su.docs.analyzing}</>
                    : mandatoryResolved.length < mandatoryKeys.length
                    ? su.docs.missing(mandatoryKeys.length - mandatoryResolved.length)
                    : su.docs.continueBtn
                  }
                </Button>
              </div>
            </>
          )}

          {/* ── Step: review ── */}
          {step === "review" && (
            <>
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-emerald-800 leading-relaxed">
                  <span className="font-semibold">{su.review.extractedTitle}</span>
                  {" "}{su.review.extractedBody}{" "}
                  <span className="inline-flex items-center gap-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-semibold px-1.5 py-0.5 rounded">
                    {su.review.extractedAi}
                  </span>
                  {" "}{su.review.extractedSuffix}
                </div>
              </div>

              {missingDocs.length > 0 && (
                <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">{su.review.missingTitle(missingDocs.length)}</p>
                    <ul className="mt-1.5 space-y-0.5">
                      {missingDocs.map((d) => (
                        <li key={d.key} className="text-xs text-amber-700 flex items-center gap-1.5">
                          <span className="h-1 w-1 rounded-full bg-amber-500 flex-shrink-0" />
                          {su.docs.types[d.key]?.label ?? d.key}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-amber-700 mt-2 leading-relaxed">{su.review.missingNote}</p>
                  </div>
                </div>
              )}

              <FormSection title={su.review.cipTitle} subtitle={su.review.cipSubtitle}>
                <div className="grid grid-cols-2 gap-4">
                  <ParamField label={su.fields.cip.number}  paramKey="cip_number" params={params} aiFields={aiFields} onChange={fp("cip_number")} readOnly />
                  <ParamField label={su.fields.cip.date}    paramKey="cip_date"   params={params} aiFields={aiFields} onChange={fp("cip_date")} type="date" readOnly />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {CIP_FIELD_KEYS.map((fd) => (
                    <ParamField
                      key={fd.key} label={(su.fields.cip as any)[fd.tKey]} unit={fd.unit}
                      paramKey={fd.key} params={params} aiFields={aiFields}
                      onChange={fp(fd.key)} type="number" readOnly
                    />
                  ))}
                </div>
              </FormSection>

              <FormSection title={su.review.declaredTitle} subtitle={su.review.declaredSubtitle}>
                <div className="grid grid-cols-2 gap-4">
                  {DECLARED_FIELD_KEYS.map((fd) => (
                    <ParamField
                      key={fd.key} label={(su.fields.declared as any)[fd.tKey]} unit={fd.unit}
                      paramKey={fd.key} params={params} aiFields={aiFields}
                      onChange={fp(fd.key)} type="number"
                    />
                  ))}
                  {isMultifamiliar && (
                    <ParamField
                      label={su.fields.declared.numUnidades} unit="unidades"
                      paramKey="declared_num_unidades_vivienda"
                      params={params} aiFields={aiFields}
                      onChange={fp("declared_num_unidades_vivienda")} type="number"
                    />
                  )}
                </div>
                {!isMultifamiliar && (
                  <p className="text-xs text-muted-foreground bg-secondary/60 border border-border rounded-lg px-3 py-2">
                    {su.review.unitsNote}
                  </p>
                )}
              </FormSection>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("documents")} className="h-11 px-6">
                  {su.review.back}
                </Button>
                <Button onClick={handleSubmit} disabled={submitting} className="flex-1 h-11">
                  {submitting
                    ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />{su.review.submitting}</>
                    : su.review.submitBtn
                  }
                </Button>
              </div>
            </>
          )}
        </main>
      </div>
    </>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function FormSection({ title, subtitle, children }: {
  title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        {subtitle && <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{subtitle}</p>}
      </CardHeader>
      <CardContent className="pt-4 space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, value, onChange, type = "text", tooltip }: {
  label: string; value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; tooltip?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </label>
      <input type={type} value={value} onChange={onChange}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring transition-shadow" />
    </div>
  );
}

function SelectField({ label, value, onChange, children }: {
  label: string; value: string; onChange: (e: any) => void; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">{label}</label>
      <select value={value} onChange={onChange}
        className="w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring">
        {children}
      </select>
    </div>
  );
}

function ParamField({ label, unit, paramKey, params, aiFields, onChange, type = "text", readOnly = false }: {
  label: string; unit?: string; paramKey: string;
  params: ParamsState; aiFields: Set<string>;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; readOnly?: boolean;
}) {
  const { t } = useT();
  const val = (params as any)[paramKey];
  const isAi = aiFields.has(paramKey);
  const isEmpty = !val;

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center justify-between">
        <span>{label}</span>
        <span className="flex items-center gap-1">
          {readOnly && (
            <span className="text-[10px] font-medium text-muted-foreground/60 flex items-center gap-0.5">
              <Lock className="h-2.5 w-2.5" />{t.submit.review.readOnly}
            </span>
          )}
          {isAi && (
            <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
              <Sparkles className="h-2.5 w-2.5" />{t.submit.review.extractedAi}
            </span>
          )}
        </span>
      </label>
      <div className="relative">
        <input
          type={type}
          value={val}
          onChange={readOnly ? () => {} : onChange}
          readOnly={readOnly}
          step={type === "number" ? "0.01" : undefined}
          placeholder={!readOnly && isEmpty ? t.submit.review.fillManually : undefined}
          className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none transition-shadow ${
            unit ? "pr-16" : ""
          } ${
            readOnly
              ? "bg-muted/40 border-border text-foreground/70 cursor-default select-none"
              : isAi && !isEmpty
              ? "bg-card border-emerald-300 bg-emerald-50/40 focus:ring-2 focus:ring-emerald-400/30"
              : isEmpty
              ? "bg-card border-amber-300 bg-amber-50/30 focus:ring-2 focus:ring-amber-400/30"
              : "bg-card border-border focus:ring-2 focus:ring-ring"
          }`}
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-mono pointer-events-none">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
}

function DocUploadRow({ doc, file, isExtracting, extractErr, isRi, notAvailable, onSelect, onToggleNotAvailable }: {
  doc: (typeof DOCUMENT_TYPES)[0];
  file?: File;
  isExtracting: boolean;
  extractErr?: string;
  isRi: boolean;
  notAvailable: boolean;
  onSelect: (f: File) => void;
  onToggleNotAvailable: (v: boolean) => void;
}) {
  const { t } = useT();
  const su = t.submit;
  const docT = su.docs.types[doc.key];
  const uploaded = !!file;

  return (
    <div className={`rounded-lg border transition-colors ${
      uploaded     ? "border-emerald-200 bg-emerald-50/40" :
      notAvailable ? "border-amber-200 bg-amber-50/40" :
      isExtracting ? "border-primary/30 bg-primary/5" :
      "border-border bg-card"
    }`}>
      <div className="flex items-start justify-between p-3.5">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="mt-0.5 flex-shrink-0">
            {isExtracting
              ? <Loader2 className="h-4 w-4 animate-spin text-primary" />
              : uploaded
              ? <CheckCircle className="h-4 w-4 text-emerald-600" />
              : notAvailable
              ? <AlertCircle className="h-4 w-4 text-amber-500" />
              : <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
            }
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-medium">{docT?.label ?? doc.key}</p>
              {doc.mandatory
                ? <span className={`text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border ${
                    notAvailable
                      ? "text-amber-700 bg-amber-50 border-amber-200"
                      : "text-red-600 bg-red-50 border-red-100"
                  }`}>{su.docs.mandatoryBadge}</span>
                : <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground bg-secondary border border-border px-1.5 py-0.5 rounded">
                    {su.docs.optionalBadge}
                  </span>
              }
              {doc.extractsParams && (
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Sparkles className="h-2.5 w-2.5" />{su.docs.extractsBadge}
                </span>
              )}
              {isRi && doc.key === "informe_ri" && !uploaded && (
                <span className="text-[10px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded">
                  {su.docs.riRecommended}
                </span>
              )}
            </div>
            {uploaded
              ? <p className="text-xs text-emerald-700 mt-0.5 font-mono truncate">{file.name}</p>
              : notAvailable
              ? <p className="text-xs text-amber-700 mt-0.5">{su.docs.notAvailable}</p>
              : <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{docT?.description}</p>
            }
            {extractErr && (
              <p className="text-xs text-red-600 mt-0.5 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />{extractErr}
              </p>
            )}
            {isExtracting && (
              <p className="text-xs text-primary mt-0.5">{su.docs.analyzingDoc}</p>
            )}
          </div>
        </div>
        <label className={`cursor-pointer flex-shrink-0 ml-3 ${isExtracting ? "pointer-events-none opacity-50" : ""}`}>
          <span className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors inline-flex items-center gap-1.5 ${
            uploaded
              ? "bg-secondary text-muted-foreground hover:bg-secondary"
              : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}>
            {uploaded
              ? <><FileText className="h-3 w-3" />{su.docs.change}</>
              : <><Upload className="h-3 w-3" />{su.docs.upload}</>
            }
          </span>
          <input type="file" accept=".pdf" className="hidden"
            onChange={(e) => { if (e.target.files?.[0]) onSelect(e.target.files[0]); }} />
        </label>
      </div>

      {doc.mandatory && !uploaded && !isExtracting && (
        <label className="flex items-center gap-2.5 px-3.5 pb-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={notAvailable}
            onChange={(e) => onToggleNotAvailable(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border accent-amber-500 flex-shrink-0"
          />
          <span className={`text-xs transition-colors ${
            notAvailable ? "text-amber-700 font-medium" : "text-muted-foreground group-hover:text-foreground"
          }`}>
            {su.docs.notAvailableCheck}
          </span>
        </label>
      )}
    </div>
  );
}

function ExtractionBadge({ docKey, loading, error }: {
  docKey: string; loading: boolean; error?: string;
}) {
  const { t } = useT();
  const su = t.submit;
  const label = su.docs.types[docKey]?.label ?? docKey;
  const fields = (su.docs.extractFields[docKey] ?? []).join(", ");

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 px-3 py-2 bg-primary/5 border border-primary/20 rounded-lg text-xs text-primary">
        <Loader2 className="h-3.5 w-3.5 animate-spin flex-shrink-0" />
        <span>{su.docs.extractLoading(label)}</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-700">
        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
        <span><strong>{label}</strong>: {error}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
      <CheckCircle className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{su.docs.extractDone(label, fields)}</span>
    </div>
  );
}

function InfoTooltip({ content }: { content: string }) {
  return (
    <span className="group relative inline-flex ml-1 cursor-help align-middle">
      <Info className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 bg-foreground text-background text-xs rounded-lg px-3 py-2 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all z-50 leading-relaxed shadow-xl">
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
      </span>
    </span>
  );
}
