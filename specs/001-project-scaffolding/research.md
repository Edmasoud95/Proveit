# Research: Project Scaffolding

**Feature**: 001-project-scaffolding
**Date**: 2026-05-26

## R1: Monorepo Tooling

**Decision**: pnpm workspaces

**Rationale**: pnpm is faster than npm workspaces, uses less disk via hardlinks, and has mature workspace support. No need for Turborepo/Nx overhead for a two-package repo. The `workspace:*` protocol handles cross-package references cleanly.

**Alternatives considered**:
- npm workspaces: Viable but slower installs, no hardlinks
- Turborepo: Overkill for 3 packages, adds config complexity
- Nx: Heavy, designed for large monorepos with many packages

## R2: Frontend Build Tool

**Decision**: Vite

**Rationale**: Fast dev server with HMR, native ESM, minimal config for React+TypeScript. Produces optimized production builds. The ecosystem standard for new React projects.

**Alternatives considered**:
- Create React App: Deprecated/unmaintained
- Next.js: SSR/SSG unnecessary for a local-first single-page app
- Webpack: Slower, more config, no compelling advantage

## R3: LLM Integration Pattern

**Decision**: OpenAI Node.js SDK with configurable base URL

**Rationale**: The OpenAI SDK supports `baseURL` override, making it compatible with LM Studio, Ollama, Groq, and any OpenAI-compatible endpoint. One SDK covers all providers. Constitution mandates OpenAI-compatible only.

**Alternatives considered**:
- LangChain: Heavy dependency, abstractions add complexity without value for direct API calls
- Custom HTTP client: Re-invents what the SDK already handles (streaming, retries, types)
- Vercel AI SDK: Adds unnecessary abstraction layer for our use case

## R4: LLM-as-Judge Implementation

**Decision**: Structured judge prompt with JSON-schema scoring output

**Rationale**: The judge LLM receives the eval case input, the POC's response, and a scoring rubric. It returns a structured JSON with pass/fail, score (0-10), and reasoning. Using the same OpenAI SDK with `response_format: { type: "json_object" }` ensures parseable output.

**Alternatives considered**:
- Free-text judge responses parsed with regex: Brittle, inconsistent
- Numeric-only scoring: Loses the reasoning that makes results actionable
- External eval frameworks (promptfoo, etc.): Adds dependency, hides config — violates "never hide the config" principle

## R5: Real-Time Eval Streaming

**Decision**: Server-Sent Events (SSE)

**Rationale**: SSE is simpler than WebSockets for unidirectional server→client streaming. NestJS supports SSE natively via `@Sse()` decorator. Frontend uses EventSource API. Perfect for streaming per-case eval results as they complete.

**Alternatives considered**:
- WebSockets: Bidirectional not needed, more complex setup and reconnection handling
- Polling: Violates "immediate feedback" principle, wastes resources
- Long polling: Complex to implement correctly, SSE is strictly better here

## R6: POC Scaffolding Strategy

**Decision**: Backend service calls connected LLM with a structured scaffolding prompt, returns JSON config

**Rationale**: The scaffold service sends the user's workflow description to the LLM with a system prompt that defines the POC config schema. The LLM returns a complete config (system prompt, tools, eval cases). This keeps scaffolding swappable per constitution.

**Alternatives considered**:
- Template-based generation (no LLM): Too rigid, can't handle arbitrary workflow descriptions
- Multi-step generation (prompt → tools → evals separately): Slower, loses context between steps
- Client-side generation: Violates "frontend never calls LLMs directly"

## R7: Testing Strategy

**Decision**: Vitest for unit/integration, Playwright for e2e

**Rationale**: Vitest is fast, TypeScript-native, compatible with Vite's config. Works for both backend (NestJS modules) and frontend (React components). Playwright handles browser-based e2e testing for the full user flow.

**Alternatives considered**:
- Jest: Slower, requires more config for ESM/TypeScript
- Cypress: Heavier, Playwright has better DX and speed
- Testing Library only: Insufficient for full integration testing

## R8: State Management (Frontend)

**Decision**: React Query (TanStack Query) for server state, React Context for UI state

**Rationale**: React Query handles API caching, refetching, optimistic updates — exactly what a CRUD app with real-time updates needs. Minimal UI state (active page, modal open) handled by context. No Redux/Zustand needed.

**Alternatives considered**:
- Redux: Boilerplate-heavy for simple CRUD + real-time
- Zustand: Viable but unnecessary when React Query handles server state
- No state library: Would re-invent caching and synchronization logic
