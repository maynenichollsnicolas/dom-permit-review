"""
Intake routes — Phase 4 (Admisibilidad) and architect submission.

POST /intake/submit          — architect submits a new permit application
POST /intake/{id}/documents  — upload a document to Supabase Storage
POST /intake/{id}/analyze    — run Document Intake Agent (Claude Vision)
GET  /intake/queue           — Admisibilidad officer sees pending submissions
POST /intake/{id}/admit      — officer stamps admitted → triggers compliance queue
POST /intake/{id}/resubmit   — architect submits corrections (triggers Round 2)
"""
from __future__ import annotations

import uuid
import base64
from datetime import datetime, timezone
from typing import Optional

import anthropic
from fastapi import APIRouter, BackgroundTasks, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from supabase import create_client

from config import settings
from agents.pipeline import run_pipeline

router = APIRouter(prefix="/intake", tags=["intake"])
supabase = create_client(settings.supabase_url, settings.supabase_service_key)
client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

# ─── Art. 5.1.6 OGUC checklist ───────────────────────────────────────────────

REQUIRED_DOCUMENTS = [
    {"key": "solicitud_firmada",        "label": "Solicitud firmada por propietario y arquitecto"},
    {"key": "cip_vigente",              "label": "CIP vigente (Certificado de Informaciones Previas)"},
    {"key": "fue",                      "label": "FUE (Formulario Único de Estadísticas de Edificación)"},
    {"key": "planos_arquitectonicos",   "label": "Planos arquitectónicos (emplazamiento, plantas, cortes, elevaciones)"},
    {"key": "cuadro_superficies",       "label": "Cuadro de superficies y cabida normativa"},
    {"key": "memoria_calculo",          "label": "Memoria de cálculo estructural"},
    {"key": "factibilidad_sanitaria",   "label": "Certificado de factibilidad sanitaria"},
    {"key": "informe_ri",               "label": "Informe Revisor Independiente (si aplica — reduce plazos Ley 21.718)"},
]

# ─── Request / Response models ────────────────────────────────────────────────

class SubmitApplicationRequest(BaseModel):
    # Architect info
    architect_email: str
    architect_name: str
    owner_name: str
    # Project info
    address: str
    municipality: str = "Las Condes"
    project_type: str = "obra_nueva_residencial"
    zone: str
    has_revisor_independiente: bool = False
    # CIP parameters (from the CIP document)
    cip_number: str
    cip_date: str
    cip_constructibilidad_max: float
    cip_ocupacion_suelo_max: float
    cip_altura_maxima_m: float
    cip_densidad_max_hab_ha: float
    cip_estacionamientos_min: float
    cip_distanciamiento_lateral_m: float
    cip_distanciamiento_fondo_m: float
    cip_antejardin_m: float
    # Architect's declared parameters
    declared_constructibilidad: float
    declared_ocupacion_suelo: float
    declared_altura_m: float
    declared_densidad_hab_ha: float
    declared_estacionamientos: float
    declared_distanciamiento_lateral_m: float
    declared_distanciamiento_fondo_m: float
    declared_antejardin_m: float
    declared_superficie_predio_m2: float
    declared_superficie_total_edificada_m2: float
    declared_num_unidades_vivienda: int


class ResubmitRequest(BaseModel):
    # Updated declared values after corrections
    declared_constructibilidad: Optional[float] = None
    declared_ocupacion_suelo: Optional[float] = None
    declared_altura_m: Optional[float] = None
    declared_densidad_hab_ha: Optional[float] = None
    declared_estacionamientos: Optional[float] = None
    declared_distanciamiento_lateral_m: Optional[float] = None
    declared_distanciamiento_fondo_m: Optional[float] = None
    declared_antejardin_m: Optional[float] = None
    declared_superficie_total_edificada_m2: Optional[float] = None
    declared_num_unidades_vivienda: Optional[int] = None
    correction_notes: Optional[str] = None


# ─── Routes ───────────────────────────────────────────────────────────────────

