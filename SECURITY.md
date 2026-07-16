# Security Policy

## Threat model: local-first, single-user

Proveit is a **local development sandbox**. It is designed to run on `localhost`
for a single user and makes deliberate trade-offs that are only safe in that
setting:

- **No authentication.** Every API endpoint is open to whoever can reach the
  port. The server binds to all interfaces by default — do not expose port
  3000 (or the Vite dev port) beyond your machine or trusted network.
- **LLM API keys are stored in plaintext** in the local SQLite database
  (`packages/backend/prisma/dev.db`). The database file is gitignored and keys
  are never returned by the API or persisted in browser storage, but anyone
  with read access to the file can extract them. Treat the DB like a
  credentials file. If you need at-rest encryption or multi-user isolation,
  this tool is not that — front it with your own infrastructure.
- **Private/LAN endpoint URLs are intentionally allowed.** Connecting to LM
  Studio or Ollama on `localhost` or a LAN host is the primary use case, so
  the endpoint-URL validation only enforces `http(s)://` and blocks cloud
  instance-metadata hosts (`169.254.169.254`, `metadata.google.internal`).
  A hosted deployment would need real SSRF protection (private-range blocking,
  an egress proxy, or an allowlist).

## Hardening that is in place

- Strict request validation on every endpoint (`class-validator`, whitelist +
  reject-unknown-fields).
- 1 MB request body cap; malformed JSON is rejected.
- `helmet` security headers; CORS restricted to `http://localhost:*`.
- Eval-run SSE streams are scoped to their POC.
- API keys are stripped from all API responses and never written to browser
  storage.

## Known dependency advisories

`pnpm audit` is clean apart from three **moderate**, **dev-or-unused-path**
advisories that require breaking upstream majors:

| Package | Why it remains |
|---|---|
| `@nestjs/core` (< 11.1.18) | Fix requires NestJS 11 major upgrade. |
| `file-type` (via `@nestjs/common`, 2 advisories) | Fixed versions are ESM-only and incompatible with NestJS 10; only used for file-upload magic-number sniffing, and this app has no file uploads. |

Transitive vulnerabilities elsewhere are patched via scoped `overrides` in
`pnpm-workspace.yaml`.

## Reporting a vulnerability

Email **hello@theo1.space** with a description and reproduction steps. Please
do not open a public issue for anything sensitive.
