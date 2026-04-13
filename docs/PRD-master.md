# DOM Permit Review AI — Master PRD
**Last updated:** April 8, 2026
**Status:** MVP in progress — showcase deadline April 15, 2026
**Pilot municipality:** Las Condes, Santiago

---

## 1. The Problem

Chile has a housing deficit of 650,000 units. Building permits take an average of **225 days** to be approved against a legal limit of 30 days — a 7.5x overrun. This delay adds 9.5–12% to the cost of every housing unit.

The core bottleneck is the **technical review loop** (Phase 5 of the permit process):

1. Architect submits a permit application with errors
2. DOM technical reviewer (Revisor Técnico) manually cross-references hundreds of OGUC/PRC articles
3. Issues an Acta de Observaciones listing violations
4. Architect corrects and resubmits — the clock resets
5. Average: **2.3 rounds** per project

**Ley 21.718** made this worse by cutting review deadlines from 30→15 days (with Revisor Independiente) and adding silencio administrativo negativo liability — if the DOM misses its deadline, the permit is automatically rejected and the municipality can be sued.

**Information asymmetry is the root cause.** Architects don't know which articles they're violating before they submit. Reviewers spend most of their time on lookup, not judgment.

---

## 2. The Solution

An AI-assisted compliance review system for DOM staff — specifically the **Revisor Técnico** role — that:

1. Ingests a permit application's declared parameters
2. Retrieves the applicable normative regulations (OGUC + LGUC + PRC Las Condes)
3. Runs a per-parameter compliance check using Claude
4. Drafts a complete Acta de Observaciones in official MINVU format
5. Presents the draft to the reviewer for human-in-the-loop validation before publication

**Key product principle:** The AI drafts, the human decides. The tool eliminates lookup time — not reviewer judgment.

---

## 3. Users

The product is designed for municipality staff, not architects. The primary user for the MVP is:

### Primary — Revisor Técnico
- Reviews permit applications against OGUC/PRC
- Currently spends 60–70% of time on article lookup
- Pain: deadline pressure from Ley 21.718, high cognitive load, repetitive violations
- Need: instant compliance check, pre-drafted Acta, confidence in citations
- MVP scope: this role only

### Secondary (future roles)
| Role | Module | Key need |
|---|---|---|
| Jefe de Departamento | Dashboard + queue | SLA tracking, bottleneck visibility |
| Director DOM | Executive view | Municipality-level risk |
| Admisibilidad | Intake gate | Document completeness check |
| Inspector Municipal | Field inspections | Construction vs. permit comparison |
| Recepción Definitiva | Final sign-off | Compliance closure tracking |
| Catastro | Land registry | Zone/lot data queries |

Each role sees only their module. The design is a standalone tool (not integrated into existing municipal systems for the MVP).

---

## 3b. User Flows — All 7 DOM Roles

### Role 1: Revisor Técnico — MVP

**Who:** The technical reviewer inside the DOM. Responsible for Phase 5 of the permit lifecycle. Currently spends 60–70% of review time on article lookup and Acta drafting.

**Trigger:** A new expedient appears in the queue after Admisibilidad has accepted it.

**Step-by-step flow:**

1. **Logs in** → sees the queue sorted by deadline (color-coded: red ≤3 days, yellow ≤7 days, green safe).
2. **Selects an expedient** → opens the detail page with 3 tabs: Resumen, Análisis de Cumplimiento, Acta de Observaciones.
3. **Resumen tab:** Sees the property address, zone (e.g. E-Aa1), project type, architect, and the CIP vs. declared parameter table. Immediately identifies which parameters are flagged (over/under/missing).
4. **Clicks "Analizar"** → the AI pipeline runs in the background (≈15–30 sec). A loading indicator shows which agent is active.
5. **Análisis tab:** Sees per-parameter verdicts grouped:
   - **VIOLATION** (red): declared value, allowed value, excess/deficit, exact article cited.
   - **NEEDS_REVIEW** (yellow): expanded automatically — AI could not determine compliance; reviewer must decide.
   - **COMPLIANT** (green): collapsed by default.
6. **Reviews each observation:**
   - **Accept:** Agrees with the AI finding. Observation added to the Acta as-is.
   - **Edit:** Modifies the AI-drafted text. Full text editor with the normative reference pre-filled.
   - **Discard:** Rejects the finding (e.g. AI error). Must select a reason from a predefined list (incorrect article, parameter not applicable, etc.).
7. **Acta tab:** Sees the full draft Acta in MINVU official format — monospace, numbered observations, header with expedient metadata. Pending observations are flagged.
8. **Clicks "Publicar Acta":** If any observations are pending (not accepted, edited, or discarded), the system blocks and shows which are unresolved. Once all are resolved, the Acta is published and locked — no further edits.
9. **Outcome:** The published Acta is stored in Supabase and can be printed or exported. The expedient status changes to "Acta Emitida". The architect receives notification via existing channels (email / DOM en Línea — out of scope for MVP).

**Pain relieved:** Lookup time eliminated. Article citations are AI-generated and pre-validated. Acta text is drafted in correct administrative Spanish. Time per review drops from ~3h to ~30 min.