@router.post("/submit")
async def submit_application(body: SubmitApplicationRequest):
    """Architect submits a new permit application — creates expedient in pendiente_admision."""
    # Find or create architect profile
    arch = supabase.table("architects").select("id").eq("email", body.architect_email).single().execute()
    if not arch.data:
        arch = supabase.table("architects").insert({
            "email": body.architect_email,
            "full_name": body.architect_name,
        }).execute()
    architect_id = arch.data["id"] if isinstance(arch.data, dict) else arch.data[0]["id"]

    # Generate expedition number
    year = datetime.now(timezone.utc).year
    count = supabase.table("expedients").select("id", count="exact").execute()
    exp_number = f"{year}-{(count.count or 0) + 1:04d}"

    # Create expedient
    exp = supabase.table("expedients").insert({
        "exp_number": exp_number,
        "address": body.address,
        "municipality": body.municipality,
        "project_type": body.project_type,
        "zone": body.zone,
        "architect_name": body.architect_name,
        "owner_name": body.owner_name,
        "architect_user_id": architect_id,
        "has_revisor_independiente": body.has_revisor_independiente,
        "status": "pendiente_admision",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
        "admitted_at": datetime.now(timezone.utc).isoformat(),  # will be overwritten on admit
    }).execute()
    expedient_id = exp.data[0]["id"]

    # Create project parameters
    supabase.table("project_parameters").insert({
        "expedient_id": expedient_id,
        "cip_number": body.cip_number,
        "cip_date": body.cip_date,
        "cip_constructibilidad_max": body.cip_constructibilidad_max,
        "cip_ocupacion_suelo_max": body.cip_ocupacion_suelo_max,
        "cip_altura_maxima_m": body.cip_altura_maxima_m,
        "cip_densidad_max_hab_ha": body.cip_densidad_max_hab_ha,
        "cip_estacionamientos_min": body.cip_estacionamientos_min,
        "cip_distanciamiento_lateral_m": body.cip_distanciamiento_lateral_m,
        "cip_distanciamiento_fondo_m": body.cip_distanciamiento_fondo_m,
        "cip_antejardin_m": body.cip_antejardin_m,
        "declared_constructibilidad": body.declared_constructibilidad,
        "declared_ocupacion_suelo": body.declared_ocupacion_suelo,
        "declared_altura_m": body.declared_altura_m,
        "declared_densidad_hab_ha": body.declared_densidad_hab_ha,
        "declared_estacionamientos": body.declared_estacionamientos,
        "declared_distanciamiento_lateral_m": body.declared_distanciamiento_lateral_m,
        "declared_distanciamiento_fondo_m": body.declared_distanciamiento_fondo_m,
        "declared_antejardin_m": body.declared_antejardin_m,
        "declared_superficie_predio_m2": body.declared_superficie_predio_m2,
        "declared_superficie_total_edificada_m2": body.declared_superficie_total_edificada_m2,
        "declared_num_unidades_vivienda": body.declared_num_unidades_vivienda,
    }).execute()

    # Initialize admisibilidad checklist rows
    checklist_rows = [
        {"expedient_id": expedient_id, "requirement": doc["key"]}
        for doc in REQUIRED_DOCUMENTS
    ]
    supabase.table("admisibilidad_checklist").insert(checklist_rows).execute()

    return {"expedient_id": expedient_id, "exp_number": exp_number}


@router.post("/{expedient_id}/documents")
async def upload_document(
    expedient_id: str,
    document_type: str = Form(...),
    file: UploadFile = File(...),
):
    """Upload a document to Supabase Storage and register it."""
    contents = await file.read()
    storage_path = f"{expedient_id}/{document_type}/{file.filename}"

    supabase.storage.from_("expedient-documents").upload(
        storage_path,
        contents,
        {"content-type": file.content_type or "application/pdf"},
    )

    doc = supabase.table("expedient_documents").insert({
        "expedient_id": expedient_id,
        "document_type": document_type,
        "file_name": file.filename,
        "storage_path": storage_path,
        "ai_status": "pending",
    }).execute()

    return {"document_id": doc.data[0]["id"], "storage_path": storage_path}


