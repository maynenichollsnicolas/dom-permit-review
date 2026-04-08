# DSAIL Project Master Specification: AI Building Permit Pre-Review Agent

**Context:** This document is the master specification for a university project (DSAIL) to be completed by April 16th. The goal is to build a working prototype of an AI agent system that pre-reviews building permit applications in Chile against the national building code (OGUC) and local zoning plans (PRC), generating a structured observation report (*Acta de Observaciones*).

**Execution Model:** This project will be built using **Claude Code** (for local scaffolding and backend/frontend generation) and **Claude Cowork** (for agent orchestration and reasoning). The total time budget is 12–15 hours.

---

## Part 1: The Core Problem & Pitch (For Context)

### 1. What problem are you solving and why does it matter?
Chile has a housing crisis with a deficit of 650,000 units. A primary structural cause is that building permits take an average of 225 days to be approved (vs. a 30-day legal limit). This 7.5x overrun adds 9.5–12% to the final price of every housing unit. The core bottleneck is information asymmetry: architects submit plans with errors violating the OGUC or PRC, the DOM (municipal works directorate) issues an *Acta de Observaciones*, and the clock resets. This loop repeats an average of 2.3 times per project. Solving this information problem at the pre-submission stage can compress timelines by months.

### 2. How do you plan to build with AI?
The product is a multi-agent pre-review system orchestrated via **LangGraph**. It ingests project parameters, queries a **Supabase pgvector** database containing 986 pre-chunked regulatory articles (OGUC + PRC), reasons about compliance using **Claude 3.5 Sonnet**, and generates a structured *Acta de Observaciones*. The stack is entirely local (FastAPI + React/Vite) except for Supabase (Auth + DB + Vector Store).

### 3. What do you hope to learn about AI through this project?
1. **Productizing AI:** Moving from a raw agent script to a product with auth, persistent state, and a human-in-the-loop UI.
2. **Memory Architecture:** Managing short-term (agent state), session-level (project history), and long-term memory using LangGraph's Supabase checkpointer.
3. **High-Stakes RAG:** Building reliable retrieval and reasoning for legal compliance where hallucination has severe real-world costs.
4. **Human-in-the-Loop Design:** Designing the right handoff points (e.g., "Mark as Resolved" workflows) to build trust without over-reliance.

---

## Part 2: System Architecture & Tech Stack

### The Stack
- **LLM:** Claude 3.5 Sonnet (via Anthropic API)
- **Agent Orchestration:** LangGraph (Python)
- **Backend:** FastAPI (Python)
- **Frontend:** React + Vite + Tailwind CSS
- **Database & Auth:** Supabase (PostgreSQL)
- **Vector Store:** Supabase pgvector
- **State Persistence:** LangGraph Supabase Checkpointer

### The Agent Graph (LangGraph)
The system is a directed graph with four nodes (agents) and a shared state object:

1. **Input Parser Node:** Validates incoming JSON project parameters (zone, surface, height, etc.) against expected schemas.
2. **Regulatory Retriever Node:** Takes the parsed parameters, generates search queries, and retrieves relevant chunks from Supabase pgvector (e.g., "What is the maximum height for zone ZHR2?").
3. **Compliance Reasoner Node:** Compares the project parameters against the retrieved regulatory text. Identifies violations and cites the specific article.
4. **Report Generator Node:** Formats the violations into a structured *Acta de Observaciones* matching the official MINVU template.

---

## Part 3: The Execution Plan (12-15 Hours)

This is the exact sequence of tasks to be executed by the human developer paired with Claude Code/Cowork.

### Phase 1: Foundation (Hours 1-3)

**Task 1.1: Supabase Setup & Schema**
- Create a new Supabase project.
- Enable Google OAuth.
- Enable the `pgvector` extension.
- **Action for Claude Code:** Write and execute the `supabase/schema.sql` to create the following tables:
  - `users` (id, email, created_at)
  - `projects` (id, user_id, name, address, parameters_json, status)
  - `compliance_runs` (id, project_id, run_date, raw_output)
  - `observations` (id, run_id, article_cited, description, status [open/resolved])
  - `regulatory_chunks` (id, source [OGUC/PRC], article_num, content, embedding [vector])

