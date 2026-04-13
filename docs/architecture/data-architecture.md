# Data Architecture — DOM Permit Review AI

This document covers every decision made about data: what we use, where it comes from, how we clean and transform it, how it is stored in a vector database, and why we made each architectural choice.

---

## 1. The Problem We Are Solving with Data

Chilean building permit review (Dirección de Obras Municipales, DOM) requires a technical reviewer to compare a project's declared parameters against three overlapping layers of normative regulation:

1. **LGUC** — national law (integer articles, e.g. Artículo 116°)
2. **OGUC** — national building ordinance (decimal articles, e.g. Art. 5.1.6)
3. **PRC** — local zoning plan per municipality (zone-specific tables)

A reviewer must mentally cross-reference hundreds of articles to decide if a declared value (e.g. constructibilidad = 1.72) violates the norm for that zone (e.g. E-Aa1 max = 1.0). This is slow, error-prone, and creates the bottleneck that Ley 21.718 puts under strict 30/60-day deadlines.

Our AI system automates this lookup by:
1. Parsing all regulatory documents into structured chunks
2. Storing them in a vector database (pgvector on Supabase)
3. Retrieving the relevant chunks per parameter at review time
4. Sending them to Claude with the project's declared values to produce verdicts

---

## 2. Regulatory Hierarchy

```
LGUC (Ley General de Urbanismo y Construcciones)
  DFL 458/1975 — national law
  124 pages, integer articles (Art. 116°, Art. 119°, etc.)
  Governs: permit process, timelines, silencio administrativo
      │
      ▼
OGUC (Ordenanza General de Urbanismo y Construcciones)
  Decreto 47/1992 — national regulation
  427 pages, decimal articles (Art. 1.4.9, Art. 5.1.6, etc.)
  Governs: technical standards, construction requirements, expedient requirements
      │
      ▼
PRC (Plan Regulador Comunal — Las Condes)
  Texto Refundido Modificación N°11, December 2022
  96 pages, zone-specific tables
  Governs: constructibilidad, altura, densidad, distanciamiento per zone
```

Each layer constrains the one below. LGUC sets the process; OGUC sets the technical rules; PRC sets the local limits for each zone. A permit violation can come from any layer.

---

## 3. Source Documents

### 3.1 Raw Files

| File | Location | Type | Pages | Content |
|---|---|---|---|---|
| `OGUC.pdf` | `data/raw/oguc/` | Digital PDF | 427 | OGUC (Decreto 47/1992), last modified 16-MAR-2026 |
| `LGUC.pdf` | `data/raw/lguc/` | Digital PDF | 124 | LGUC (DFL 458/1975), last modified 29-MAR-2026 |
| `Texto_Refundido_SEREMI_firmado.pdf` | `data/raw/prc/` | Digital PDF | 96 | PRC Las Condes, Modificación N°11 |
| `Texto_Resolutivo_Mod_11_vf_corregida_firmado.pdf` | `data/raw/prc/` | Digital PDF | — | PRC modification resolutions |
| `Memoria_Explicativa_Mod_11_v_corregida_firmada.pdf` | `data/raw/prc/` | Digital PDF | — | PRC explanatory memory |
| `PL_lamina-01/02/03_PLANO-REGULADOR.pdf` | `data/raw/prc/` | Image-only PDF | — | Zone maps (no text — skipped) |
| `Ord.-Alc.-*.pdf`, `Ord.-SEREMI-*.pdf` | `data/raw/prc/` | Digital PDF | — | Administrative ordinances |
| `vitacura_acta1.pdf`, `vitacura_acta3.pdf` | `data/raw/actas/` | Digital PDF | 1–2 | Vitacura Actas (text-extractable) |
| `conchali_acta2.pdf`, `paine_acta.pdf`, `cabildo_minvu.pdf` | `data/raw/actas/` | Scanned PDF | — | Scanned Actas (image-only, no text) |
| `lascondes_page*.png`, `lascondes2_page*.png` | `data/raw/actas/` | PNG images | — | Las Condes Actas (scanned) |
| `es.scribd.com_document_*.md` | `data/raw/actas/` | Markdown | — | Scribd-scraped Acta text |
| Various `*_page*.png` | `data/raw/actas/` | PNG images | — | Scanned Acta pages from other municipalities |

