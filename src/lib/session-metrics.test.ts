import { describe, expect, it } from 'vitest';

import {
  MODEL_ID,
  type ChatMetadata,
  type WorkshopMessage,
} from './chat';
import { calculateSessionMetrics } from './session-metrics';

function userMessage(id: string): WorkshopMessage {
  return { id, role: 'user', parts: [{ type: 'text', text: 'Pergunta' }] };
}

function assistantMessage(
  id: string,
  route: ChatMetadata['route'],
): WorkshopMessage {
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text: 'Resposta' }],
    metadata: {
      route,
      learningGoal: 'faq',
      model: MODEL_ID,
      usedMemory: false,
    },
  };
}

describe('calculateSessionMetrics', () => {
  it('returns zero counts and null rates for an empty session', () => {
    expect(calculateSessionMetrics([], {})).toEqual({
      userTurns: 0,
      routeTotal: 0,
      faqCount: 0,
      fallbackCount: 0,
      handoffCount: 0,
      errorCount: 0,
      faqHitRate: null,
      fallbackRate: null,
      handoffRate: null,
      ratedCount: 0,
      resolvedCount: 0,
      resolutionRate: null,
    });
  });

  it('counts user turns and each assistant route, keeping errors separate', () => {
    expect(
      calculateSessionMetrics(
        [
          userMessage('user-1'),
          assistantMessage('faq-1', 'faq'),
          userMessage('user-2'),
          assistantMessage('fallback-1', 'fallback'),
          assistantMessage('handoff-1', 'handoff'),
          assistantMessage('error-1', 'error'),
        ],
        {},
      ),
    ).toEqual({
      userTurns: 2,
      routeTotal: 3,
      faqCount: 1,
      fallbackCount: 1,
      handoffCount: 1,
      errorCount: 1,
      faqHitRate: 1 / 3,
      fallbackRate: 1 / 3,
      handoffRate: 1 / 3,
      ratedCount: 0,
      resolvedCount: 0,
      resolutionRate: null,
    });
  });

  it('reports a full FAQ hit rate and zero rates for other routes', () => {
    expect(
      calculateSessionMetrics([assistantMessage('faq-1', 'faq')], {}),
    ).toMatchObject({
      routeTotal: 1,
      faqCount: 1,
      fallbackCount: 0,
      handoffCount: 0,
      faqHitRate: 1,
      fallbackRate: 0,
      handoffRate: 0,
    });
  });

  it('counts a yes rating for one of two FAQ messages', () => {
    expect(
      calculateSessionMetrics(
        [assistantMessage('faq-1', 'faq'), assistantMessage('faq-2', 'faq')],
        { 'faq-1': 'yes' },
      ),
    ).toMatchObject({
      ratedCount: 1,
      resolvedCount: 1,
      resolutionRate: 1,
    });
  });

  it('changes the resolution result when the FAQ rating changes to no', () => {
    expect(
      calculateSessionMetrics(
        [assistantMessage('faq-1', 'faq'), assistantMessage('faq-2', 'faq')],
        { 'faq-1': 'no' },
      ),
    ).toMatchObject({
      ratedCount: 1,
      resolvedCount: 0,
      resolutionRate: 0,
    });
  });

  it('calculates an exact fractional resolution rate for mixed ratings', () => {
    expect(
      calculateSessionMetrics(
        [
          assistantMessage('faq-1', 'faq'),
          assistantMessage('faq-2', 'faq'),
          assistantMessage('faq-3', 'faq'),
        ],
        { 'faq-1': 'yes', 'faq-2': 'no', 'faq-3': 'yes' },
      ),
    ).toMatchObject({
      ratedCount: 3,
      resolvedCount: 2,
      resolutionRate: 2 / 3,
    });
  });

  it('ignores stale and non-FAQ feedback entries', () => {
    expect(
      calculateSessionMetrics(
        [
          assistantMessage('faq-1', 'faq'),
          assistantMessage('fallback-1', 'fallback'),
          userMessage('user-1'),
        ],
        {
          'faq-1': 'yes',
          'fallback-1': 'yes',
          'user-1': 'no',
          stale: 'yes',
        },
      ),
    ).toMatchObject({
      ratedCount: 1,
      resolvedCount: 1,
      resolutionRate: 1,
    });
  });

  it('does not mutate messages or feedback', () => {
    const messages = [
      assistantMessage('faq-1', 'faq'),
      assistantMessage('fallback-1', 'fallback'),
      userMessage('user-1'),
    ] as const;
    const feedback = { 'faq-1': 'yes' as const, stale: 'no' as const };
    const messagesBefore = structuredClone(messages);
    const feedbackBefore = structuredClone(feedback);

    calculateSessionMetrics(messages, feedback);

    expect(messages).toEqual(messagesBefore);
    expect(feedback).toEqual(feedbackBefore);
  });
});