---

### Role 2: Jefe de Departamento

**Who:** Head of the technical review department. Manages 3–8 Revisores Técnicos. Responsible for SLA compliance under Ley 21.718. Does not do technical reviews personally.

**Trigger:** Daily start-of-day queue monitoring. Weekly report to Director DOM.

**Step-by-step flow:**

1. **Logs in** → sees a department dashboard (not the individual queue).
2. **Summary cards:** Total expedients in progress, count at risk (≤7 days), count critical (≤3 days), count overdue, count approved this week.
3. **Reviewer breakdown:** Table showing each Revisor Técnico, their current load, oldest deadline, and how many expedients are at risk.
4. **Drills into a reviewer:** Sees that reviewer's queue — can view expedient details in read-only mode.
5. **Reassigns:** Can move an expedient from one reviewer to another (e.g. when a reviewer is absent or overloaded).
6. **Escalation:** Flags an expedient as requiring Director attention (e.g. complex project, disputed observation).
7. **Violation patterns:** Sees the most common violation types across the current queue (e.g. "constructibilidad accounts for 34% of all violations this month"). Uses this to brief architects proactively.
8. **Weekly report:** Exports a summary PDF — expedients processed, average review time, SLA compliance rate, violation distribution — for the Director.

**Key screens:** Department dashboard, reviewer workload table, violation analytics panel, export function.

**What the MVP defers:** The Jefe de Departamento module is post-MVP. For the April 15 showcase, this role is represented by the same queue page with a "manager view" note in the demo script.

---

### Role 3: Director DOM

**Who:** The Director of the Dirección de Obras Municipales. Reports to the Alcalde. Has legal liability for SLA compliance under Ley 21.718. Does not review individual expedients.

**Trigger:** Weekly briefing to the Alcalde. Monthly SEREMI reports. Ad-hoc when a project generates public controversy or legal risk.

**Step-by-step flow:**

1. **Logs in** → sees the executive dashboard.
2. **Municipality-level KPIs:**
   - Average review time (days) — current vs. legal limit.
   - SLA compliance rate (% resolved within deadline).
   - Total permits issued vs. pending vs. overdue.
   - Average number of observation rounds per expedient.
3. **Zone risk map:** Visual breakdown of violations by PRC zone (e.g. E-Aa1 has high constructibilidad violation rate — may indicate architects are systematically misreading the PRC).
4. **Trend charts:** Monthly SLA compliance over the past 12 months, showing Ley 21.718 impact.
5. **High-risk alerts:** Expedients approaching silencio administrativo negativo (≤2 days). Requires immediate escalation to reviewer.
6. **Exports:** Generates reports for SEREMI MINVU, Alcalde presentations, and annual municipal management reports.

**What the MVP defers:** Executive dashboard is post-MVP. For the showcase, the Director role is described in the demo script but not built.

---

### Role 4: Admisibilidad

**Who:** The intake officer. Receives expedients from architects via DOM en Línea or in-person. Responsible for Phase 4 — checking that the submitted package is complete before it enters the technical review queue.

**Trigger:** Architect submits a permit application.

**Step-by-step flow:**

1. **Receives the submission** via DOM en Línea or physical delivery.
2. **Opens the intake checklist** — a structured list based on Art. 5.1.6 OGUC (the legal list of required documents for a Permiso de Edificación de Obra Nueva):
   - Solicitud firmada por propietario y arquitecto
   - CIP vigente
   - FUE (Formulario Único de Estadísticas de Edificación)
   - Memoria de cálculo estructural
   - Planos arquitectónicos (emplazamiento, plantas, cortes, elevaciones, techumbre)
   - Cuadro de superficies y cabida normativa
   - Certificado de factibilidad sanitaria
   - Estudio de impacto vial (if required)
   - Informe RI (if present — reduces deadlines by half under Ley 21.718)
3. **Marks each item:** Present / Missing / Deficient.
4. **AI assist (future):** The system pre-checks the uploaded file list against the required checklist and auto-flags missing documents.
5. **Decision:**
   - **Complete:** Stamps the expedient as Admitido. Activates the Ley 21.718 deadline clock. Assigns to the technical review queue.
   - **Incomplete:** Issues a document deficiency list. Returns the package. The deadline clock does NOT start until a complete package is received.
6. **Logs the outcome** in the system with date and officer name.

**What the MVP defers:** Admisibilidad module is post-MVP. For the showcase, the demo expedient is pre-admitted.

---

### Role 5: Inspector Municipal

**Who:** The DOM field inspector. Visits construction sites during Phase 7. Verifies that the building under construction matches the approved permit and plans.

**Trigger:** Scheduled inspection round, or complaint from a neighbor or ITO.

**Step-by-step flow:**

1. **Logs in on mobile** (or tablet) → sees the list of active construction sites assigned to them.
2. **Selects a site** → sees the approved permit, the approved parameters (height, setbacks, lot coverage, floors), and the approved plans.
3. **On-site inspection:**
   - Checks actual height vs. permitted height.
   - Checks setbacks (distanciamiento lateral, fondo) using measuring tools.
   - Checks lot coverage against the approved occupancy coefficient.
   - Checks that construction matches the approved plans (no unapproved additions).
