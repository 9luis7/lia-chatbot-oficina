import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@ai-sdk/google', () => ({
  google: vi.fn(() => ({ provider: 'test-google-model' })),
}));

vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>();

  return {
    ...actual,
    streamText: vi.fn(),
  };
});

import { google } from '@ai-sdk/google';
import { streamText } from 'ai';

import { CHAT_COPY, MODEL_ID, type LearningGoal, type WorkshopMessage } from '../../../lib/chat';
import { POST } from './route';

const googleMock = vi.mocked(google);
const streamTextMock = vi.mocked(streamText);
const originalApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

function userMessage(text: string): WorkshopMessage {
  return {
    id: 'user-1',
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

function assistantMessage(faqId: string): WorkshopMessage {
  return {
    id: 'assistant-1',
    role: 'assistant',
    metadata: {
      route: 'faq',
      faqId,
      learningGoal: 'faq',
      model: MODEL_ID,
      usedMemory: false,
    },
    parts: [{ type: 'text', text: 'Resposta anterior.' }],
  };
}

function requestFor(
  messages: WorkshopMessage[],
  learningGoal: LearningGoal = 'faq',
): Request {
  return rawRequest({ messages, learningGoal });
}

function rawRequest(body: unknown): Request {
  return new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function streamEvents(response: Response): Promise<Record<string, unknown>[]> {
  const raw = await response.text();

  return raw
    .split('\n\n')
    .filter(line => line.startsWith('data: ') && line !== 'data: [DONE]')
    .map(line => JSON.parse(line.slice('data: '.length)) as Record<string, unknown>);
}

function metadataFrom(events: Record<string, unknown>[]) {
  return events
    .filter(event => event.type === 'start' || event.type === 'finish')
    .map(event => event.messageMetadata);
}

function fakeModelStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({ type: 'start' });
      controller.enqueue({ type: 'text-start', id: 'text-1' });
      controller.enqueue({ type: 'text-delta', id: 'text-1', text: 'Resposta da Lia.' });
      controller.enqueue({ type: 'text-end', id: 'text-1' });
      controller.enqueue({
        type: 'finish',
        finishReason: 'stop',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
      });
      controller.close();
    },
  });
}

