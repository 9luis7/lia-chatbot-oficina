# Plano de implementação — Lia MVP

## Global constraints

- Next.js App Router, TypeScript, Tailwind CSS and AI SDK.
- Direct Google provider with `google('gemini-flash-latest')` and server-only `GOOGLE_GENERATIVE_AI_API_KEY`.
- No database, authentication, embeddings, vector store, runtime agents, analytics service or public deployment.
- Conversation memory lasts only for the current browser session.
- Deterministic order: validate input, handoff, FAQ retrieval, Gemini call, fallback.
- Gemini is called only for a matched FAQ and must answer in Brazilian Portuguese from retrieved context and history.
- Never expose API keys, internal payloads or the system prompt.
- UI is a light editorial classroom aesthetic inspired by the supplied slides: warm neutral paper, magenta accent, accessible contrast, responsive chat and live checklist panel.
- TDD is required for deterministic rules, route behavior and user-visible state transitions.

## Task 1: Deterministic conversation core

Create the typed conversation core in `src/lib/chat.ts` and tests in `src/lib/chat.test.ts`.

- Types: `LearningGoal`, `ConversationRoute`, `FaqEntry`, `ChatMetadata`, `WorkshopMessage`.
- Constant `MODEL_ID = 'gemini-flash-latest'` and maximum input length 500.
- Seven FAQs: minimum checklist, happy path, slot/state, rule versus LLM, knowledge base, testing/demo and future metrics.
- Normalize lowercase text, diacritics and punctuation.
- Explicit requests to talk to a professor/human take precedence over FAQ matches.
- Retrieve the highest-scoring FAQ by keyword intersection; ties follow FAQ source order.
- If no direct match, recognized follow-up wording may reuse the previous FAQ id and sets `usedMemory: true`.
- Empty/oversized input is invalid; unmatched input is fallback.
- Provide fixed Portuguese copy for validation, fallback and handoff.
- Tests must first fail for every behavior, then pass.

## Task 2: Streaming API route

Create `src/app/api/chat/route.ts` and focused route tests.

- Accept `{ messages, learningGoal }` and validate the latest user text and learning goal.
- Read the last assistant metadata to resolve previous FAQ context.
- For handoff, fallback or validation, return a fixed AI SDK UI message stream with typed metadata and no provider call.
- For FAQ, call `streamText` with `google(MODEL_ID)`, `instructions`, converted message history and retrieved FAQ context.
- Return typed message metadata with route, FAQ id when present, learning goal, model id and `usedMemory`.
- Provider and configuration errors return a safe Portuguese error message without leaking details.
- Tests cover deterministic routes and ensure non-FAQ routes never invoke generation.

## Task 3: Classroom chat interface

Implement the responsive interface and component tests.

- Goal selector for `design`, `system-prompt`, `memory-state`, `guardrail`, and `faq`.
- Use `useChat<WorkshopMessage>` with `DefaultChatTransport` and request-level `{ learningGoal }`.
- Chat messages, source label, streaming/loading/error states, 500-character composer and specific accessible actions.
- Live panel shows goal, turns, last route, FAQ id, `gemini-flash-latest`, and dynamic checklist items.
- Handoff locks the composer and exposes `Reiniciar conversa`; reset clears messages, goal and runtime checklist.
- Use an editorial classroom visual direction with warm paper surfaces, dark plum text, magenta accent, distinctive typography, restrained motion and reduced-motion support.

## Task 4: Documentation and integration

Update project metadata and README.

- Add `.env.example` containing only `GOOGLE_GENERATIVE_AI_API_KEY=`.
- Document setup, scripts, architecture, guardrails, exact classroom demo and future metrics.
- Add `test`, `test:watch` and `typecheck` scripts.
- Run the complete test, lint, typecheck and production build suites.