4. **Records findings:**
   - Takes photos linked to the expedient.
   - Enters deviations observed (e.g. "Altura real medida: 19.2 m. Permitido: 15.0 m. Exceso: 4.2 m").
   - Marks the inspection as: Conforme / No Conforme / Observaciones.
5. **Generates an inspection report** — linked to the original permit expedient.
6. **Escalation:** If a major violation is found (e.g. unauthorized structural addition), flags for Director attention and can initiate a paralización de obras order.

**What the MVP defers:** Inspector module is post-MVP. The infrastructure is in place (expedients with approved parameters, Supabase schema).

---

### Role 6: Recepción Definitiva

**Who:** The final reception officer. Manages Phase 8 — verifying that a completed building matches its approved permit and issuing the Certificado de Recepción Definitiva.

**Trigger:** Owner or architect requests final reception.

**Step-by-step flow:**

1. **Receives the reception request** with the required certificates:
   - ITO final report
   - Structural engineer sign-off
   - MEP reception certificates (electrical, sanitary, gas)
   - Ascensor certificate (if applicable)
2. **Links the request to the original permit expedient** — sees the full history: original parameters, all observation rounds, and any modifications.
3. **Verification checklist:**
   - All original observations resolved?
   - All certificates present and valid?
   - Field inspection (by Inspector Municipal) completed with Conforme status?
4. **AI assist (future):** Cross-checks the declared final building area vs. approved area. Flags discrepancies.
5. **Issues the Certificado de Recepción Definitiva** — digitally signed. Linked to the expedient. Closes the permit lifecycle.
6. **Catastro notification:** Sends an automatic update to the Catastro module so the land registry is updated.

**What the MVP defers:** Recepción Definitiva module is post-MVP.

---

### Role 7: Catastro

**Who:** The land registry officer. Maintains the municipality's cadastral database — which parcels exist, their zone classification, and the history of permits and receptions on each parcel.

**Trigger:** Ad-hoc zone and parcel information queries. Automatic updates when permits are issued or receptions are granted.

**Step-by-step flow:**

1. **Searches by parcel:** Input address or rol de avalúo → sees the parcel record.
2. **Zone information:**
   - Current PRC zone (e.g. E-Aa1)
   - Applicable normative parameters (constructibilidad, ocupación, altura, densidad, distanciamientos)
   - Any special conditions (afectación a utilidad pública, zona de conservación histórica, etc.)
3. **Permit history:** All permits issued on the parcel — granted, pending, rejected. Links to each expedient.
4. **AI assist (future):** "What can be built on this parcel?" — natural language query that returns the applicable PRC parameters from the vector store.
5. **Generates zone certificates:** Issues Certificado de Informaciones Previas (CIP) or zona certificate for a parcel, extracting data directly from the PRC database.
6. **Receives updates:** When a permit is granted (Phase 6) or a Recepción Definitiva is issued (Phase 8), the catastro record is automatically updated.

**What the MVP defers:** Catastro module is post-MVP. The PRC data is already parsed and available in the vector store — querying it for Catastro use is a natural extension.

---

### User Flow Coverage Summary

| Role | Phase | MVP | Post-MVP | Core value |
|---|---|---|---|---|
| Revisor Técnico | 5 | **Built** | Enhance multi-round | Eliminate lookup, draft Acta |
| Admisibilidad | 4 | — | Priority 1 | Document completeness check |
| Jefe de Departamento | Cross-cutting | — | Priority 2 | SLA visibility, workload management |
| Inspector Municipal | 7 | — | Priority 3 | Construction vs. permit comparison |
| Recepción Definitiva | 8 | — | Priority 4 | Compliance closure tracking |
| Director DOM | Cross-cutting | — | Priority 5 | Executive KPIs, legal risk view |
| Catastro | 0–1 | — | Priority 6 | Zone queries, CIP generation |

---

## 3c. Multi-Agent Architecture Proposal [FOR REVIEW — not yet built]

> **Status:** This section is a design proposal for review. Nothing in this section is implemented.
> Feedback requested before any code is written.

---

### The framing problem to fix first

The instinct to say "7 roles → 7 agents" is wrong, and building on it would produce a system that is architecturally complex, expensive to run, and mostly AI where it shouldn't be.

Multi-agent means multiple autonomous reasoning units with tool use and loops — not one LLM call per user interface. The right question is: **for which problems does AI reasoning genuinely outperform deterministic code?** Reasoning under ambiguity, extracting structure from unstructured documents, and making judgment calls with incomplete information are AI problems. Checking a database, computing a deadline, generating a report from structured data — those are not.

Applying this to the 7 roles:

---

### Role-by-role AI fit assessment

