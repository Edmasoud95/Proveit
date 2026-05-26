# Proveit Constitution

A sandbox platform for creating and testing agent workflow POCs against local and external LLMs.

Target user: developers who want to validate an agent idea quickly — no infrastructure setup, minimal overhead.

## Core Principles

### I. Speed Over Completeness
A POC that runs beats a perfect one that doesn't.

### II. AI-Assisted Not AI-Replaced
Scaffold then let the user edit, never hide the config.

### III. Local-First
Default to local LLMs, but support any OpenAI-compatible endpoint including external providers (OpenAI, Anthropic via proxy, Groq, etc.) via API key configuration.

### IV. Portable Configs
A POC is a JSON file, always exportable and human-readable.

### V. Minimal Dependencies
Resist adding packages; prefer simple over clever.

### VI. UI/UX First
The platform is only as good as how fast a user can move through it; every screen should require zero explanation.

### VII. Progressive Disclosure
Show simple by default, reveal complexity only when the user asks for it.

### VIII. Immediate Feedback
Every action (scaffold, run evals, connect LLM) should show visible progress; no blind waits.

### IX. Opinionated Defaults
Make the happy path obvious; advanced config is secondary, never blocking.

## Core Loop

1. Describe your workflow in plain text
2. Platform scaffolds a POC — system prompt, tools, eval cases
3. User reviews and edits the generated config in the UI
4. Connect a local or external LLM (LM Studio, Ollama, OpenAI, Groq, or any OpenAI-compatible endpoint)
5. Run evals — upload your own as JSON or generate them via AI
6. Get scored results with pass/fail reasoning per case (LLM-as-judge)

## Tech Stack

- Backend: TypeScript / NestJS
- Frontend: TypeScript / React / Tailwind
- Storage: SQLite via Prisma
- Monorepo: single repo, backend and frontend as separate packages
- LLM integration: OpenAI Node.js SDK (OpenAI-compatible, works for local and external)
- Evals: LLM-as-judge scoring, no hardcoded expected outputs
- UI component approach: hand-crafted Tailwind components over heavy libraries — keeps the UI fast, consistent, and fully controllable
- Motion and feedback: subtle transitions and loading states are not polish, they are part of the UX contract

## Architecture Boundaries

- POC config is the central data model — everything reads from and writes to it
- Scaffolding agent and eval generation agent are isolated services, swappable
- Frontend never calls LLMs directly — always via backend

## Out of Scope (v1)

- Auth / multi-user
- Trace ingestion
- Cloud deployment of POCs
- Non-OpenAI-compatible LLM APIs

## Governance

This constitution defines the product identity and technical guardrails. All implementation decisions should align with these principles. Amendments require explicit discussion.

**Version**: 1.0.0 | **Ratified**: 2026-05-26 | **Last Amended**: 2026-05-26
