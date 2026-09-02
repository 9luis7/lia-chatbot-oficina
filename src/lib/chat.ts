import type { UIMessage } from 'ai';

export type LearningGoal =
  | 'design'
  | 'system-prompt'
  | 'memory-state'
  | 'guardrail'
  | 'faq';

export type ConversationRoute = 'faq' | 'fallback' | 'handoff' | 'error';

export interface FaqEntry {
  id: string;
  question: string;
  answer: string;
  keywords: string[];
}

export interface ChatMetadata {
  route: ConversationRoute;
  faqId?: string;
  learningGoal: LearningGoal;
  model: string;
  usedMemory: boolean;
}

export type WorkshopMessage = UIMessage<ChatMetadata>;

export const MODEL_ID = 'gemini-flash-latest';
export const MAX_INPUT_LENGTH = 500;

export const CHAT_COPY = {
  emptyInput: 'Escreva uma pergunta para eu poder ajudar.',
  tooLongInput:
    'Sua mensagem passou de 500 caracteres. Resuma a pergunta e tente novamente.',
  fallback:
    'Ainda não tenho uma resposta pronta para isso. Tente perguntar sobre checklist, fluxo, estado, regras, FAQ, testes ou métricas.',
  handoff:
    'Lia não consegue contatar ninguém automaticamente. Chame o professor presente para continuar.',
} as const;

export const FAQ_ENTRIES: readonly FaqEntry[] = [
  {
    id: 'minimum-checklist',
    question: 'Qual é o checklist mínimo para o chatbot?',
    answer:
      'O mínimo é: persona e regras, um estado ou slot, memória da conversa, um guardrail ou encaminhamento e uma FAQ.',
    keywords: [
      'checklist',
      'mínimo',
      'persona',
      'regras',
      'memória',
      'guardrail',
      'encaminhamento',
      'faq',
    ],
  },
  {
    id: 'happy-path',
    question: 'Como começo o happy path?',
    answer:
      'Comece pelo system prompt e por um fluxo bem-sucedido. Faça funcionar antes de decorar e reserve cinco minutos para a demonstração.',
    keywords: [
      'happy path',
      'fluxo',
      'system prompt',
      'sucesso',
      'decorar',
      'cinco minutos',
      'demonstração',
    ],
  },
  {
    id: 'slot-state',
    question: 'O que é um slot ou estado?',
    answer:
      'É um valor capturado e lembrado pelo bot. Na Lia, o exemplo é o objetivo de aprendizagem selecionado.',
    keywords: [
      'slot',
      'estado',
      'valor',
      'capturado',
      'lembrado',
      'objetivo de aprendizagem',
    ],
  },
  {
    id: 'rule-versus-llm',
    question: 'Quando uso regra e quando uso LLM?',
    answer:
      'Decisões críticas devem ser determinísticas, feitas por regras. O LLM fica responsável pela conversa.',
    keywords: [
      'regra',
      'regras',
      'llm',
      'decisões',
      'críticas',
      'determinísticas',
      'conversa',
    ],
  },
  {
    id: 'knowledge-base',
    question: 'Para que serve a base de conhecimento?',
    answer:
      'A FAQ ancora as respostas como uma pequena base de conhecimento antes de usar RAG.',
    keywords: [
      'base de conhecimento',
      'faq',
      'respostas',
      'rag',
      'âncora',
    ],
  },
  {
    id: 'testing-demo',
    question: 'Como testar e preparar a demo?',
    answer:
      'Converse de verdade, teste o happy path, o fallback e o handoff, e prepare a demonstração.',
    keywords: [
      'testar',
      'teste',
      'demo',
      'demonstrar',
      'demonstração',
      'happy path',
      'fallback',
      'handoff',
    ],
  },
  {
    id: 'future-metrics',
    question: 'Quais métricas devo acompanhar no futuro?',
    answer:
      'Acompanhe taxa de acertos da FAQ, taxa de fallback, taxa de handoff, taxa de resolução e média de turnos.',
    keywords: [
      'métricas',
      'faq',
      'fallback',
      'handoff',
      'resolução',
      'turnos',
      'média',
    ],
  },
];