| Role | Phase | AI type | Verdict | Reasoning |
|---|---|---|---|---|
| Revisor Técnico | 5 | True agent (tool use loop) | **Build** | Compliance reasoning is genuinely ambiguous. Articles conflict. Context matters. Retrieval must be dynamic. |
| Admisibilidad | 4 | Single-step document reader | **Build (limited)** | The checklist is deterministic. The hard part — did this PDF actually contain a structural calculation? — requires Claude Vision. That's one call, not a loop. |
| Catastro | 0–1 | RAG agent | **Build (limited)** | "What can I build on this plot?" is a real NL→regulatory query. Worth building after Admisibilidad. |
| Inspector Municipal | 7 | Vision call | **Defer** | Comparing a photo to a permit requires Claude Vision. But it also requires a mobile client, GPS-tagged photos, and a field workflow. That's a separate product surface. |
| Recepción Definitiva | 8 | Deterministic checklist | **Defer** | Cross-check certificates + confirm Inspector signed off. No AI needed. Python + SQL. |
| Jefe de Departamento | Cross | Analytics dashboard | **No AI** | SLA monitoring, queue metrics, workload balance — these are SQL queries. Building an LLM agent for this would be engineering theater. |
| Director DOM | Cross | Analytics dashboard | **No AI** | Same as Jefe. KPI dashboards don't need LLMs. |

**Bottom line: 3 agents, not 7.** The Jefe and Director modules are dashboards. The Inspector and Recepción modules are either premature or deterministic. Calling any of them "agents" would be misleading.

---

### The 3 real agents

#### Agent 1 — Compliance Reasoner (Phase 5, Revisor Técnico)
**Status: Built.**

A genuine ReAct agent. Claude receives project parameters and normative chunks, calls `retrieve_regulation()` as a tool when context is insufficient, loops until all parameters are evaluated, then emits structured verdicts. The LangGraph graph adds a conditional retry edge at the graph level as a quality gate.

This is the right design. The only meaningful extension post-MVP is multi-round tracking: when an architect resubmits, the agent should compare round 2 against round 1 and identify which observations were resolved, which remain open, and whether new violations were introduced. That requires a new graph node — but not a new agent design.

**HITL interface:** Accept / Edit / Discard per observation before Acta is published. This is correct and should not change.

---

#### Agent 2 — Document Intake Agent (Phase 4, Admisibilidad)
**Status: Not built.**

**What it does:** Given a submitted expedient package (set of uploaded PDFs), determine whether each required document from the Art. 5.1.6 OGUC checklist is present, complete, and matches what was declared.

**Why it needs AI:** The checklist itself is deterministic. What's not deterministic is reading PDF content. An architect might submit a 40-page PDF that contains the structural calculation embedded in section 7. A deterministic tool that checks "is a file named memoria_calculo.pdf present?" would fail. Claude Vision can read the PDFs and determine if they satisfy each requirement.

**What it should NOT do:** Automatically admit or reject the package. That is a formal administrative act that creates legal liability. The agent informs; the Admisibilidad officer decides.

**Tool set:**
- `read_document(file_id)` → extracts text/content via Vision
- `check_requirement(requirement, document_content)` → returns met / unmet / uncertain
- `list_missing(requirements, results)` → deterministic summary

**This is a single-step LLM call, not a loop.** The agent reads all documents once, evaluates each against each requirement, and outputs a structured report. There's no iteration needed because the documents don't change mid-check. Calling this a "ReAct agent" would be misleading — it's a Claude Vision call with structured output.

**HITL interface:**
- Agent output: a table of requirements × documents with a met/unmet/uncertain status per cell
- Officer action: confirm or override each cell, then click "Stamp Admitted" or "Return"
- The override path is critical — the agent will make mistakes (especially with multi-document PDFs), and the officer needs a clear way to correct each finding individually, not just dismiss the whole analysis