### 3.2 Critical Discovery: Files Were Misnamed

When the documents were first uploaded, the filenames were swapped:

- `data/raw/oguc/OGUC-2024.pdf` → was actually **LGUC** (DFL 458/1975, integer articles like Artículo 1°)
- `data/raw/oguc/LGUC.pdf` → was actually **OGUC** (Decreto 47/1992, decimal articles like Artículo 1.1.1.)

**How we detected this:** By running `pdfplumber` and checking article numbering patterns:
- Integer-only article numbers (`Artículo 1°`, `Artículo 116°`) → LGUC
- Decimal article numbers (`Artículo 1.1.1.`, `Artículo 5.1.6.`) → OGUC

**Resolution:** Both files were moved and renamed to match their actual content:
```
data/raw/oguc/LGUC.pdf    → data/raw/oguc/OGUC.pdf    (correct: OGUC)
data/raw/oguc/OGUC-2024.pdf → data/raw/lguc/LGUC.pdf  (correct: LGUC)
```

### 3.3 Critical Discovery: PRC Zone Names Were Wrong

The initial seed data (`data/prc/zhr2.json`) used zone codes `ZHR1`, `ZHR2`, `ZHR3` — but these do not exist in the actual Las Condes PRC.

**The real zone system (from `Texto_Refundido_SEREMI_firmado.pdf`):**

| Code | Full name |
|---|---|
| E-Ab1, E-Ab2, E-Ab3, E-Ab4 | Edificación Aislada Baja (1–4) |
| E-Am1, E-Am2, E-Am4 | Edificación Aislada Media (1, 2, 4) |
| E-Aa1, E-Aa2, E-Aa3, E-Aa4, E-Aa | Edificación Aislada Alta (1–4) |
| E-e1, E-e2, E-e3, E-e4, E-e5 | Edificación Especial (1–5) |

**Resolution:** `parse_prc.py` was completely rewritten to auto-detect zone names from the document text (matching patterns like `"1. Zona E-Ab1"`, `"2.a. Subzona E-Ab2-A"`).

---

## 4. Parsing Pipeline

Each document type requires a different parsing strategy because of how the text is structured in the PDF.

### 4.1 OGUC Parser (`scripts/parse_oguc.py`)

**Input:** `data/raw/oguc/OGUC.pdf` (427 pages)

**Strategy:** The OGUC is a continuous text document with articles separated by a consistent pattern: `"Artículo X.Y.Z."` followed by a title and body text. We use a **regex boundary detector** to split the full text into per-article segments.

```python
ARTICLE_PATTERN = re.compile(
    r"(?:Artículo|ARTÍCULO|Art\.)\s+(\d+\.\d+(?:\.\d+)?)\s*[.–\-]?\s*(.{0,150}?)(?:\n|\.\s)",
    re.IGNORECASE,
)
```

**Chunking logic:**
1. Extract full text from all pages with `pdfplumber`
2. Find all article boundary positions with the regex
3. For each article: content = text from end of match to start of next match
4. If content ≤ 800 tokens → single chunk
5. If content > 800 tokens → split by `\n\n` paragraph boundaries
6. Hard cap at 7,500 tokens (OpenAI text-embedding-3-small limit is 8,191 tokens)

**Output:** `data/processed/oguc-chunks.json` — **557 chunks**

**Metadata per chunk:**
```json
{
  "id": "oguc-5-1-6",
  "source": "OGUC",
  "article": "5.1.6",
  "parameter_types": ["expediente", "documentacion"],
  "zone_applicability": ["all"],
  "article_reference": "OGUC art. 5.1.6"
}
```

