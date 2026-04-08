# System Architecture — DOM Permit Review AI

## Overview

AI-assisted building permit review tool for Chilean municipality staff (DOM — Dirección de Obras Municipales). Primary users are municipality employees, starting with the **Revisor Técnico** role.

## Stack

| Layer | Technology | Deployment |
|---|---|---|
| Frontend | Next.js 14 (App Router, TypeScript, Tailwind) | Vercel |
| Backend | FastAPI (Python 3.11) | Railway |
| Database | Supabase (PostgreSQL) | Supabase Cloud |
| Vector Store | Supabase pgvector | Supabase Cloud (post-MVP) |
| AI / LLM | Anthropic Claude (claude-sonnet-4-6) | Anthropic API |
| Auth | Supabase Auth | Supabase Cloud (post-MVP) |

## MVP vs. Production Architecture

### MVP (April 15 showcase)
The compliance agents use **context stuffing** instead of vector search: all relevant normative chunks for ZHR2 residential projects are loaded directly into the Claude prompt. This is viable because the full regulatory context for a single zone fits comfortably within Claude's context window (~5,000 tokens).

### Production (post-MVP)
Replace context stuffing with pgvector similarity search. The data schema is identical — only the retrieval mechanism changes. Enables multi-zone and multi-municipality support.

```
MVP:     Input → Input Parser → [All ZHR2 chunks in prompt] → Claude → Output
PROD:    Input → Input Parser → pgvector search → top-k chunks → Claude → Output
```

## AI Agent Pipeline

Four sequential agents, implemented as Python functions orchestrated by FastAPI:

```
┌─────────────────┐
│  Input Parser   │  Deterministic. Validates CIP params vs. declared values.
│  (no LLM)       │  Outputs structured ProjectParameters object.
└────────┬────────┘
         │
┌────────▼────────┐
│  Reg. Retriever │  MVP: loads all ZHR2 chunks from data/. 
│  (no LLM)       │  PROD: pgvector similarity search.
└────────┬────────┘
         │
┌────────▼────────┐
│  Compliance     │  Claude claude-sonnet-4-6. Structured output.
│  Reasoner       │  Per-parameter: VIOLATION / COMPLIANT / NEEDS_REVIEW / SIN_DATOS
└────────┬────────┘
         │
┌────────▼────────┐
│  Report         │  Claude claude-sonnet-4-6. Generates draft Acta de
│  Generator      │  Observaciones in official DOM format.
└─────────────────┘
```

### Agent Outputs

**Input Parser output:**
```json
{
  "expedient_id": "uuid",
  "zone": "ZHR2",
  "project_type": "obra_nueva_residencial",
  "cip_params": {
    "constructibilidad_max": 1.8,
    "ocupacion_suelo_max": 0.5,
    "altura_maxima_m": 15.0,
    "densidad_max_hab_ha": 400,
    "estacionamientos_min_per_vivienda": 1.0
  },
  "declared_params": {
    "constructibilidad": 1.72,
    "ocupacion_suelo": 0.61,
    "altura_m": 18.5,
    "densidad_hab_ha": 312,
    "estacionamientos_per_vivienda": 0.8
  },
  "deltas": {
    "constructibilidad": {"status": "ok", "delta": -0.08},
    "ocupacion_suelo": {"status": "over", "delta": 0.11},
    "altura_m": {"status": "over", "delta": 3.5},
    "densidad_hab_ha": {"status": "ok", "delta": -88},
    "estacionamientos_per_vivienda": {"status": "under", "delta": -0.2}
  }
}
```

**Compliance Reasoner output (per parameter):**
```json
{
  "parameter": "altura_maxima",
  "verdict": "VIOLATION",
  "confidence": "HIGH",
  "declared_value": "18.50 m",
  "allowed_value": "15.00 m",
  "excess": "3.50 m",
  "normative_reference": "PRC Las Condes, Tabla de Normas Urbanísticas, Zona ZHR2",
  "article_cited": "PRC-LC-ZHR2-ALTURA",
  "draft_observation": "La altura proyectada de 18,50 m excede la altura máxima de 15,00 m establecida para la zona ZHR2 por el PRC comunal, Tabla ZHR2. Debe ajustarse a dicha limitación.",
  "chunks_used": ["prc-lc-zhr2-tabla", "oguc-2-6-1"]
}
```

## Database Schema (Supabase PostgreSQL)

### Core tables

```sql
users               -- DOM staff with roles
expedients          -- Permit applications
project_parameters  -- CIP + declared values per expedient  
compliance_checks   -- AI analysis runs (one per round)
observations        -- Individual findings with lifecycle tracking
actas               -- Published Actas de Observaciones
```

### Observation lifecycle states

```
Round 1:  NUEVA (new finding from AI)
Round 2+: SUBSANADA | PENDIENTE | REABIERTA | NUEVA
```

### Reviewer action states
```
pending → accepted | edited | discarded
```

## Data Architecture

### Normative data (for RAG)

```
data/
├── oguc/
│   └── key-articles.json     # ~25 OGUC articles, chunked
├── prc/
│   └── zhr2.json             # ZHR2 zone parameters (seed values)
└── examples/
    └── actas-examples.json   # 5 synthetic Actas for few-shot prompting
```

Each chunk schema:
```json
{
  "id": "oguc-2-5-3",
  "source": "OGUC",
  "article": "2.5.3",
  "title": "Distanciamientos mínimos",
  "content": "...",
  "zone_applicability": ["all"],
  "parameter_types": ["distanciamiento"],
  "embedding": null  // populated in production
}
```

## API Routes (FastAPI)

```
GET  /expedients                    List expedients for reviewer
GET  /expedients/{id}               Expedient detail
POST /expedients                    Create expedient
GET  /expedients/{id}/compliance    Get latest compliance check results  
POST /expedients/{id}/analyze       Trigger AI pipeline (auto-runs on admission)
PATCH /expedients/{id}/observations/{obs_id}  Reviewer action on observation
POST /expedients/{id}/acta          Publish Acta
GET  /expedients/{id}/acta          Get Acta (draft or published)
```

## Deployment

```
Frontend (Vercel):
  - main branch → production (domreview.vercel.app or custom domain)
  - Auto-deploy on push to main

Backend (Railway):
  - Dockerfile in apps/api/
  - Env vars: ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY

Database (Supabase):
  - Free tier sufficient for MVP
  - Migrations in apps/api/db/migrations/
```

## Environment Variables

```
# apps/api/.env
ANTHROPIC_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
ENVIRONMENT=development

# apps/web/.env.local
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Post-MVP Roadmap

1. **Auth** — Supabase Auth with role-based access (revisor_tecnico, jefe_departamento, director_dom, etc.)
2. **Document upload** — CIP and expedient PDF parsing with structured extraction
3. **pgvector RAG** — Replace context stuffing with similarity search; enables multi-zone support
4. **Round 2+ flow** — Observation threading across subsanación rounds
5. **Jefe de Departamento view** — Deadline queue, workload management
6. **Additional zones** — ZHR1, ZHR3, ZC commercial zones
7. **Additional municipalities** — PRC swap mechanism