describe('POST /api/chat', () => {
  beforeEach(() => {
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    googleMock.mockClear();
    streamTextMock.mockReset();
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    } else {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = originalApiKey;
    }
  });

  it('rejects malformed JSON with a safe Portuguese 400 response without generation', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/solicita|pedido|requisi/i);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('rejects an unsupported learning goal with a safe Portuguese 400 response without generation', async () => {
    const response = await POST(
      new Request('http://localhost/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          messages: [userMessage('checklist mínimo')],
          learningGoal: 'unknown-goal',
        }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/solicita|pedido|requisi/i);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a null part', null],
    ['a non-object part', 'texto solto'],
    ['a text part without text', { type: 'text' }],
    ['a text part with non-string text', { type: 'text', text: 42 }],
  ])('rejects %s with a safe Portuguese 400 response without generation', async (_name, part) => {
    const response = await POST(
      rawRequest({
        messages: [{ id: 'user-1', role: 'user', parts: [part] }],
        learningGoal: 'faq',
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/solicita|pedido|requisi/i);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('rejects more than 100 messages without invoking the provider', async () => {
    const messages = Array.from({ length: 101 }, (_, index) => ({
      ...userMessage('checklist mínimo'),
      id: `user-${index}`,
    }));

    const response = await POST(requestFor(messages));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/solicita|pedido|requisi/i);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('rejects history without a user message without invoking the provider', async () => {
    const response = await POST(requestFor([assistantMessage('minimum-checklist')]));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/solicita|pedido|requisi/i);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it.each([
    ['empty input', '   ', CHAT_COPY.emptyInput],
    ['501-character input', 'a'.repeat(501), CHAT_COPY.tooLongInput],
  ])('streams route:error for %s without generation', async (_name, text, expectedText) => {
    const response = await POST(requestFor([userMessage(text)]));
    const events = await streamEvents(response);

    expect(response.status).toBe(200);
    expect(events.find(event => event.type === 'text-delta')).toMatchObject({
      delta: expectedText,
    });
    expect(metadataFrom(events)).toEqual([
      { route: 'error', learningGoal: 'faq', model: MODEL_ID, usedMemory: false },
      { route: 'error', learningGoal: 'faq', model: MODEL_ID, usedMemory: false },
    ]);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('gives handoff precedence and streams the fixed handoff text without generation', async () => {
    const response = await POST(
      requestFor([userMessage('Quero falar com o professor sobre o checklist mínimo.')], 'guardrail'),
    );
    const events = await streamEvents(response);

    expect(events.find(event => event.type === 'text-delta')).toMatchObject({
      delta: CHAT_COPY.handoff,
    });
    expect(metadataFrom(events)).toEqual([
      { route: 'handoff', learningGoal: 'guardrail', model: MODEL_ID, usedMemory: false },
      { route: 'handoff', learningGoal: 'guardrail', model: MODEL_ID, usedMemory: false },
    ]);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('streams the fixed fallback text and metadata without generation', async () => {
    const response = await POST(requestFor([userMessage('Qual a previsão do tempo amanhã?')], 'faq'));
    const events = await streamEvents(response);

    expect(events.find(event => event.type === 'text-delta')).toMatchObject({
      delta: CHAT_COPY.fallback,
    });
    expect(metadataFrom(events)).toEqual([
      { route: 'fallback', learningGoal: 'faq', model: MODEL_ID, usedMemory: false },
      { route: 'fallback', learningGoal: 'faq', model: MODEL_ID, usedMemory: false },
    ]);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('streams a safe error for a FAQ request with no API key and does not invoke the provider', async () => {
    const response = await POST(requestFor([userMessage('Qual é o checklist mínimo?')]));
    const events = await streamEvents(response);

    expect(events.find(event => event.type === 'text-delta')).toMatchObject({
      delta: expect.stringMatching(/dispon.vel|tente novamente/i),
    });
    expect(metadataFrom(events)).toEqual([
      { route: 'error', learningGoal: 'faq', model: MODEL_ID, usedMemory: false },
      { route: 'error', learningGoal: 'faq', model: MODEL_ID, usedMemory: false },
    ]);
    expect(googleMock).not.toHaveBeenCalled();
    expect(streamTextMock).not.toHaveBeenCalled();
  });

  it('uses the required Gemini alias and FAQ context when streaming a FAQ answer', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
    streamTextMock.mockReturnValue({ stream: fakeModelStream() } as never);

    const response = await POST(requestFor([userMessage('Qual é o checklist mínimo?')], 'design'));
    const events = await streamEvents(response);

    expect(events.find(event => event.type === 'text-delta')).toMatchObject({
      delta: 'Resposta da Lia.',
    });
    expect(googleMock).toHaveBeenCalledWith('gemini-flash-latest');
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'test-google-model' },
        instructions: expect.stringContaining('Lia'),
        messages: [
          {
            role: 'user',
            content: [{ type: 'text', text: 'Qual é o checklist mínimo?' }],
          },
        ],
      }),
    );
    expect(vi.mocked(streamText).mock.calls[0]?.[0]?.instructions).toContain(
      'Qual é o checklist mínimo para o chatbot?',
    );
    expect(metadataFrom(events)).toEqual([
      {
        route: 'faq',
        faqId: 'minimum-checklist',
        learningGoal: 'design',
        model: MODEL_ID,
        usedMemory: false,
      },
      {
        route: 'faq',
        faqId: 'minimum-checklist',
        learningGoal: 'design',
        model: MODEL_ID,
        usedMemory: false,
      },
    ]);
  });

  it('handles provider errors without logging or exposing sensitive provider payloads', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
    streamTextMock.mockReturnValue({ stream: fakeModelStream() } as never);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await POST(
      requestFor(
        [
          assistantMessage('minimum-checklist'),
          userMessage('Qual é o checklist mínimo?'),
        ],
        'design',
      ),
    );

    const providerOnError = streamTextMock.mock.calls[0]?.[0]?.onError;
    expect(providerOnError).toBeTypeOf('function');

    const handlerResult = providerOnError?.({
      error: new Error(
        'SECRET_MARKER HISTORY_MARKER SYSTEM_PROMPT_MARKER',
      ),
    });
    const observableOutput = String(handlerResult);

    expect(consoleError).not.toHaveBeenCalled();
    expect(observableOutput).not.toMatch(
      /SECRET_MARKER|HISTORY_MARKER|SYSTEM_PROMPT_MARKER/,
    );

    consoleError.mockRestore();
  });

  it('uses the slot FAQ for the documented continuation and marks streamed metadata as memory-backed', async () => {
    process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'test-key';
    streamTextMock.mockReturnValue({ stream: fakeModelStream() } as never);

    const response = await POST(
      requestFor(
        [assistantMessage('slot-state'), userMessage('E como isso aparece neste bot?')],
        'memory-state',
      ),
    );
    const events = await streamEvents(response);

    expect(metadataFrom(events)).toEqual([
      {
        route: 'faq',
        faqId: 'slot-state',
        learningGoal: 'memory-state',
        model: MODEL_ID,
        usedMemory: true,
      },
      {
        route: 'faq',
        faqId: 'slot-state',
        learningGoal: 'memory-state',
        model: MODEL_ID,
        usedMemory: true,
      },
    ]);
  });
});