@router.post("/{expedient_id}/analyze-documents")
async def analyze_documents(expedient_id: str):
    """
    Document Intake Agent — Claude Vision reads uploaded PDFs and evaluates
    each requirement from the Art. 5.1.6 OGUC checklist.
    """
    # Get uploaded documents
    docs = supabase.table("expedient_documents") \
        .select("*").eq("expedient_id", expedient_id).execute()

    if not docs.data:
        raise HTTPException(status_code=400, detail="No documents uploaded yet")

    # Download each document and encode for Claude Vision
    document_blocks = []
    for doc in docs.data:
        try:
            file_bytes = supabase.storage.from_("expedient-documents") \
                .download(doc["storage_path"])
            b64 = base64.standard_b64encode(file_bytes).decode("utf-8")
            document_blocks.append({
                "type": "document",
                "source": {
                    "type": "base64",
                    "media_type": "application/pdf",
                    "data": b64,
                },
                "title": f"{doc['document_type']}: {doc['file_name']}",
            })
        except Exception:
            continue

    if not document_blocks:
        raise HTTPException(status_code=400, detail="Could not read uploaded documents")

    # Build checklist prompt
    checklist_text = "\n".join(
        f"- {doc['key']}: {doc['label']}" for doc in REQUIRED_DOCUMENTS
    )

    prompt = f"""Eres un oficial de admisibilidad de la Dirección de Obras Municipales de Las Condes, Chile.
Revisa los documentos adjuntos y determina si cada uno de los siguientes requisitos del Art. 5.1.6 OGUC está presente y completo.

REQUISITOS A VERIFICAR:
{checklist_text}

Para cada requisito, responde en JSON con este formato exacto:
{{
  "results": [
    {{
      "requirement": "clave_del_requisito",
      "status": "met|unmet|uncertain",
      "confidence": "HIGH|MEDIUM|LOW",
      "notes": "observación breve sobre por qué se cumple o no"
    }}
  ]
}}

Reglas:
- "met": el documento está presente y parece completo
- "unmet": el documento claramente no está presente
- "uncertain": hay un documento pero no puedes confirmar si satisface el requisito
- Si un requisito dice "si aplica" (como informe_ri), márcalo como "met" si no aplica al proyecto
- Sé conservador: prefiere "uncertain" sobre "met" si hay dudas"""

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=2000,
        messages=[{
            "role": "user",
            "content": document_blocks + [{"type": "text", "text": prompt}],
        }],
    )

    import json
    text = response.content[0].text
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    ai_results = json.loads(text.strip())

    # Update checklist rows with AI results
    for result in ai_results.get("results", []):
        supabase.table("admisibilidad_checklist").update({
            "ai_status": result["status"],
            "ai_confidence": result["confidence"],
            "ai_notes": result.get("notes"),
        }).eq("expedient_id", expedient_id).eq("requirement", result["requirement"]).execute()

    # Mark documents as processed
    supabase.table("expedient_documents").update({"ai_status": "done"}) \
        .eq("expedient_id", expedient_id).execute()

    return {"results": ai_results.get("results", [])}


@router.get("/queue")
async def get_intake_queue():
    """Admisibilidad officer sees all pending submissions."""
    result = supabase.table("expedients") \
        .select("*, project_parameters(*), admisibilidad_checklist(*)") \
        .eq("status", "pendiente_admision") \
        .order("submitted_at", desc=False) \
        .execute()
    return result.data


@router.get("/{expedient_id}/documents")
async def list_documents(expedient_id: str):
    """List all uploaded documents for an expedient."""
    docs = supabase.table("expedient_documents") \
        .select("*") \
        .eq("expedient_id", expedient_id) \
        .execute()
    return docs.data


