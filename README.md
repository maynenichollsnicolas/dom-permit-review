# DOM Permit Review AI

AI-assisted building permit review for Chilean municipalities (Dirección de Obras Municipales).

## What it does

The Revisor Técnico opens a submitted permit expedient. The system automatically runs a compliance analysis against OGUC and PRC Las Condes using Claude, flags violations with exact article citations, and generates a draft Acta de Observaciones in official DOM format. The reviewer reviews, edits, and publishes the Acta.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind, shadcn/ui |
| Backend | FastAPI (Python 3.11) |
| Database | Supabase (PostgreSQL + pgvector) |
| AI | Claude claude-sonnet-4-6 (Anthropic) |
| Embeddings | text-embedding-3-small (OpenAI) |
| Deploy | Vercel (frontend) + Railway (backend) |

## Getting started

### 1. Supabase setup

1. Create a project at supabase.com
2. Run `apps/api/db/migrations/001_initial.sql` in the SQL Editor
3. Copy your project URL and service role key

### 2. Backend

```bash
cd apps/api
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn main:app --reload
```

### 3. Ingest regulatory data

```bash
cd apps/api
python3 scripts/ingest_data.py
```

This embeds OGUC articles and PRC ZHR2 data into Supabase pgvector.

### 4. Frontend

```bash
cd apps/web
cp .env.local.example .env.local   # set NEXT_PUBLIC_API_URL
npm install
npm run dev
```

Open http://localhost:3000

## Project structure

```
├── apps/
│   ├── api/          FastAPI backend + AI agent pipeline
│   └── web/          Next.js frontend
├── data/
│   ├── oguc/         OGUC article chunks (JSON seed data)
│   ├── prc/          PRC Las Condes ZHR2 parameters
│   └── examples/     Synthetic Actas de Observaciones (few-shot)
└── docs/
    ├── architecture/ System architecture
    ├── research/     Regulatory research documents
    └── flows/        User flow definitions
```

## MVP scope

- Municipality: Las Condes
- Zone: ZHR2
- Project type: Obra Nueva Residencial, Ampliación Residencial
- User role: Revisor Técnico

## Roadmap

- [ ] Auth (Supabase Auth, role-based)
- [ ] Document upload + CIP PDF parsing
- [ ] Round 2+ observation threading
- [ ] Jefe de Departamento view
- [ ] Additional zones (ZHR1, ZHR3, ZC)
- [ ] Additional municipalities (PRC swap mechanism)
