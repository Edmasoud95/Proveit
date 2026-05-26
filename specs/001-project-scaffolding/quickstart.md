# Quickstart: Proveit

## Prerequisites

- Node.js 20+
- pnpm 9+
- A local LLM running (LM Studio or Ollama) OR an external API key (OpenAI, Groq)

## Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client + run migrations
pnpm --filter backend db:setup

# Start development (backend + frontend concurrently)
pnpm dev
```

Backend runs on `http://localhost:3000`, frontend on `http://localhost:5173`.

## First POC

1. Open `http://localhost:5173`
2. Click "New POC"
3. Type a workflow description: e.g., "A customer support agent that answers questions about a product using a knowledge base"
4. Wait for scaffolding (~10-30s depending on LLM)
5. Review the generated system prompt, tools, and eval cases
6. Connect your LLM (Settings → LLM Connection → enter endpoint URL)
7. Click "Run Evals" to see scored results

## Package Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start backend + frontend in dev mode |
| `pnpm --filter backend dev` | Start only backend |
| `pnpm --filter frontend dev` | Start only frontend |
| `pnpm --filter backend db:setup` | Generate Prisma client + migrate |
| `pnpm --filter backend db:migrate` | Run pending migrations |
| `pnpm --filter backend db:studio` | Open Prisma Studio |
| `pnpm test` | Run all tests |
| `pnpm --filter backend test` | Run backend tests |
| `pnpm --filter frontend test` | Run frontend tests |
| `pnpm lint` | Lint all packages |
| `pnpm build` | Build all packages for production |

## Project Layout

```
packages/
├── backend/     # NestJS API server
├── frontend/    # React + Vite + Tailwind
└── shared/      # Shared TypeScript types
```

## Local LLM Setup

**LM Studio**: Start LM Studio → Load a model → Enable "Local Server" (defaults to `http://localhost:1234/v1`)

**Ollama**: `ollama serve` → defaults to `http://localhost:11434/v1`

Both expose OpenAI-compatible endpoints. Use these URLs in the LLM Connection screen.