`parameter_types` is a manually curated list mapping each article to the compliance parameters it governs (e.g. Art. 2.6.1 → `["constructibilidad", "ocupacion_suelo"]`).

---

### 4.2 LGUC Parser (`scripts/parse_lguc.py`)

**Input:** `data/raw/lguc/LGUC.pdf` (124 pages)

**Strategy:** Same approach as OGUC but with an **integer article regex** because LGUC uses `Artículo 116°.-` style:

```python
ARTICLE_PATTERN = re.compile(
    r"Artículo\s+(\d{1,3})°?\s*[.–\-]\s*(.{0,150}?)(?:\n|\.\s)",
    re.IGNORECASE,
)
```

**Key articles indexed:**

| Article | Topic |
|---|---|
| 116 | Permisos de edificación (building permits required) |
| 118 | Expedient document requirements |
| 119 | Observations process (Acta de Observaciones) |
| 120 | Silencio administrativo negativo (60-day rule) |
| 143 | Certificate of conformity |
| 144 | Recepción definitiva |

**Output:** `data/processed/lguc-chunks.json` — **183 chunks**

---

### 4.3 PRC Parser (`scripts/parse_prc.py`)

**Input:** `data/raw/prc/Texto_Refundido_SEREMI_firmado.pdf` (96 pages)

**This was the most complex parser.** The PRC is not a linear text like OGUC — it is structured as:
- Chapter I–V: General norms (antejardines, estacionamientos, densificación incentives)
- Chapter VI (Art. 38): Zone-by-zone normative tables

**Challenge — rotated table headers:** The zone norm tables have column headers rendered as rotated text in the PDF. `pdfplumber` extracts them as reversed strings:

```
"aturB dadisneD"   → "Densidad Bruta"  (reversed)
"dadilibitcurtsnoC" → "Constructibilidad" (reversed)
"etnasaR"          → "Rasante" (reversed)
```

**Solution:** Since the column order is consistent across all tables in the PRC, we **hardcode the column position mapping** based on observed structure, rather than trying to parse the garbled headers:

| Col index | Base table (no área libre) | Densification table (with área libre) |
|---|---|---|
| 0 | densidad_bruta | densidad_bruta |
| 1 | subdivision_predial_min | subdivision_predial_min |
| 2 | constructibilidad | constructibilidad |
| 3 | ocupacion_suelo | ocupacion_suelo |
| 4 | rasante | **area_libre** |
| 5 | altura | rasante |
| 6 | antejardin | altura |
| 7 | distanciamiento | antejardin |
| 8 | adosamiento | distanciamiento |
| 9 | sistema_agrupamiento | sistema_agrupamiento + adosamiento |

**Detection of table type:** We check if column 4 header contains the fragment `nerbiL` (= "Libre" reversed) to identify densification tables.

**Zone section detection:** Zone names are identified from section headers matching:
```python
ZONE_SECTION_PATTERN = re.compile(
    r"(\d+\.(?:[a-d]\.)?\s+(?:Zona|Subzona|Sector)\s+(E-[A-Za-z]+\d+(?:[.-][A-Za-z0-9]*)*))",
)
```

**Output per zone:** For each zone we generate:
1. A **summary chunk** with all parameters in human-readable prose
2. **Individual parameter chunks** for precise retrieval (one per parameter: constructibilidad, altura, ocupacion_suelo, etc.)
3. **Densification table chunks** (Tabla B/C/D) tagged separately

**Output:** `data/processed/prc-chunks.json` — **184 chunks from 16 zones**

Zones extracted: E-Aa1, E-Aa3-A, E-Aa4, E-Ab1-A, E-Ab2-A, E-Ab3, E-Ab4, E-Am1, E-Am1-A, E-Am2, E-Am4, E-Am4-A, E-e1, E-e2, E-e3, E-e5.

**Example zone chunk:**
```
Zona E-Aa1, Las Condes. Coeficiente de constructibilidad máximo: 1.0.
La superficie total edificada no puede superar 1.0 veces la superficie del predio.
```

