# Changelog

All notable changes are recorded here at phase level. The README is the source of truth for behavior and architecture.

## [1.0.0] — 2026-10-19

### Phase 0 — Foundation and provider abstraction
- Next.js 15 App Router, TypeScript, Tailwind, local Geist fonts.
- Nine provider entries (8 presets + Custom) with capability metadata, default models, key requirements, and Direct Mode support.
- `lib/llm.ts` provider-agnostic wrapper with JSON-mode gating, one corrective retry, bounded transport retries, and metadata-only logging.
- AES-GCM + PBKDF2 key vault in IndexedDB via localForage.
- Settings page with masked key, capability badges, base URL/model auto-fill, connectivity test, key deletion, routing mode, and budget ceiling.
- Honest stateless-proxy and Direct Mode notices.

### Phase 1 — Critic engine
- Four critics with explicit rubrics and per-dimension weights.
- Two few-shot anchors per critic in `agents/fewshot/`, with evidence integrity tests.
- Zod schemas per critic, deterministic probability recomputation, and typed failures.
- Grounding check with one corrective retry and explicit `null` handling.
- CLI critic harness for three fixture classes and two provider capability profiles.

### Phase 2 — Orchestrator and deterministic aggregator
- `Promise.allSettled` critic execution with partial-failure tolerance.
- Deterministic risk score, level bands, contribution ledger, and coverage.
- Single LLM call for summary and top failures, isolated from score availability.
- Stateless API actions: `chat`, `ping`, and server-run `analyze`.
- 30s per-call timeout, 120s pipeline deadline, 429/5xx backoff, 24h critic cache.
- Conflict detection and selected-fix resolution.

### Phase 3 — UI
- Dark editorial shell, oversized display type, and one risk accent.
- Empty state with sample draft and keyless `/demo` report.
- Risk meter with formula disclosure, critic cards with evidence highlighting.
- Retryable critic cards showing parse, schema, grounding, timeout, and transport stages.
- Conflict resolution UI and before/after rewrite diff with source-critic attribution.
- Responsive mobile composer, sticky analysis action, stacked diff, reduced-motion support.

### Phase 4 — Quality, automation, documentation
- 30 Vitest tests across aggregator, conflicts, LLM transport, structured output, streaming JSON, grounding, schemas, and orchestrator.
- README drift checker for critics, few-shots, providers, URLs, JSON capability, Direct Mode, and key requirements.
- CHANGELOG, security notes, deployment guide, demo recording script.
- Production build and TypeScript checks pass.

### Known gaps
- Live deployment requires the operator's Vercel account; no credentials are included.
- Real-provider critic harness requires user-supplied keys.
- Rate limiting is in-memory and best-effort on serverless.
