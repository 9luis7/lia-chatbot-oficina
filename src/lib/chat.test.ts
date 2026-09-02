import { describe, expect, it } from 'vitest';

import {
  decideConversation,
  FAQ_ENTRIES,
  MAX_INPUT_LENGTH,
  MODEL_ID,
  normalizeText,
} from './chat';

describe('normalizeText', () => {
  it('normalizes accents, punctuation, casing, and repeated whitespace', () => {
    expect(normalizeText('  Árvore,  ação!  ')).toBe('arvore acao');
  });
});

describe('decideConversation', () => {
  it('rejects empty input', () => {
    expect(decideConversation('   ')).toMatchObject({
      kind: 'invalid',
      reason: 'empty',
      route: 'error',
    });
  });

  it('accepts input with exactly 500 characters', () => {
    expect(decideConversation('a'.repeat(MAX_INPUT_LENGTH))).toMatchObject({
      kind: 'fallback',
      route: 'fallback',
    });
  });

  it('rejects input with 501 characters', () => {
    expect(decideConversation('a'.repeat(MAX_INPUT_LENGTH + 1))).toMatchObject({
      kind: 'invalid',
      reason: 'too-long',
      route: 'error',
    });
  });

  it('prioritizes an explicit professor handoff over FAQ terms', () => {
    expect(decideConversation('Quero falar com o professor sobre o checklist mínimo.')).toMatchObject({
      kind: 'handoff',
      route: 'handoff',
    });
  });

  it.each([
    ['checklist mínimo', 'Qual é o checklist mínimo?', 'minimum-checklist'],
    ['happy path', 'Como começo o happy path?', 'happy-path'],
    ['slot/state', 'O que é um slot ou estado?', 'slot-state'],
    ['rule versus LLM', 'Quando uso regra versus LLM?', 'rule-versus-llm'],
    ['knowledge base', 'O que é uma base de conhecimento?', 'knowledge-base'],
    ['testing/demo', 'Como devo testar e demonstrar?', 'testing-demo'],
    ['future metrics', 'Quais métricas futuras devo acompanhar?', 'future-metrics'],
  ])('retrieves the %s FAQ', (_topic, input, expectedFaqId) => {
    expect(decideConversation(input)).toMatchObject({
      kind: 'faq',
      route: 'faq',
      faq: { id: expectedFaqId },
      usedMemory: false,
    });
  });

  it('uses source order to resolve a retrieval tie', () => {
    expect(decideConversation('faq')).toMatchObject({
      kind: 'faq',
      faq: { id: FAQ_ENTRIES[0].id },
    });
  });

  it('falls back for an unrelated question', () => {
    expect(decideConversation('Qual a previsão do tempo amanhã?')).toMatchObject({
      kind: 'fallback',
      route: 'fallback',
    });
  });

  it('reuses a valid previous FAQ for a recognized continuation', () => {
    expect(decideConversation('E por que?', 'rule-versus-llm')).toMatchObject({
      kind: 'faq',
      faq: { id: 'rule-versus-llm' },
      usedMemory: true,
    });
  });

  it('does not reuse an unknown previous FAQ id', () => {
    expect(decideConversation('Como isso aparece aqui?', 'not-a-real-faq')).toMatchObject({
      kind: 'fallback',
      usedMemory: false,
    });
  });

  it('does not reuse memory for unrelated text', () => {
    expect(decideConversation('Qual a previsão do tempo amanhã?', 'knowledge-base')).toMatchObject({
      kind: 'fallback',
      usedMemory: false,
    });
  });
});

describe('model contract', () => {
  it('keeps FAQ decisions tied to the required Gemini alias', () => {
    expect(MODEL_ID).toBe('gemini-flash-latest');
  });
});