---

### 4.4 Actas Parser (`scripts/parse_actas.py`)

**Input:** `data/raw/actas/` — 41 files of mixed types

The Actas de Observaciones are the reference examples used for few-shot prompting of the Report Generator agent. They represent real DOM decisions from multiple municipalities.

**File types and extraction strategies:**

| File type | Strategy |
|---|---|
| Digital PDF (vitacura_acta1.pdf, vitacura_acta3.pdf) | `pdfplumber` text extraction |
| Scanned PDF (conchali_acta2.pdf, paine_acta.pdf, cabildo_minvu.pdf) | `pdfplumber` page-to-image → Claude Vision API |
| PNG images (lascondes_page*.png, etc.) | Claude Vision API directly |
| Scribd .md files | Strip Scribd UI boilerplate, extract Acta text |
| Plain .txt | Direct read |

**Scanned PDF detection:** We attempt text extraction with `pdfplumber`. If the result is < 50 characters, the PDF is classified as scanned and routed to Vision.

**Scribd boilerplate stripping:** Scribd .md files contain navigation UI, download prompts, and other noise before the actual document text. We detect the end of the boilerplate by scanning for markers like `"You are on page"` or `"Fullscreen"` and discard everything before them.

**Two Acta formats found:**

1. **Free-text** (most common): numbered observations in prose, each citing a normative article
   ```
   1.- Proyecto debe respetar franja de antejardín de 3 metros.
       Art. 24° Ordenanza Plan Regulador comunal.
   ```

2. **Checklist (Formulario 5.12)**: table with C/NC/NA columns per item — used by Conchalí and some other municipalities

Claude extracts both formats into the same JSON schema.

**Output:** `data/processed/actas-examples.json` — **41 examples, 32 processed via Vision**

**Resume support:** The parser saves after every successfully processed file so interrupted runs continue from the last checkpoint.

---

## 5. Vector Database Architecture

### 5.1 Why pgvector

We use **pgvector** inside Supabase (PostgreSQL) rather than a dedicated vector database (Pinecone, Weaviate, etc.) for three reasons:

1. **Co-location with operational data:** The `regulatory_chunks` table lives in the same database as `expedients`, `observations`, and `actas`. This allows metadata-filtered queries using standard SQL — no cross-service calls.
2. **Hybrid retrieval:** pgvector supports both vector similarity search AND exact metadata filtering (`WHERE source = 'PRC_LAS_CONDES' AND zone = 'E-Aa1'`). This is essential for PRC data.
3. **Simplicity for MVP:** One infrastructure provider (Supabase) covers auth, database, storage, and vector search.

### 5.2 Schema

```sql
CREATE TABLE regulatory_chunks (
  id               TEXT PRIMARY KEY,          -- e.g. "oguc-5-1-6", "prc-lc-eaa1-constructibilidad"
  source           TEXT NOT NULL,             -- 'OGUC' | 'LGUC' | 'PRC_LAS_CONDES'
  article          TEXT,                      -- article number (OGUC/LGUC only)
  zone             TEXT,                      -- PRC zone code (e.g. 'E-Aa1'), NULL for OGUC/LGUC
  parameter_types  TEXT[],                    -- ['constructibilidad', 'altura', ...]
  title            TEXT NOT NULL,             -- human-readable chunk title
  content          TEXT NOT NULL,             -- full text sent to embedding model
  article_reference TEXT,                     -- citation string for the Acta
  embedding        VECTOR(1536),              -- OpenAI text-embedding-3-small
  metadata         JSONB                      -- additional fields (zone_applicability, etc.)
);
```

**Index:** IVFFlat index on the embedding column for approximate nearest-neighbor search:
```sql
CREATE INDEX regulatory_chunks_embedding_idx
  ON regulatory_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 50);
```

`lists = 50` is appropriate for our corpus size (~900 chunks). The rule of thumb is `sqrt(N)` to `N/10` lists.

### 5.3 Embedding Model

