1# DSAIL Project: AI Building Permit Pre-Review Agent — Complete Specification

**Project:** DSAIL (Data Science & AI Lab) — Spring 2026
**Author:** Nico
**Deadline:** April 16, 2026
**Time Budget:** 12–15 hours
**Execution Model:** Claude Code + Claude Cowork
**Last Updated:** March 31, 2026

---

## Table of Contents

1. [What problem are you solving and why does it matter?](#1-what-problem-are-you-solving-and-why-does-it-matter)
2. [How do you plan to build with AI?](#2-how-do-you-plan-to-build-with-ai)
3. [What do you hope to learn about AI through this project?](#3-what-do-you-hope-to-learn-about-ai-through-this-project)
4. [Domain Deep-Dive: The Building Permit Flow in Chile](#4-domain-deep-dive-the-building-permit-flow-in-chile)
5. [System Architecture & Design](#5-system-architecture--design)
6. [Execution Roadmap (8 Steps, 12–15 Hours)](#6-execution-roadmap-8-steps-1215-hours)
7. [Open Questions & Decisions](#7-open-questions--decisions)

---

# Part I: Assignment

## 1. What problem are you solving and why does it matter?

Chile has a housing crisis. There is a deficit of 650,000 housing units, and one of the primary structural causes is that building permits take an average of **225 days** to be approved — against a legal limit of 30 days. That is a 7.5x overrun, and it adds **9.5–12% to the final price** of every housing unit in the country.

The core bottleneck is not corruption or bad intent — it is **information asymmetry**. Architects submit plans with errors or omissions that violate the OGUC (the national building code) or the municipality's local zoning plan (PRC). The DOM reviewer issues an *Acta de Observaciones* — a list of compliance failures — and the clock resets. This loop repeats an average of **2.3 times per project**, adding months to each cycle.

The problem matters because it is not just a bureaucratic inconvenience: every month of delay costs a developer USD 15,000–50,000 in financing costs, pushes housing prices higher, and deepens a crisis that is locking an entire generation out of homeownership. It is a solvable information problem sitting at the intersection of AI, law, and public policy — and no one has built the solution in Chile or anywhere in Latin America.

### Why Las Condes as the Starting Point

Las Condes is one of the most digitized municipalities in Chile. Its DOM operates with a specialized functional structure (edificación, urbanización, recepción definitiva, inspección, catastro), is fully integrated with the national DOM en Línea platform, and has been selected for MINVU pilot programs involving AI-based normative analysis tools (the "Biblioteca Normativa" initiative). The volume and complexity of projects processed in Las Condes, combined with its standardized forms and digital workflows, make it an ideal "anchor municipality" to design, test, and refine a solution that can later scale to other Chilean DOMs.

### The Regulatory Landscape After Ley 21.718

The recently enacted Ley 21.718 reinforces the urgency and opportunity for this product:

- **Stricter timelines:** 30 days for standard permits, 60 days for large-scale residential projects (≥1,000 occupancy load). Timelines are halved when accompanied by an Independent Reviewer (Revisor Independiente) report.
- **Negative administrative silence (silencio administrativo negativo):** If the DOM does not respond within the legal deadline, the application is considered tacitly rejected, enabling the applicant to escalate to the SEREMI MINVU. This means DOMs now face direct legal risk from delays.
- **Shift toward professional responsibility:** The law moves toward *solidary liability* for architects, independent reviewers, and ITOs, increasing incentives for rigorous pre-submission compliance checks.
- **Declaraciones juradas for minor works:** Certain permits are replaced by sworn technical declarations, shifting review burden from the DOM to the professional market.

These changes create a direct market for a pre-review tool: architects need to submit cleaner files to avoid rejection cycles under tighter deadlines, and DOMs need tools to prioritize and process expedientes within legally binding timeframes.

---

## 2. How do you plan to build with AI?

The product is a **multi-agent pre-review system** that ingests an architect's project parameters and checks them against the OGUC and the municipality's PRC before submission — generating a structured observation report in the same format as a real DOM *Acta de Observaciones*.

### The Four AI Agents

The system has four AI agents orchestrated as a directed graph using **LangGraph**:

| Agent | Role | Tool |
|-------|------|------|
| **Input Parser Agent** | Validates and structures project data (zone, surface, height, constructibility, etc.) from submitted forms | Pydantic (deterministic, no LLM) |
| **Regulatory Retriever Agent** | Queries Supabase pgvector — a vector database of 986 pre-chunked OGUC + PRC articles — using semantic search | LangGraph + Supabase pgvector |
| **Compliance Reasoner Agent** | Reasons over retrieved articles and project parameters to identify violations, citing specific articles | Claude 3.5 Sonnet |
| **Report Generator Agent** | Formats findings into a numbered *Acta de Observaciones* matching the official MINVU template | Claude 3.5 Sonnet |

**What I delegate to AI:** Legal cross-referencing, natural language generation of observation text, semantic search over 986 regulatory chunks, structured output formatting, and memory management across sessions.

**What I build manually:** The chunking pipeline for the OGUC/PRC, the FastAPI backend, the React frontend, and the evaluation framework comparing AI-generated Actas against real ones.

### The Tech Stack

- **LLM:** Claude 3.5 Sonnet (Anthropic API) — best legal reasoning and structured output
- **Agent Orchestration:** LangGraph (Python) — native directed graph with state, streaming, and human-in-the-loop checkpoints
- **Memory & Persistence:** Supabase (PostgreSQL + pgvector) — stores agent state, conversation history, past project runs, and regulatory vectors in one place; LangGraph's native Supabase checkpointer handles this automatically
- **Auth:** Google OAuth via Supabase Auth — architects log in with Google, their project history and past compliance reports persist across sessions
- **Backend:** FastAPI — lightweight, async, LangGraph-compatible
- **Frontend:** React + Vite + Tailwind — generated by Claude Code, lives in the same repo as the backend

**Prototype approach:** Start with a single municipality (Las Condes), a single project type (residential Edificación Nueva), and a single zone (ZHR2). Validate against real Actas de Observaciones collected from public sources. Expand from there.

---

## 3. What do you hope to learn about AI through this project?

Four specific things:

**1. How to productize an AI agent system.** I have built multi-agent pipelines before, but I have never shipped one as a real product — with authentication, persistent user state, a production-grade frontend, and an evaluation framework. The gap between a working agent demo and a product someone actually trusts and uses is enormous. I want to learn what it takes to close that gap: how do you handle errors gracefully, communicate uncertainty to non-technical users, and design a UI that makes an AI agent feel reliable rather than opaque?

**2. How to design and implement memory for AI agents.** Memory is the hardest unsolved problem in production agent systems. For this product, there are three distinct memory layers I need to get right: short-term (the agent's working state within a single compliance run), session-level (what the architect submitted last time, which observations were resolved), and long-term (patterns across hundreds of projects — which violations are most common in which zones, which article combinations appear together). I want to learn how LangGraph's checkpointer and Supabase's persistence layer handle each of these, and where the architecture breaks down at scale.

**3. How to build reliable RAG systems for high-stakes legal reasoning.** The system must retrieve the right regulatory article, reason correctly about whether a specific project parameter violates it, and cite it accurately. Hallucination here has real consequences. I want to learn what retrieval strategies, chunking approaches, and prompt architectures actually work when the cost of being wrong is months of delay for an architect.

**4. How to design human-in-the-loop workflows for a regulated industry.** The AI cannot be the final authority — it is a pre-review tool, not a replacement for the DOM. I want to learn how to design the right handoff points using LangGraph's interrupt mechanism: when does the system pause and require human confirmation, how do you communicate confidence levels to a non-technical user, and how do you build trust incrementally so that users rely on the tool without over-relying on it?

---

# Part II: Domain Context

## 4. Domain Deep-Dive: The Building Permit Flow in Chile

This section documents the complete lifecycle of a building permit in Chile, with specific focus on the DOM of Las Condes. Understanding this flow in detail is essential because the AI agent must mirror the DOM's actual review logic, vocabulary, and document structure. The information below is sourced from OGUC text, LGUC, Ley 21.718, municipal websites, and practitioner guides.

### 4.1 Actors in the Process

**On the project side:**

- **Propietario / Mandante:** The owner of the property or their legal representative. Signs the application, declares ownership, and assumes financial obligations (municipal fees, construction costs).
- **Arquitecto proyectista / patrocinante:** Responsible for architectural design and comprehensive regulatory compliance. Signs plans, specifications, MINVU forms, and compliance declarations. This is the primary user of our product.
- **Ingeniero calculista estructural:** Prepares the structural calculation project and calculation memory. Mandatory participation according to the type and complexity of the work (Art. 5.1.7 OGUC).
- **Ingenieros especialistas (MEP):** Develop mechanical, electrical, plumbing, and HVAC projects and issue certificates required for final reception.
- **Revisor Independiente (RI):** When contracted, issues a favorable report on the project's regulatory compliance. Under Ley 21.718, having an RI halves DOM review timelines.
- **Inspector Técnico de Obra (ITO):** Inspects on-site compliance with technical standards and the approved project.

**On the public side:**

- **Dirección de Obras Municipales (DOM):** Applies LGUC, OGUC, and PRC. Grants permits, inspects execution, and issues final reception certificates. In Las Condes, the DOM operates from Apoquindo 3400 with specialized departments.
- **SEREMI MINVU:** Regional instance for urban complaints and hierarchical review when there is an express rejection or negative administrative silence under Ley 21.718.
- **Utility companies (Aguas Andinas, electrical distributors, gas):** Issue feasibility and service certificates required both for permits and for final reception.

### 4.2 The Eight Phases of the Permit Lifecycle

| Phase | Milestone | Key Actors | Las Condes Support |
|-------|-----------|------------|-------------------|
| 0. Due diligence | Property and regulatory evaluation | Owner, architect | PRC and municipal cadastre consultation (online/in-person) |
| 1. CIP | Certificado de Informaciones Previas | Owner/architect, DOM | Online request and payment; 7-day turnaround |
| 2. Anteproyecto / Revisión Previa | Design feasibility and DOM alignment | Architect, DOM | Ley 21.718 introduces formal Revisión Previa with binding timelines |
| 3. Expediente de Permiso | Complete technical-legal file assembly | Architect, calculista, specialists, RI | MINVU standard forms + digital upload |
| 4. Ingreso y admisibilidad | Formal completeness check | Architect, DOM | Digital intake via DOM en Línea; electronic stamping |
| 5. Revisión técnica y observaciones | Technical review and observation rounds | DOM, architect, RI | Online tracking and response upload via DOM en Línea |
| 6. Otorgamiento del permiso | Permit resolution and plan stamping | DOM, owner | Digital permit issuance; municipal fees (1.5% of construction budget) |
| 7. Construcción e inspecciones | On-site execution and monitoring | Constructor, ITO, DOM | DOM field inspections; Libro de Obras |
| 8. Recepción definitiva | Final certification of compliance | Owner, architect, ITO, RI, DOM | Managed by Las Condes Departamento de Recepción Definitiva |

### 4.3 The CIP: Foundation of the "Constructible Volume"

The Certificado de Informaciones Previas (CIP) is the document that defines the regulatory envelope for any project. Issued by the DOM per Art. 1.4.4 OGUC, it specifies: lot number, official boundary lines, public utility easements, urbanization requirements, permitted land uses, constructibility and ground occupation coefficients, maximum heights, setback distances, densities, parking requirements, and risk zones.

In practice, the CIP defines the "constructible volume" (*cabida*) of the lot and is the normative basis for the project design. In Las Condes, the CIP is requested online with a 7-day turnaround.

**Relevance to our agent:** The CIP parameters are the inputs to our system. The Input Parser Agent validates that the architect's submitted parameters are consistent with what the CIP allows. The Regulatory Retriever uses these parameters to query the correct regulatory articles.

### 4.4 Phase 5 — The Core Bottleneck Our Agent Addresses

Phase 5 (Technical Review and Observations) is where the 225-day average comes from. This is the phase our agent directly targets.

**How it works today:**

1. The DOM reviewer checks the submitted project against LGUC, OGUC, and PRC — specifically: coherence between CIP, PRC, and plans; calculation and application of urban parameters (constructibility, ground occupation, setbacks, shadow angles, density); compliance with safety, habitability, and accessibility standards; and consistency between architecture, structure, and specialties.

2. When violations are found, the DOM issues an *Acta de Observaciones* rather than rejecting the project outright. The applicant has 60 days to address the observations.

3. In practice, **2–3 rounds of observations** are typical for complex projects, with new observations potentially emerging in later rounds. This iterative loop is the primary source of delays.

4. With DOM en Línea, the interaction is now digital: the architect uploads corrected plans, responds point by point, and receives new actas and notifications remotely.

**What our agent does:** It simulates Phase 5 *before submission*. The architect runs their project parameters through the agent, receives a pre-review Acta de Observaciones, fixes the flagged issues, and submits a cleaner file. This reduces the number of DOM observation rounds from 2.3 to ideally 0–1.

### 4.5 The Acta de Observaciones: Our Primary Output

The Acta de Observaciones is a numbered list of regulatory violations or documentation deficiencies found during the DOM's technical review. Each observation typically includes:

- A sequential number
- The specific parameter or aspect under review
- A description of the violation or deficiency
- A citation to the specific OGUC/PRC article being violated
- Sometimes, the expected value vs. the submitted value

Our Report Generator Agent must produce output that matches this structure exactly, so architects can use it as a checklist to fix their project before the real DOM review.

### 4.6 Post-Ley 21.718 Timeline Pressure

The Ley 21.718 introduces legally binding deadlines with real consequences:

| Scenario | DOM Review Deadline | Consequence of Missing Deadline |
|----------|-------------------|---------------------------------|
| Standard permit | 30 days | Negative administrative silence → applicant can escalate to SEREMI MINVU |
| Large-scale residential (≥1,000 occupancy) | 60 days | Same escalation path |
| With Revisor Independiente report | Half of above | Same escalation path |
| Utility feasibility certificates | 10 days | Sanctions for non-compliance |

This creates a dual market opportunity: architects need tools to submit cleaner files (reducing rounds), and DOMs need tools to prioritize and process expedientes within binding timeframes.

### 4.7 The OGUC Art. 5.1.6 Expediente: What Gets Reviewed

For a Permiso de Edificación for obra nueva, the complete expediente per Art. 5.1.6 OGUC includes:

**Legal and administrative documents:**
- Application signed by owner and architect, with list of numbered documents and plans, simple declaration of property ownership, identification of all professionals (architect, calculista, reviewers, ITO), and indication of whether the project includes buildings for public use.
- Valid CIP (or the one used as basis for the anteproyecto) and cadastral plan.
- MINVU/INE Formulario Único de Estadísticas de Edificación (FUE).
- Architect's or independent reviewer's report certifying compliance with all applicable legal, regulatory, and technical standards.

**Feasibility and complementary studies:**
- Water and sewerage feasibility certificate from the sanitary utility company.
- Traffic impact mitigation study (IMIV) receipt or certificate of non-requirement.
- Telecommunications documentation when applicable.

**Architectural plans:**
- Site location plan relative to neighbors and public space.
- Site plan with building footprints, distances to property boundaries, shadow angles (*rasantes*), terrain levels, pedestrian and vehicular access.
- Floor plans for all levels with room designations and sufficient data for surface and occupancy calculations.
- Sections and elevations showing heights, levels, shadow angles, setbacks, and projections.
- Roof plan and enclosure plan if applicable.
- Surface area table and, if applicable, shadow comparison plan per Art. 2.6.11 OGUC.

**Technical complements:**
- Structural calculation project and memory of calculation, including soil mechanics study when required (Art. 5.1.7 OGUC).
- Technical specifications for fire safety, thermal conditioning, acoustic insulation, and relevant materials.
- Elevator documentation when applicable.
- MEP projects (electrical, water/sewerage, gas, HVAC, ventilation, telecommunications).

**Relevance to our agent:** For the prototype, our Input Parser validates a simplified subset of these parameters (zone, surface area, number of floors, max height, constructibility coefficient, occupation coefficient). Future versions could expand to cover the full Art. 5.1.6 checklist.

---

# Part III: System Design

## 5. System Architecture & Design

### 5.1 The Graph Topology: From Pipeline to Agentic Loop

The original design specified a linear four-node chain. Based on architectural review, the system now includes a **conditional retrieval refinement loop** that makes it a genuinely agentic graph:

```
Input Parser → Regulatory Retriever → Compliance Reasoner → [Sufficiency Check]
    ├── If SUFFICIENT → Report Generator → END
    └── If INSUFFICIENT → Query Refiner → Regulatory Retriever (loop, max 2 iterations)
```

**Why this matters:** A single retrieval pass often misses relevant regulatory articles. The OGUC has extensive cross-references between articles (e.g., Art. 2.1.17 references Art. 2.6.3 for parking requirements). A single-pass retriever will not follow these chains. The refinement loop catches these gaps.

#### How the Sufficiency Check Works

The Compliance Reasoner outputs a structured assessment per parameter, not just a compliance verdict:

| Parameter | Verdict | Confidence | Missing Context |
|-----------|---------|------------|-----------------|
| Max Height | VIOLATION | HIGH | None |
| Constructibility | COMPLIANT | HIGH | None |
| Parking | INSUFFICIENT_DATA | LOW | Art. 2.6.3 parking table not found in retrieved chunks |
| Setbacks | VIOLATION | MEDIUM | Cross-reference to municipal overlay zone not retrieved |

A pure Python function (no LLM call) inspects this output:

```python
def should_refine(state: GraphState) -> str:
    insufficient = [p for p in state["assessments"]
                    if p.verdict == "INSUFFICIENT_DATA"]
    if len(insufficient) > 0 and state["retrieval_iterations"] < 2:
        state["refined_queries"] = [p.missing_context for p in insufficient]
        state["retrieval_iterations"] += 1
        return "refine"   # Route back to Retriever
    return "generate"     # Proceed to Report Generator
```

**Key design decisions:**
- **Max 2 retrieval iterations** to prevent infinite loops and keep latency predictable. After 2 passes, any remaining INSUFFICIENT_DATA parameters are forwarded to the Report Generator as explicit gaps.
- **The Query Refiner is not an LLM** — it extracts missing_context strings and reformulates them as new pgvector queries. Fast and deterministic.
- **New chunks are appended, not replaced** — the Reasoner sees all chunks from both passes.
- **The loop is visible in the UI** — status messages like "Retrieving additional regulatory context for parking requirements..." build user trust.

### 5.2 Three-Category Output: Beyond Binary Compliance

Instead of a binary (violation / compliant) output, the system produces three categories:

| Category | Meaning | Action Required | UI Treatment |
|----------|---------|-----------------|-------------|
| **VIOLATION** | Parameter clearly violates a cited article | Architect must fix before submission | Red indicator + cited article |
| **COMPLIANT** | Parameter clearly meets requirements per cited article | No action needed | Green indicator + cited article |
| **NEEDS REVIEW** | System could not determine compliance with sufficient confidence | Human expert must verify manually | Amber indicator + explanation of what is missing |

**Why this changes everything:** The binary design forces the system to always give an answer, which is the root cause of hallucination in compliance systems. NEEDS REVIEW gives the system permission to be honest about its limitations. A report with 6 confident findings and 2 "needs review" items builds far more trust than 8 findings where 2 are subtly wrong.

### 5.3 Embedding Model Validation Protocol

Before committing to an embedding model, run a structured validation on the actual corpus:

**Step A: Create a Validation Query Set (15–20 queries)**

| Query (as the Reasoner would ask) | Expected Chunk(s) | Why It Is Tricky |
|-----------------------------------|--------------------|------------------|
| ¿Cuál es la altura máxima permitida en zona ZHR2? | PRC Las Condes, Tabla ZHR2 (altura) | Query is a question; chunk is a table row |
| Requisitos de estacionamientos para edificación nueva residencial | OGUC Art. 2.4.1 + Art. 2.6.3 | Answer spans two articles with cross-reference |
| Coeficiente de constructibilidad vs ocupación de suelo en ZHR2 | PRC Las Condes, Tabla ZHR2 | Two similar-sounding but distinct concepts |
| Rasante y distanciamiento Art. 2.6.3 OGUC | OGUC Art. 2.6.3 | Technical term "rasante" has no common synonym |

**Step B: Benchmark 2–3 models** — measure Recall@5 and Recall@10 on the validation set:

| Model | Cost/1M tokens | Spanish Legal Quality |
|-------|---------------|-----------------------|
| OpenAI text-embedding-3-small | $0.02 | Good general, test on domain |
| Cohere embed-multilingual-v3 | $0.10 | Strong multilingual |
| Voyage AI voyage-multilingual-2 | $0.12 | Strong multilingual |

**Decision framework:**
- If OpenAI Recall@5 ≥ 80%: use it (cheapest, fastest, sufficient with the refinement loop).
- If OpenAI < 80% but Cohere/Voyage ≥ 80%: use the multilingual model (cost difference is negligible at 986 chunks).
- If all models < 70%: the problem is chunk quality, not the embedding model. Re-examine the OGUC chunks.

### 5.4 Failure Architecture: Three Layers of Graceful Degradation

#### Layer 1: Retriever Guardrails

- **Zero-result guard:** If the Retriever returns 0 chunks for any query, it returns a sentinel object: `{status: "NO_RESULTS", query: "...", attempted_reformulations: [...]}`. The Reasoner receives this explicitly.
- **Low-similarity guard:** If the top chunk has cosine similarity below 0.65, flag as LOW_CONFIDENCE.
- **Chunk integrity check:** Filter out empty or malformed chunks before returning.

#### Layer 2: Reasoner Prompt Rules for Uncertainty

The Reasoner system prompt includes explicit failure instructions:

> **CRITICAL RULES FOR UNCERTAINTY:**
>
> 1. If the retrieved regulatory text does not contain sufficient information to determine compliance for a specific parameter, output verdict: `INSUFFICIENT_DATA`. Never guess.
>
> 2. Every VIOLATION or COMPLIANT verdict MUST cite a specific article number (e.g., "Art. 2.1.17 OGUC") that appears **verbatim** in the retrieved text. If you cannot find the exact article number, output `INSUFFICIENT_DATA`.
>
> 3. If a retrieved chunk appears to contain a corrupted table, note: "Retrieved text for [parameter] appears to contain a corrupted table. Manual verification recommended."
>
> 4. For each parameter, output a confidence field: HIGH (article found and clearly applicable), MEDIUM (article found but interpretation may vary), LOW (article partially relevant or context incomplete).
>
> 5. Never extrapolate from one zone to another. If the question is about ZHR2 and the retrieved text only mentions ZHR1, output `INSUFFICIENT_DATA`.

#### Layer 3: Infrastructure Resilience

- **Supabase connection failures:** Retry with exponential backoff (3 attempts: 1s/2s/4s). User-friendly error message on total failure.
- **Anthropic API rate limits or timeouts:** Retry once; if failed, save partial state via LangGraph checkpointer so the user can resume.
- **Partial graph completion:** The checkpointer saves the last successful node output. Frontend shows which steps completed and which failed.

### 5.5 The Tech Stack (Summary)

| Layer | Technology | Purpose |
|-------|-----------|---------|
| LLM | Claude 3.5 Sonnet (Anthropic API) | Reasoning and generation |
| Agent Orchestration | LangGraph (Python) | Directed graph with conditional edges and checkpointing |
| Backend | FastAPI (Python) | API layer, async |
| Frontend | React + Vite + Tailwind CSS | User interface |
| Database & Auth | Supabase (PostgreSQL + Google OAuth) | Users, projects, runs, observations |
| Vector Store | Supabase pgvector | 986 pre-chunked regulatory articles |
| State Persistence | LangGraph Supabase Checkpointer | Graph state saved per project |

### 5.6 Database Schema

```sql
-- Core tables
users (id, email, created_at)
projects (id, user_id, name, address, parameters_json, status)
compliance_runs (id, project_id, run_date, raw_output)
observations (id, run_id, article_cited, description, status [open/resolved/needs_review], confidence [high/medium/low])
regulatory_chunks (id, source [OGUC/PRC], article_num, content, embedding [vector])
```

### 5.7 API Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/projects` | Create a project |
| POST | `/api/projects/{id}/analyze` | Trigger the LangGraph workflow |
| GET | `/api/projects/{id}/report` | Fetch the generated observations |
| PATCH | `/api/observations/{id}` | Mark an observation as resolved / verified |

### 5.8 Frontend Screens

| Screen | What It Does |
|--------|-------------|
| **Login** | Google OAuth via Supabase — one button |
| **New Project** | Form: project address, zone, use type, key metrics (constructibility, height, surface, parking) |
| **Compliance Report** | Streaming display of observations as they generate; each observation shows the article cited and the specific violation; "Mark as Resolved" button per observation; amber "Needs Review" cards for uncertain items |
| **Project History** | List of past runs with status (Compliant / Observations / Rejected) |

---

# Part IV: Execution Plan

## 6. Execution Roadmap (8 Steps, 12–15 Hours)

### Step 1 — Validate and Fix Regulatory Corpus (1 hour)

**What:** Manually spot-check the 986 OGUC + PRC chunks for the 10–15 most critical articles. Verify that Art. 1.4.9 (Acta procedure), Art. 5.1.17 (permit requirements), and the Las Condes ZHR2 zone table are cleanly chunked and complete. Fix any broken chunks.

**Also:** Run the embedding model validation protocol (Section 5.3). Embed a set of 15–20 validation queries and the corpus with 2–3 candidate models, measure Recall@5 and Recall@10, and select the best performer.

**Why first:** RAG quality is 80% determined by chunk quality. If the chunks are wrong, the agents will hallucinate regardless of how good the prompts are. The embedding decision must be data-driven, not a guess.

**Output:** Validated, corrected `oguc_chunks.jsonl` and `prc_lascondes_chunks.jsonl` ready for Supabase pgvector ingestion. Embedding model selected with benchmark data.

### Step 2 — Define Evaluation Framework (30 min)

**What:** Create a simple eval set using the real Actas you already have. Take the Paine 2019 project parameters, run them through the AI, and compare the AI's observations against the 8 real DOM observations. Define three metrics: (1) did the AI catch the real violations? (recall) (2) did it hallucinate fake violations? (precision / false positive rate) (3) did it cite the correct articles? (citation accuracy)

**Why:** Without this, you cannot know when the prototype is good enough to demo. This is 30 minutes of setup that saves hours of guesswork.

**Output:** `eval/ground_truth.json` with the Paine project parameters and the 8 real observations as expected output.

### Step 3 — Design Agent Prompts and Use Cases (1 hour)

**What:** Write the system prompts for all four agents. Define the exact input/output schema for each. Decide the two use cases the prototype will handle: (1) Edificación Nueva residential in ZHR2 (Las Condes), (2) Ampliación residencial in ZHR2. These two cover 60%+ of real permit submissions.

**Critical:** Incorporate the failure mode instructions from Section 5.4 Layer 2 directly into the Reasoner prompt. The Reasoner must output the three-category assessment (VIOLATION / COMPLIANT / NEEDS REVIEW) with confidence levels.

**Why before building:** If you start coding without finalized prompts, you will refactor constantly. The prompts are the product logic — they should be designed, not improvised.

**Output:** A `prompts/` directory with four system prompt files and an `agent_schemas.py` with Pydantic input/output models.

### Step 4 — Build Supabase Schema (1 hour)

**What:** Set up the Supabase project with: (1) Google OAuth enabled, (2) pgvector extension enabled, (3) the five core tables (users, projects, compliance_runs, observations, regulatory_chunks) with RLS policies, (4) ingest the 986 regulatory chunks into the regulatory_chunks vector table.

**Why:** Everything else depends on this. The LangGraph agents need the vector store to exist before they can query it. Auth needs to be set up before the frontend can protect routes.

**Output:** A running Supabase project with schema, RLS, and populated vector store. A `supabase/schema.sql` file in the repo.

### Step 5 — Build Backend: FastAPI + LangGraph Agents (4–5 hours)

**What:** Build the four-agent LangGraph graph and expose it via two FastAPI endpoints: POST `/api/analyze` (runs the full compliance check) and GET `/api/runs/{run_id}` (retrieves a past run). Implement the conditional retrieval refinement loop (Section 5.1). Implement the retriever guardrails (Section 5.4 Layer 1). Implement LangGraph's Supabase checkpointer for state persistence. Implement infrastructure retry logic.

**Why this is the biggest time block:** This is the core product. The graph state, agent transitions, error handling, and streaming response all live here. The project spec already covers this in detail — Claude Code can scaffold it from that document.

**Output:** A working backend that accepts project parameters, runs the four agents, and returns a structured compliance report. Testable via curl or the eval script.

### Step 6 — Build Frontend: React + Human-in-the-Loop UX (3–4 hours)

**What:** Four screens only — no more: Login, New Project, Compliance Report, Project History. The Compliance Report screen is the core human-in-the-loop interface: streaming display of observations as they generate, each with article citation, a "Mark as Resolved" button, and amber "Needs Review" cards for uncertain items.

**Why this scope:** The human-in-the-loop element is the "Mark as Resolved" button — the architect reviews each observation, marks it resolved when corrected, and resubmits. This is the core product loop and it is achievable in 3–4 hours with Claude Code. There could also be a back-and-forth chat for when the agent doesn't know the answer and the expert can type it in.

**Output:** A working React frontend connected to the FastAPI backend, with Google Auth and streaming agent output.

### Step 7 — Evaluate and Iterate (1–2 hours)

**What:** Run the eval framework against the Paine ground truth. Measure precision, recall, citation accuracy, and hallucination rate. Fix the top 2–3 issues found. Run again.

**Why:** You need at least one evaluation cycle before the demo. Even a single pass will reveal the most obvious prompt failures.

**Key addition:** Run the eval after *every* major change to the Reasoner prompt or retrieval logic, not just at the end. Make `run_eval.py` your constant feedback loop.

**Output:** An eval report showing the prototype's performance on the ground truth set.

### Step 8 — Demo Prep (30 min)

**What:** Prepare the Stepke project (12-floor building, Las Condes ZHR2) as the live demo case. Verify it runs end-to-end. Prepare a 2-minute walkthrough: input parameters → streaming compliance report → one observation marked as resolved.

**Output:** A rehearsed, reproducible demo.

### Time Budget Summary

| Step | Task | Hours |
|------|------|-------|
| 1 | Validate regulatory corpus + embedding validation | 1.0 |
| 2 | Evaluation framework | 0.5 |
| 3 | Agent prompts + use cases | 1.0 |
| 4 | Supabase schema + ingestion | 1.0 |
| 5 | Backend: FastAPI + LangGraph + refinement loop + guardrails | 5.0 |
| 6 | Frontend: React + UX | 3.5 |
| 7 | Evaluate + iterate | 1.5 |
| 8 | Demo prep | 0.5 |
| **Total** | | **14.0** |

---

## 7. Open Questions & Decisions

### Resolved

1. **Embedding model:** Will be selected via the validation protocol in Step 1 (see Section 5.3), not assumed upfront.
2. **Input schema scope:** Limited to Zone, Total Surface, Number of Floors, Max Height, Constructibility Coefficient, and Occupation Coefficient for the prototype.
3. **Streaming:** Wait for graph completion for the prototype to simplify state management; add token-by-token streaming later if time permits.
4. **Input Parser implementation:** Pure Pydantic validation (no LLM call). Saves cost and latency.

### Still Open

1. **Acta de Observaciones template:** Need a concrete example of a real Acta to use as a few-shot example in the Report Generator prompt. If you have real Actas from past projects, they should be incorporated into Step 3.
2. **Rasante (shadow angle) calculation:** This is a geometric calculation, not a text-matching task. The agent may need a code-execution tool or a hardcoded formula rather than pure LLM reasoning for this parameter. To be evaluated during Step 5.
3. **Long-term memory (cross-project patterns):** Out of scope for the prototype, but the database schema should be designed to support future analytics queries (e.g., "most common violations in ZHR2").

---

## Instructions for Claude Code / Claude Cowork

When reading this document to begin work:
1. Acknowledge the constraints (12–15 hours, April 16 deadline).
2. Do not attempt to build the entire system in one prompt.
3. Begin strictly with **Step 1** (Validate Regulatory Corpus + Embedding Validation). Output the validation script and wait for confirmation before moving to Step 2.
4. Always write tests for the LangGraph nodes before wiring them to the FastAPI endpoints.
5. Treat `run_eval.py` as a continuous feedback loop — run it after every major change to the Reasoner.
6. When implementing the Compliance Reasoner, use the three-category output (VIOLATION / COMPLIANT / NEEDS REVIEW) from Day 1. Do not build binary first and refactor later.
7. The retrieval refinement loop (conditional edge) should be implemented as part of Step 5, not as a later add-on.