export type ConversationDecision =
  | {
      kind: 'invalid';
      route: 'error';
      reason: 'empty' | 'too-long';
      message: string;
      usedMemory: false;
    }
  | {
      kind: 'handoff';
      route: 'handoff';
      message: string;
      usedMemory: false;
    }
  | {
      kind: 'faq';
      route: 'faq';
      faq: FaqEntry;
      faqId: string;
      usedMemory: boolean;
    }
  | {
      kind: 'fallback';
      route: 'fallback';
      message: string;
      usedMemory: false;
    };

export function normalizeText(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function retrieveFaq(text: string): FaqEntry | undefined {
  const tokens = new Set(normalizeText(text).split(' ').filter(Boolean));
  let bestMatch: FaqEntry | undefined;
  let bestScore = 0;

  for (const entry of FAQ_ENTRIES) {
    const keywordTokens = new Set(
      entry.keywords.flatMap((keyword) => normalizeText(keyword).split(' ').filter(Boolean)),
    );
    const score = [...keywordTokens].filter((keyword) => tokens.has(keyword)).length;

    if (score > bestScore) {
      bestMatch = entry;
      bestScore = score;
    }
  }

  return bestMatch;
}

function isHandoffRequest(normalizedText: string): boolean {
  const contact = '(?:falar|conversar|chamar|procurar|contatar|ligar)';
  const person = '(?:professor|professora|humano|humana|pessoa|atendente)';
  const article = '(?:o|a|um|uma)?';

  return (
    new RegExp(`\\b${contact}\\s+(?:com\\s+)?${article}\\s*${person}\\b`).test(
      normalizedText,
    ) ||
    new RegExp(`\\b(?:quero|preciso|gostaria)\\s+(?:de\\s+)?${article}\\s*${person}\\b`).test(
      normalizedText,
    )
  );
}

function isRecognizedContinuation(normalizedText: string): boolean {
  return (
    normalizedText === 'e por que' ||
    normalizedText === 'como isso aparece aqui' ||
    /^(?:isso|isto|aquilo|ele|ela|esse|essa|desse|dessa|nisso|nele|nela)\b/.test(
      normalizedText,
    )
  );
}

/**
 * Applies the deterministic classroom rules before the route decides whether
 * a matched FAQ should be expanded by the language model.
 */
export function decideConversation(
  text: string,
  previousFaqId?: string,
): ConversationDecision {
  const normalizedText = normalizeText(text);

  if (!normalizedText) {
    return {
      kind: 'invalid',
      route: 'error',
      reason: 'empty',
      message: CHAT_COPY.emptyInput,
      usedMemory: false,
    };
  }

  if (text.length > MAX_INPUT_LENGTH) {
    return {
      kind: 'invalid',
      route: 'error',
      reason: 'too-long',
      message: CHAT_COPY.tooLongInput,
      usedMemory: false,
    };
  }

  if (isHandoffRequest(normalizedText)) {
    return {
      kind: 'handoff',
      route: 'handoff',
      message: CHAT_COPY.handoff,
      usedMemory: false,
    };
  }

  const directFaq = retrieveFaq(normalizedText);
  if (directFaq) {
    return {
      kind: 'faq',
      route: 'faq',
      faq: directFaq,
      faqId: directFaq.id,
      usedMemory: false,
    };
  }

  const previousFaq = FAQ_ENTRIES.find((entry) => entry.id === previousFaqId);
  if (previousFaq && isRecognizedContinuation(normalizedText)) {
    return {
      kind: 'faq',
      route: 'faq',
      faq: previousFaq,
      faqId: previousFaq.id,
      usedMemory: true,
    };
  }

  return {
    kind: 'fallback',
    route: 'fallback',
    message: CHAT_COPY.fallback,
    usedMemory: false,
  };
}
