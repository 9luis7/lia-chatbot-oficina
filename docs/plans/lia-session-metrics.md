# Lia Session Metrics Implementation Plan

**Goal:** Add local, session-only chatbot metrics derived from existing UI messages and explicit FAQ-resolution feedback.

**Architecture:** Keep `ChatMetadata` and `POST /api/chat` unchanged. A pure client-side calculator consumes `WorkshopMessage[]` plus feedback keyed by assistant message id; the existing Lia interface owns ephemeral feedback state and renders the resulting metrics.

**Tech Stack:** Next.js App Router, React, TypeScript, AI SDK 7, Vitest, Testing Library.

## Global constraints

- No database, `localStorage`, new endpoint, external analytics, charts, per-FAQ breakdown, latency, token, or cost tracking.
- Reloading or restarting clears every metric and feedback value.
- Route-rate denominator is `faq + fallback + handoff`; `error` is excluded and counted separately.
- Resolution is `yes / (yes + no)` over valid feedback for currently present FAQ assistant messages only.
- A missing denominator is represented as `null` and displayed as `—`.
- Percentages are rounded to the nearest integer and accompanied by their fraction.
- Feedback never sends a chat message or calls the backend/Gemini.
- Preserve the existing model, API request/response contract, `ChatMetadata`, visual language, accessibility, and responsive behavior.

## Task 1: Pure session metrics

Create `src/lib/session-metrics.ts` and its Vitest suite. Export `ResolutionFeedback`, `FeedbackByMessageId`, `SessionMetrics`, and `calculateSessionMetrics(messages, feedback)`. Cover empty sessions, each route, combined rates, error exclusion, partial feedback, changed feedback, and stale/non-FAQ feedback.

## Task 2: Feedback and live metrics UI

Integrate the calculator into `LiaChat`. Store feedback by assistant message id; render an accessible Sim/Não radio group for FAQ responses, allow corrections, disable controls while busy, and clear feedback on reset. Insert a compact “Métricas da sessão” section between telemetry and checklist and extend the existing component tests and styles.

## Task 3: Documentation and final integration

Update the README with metric definitions, session-only limitations, and the exact demo sequence. Run `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build`; verify the API route and `ChatMetadata` did not change.