@router.get("/{expedient_id}/documents/{document_type}/url")
async def get_document_signed_url(expedient_id: str, document_type: str):
    """Generate a 1-hour signed download URL for a specific document."""
    result = supabase.table("expedient_documents") \
        .select("storage_path, file_name") \
        .eq("expedient_id", expedient_id) \
        .eq("document_type", document_type) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Documento no encontrado")

    doc = result.data[0]
    signed = supabase.storage.from_("expedient-documents").create_signed_url(
        doc["storage_path"], 3600
    )

    # supabase-py 2.x returns a dict with signedURL key
    url = signed.get("signedURL") or signed.get("signed_url") if isinstance(signed, dict) else None
    if not url:
        raise HTTPException(status_code=500, detail="No se pudo generar el enlace de descarga")

    return {"url": url, "file_name": doc["file_name"]}


@router.get("/{expedient_id}/checklist")
async def get_checklist(expedient_id: str):
    """Get the admisibilidad checklist for an expedient."""
    checklist = supabase.table("admisibilidad_checklist") \
        .select("*").eq("expedient_id", expedient_id).execute()
    docs = supabase.table("expedient_documents") \
        .select("*").eq("expedient_id", expedient_id).execute()
    return {"checklist": checklist.data, "documents": docs.data}


@router.post("/{expedient_id}/admit")
async def admit_expedient(expedient_id: str, background_tasks: BackgroundTasks):
    """
    Admisibilidad officer stamps the expedient as admitted.
    Starts the Ley 21.718 deadline clock and queues compliance review.
    """
    # Check all required docs are met (officer may have overridden)
    checklist = supabase.table("admisibilidad_checklist") \
        .select("requirement, final_status") \
        .eq("expedient_id", expedient_id).execute()

    unmet = [r for r in (checklist.data or []) if r.get("final_status") == "unmet"]
    if unmet:
        raise HTTPException(
            status_code=400,
            detail=f"Documentos faltantes: {', '.join(r['requirement'] for r in unmet)}"
        )

    # Stamp admitted
    now = datetime.now(timezone.utc).isoformat()
    supabase.table("expedients").update({
        "status": "admitido",
        "admitted_at": now,
    }).eq("id", expedient_id).execute()

    # Trigger compliance pipeline in background
    background_tasks.add_task(run_pipeline, expedient_id)

    return {"message": "Expediente admitido. Análisis de cumplimiento iniciado.", "expedient_id": expedient_id}