**Model:** `text-embedding-3-small` (OpenAI)
- Dimensions: 1,536
- Max input: 8,191 tokens
- Cost: ~$0.02 per million tokens

We chose `text-embedding-3-small` over `text-embedding-3-large` (3,072 dimensions) because:
- The regulatory text is domain-specific Spanish — larger dimensions don't significantly improve retrieval quality for structured legal text
- Lower cost matters when embedding 924+ chunks and re-embedding on each corpus update
- 1,536 dimensions are sufficient for the semantic distinctions we need (constructibilidad vs. ocupacion vs. altura)

### 5.4 Corpus Statistics

| Source | Chunks | Avg tokens |
|---|---|---|
| OGUC | 557 | ~359 |
| LGUC | 183 | ~349 |
| PRC Las Condes | 184 | ~150 |
| **Total** | **924** | **~330** |

---

## 6. Retrieval Architecture

### 6.1 The Two-Strategy Problem

A naive single-query approach ("embed the question and find top-5 similar chunks") fails for this domain because:

- **PRC data is structured, not semantic.** The fact that E-Aa1 has constructibilidad = 1.0 is an exact value in a table. Semantic similarity search might return chunks for E-Aa1 *altura* when we need E-Aa1 *constructibilidad* — the text is similar, the answer is different.
- **OGUC/LGUC data is semantic.** Article 5.1.6 covers expedient requirements across many topics. A semantic search for "what documents are required" needs to find relevant articles regardless of exact phrasing.

**Solution:** Use different retrieval strategies per source.

### 6.2 Strategy 1 — Direct Metadata Query (PRC)

For PRC zone-specific parameters, we query by exact metadata — no embedding needed:

```python
supabase.table("regulatory_chunks")
    .select("*")
    .eq("source", "PRC_LAS_CONDES")
    .eq("zone", zone)                          # e.g. "E-Aa1"
    .contains("parameter_types", [param])      # e.g. ["constructibilidad"]
    .execute()
```

This returns exactly the chunk for `(zone=E-Aa1, parameter=constructibilidad)` in one fast SQL query. No false positives, no missed results.

### 6.3 Strategy 2 — Semantic Vector Search (OGUC / LGUC)

For normative articles, we embed a query string and use pgvector cosine similarity:

```python
supabase.rpc("match_regulatory_chunks", {
    "query_embedding": embed("constructibilidad norma urbanística OGUC"),
    "match_threshold": 0.25,
    "match_count": 10,
    "filter_zone": None,
})
```

The RPC function runs in PostgreSQL:
```sql
SELECT *, 1 - (embedding <=> query_embedding) AS similarity
FROM regulatory_chunks
WHERE 1 - (embedding <=> query_embedding) > match_threshold
ORDER BY embedding <=> query_embedding
LIMIT match_count;
```

### 6.4 Per-Parameter Retrieval

The main retrieval function `retrieve_for_compliance_check()` combines both strategies for each parameter being checked:

```python
for param in ["constructibilidad", "altura", "ocupacion_suelo", ...]:
    prc_chunks  = retrieve_prc_direct(zone, [param])         # exact SQL
    oguc_chunks = retrieve_semantic(query, ["OGUC"], [param]) # vector search
    lguc_chunks = retrieve_semantic(query, ["LGUC"], [param]) # vector search (procedural only)
    result[param] = deduplicated(prc_chunks + oguc_chunks + lguc_chunks)
```

This ensures that for every parameter the reasoner sees:
1. The exact PRC value for that zone
2. The relevant OGUC technical standard
3. Relevant LGUC procedural article (for documentation/process parameters)

---

## 7. Agent Pipeline