**Task 1.2: Regulatory Corpus Ingestion**
- The project already has `oguc_chunks.jsonl` and `prc_lascondes_chunks.jsonl` (986 chunks total).
- **Action for Claude Code:** Write a Python script (`scripts/ingest_vectors.py`) that reads these JSONL files, generates embeddings using OpenAI `text-embedding-3-small` (or Anthropic equivalent if preferred), and inserts them into the Supabase `regulatory_chunks` table.

**Task 1.3: Evaluation Framework Setup**
- **Action for Claude Code:** Create `eval/ground_truth.json` containing the parameters of the "Paine 2019" real-world project and its 8 known DOM observations. Write a simple evaluation script (`scripts/run_eval.py`) that will later compare agent output against this ground truth.

### Phase 2: Core Agent Logic (Hours 4-8)

**Task 2.1: LangGraph State & Models**
- **Action for Claude Code:** Define the `TypedDict` state object for the graph in `backend/app/graph/state.py`. Define Pydantic models for the input parameters and the final output report.

**Task 2.2: Agent Nodes**
- **Action for Claude Code:** Implement the four nodes in `backend/app/graph/nodes/`.
  - Write the system prompts for the Reasoner and Generator nodes. The Reasoner prompt MUST instruct the LLM to strictly cite the retrieved text and output "COMPLIANT" if no violation is found.
  - Implement the pgvector similarity search in the Retriever node.

**Task 2.3: Graph Compilation & Persistence**
- **Action for Claude Code:** Wire the nodes together in `backend/app/graph/workflow.py`. Configure the LangGraph Supabase checkpointer so that the graph state is saved to the database after every run, keyed by `project_id`.

### Phase 3: API & Frontend (Hours 9-13)

**Task 3.1: FastAPI Backend**
- **Action for Claude Code:** Build `backend/app/main.py` with endpoints:
  - `POST /api/projects` (Create a project)
  - `POST /api/projects/{id}/analyze` (Trigger the LangGraph workflow)
  - `GET /api/projects/{id}/report` (Fetch the generated observations)
  - `PATCH /api/observations/{id}` (Mark an observation as resolved)

**Task 3.2: React Frontend Scaffolding**
- **Action for Claude Code:** Initialize a Vite/React/Tailwind app in `frontend/`. Set up Supabase Auth context provider for Google login.

**Task 3.3: UI Implementation**
- **Action for Claude Code:** Build three core screens:
  1. **Dashboard:** List of user's projects.
  2. **Project Input Form:** Form to input parameters (Zone, Surface Area, Height, Constructibility Coefficient, etc.).
  3. **Compliance Report View:** The human-in-the-loop interface. Displays the generated *Acta de Observaciones*. Each observation must have a "Mark as Resolved" button.

### Phase 4: Testing & Demo Prep (Hours 14-15)

**Task 4.1: End-to-End Testing**
- Run the "Stepke" test case (12-floor building, Las Condes ZHR2) through the UI.
- Verify the graph executes, retrieves the correct PRC rules, and generates the report.

**Task 4.2: Evaluation Run**
- Run `scripts/run_eval.py` against the Paine ground truth. Note precision and hallucination rates. Tweak the Reasoner prompt if necessary.

---

## Part 4: Open Questions & Decisions to Finalize

Before executing Phase 1, the following questions must be answered:

1. **Embedding Model:** Which embedding model will be used for pgvector? (Recommendation: OpenAI `text-embedding-3-small` is cheapest and fastest, but requires an OpenAI key. If strictly Anthropic, use Voyage AI or a local HuggingFace model).
2. **Input Schema Scope:** The OGUC is vast. For the prototype, what exact fields will the input form accept? (Recommendation: Limit to Zone, Total Surface, Number of Floors, Max Height, Constructibility Coefficient, and Occupation Coefficient).
3. **Streaming:** Will the LangGraph output stream to the frontend token-by-token, or wait for the full graph to complete and return a JSON block? (Recommendation: Wait for completion for the prototype to simplify state management, add streaming later if time permits).

---

## Instructions for Claude Code / Claude Cowork

When reading this document to begin work:
1. Acknowledge the constraints (12-15 hours, April 16 deadline).
2. Do not attempt to build the entire system in one prompt.
3. Begin strictly with **Phase 1, Task 1.1** (Supabase Schema). Output the SQL and wait for confirmation before moving to Task 1.2.
4. Always write tests for the LangGraph nodes before wiring them to the FastAPI endpoints.