@router.post("/{expedient_id}/resubmit")
async def resubmit_corrections(expedient_id: str, body: ResubmitRequest, background_tasks: BackgroundTasks):
    """
    Architect submits corrected parameters after receiving Acta de Observaciones.
    Updates declared values and triggers Round 2 compliance check.
    """
    # Verify expedient is in 'observado' state
    exp = supabase.table("expedients").select("status, current_round") \
        .eq("id", expedient_id).single().execute()
    if not exp.data:
        raise HTTPException(status_code=404, detail="Expedient not found")
    if exp.data["status"] != "observado":
        raise HTTPException(status_code=400, detail="Expedient must be in 'observado' state to resubmit")

    # Build update dict with only provided values
    updates = {k: v for k, v in body.model_dump(exclude={"correction_notes"}).items() if v is not None}

    if updates:
        supabase.table("project_parameters").update(updates) \
            .eq("expedient_id", expedient_id).execute()

    # Increment round and reset status
    new_round = exp.data["current_round"] + 1
    supabase.table("expedients").update({
        "current_round": new_round,
        "status": "admitido",
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", expedient_id).execute()

    # Trigger Round 2 pipeline
    background_tasks.add_task(run_pipeline, expedient_id)

    return {
        "message": f"Correcciones recibidas. Ronda {new_round} de revisión iniciada.",
        "expedient_id": expedient_id,
        "round": new_round,
    }


class ChecklistOverrideRequest(BaseModel):
    requirement: str
    final_status: str  # "met" or "unmet"
    officer_notes: Optional[str] = None


@router.patch("/{expedient_id}/checklist")
async def override_checklist_item(expedient_id: str, body: ChecklistOverrideRequest):
    """Officer manually overrides the AI result for a checklist item."""
    if body.final_status not in ("met", "unmet"):
        raise HTTPException(status_code=400, detail="final_status must be 'met' or 'unmet'")

    supabase.table("admisibilidad_checklist").update({
        "final_status": body.final_status,
        "officer_notes": body.officer_notes,
    }).eq("expedient_id", expedient_id).eq("requirement", body.requirement).execute()

    return {"ok": True}


@router.post("/extract-from-doc")
async def extract_from_doc(
    doc_type: str = Form(...),
    file: UploadFile = File(...),
):
    """
    Use Claude PDF Vision to extract parameters from an uploaded document.
    Stateless — no expedient ID required. Processes the file in-memory.

    doc_type "cip_vigente"             → extracts CIP normative parameters
    doc_type "cuadro_superficies"      → extracts declared project parameters
    doc_type "planos_arquitectonicos"  → also extracts declared parameters
    """
    contents = await file.read()
    b64 = base64.standard_b64encode(contents).decode("utf-8")

    if doc_type == "cip_vigente":
        prompt = """Eres un experto en documentos de la DOM (Dirección de Obras Municipales) de Chile.
Analiza este CIP (Certificado de Informaciones Previas) y extrae exactamente los valores que aparecen en el documento.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "cip_number": "número del certificado (ej: CIP-2024-1205) o null",
  "cip_date": "fecha en formato YYYY-MM-DD o null",
  "zone": "código de zona PRC (ej: E-Ab2-A) o null",
  "cip_constructibilidad_max": número decimal o null,
  "cip_ocupacion_suelo_max": número decimal o null,
  "cip_altura_maxima_m": número decimal en metros o null,
  "cip_densidad_max_hab_ha": número decimal o null,
  "cip_estacionamientos_min": número decimal o null,
  "cip_distanciamiento_lateral_m": número decimal o null,
  "cip_distanciamiento_fondo_m": número decimal o null,
  "cip_antejardin_m": número decimal o null,
  "confidence": "HIGH si lees claramente los valores, MEDIUM si hay dudas, LOW si el documento es ilegible"
}

Si un valor no aparece o no puedes leerlo, usa null. No inventes valores."""
    else:
        # cuadro_superficies or planos_arquitectonicos
        prompt = """Eres un experto en documentos de arquitectura chilena.
Analiza este cuadro de superficies o plano y extrae los parámetros declarados del proyecto.

Responde ÚNICAMENTE con JSON válido (sin markdown, sin texto adicional):
{
  "declared_constructibilidad": número decimal o null,
  "declared_ocupacion_suelo": número decimal o null,
  "declared_altura_m": número decimal en metros o null,
  "declared_densidad_hab_ha": número decimal o null,
  "declared_estacionamientos": número decimal o null,
  "declared_distanciamiento_lateral_m": número decimal o null,
  "declared_distanciamiento_fondo_m": número decimal o null,
  "declared_antejardin_m": número decimal o null,
  "declared_superficie_predio_m2": número decimal en m² o null,
  "declared_superficie_total_edificada_m2": número decimal en m² o null,
  "declared_num_unidades_vivienda": número entero o null,
  "confidence": "HIGH si lees claramente los valores, MEDIUM si hay dudas, LOW si el documento es ilegible"
}

Si un valor no aparece o no puedes leerlo, usa null. No inventes valores."""

    response = client.messages.create(
        model=settings.llm_model,
        max_tokens=1000,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "document",
                    "source": {
                        "type": "base64",
                        "media_type": "application/pdf",
                        "data": b64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )

    import json
    text = response.content[0].text.strip()
    if "```" in text:
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]

    try:
        return json.loads(text.strip())
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail="No se pudieron extraer datos del documento. Intenta de nuevo.")


@router.get("/architect/{architect_email}/expedients")
async def get_architect_expedients(architect_email: str):
    """Get all expedients submitted by an architect."""
    arch = supabase.table("architects").select("id") \
        .eq("email", architect_email).single().execute()
    if not arch.data:
        return []

    result = supabase.table("expedients") \
        .select("*, project_parameters(*)") \
        .eq("architect_user_id", arch.data["id"]) \
        .order("created_at", desc=True) \
        .execute()
    return result.data
