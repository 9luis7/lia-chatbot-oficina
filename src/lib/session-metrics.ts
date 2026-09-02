import type { WorkshopMessage } from './chat';

export type ResolutionFeedback = 'yes' | 'no';
export type FeedbackByMessageId = Record<string, ResolutionFeedback>;

export interface SessionMetrics {
  userTurns: number;
  routeTotal: number;
  faqCount: number;
  fallbackCount: number;
  handoffCount: number;
  errorCount: number;
  faqHitRate: number | null;
  fallbackRate: number | null;
  handoffRate: number | null;
  ratedCount: number;
  resolvedCount: number;
  resolutionRate: number | null;
}

export function calculateSessionMetrics(
  messages: readonly WorkshopMessage[],
  feedbackByMessageId: Readonly<FeedbackByMessageId>,
): SessionMetrics {
  let userTurns = 0;
  let faqCount = 0;
  let fallbackCount = 0;
  let handoffCount = 0;
  let errorCount = 0;
  const faqMessageIds = new Set<string>();

  for (const message of messages) {
    if (message.role === 'user') {
      userTurns += 1;
      continue;
    }

    if (message.role !== 'assistant') {
      continue;
    }

    switch (message.metadata?.route) {
      case 'faq':
        faqCount += 1;
        faqMessageIds.add(message.id);
        break;
      case 'fallback':
        fallbackCount += 1;
        break;
      case 'handoff':
        handoffCount += 1;
        break;
      case 'error':
        errorCount += 1;
        break;
    }
  }

  const routeTotal = faqCount + fallbackCount + handoffCount;
  let ratedCount = 0;
  let resolvedCount = 0;

  for (const [messageId, feedback] of Object.entries(feedbackByMessageId)) {
    if (
      !faqMessageIds.has(messageId) ||
      (feedback !== 'yes' && feedback !== 'no')
    ) {
      continue;
    }

    ratedCount += 1;
    if (feedback === 'yes') {
      resolvedCount += 1;
    }
  }

  return {
    userTurns,
    routeTotal,
    faqCount,
    fallbackCount,
    handoffCount,
    errorCount,
    faqHitRate: routeTotal === 0 ? null : faqCount / routeTotal,
    fallbackRate: routeTotal === 0 ? null : fallbackCount / routeTotal,
    handoffRate: routeTotal === 0 ? null : handoffCount / routeTotal,
    ratedCount,
    resolvedCount,
    resolutionRate: ratedCount === 0 ? null : resolvedCount / ratedCount,
  };
}