```
Input Parser (deterministic)
    ↓
    Loads project_parameters from DB
    Computes deltas: declared vs CIP (allowed values)
    Flags: ok | over | under | missing
    ↓
Regulatory Retriever (per-parameter hybrid search)
    ↓
    For each parameter in the project:
      PRC: direct metadata SQL query (zone + parameter_type)
      OGUC: semantic vector search
      LGUC: semantic vector search (procedural params only)
    Deduplicates and flattens to a list of chunks
    ↓
Compliance Reasoner (Claude claude-sonnet-4-6)
    ↓
    Receives: parameter deltas + normative chunks (max 40, 600 chars each)
    Produces: per-parameter verdicts (VIOLATION | COMPLIANT | NEEDS_REVIEW | SIN_DATOS)
    Each verdict includes: declared value, allowed value, excess/deficit, article cited
    ↓
Report Generator (Claude claude-sonnet-4-6)
    ↓
    Receives: compliance results + few-shot Actas examples
    Produces: draft Acta de Observaciones in MINVU Formulario 5.12 format
    Saves to: actas table with status='draft'
```

---

## 8. Key Design Decisions

### Why not stuff all 924 chunks into every prompt?
At ~330 tokens average, 924 chunks = ~304,000 tokens. This exceeds Claude's context window for the reasoner, would cost ~$0.90 per check at current pricing, and — most importantly — would flood the model with irrelevant information. Per-parameter retrieval keeps each check focused.

### Why separate OGUC and LGUC?
They are legally distinct instruments (law vs. regulation), have different article numbering schemes (integer vs. decimal), cover different topics (process vs. technical standards), and are cited differently in Actas (`LGUC art. 116°` vs `OGUC art. 5.1.6`). Mixing them would create ambiguous citations and make metadata filtering impossible.

### Why max 600 chars per chunk in the prompt?
The compliance reasoner needs to see the key value from each chunk (the norm), not the full legal prose. Most OGUC articles are long; the first 600 characters contain the definition and the operative rule. The rest is typically exceptions, procedures, and cross-references that can be retrieved on demand if NEEDS_REVIEW is flagged.

### Why store PRC as individual parameter chunks (not full zone tables)?
The PRC has 16 zones × ~10 parameters = 160 combinations. Storing each as its own chunk enables surgical retrieval: for a constructibilidad check, retrieve only the constructibilidad chunk, not the full zone table with 10 parameters. This reduces prompt noise and makes the reasoner's job easier.

### Why IVFFlat instead of HNSW for the index?
IVFFlat is more memory-efficient for small corpora (< 10,000 vectors). HNSW is better for large, high-throughput production use. At 924 chunks, IVFFlat with `lists=50` gives sub-millisecond query times.

---

## 9. Data Flow Summary

```
data/raw/
├── oguc/OGUC.pdf         → parse_oguc.py  → data/processed/oguc-chunks.json  (557 chunks)
├── lguc/LGUC.pdf         → parse_lguc.py  → data/processed/lguc-chunks.json  (183 chunks)
├── prc/*.pdf             → parse_prc.py   → data/processed/prc-chunks.json   (184 chunks)
└── actas/                → parse_actas.py → data/processed/actas-examples.json (41 examples)

data/processed/*.json
    → ingest_data.py
        → OpenAI text-embedding-3-small  (embed each chunk)
        → Supabase regulatory_chunks table (upsert with embedding)

Supabase regulatory_chunks (924 vectors, 1536 dimensions)
    → retrieve_for_compliance_check()  (per-parameter hybrid retrieval)
        → Compliance Reasoner (Claude)
            → Report Generator (Claude)
                → Draft Acta de Observaciones
```

---

## 10. Re-Running the Pipeline

If you add new documents or update the parsers:

```bash
cd apps/api

# 1. Re-parse (only the source you updated)
.venv/bin/python3 scripts/parse_oguc.py
.venv/bin/python3 scripts/parse_lguc.py
.venv/bin/python3 scripts/parse_prc.py
.venv/bin/python3 scripts/parse_actas.py   # requires Anthropic API credits

# 2. Re-ingest (resumes automatically — only embeds new/changed chunks)
.venv/bin/python3 scripts/ingest_data.py
```

The ingest script checks which chunk IDs already exist in Supabase and skips them, so re-runs only process what changed.