**Key risk:** If Claude Vision misclassifies a document (marks a structural calculation as missing when it's present on page 47 of a combined PDF), the architect gets unnecessarily delayed and the DOM loses credibility with the agent. The uncertainty tier (`uncertain`) is important — the agent should surface low-confidence findings for human review rather than forcing a binary decision.

---

#### Agent 3 — Zone Query Agent (Phases 0–1, Catastro)
**Status: Not built.**

**What it does:** Answer natural language queries about what is and isn't permitted on a given parcel in Las Condes, drawing on the PRC vector store.

**Why it needs AI:** The PRC tables are dense and zone-specific. A question like "can I build a 6-story residential building on a plot in E-Ab1?" requires the agent to: (a) retrieve the E-Ab1 zone entry from the PRC, (b) look up the height limit in the correct column, (c) convert floors to meters if needed, and (d) flag any special conditions. A keyword search won't do this reliably.

**Tool set:**
- `retrieve_zone_norms(zone, parameter)` → PRC direct SQL
- `retrieve_oguc_rule(query)` → semantic search
- `compute_compliance(declared_value, limit, direction)` → deterministic arithmetic

**This IS a loop.** The agent may need to retrieve the zone entry, then retrieve a cross-referenced OGUC article, then synthesize both. The tool use pattern is the right design here.

**HITL interface:** Minimal. This is an informational query tool, not a formal administrative decision. The output is advisory — a user reads it and decides what to do. No approval gate needed. Exception: if the Zone Query Agent is used to generate a CIP (Certificado de Informaciones Previas), that IS a formal act and needs sign-off before issuance.

---

### On the orchestrator

**Proposal: no LangGraph orchestrator. Use event-driven routing instead.**

An orchestrator agent (the "supervisor pattern" in LangGraph) makes sense when multiple agents need to coordinate dynamically — when the system must decide at runtime which agent to invoke, agents exchange results, or routing depends on AI judgment.

None of that is true here. The permit lifecycle is sequential. Each phase is triggered by a human event (package submitted → Admisibilidad agent runs; Admisibilidad stamps → Compliance Reasoner queued). The routing is deterministic: event type determines which agent runs. There's no ambiguity that requires LLM reasoning at the routing layer.

What the system needs at the top level is an **event bus**, not an AI orchestrator. The FastAPI routes already function as this. Adding a LangGraph supervisor node on top would be architectural complexity without behavioral benefit — and it would slow down every pipeline with an extra LLM call just to decide what to do next, which is already known from the event type.

**Where an orchestrator becomes worth it:** When you add multi-round support. In round 2, the system needs to decide: re-run the full compliance check, or run a delta check against round 1 findings? That decision depends on how much the architect changed, which parameters were addressed, and whether new violations are likely. That routing judgment is genuinely ambiguous — it's the right place for an orchestrator that reads round 1 state and routes to the appropriate sub-graph.

That's a post-MVP feature. Don't build it yet.

---

### Proposed graph architecture

#### Current graph (Phase 5 — built)

```
START → load_and_parse → retrieve → reason ──[SIN_DATOS > 2]──→ retrieve
                                        └──[otherwise]──────────→ generate → save → END
```

The Compliance Reasoner (`reason` node) is a ReAct agent with `retrieve_regulation` tool use. The conditional edge at the graph level is a coarser quality gate. This is correct.

#### Proposed graph for Phase 4 (Document Intake Agent — not yet built)

```
START → load_documents → analyze_documents → generate_intake_report → save_intake → END
```

No loops. No conditional edges. `analyze_documents` is a single Claude Vision call (possibly batched across multiple documents). The graph is linear because the problem is linear: read → evaluate → report. Adding loop complexity here would be a mistake.

#### Proposed graph for Catastro Query (not yet built)

```
START → parse_query → retrieve_zone_norms → reason_zone → format_response → END
                             ↑                     |
                             └── [need more context]┘
```

Mirrors the Phase 5 graph structure but much simpler: the query is stateless, there's no DB persistence required, and the HITL layer is advisory only.

#### Combined system view (no orchestrator)

```
DOM Event Bus (FastAPI routes)
     │
     ├── "permit submitted"  ─────→ Document Intake Agent graph
     │
     ├── "admitted"          ─────→ Compliance Reasoner graph
     │
     ├── "round 2 submitted" ─────→ Compliance Reasoner graph (new round)
     │
     └── "zone query"        ─────→ Zone Query Agent graph
```

Each graph is independent. Each is triggered by a specific event. They share the same underlying tool infrastructure (retrievers, Supabase) but don't coordinate with each other. The FastAPI layer IS the orchestrator.

---

### What this means for human-in-the-loop design

The HITL interface design has one principle: **the agent reduces decision time, not decision authority**. The officer must always be the one who acts. The agent's job is to make the right action obvious.

| Agent | What AI produces | What human decides | What happens if AI is wrong |
|---|---|---|---|
| Compliance Reasoner | Verdicts + draft observations | Accept / Edit / Discard per observation | Edit path — full text control |
| Document Intake | Requirement × document matrix with confidence | Confirm or override each cell; stamp admitted or return | Override path — per-cell correction |
| Zone Query | Structured answer to NL query | Use the information or not | No formal consequence — advisory only |

The weakest point in the current design is the Document Intake Agent's override path, which doesn't exist yet. For the Compliance Reasoner, the edit path is implemented and works. For the Intake Agent, the override UI needs to be designed carefully — the officer needs to correct at the cell level (this document IS present, despite what Claude said), not just dismiss the whole analysis.

---

### Open questions for review

1. **Scope for post-MVP:** Are Document Intake and Zone Query the right priorities 2 and 3, or should multi-round compliance tracking (round 2 for the Revisor Técnico) be priority 2 instead? Multi-round adds more value to the existing user than a new agent for a new role.

2. **Document Intake as Vision vs. metadata:** Instead of Claude reading full PDF content, could Admisibilidad just check that the right file types were uploaded with the right names? Simpler, faster, cheaper — but less reliable. Worth debating before building.

3. **Zone Query as a user-facing feature:** The Catastro module serves a different user type (potentially even external — architects requesting CIPs). Does it belong in the same product surface as the DOM staff tools, or is it a separate product?

4. **Round 2 design:** When an architect resubmits after receiving an Acta, the system should detect which observations were addressed. This requires comparing round 2 declared values against round 1 violations. Is this a new graph or a new node in the existing Phase 5 graph?

---

## 4. Regulatory Context

### The Three-Layer Hierarchy
```
LGUC (Ley General de Urbanismo y Construcciones — DFL 458/1975)
  National law. Integer articles: Artículo 116°, Artículo 119°.
  Governs: when permits are required, timelines, silencio administrativo.
      ↓
OGUC (Ordenanza General de Urbanismo y Construcciones — Decreto 47/1992)
  National regulation. Decimal articles: Art. 5.1.6, Art. 2.6.1.
  Governs: technical standards, construction requirements, expedient documents.
      ↓
PRC (Plan Regulador Comunal — Las Condes, Texto Refundido Mod. N°11, 2022)
  Local zoning plan. Zone-specific tables.
  Governs: constructibilidad, altura, densidad, distanciamiento per zone.
```

### Las Condes Zone System
The PRC uses codes like **E-Ab1, E-Aa1, E-Am4** (not ZHR1/ZHR2 as early documentation assumed).
- E-Ab = Edificación Aislada Baja (1–4)
- E-Am = Edificación Aislada Media (1, 2, 4)
- E-Aa = Edificación Aislada Alta (1–4)
- E-e = Edificación Especial (1–5)

### Key Articles for the Reviewer
| Article | Law | Topic |
|---|---|---|
| Art. 116° | LGUC | Building permits required |
| Art. 119° | LGUC | Acta de Observaciones process |
| Art. 120° | LGUC | Silencio administrativo (60-day rule) |
| Art. 1.4.9 | OGUC | Observations procedure, 60-day return |
| Art. 5.1.6 | OGUC | Expedient document requirements |
| Art. 2.6.1 | OGUC | Constructibilidad definition |
| Art. 2.6.3 | OGUC | Ocupación de suelo |
| Art. 2.5.6 | OGUC | Rasantes |
| PRC Art. 38 | PRC | Zone-by-zone norms table |
| PRC Art. 15 | PRC | Estacionamientos Las Condes |

---

## 5. The 9-Phase Permit Lifecycle

| Phase | Name | Actor | Our tool |
|---|---|---|---|
| 0 | Due diligence | Architect | — |
| 1 | CIP (Certificado de Informaciones Previas) | Architect → DOM | — |
| 2 | Anteproyecto / Revisión Previa | Architect | — |
| 3 | Expedient preparation | Architect | — |
| 4 | Ingreso y Admisibilidad | Admisibilidad DOM | Future |
| **5** | **Revisión Técnica + Acta de Observaciones** | **Revisor Técnico** | **MVP** |
| 5b | Subsanación (architect corrects) | Architect | — |
| 6 | Permiso de Edificación granted | Director DOM | — |
| 7 | Construction + inspections | Inspector | Future |
| 8 | Recepción Definitiva | Recepción DOM | Future |

**Phase 5 is the bottleneck.** This is where 2.3 rounds of back-and-forth happen on average.

---

## 6. What We Have Built (Completed)

### 6.1 Data Layer — Complete ✅

**924 regulatory chunks** embedded and stored in Supabase pgvector:
- OGUC: 557 chunks (427 pages, Decreto 47/1992)
- LGUC: 183 chunks (124 pages, DFL 458/1975)
- PRC Las Condes: 184 chunks (96 pages, 16 zones)

**41 real Acta de Observaciones examples** extracted from multiple municipalities (Vitacura, Conchalí, Paine, Cabildo, Las Condes, Pucón, Chillán, etc.) — 32 via Claude Vision API from scanned documents.

**Parsers written:**
- `parse_oguc.py` — decimal article regex, 800-token chunking, 7,500-token hard cap
- `parse_lguc.py` — integer article regex (Art. 116°), key procedural articles
- `parse_prc.py` — zone detection from text, hardcoded column order for rotated tables, per-parameter chunks
- `parse_actas.py` — Vision API for scanned PDFs/PNGs, Scribd boilerplate stripping, resume support

### 6.2 Backend API — Complete ✅

**FastAPI** (`apps/api/`) with:

**Agents:**
- `input_parser.py` — deterministic CIP vs. declared comparison, flags ok/over/under/missing
- `compliance_reasoner.py` — Claude claude-sonnet-4-6 with structured JSON output (VIOLATION/COMPLIANT/NEEDS_REVIEW/SIN_DATOS), mandatory article citations
- `report_generator.py` — Claude claude-sonnet-4-6 with few-shot Actas examples, generates official-format Acta text
- `pipeline.py` — orchestrates all 4 agents in sequence, saves results to Supabase

**RAG (retriever.py):**
- Per-parameter hybrid retrieval: PRC via direct SQL metadata query, OGUC/LGUC via pgvector semantic search
- `retrieve_for_compliance_check()` — fetches targeted chunks per parameter across all three sources

**API routes (`/expedients`):**
- `GET /expedients` — queue sorted by deadline
- `GET /expedients/{id}` — detail with project parameters
- `POST /expedients/{id}/analyze` — triggers AI pipeline in background
- `GET /expedients/{id}/compliance` — latest check + observations
- `PATCH /expedients/{id}/observations/{obs_id}` — reviewer accept/edit/discard
- `GET /expedients/{id}/acta` — draft/published Acta
- `POST /expedients/{id}/acta/publish` — publish with pending observation check

**Database schema (Supabase):**
- `users` — DOM staff with role-based access
- `expedients` — permit applications with Ley 21.718 deadline trigger
- `project_parameters` — CIP + declared values per expedient
- `compliance_checks` — one per review round
- `observations` — individual findings with full lifecycle (NUEVA → SUBSANADA/PENDIENTE/REABIERTA)
- `actas` — draft and published Actas
- `regulatory_chunks` — 924 vectors (VECTOR 1536)

### 6.3 Frontend — Complete ✅

**Next.js 14** (`apps/web/`) with:

**Queue page (`/`):**
- Summary cards: total, critical (≤3 days), warning (≤7 days), approved
- Expedient table sorted by deadline with color-coded status

**Expedient detail page (`/expedients/[id]`):**
- 3 tabs: Resumen, Análisis de Cumplimiento, Acta de Observaciones
- CIP vs. declared parameters comparison table
- AI results grouped by verdict (VIOLATION / NEEDS_REVIEW / COMPLIANT)
- Polls compliance status every 3s while pipeline is running

**Components:**
- `observation-card.tsx` — expandable per observation, 3 action modes (accept/edit/discard), NEEDS_REVIEW auto-expanded, discard requires reason from predefined list
- `acta-panel.tsx` — monospace official-format Acta, publish button with pending check

### 6.4 Documentation — Complete ✅

- `docs/research/flujo-permiso-edificacion-las-condes.md` — permit process research, 9-phase lifecycle
- `docs/research/flujo-permisos-diseno-agentes.md` — agent design spec
- `docs/architecture/system-architecture.md` — full system architecture
- `docs/architecture/data-architecture.md` — complete data pipeline documentation

### 6.5 Tech Stack — Deployed Locally ✅

| Layer | Technology | Status |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Running on localhost:3000 |
| Backend | FastAPI + Python 3.11 | Running on localhost:8000 |
| Database | Supabase (PostgreSQL + pgvector) | Live, 924 chunks ingested |
| LLM | Claude claude-sonnet-4-6 (Anthropic) | Connected |
| Embeddings | text-embedding-3-small (OpenAI) | Connected |
| Version control | GitHub (maynenichollsnicolas/dom-permit-review) | Connected |

---

## 7. Demo Data (for Showcase)

**Expedient 2024-0847** — Av. Apoquindo 4521, Las Condes
- Zone: E-Aa1 (Edificación Aislada Alta)
- Project type: Obra Nueva Residencial
- Architect: Arq. Carlos Reyes / Inmobiliaria Apoquindo S.A.
- Admitted: 2 days ago (deadline in 28 days)

**Deliberate violations built in:**

| Parameter | CIP (allowed) | Declared | Status |
|---|---|---|---|
| Constructibilidad | 1.0 | 1.72 | VIOLATION (+0.72) |
| Ocupación de suelo | 0.4 | 0.61 | VIOLATION (+0.21) |
| Altura máxima | 10.5 m | 18.5 m | VIOLATION (+8.0 m) |
| Densidad | 20 hab/há | 312 hab/há | VIOLATION (+292) |
| Estacionamientos | 1.0/unidad | 0.8/unidad | VIOLATION (−0.2) |
| Distanciamiento lateral | 6.0 m | 3.0 m | VIOLATION (−3.0 m) |

**Pipeline result:** 6 VIOLATION, 2 NEEDS_REVIEW, 0 COMPLIANT.

---

## 8. Next Steps (to April 15)

### Priority 1 — Test and Fix the Live UI
- [ ] Confirm the full flow works in the browser: queue → detail → Analizar → results → Acta
- [ ] Fix any UI issues that appear (API calls, loading states, error handling)
- [ ] Confirm the Acta text generated by Claude matches MINVU Formulario 5.12 format

### Priority 2 — Deploy Online
- [ ] Deploy API to **Railway** (FastAPI + Python)
  - Add `railway.toml` or `Procfile`: `uvicorn main:app --host 0.0.0.0 --port $PORT`
  - Set env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY
- [ ] Deploy frontend to **Vercel** (Next.js)
  - Set env var: NEXT_PUBLIC_API_URL pointing to Railway URL
- [ ] Update CORS in `main.py` to allow the Vercel domain

### Priority 3 — Polish for Showcase
- [ ] Add a second expedient to the demo (compliant project to show contrast)
- [ ] Add loading skeletons to the frontend while AI pipeline runs
- [ ] Test with a real expedient data set if available
- [ ] Prepare a 5-minute live demo walkthrough

### Priority 4 — Known Gaps (post-April 15)
- [ ] **Multi-round tracking**: When an architect resubmits, create a new compliance check (round 2) and compare which observations were resolved vs. reopened
- [ ] **Admisibilidad module**: document completeness check before Phase 5
- [ ] **Las Condes Actas OCR**: the scanned PNG files from Las Condes (lascondes_page*.png) are SEREMI reclamation documents, not actual DOM Actas — need real Las Condes Actas
- [ ] **Additional zones**: the PRC parser missed some zones (E-Ab2-B/C/D, E-Ab4 appears twice, E-Aa2/3/4 partially). A manual review of prc-chunks.json against the PRC document is needed
- [ ] **PRMS integration**: Plan Regulador Metropolitano de Santiago — referenced in some PRC articles but not yet parsed
- [ ] **Authentication**: Supabase Auth for real DOM staff login
- [ ] **Other municipalities**: the zone parser and ingest pipeline are municipality-agnostic; adding a new PRC is a new PDF + one parse run

---

## 9. File Structure

```
DSAILProject/
├── apps/
│   ├── api/                          # FastAPI backend
│   │   ├── agents/
│   │   │   ├── input_parser.py       # Deterministic CIP vs declared
│   │   │   ├── compliance_reasoner.py # Claude compliance check
│   │   │   ├── report_generator.py   # Claude Acta draft
│   │   │   └── pipeline.py           # 4-agent orchestration
│   │   ├── rag/
│   │   │   └── retriever.py          # Hybrid PRC+OGUC+LGUC retrieval
│   │   ├── api/routes/
│   │   │   └── expedients.py         # All REST endpoints
│   │   ├── db/
│   │   │   ├── migrations/001_initial.sql
│   │   │   └── models.py
│   │   ├── scripts/
│   │   │   ├── parse_oguc.py         # OGUC PDF → chunks
│   │   │   ├── parse_lguc.py         # LGUC PDF → chunks
│   │   │   ├── parse_prc.py          # PRC PDF → zone chunks
│   │   │   ├── parse_actas.py        # Actas → examples (Vision)
│   │   │   └── ingest_data.py        # Embed + upsert to Supabase
│   │   ├── config.py
│   │   └── main.py
│   └── web/                          # Next.js 14 frontend
│       ├── app/
│       │   ├── page.tsx              # Queue / dashboard
│       │   └── expedients/[id]/page.tsx # Detail + analysis
│       ├── components/
│       │   ├── observation-card.tsx
│       │   └── acta-panel.tsx
│       └── lib/
│           ├── api.ts                # TypeScript API client
│           └── utils.ts
├── data/
│   ├── raw/
│   │   ├── oguc/OGUC.pdf            # Decreto 47/1992 (427 pages)
│   │   ├── lguc/LGUC.pdf            # DFL 458/1975 (124 pages)
│   │   ├── prc/                     # Las Condes PRC documents
│   │   └── actas/                   # Real Actas from multiple municipalities
│   ├── processed/
│   │   ├── oguc-chunks.json         # 557 chunks
│   │   ├── lguc-chunks.json         # 183 chunks
│   │   ├── prc-chunks.json          # 184 chunks (16 zones)
│   │   └── actas-examples.json      # 41 real Acta examples
│   ├── oguc/key-articles.json       # Seed fallback (deprecated)
│   └── prc/zhr2.json                # Seed fallback (deprecated — wrong zone names)
└── docs/
    ├── PRD-master.md                 # This document
    ├── research/
    │   ├── flujo-permiso-edificacion-las-condes.md
    │   └── flujo-permisos-diseno-agentes.md
    └── architecture/
        ├── system-architecture.md
        └── data-architecture.md
```

---

## 10. Architecture Summary

```
Browser (Next.js 14)
    ↕ REST
FastAPI (Python 3.11)
    ├── Input Parser          ← deterministic, no AI
    ├── Regulatory Retriever  ← pgvector (Supabase)
    │     PRC: direct SQL metadata query (zone + parameter_type)
    │     OGUC/LGUC: cosine similarity vector search
    ├── Compliance Reasoner   ← Claude claude-sonnet-4-6
    └── Report Generator      ← Claude claude-sonnet-4-6 + few-shot examples
    ↕
Supabase (PostgreSQL + pgvector)
    ├── regulatory_chunks (924 vectors, 1536 dims)
    ├── expedients + project_parameters
    ├── compliance_checks + observations
    └── actas
```

---

## 11. Key Decisions Log

| Decision | Rationale |
|---|---|
| pgvector over Pinecone/Weaviate | Co-location with operational DB, hybrid SQL+vector queries, one infrastructure provider |
| text-embedding-3-small over large | Domain-specific legal text — larger dimensions don't improve retrieval; lower cost for re-embedding |
| Per-parameter retrieval over single query | PRC data is exact (SQL), OGUC is semantic; mixing strategies improves accuracy |
| Separate OGUC and LGUC | Different laws, different article numbering, different citation format in Actas |
| Claude for reasoning, not retrieval | Retrieval is deterministic/vectorial; reasoning requires understanding of legal context |
| Human-in-the-loop before publish | Legal liability — the reviewer must own every observation that goes into the official Acta |
| Revisor Técnico as first user | Highest pain point, highest value, clearest workflow — expand to other roles after |
| Las Condes as pilot municipality | ZHR/PRC structure is complex and representative; validates the approach before scaling |
