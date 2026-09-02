// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { MODEL_ID, type ChatMetadata, type WorkshopMessage } from '../lib/chat';
import { LiaChat, type LiaChatProps } from './LiaChat';

afterEach(cleanup);

function renderChat(overrides: Partial<LiaChatProps> = {}) {
  const props: LiaChatProps = {
    messages: [],
    status: 'ready',
    onSendMessage: vi.fn(),
    onReset: vi.fn(),
    ...overrides,
  };

  return { ...render(<LiaChat {...props} />), props };
}

function assistantMessage(
  text: string,
  metadata: Partial<ChatMetadata> & Pick<ChatMetadata, 'route'>,
): WorkshopMessage {
  return {
    id: `assistant-${metadata.route}`,
    role: 'assistant',
    parts: [{ type: 'text', text }],
    metadata: {
      learningGoal: 'faq',
      model: MODEL_ID,
      usedMemory: false,
      ...metadata,
    },
  };
}

function userMessage(id: string, text: string): WorkshopMessage {
  return { id, role: 'user', parts: [{ type: 'text', text }] };
}

function metricsRow(label: string) {
  return screen.getByText(label).closest('div');
}

describe('LiaChat', () => {
  it('exposes the conversation as a politely announced accessible log', () => {
    renderChat();

    expect(screen.getByRole('log', { name: 'Conversa com a Lia' })).toHaveAttribute(
      'aria-live',
      'polite',
    );
    expect(screen.getByRole('log', { name: 'Conversa com a Lia' })).toHaveAttribute(
      'aria-relevant',
      'additions text',
    );
  });

  it('enables the composer after goal selection and reflects the goal in the live panel', () => {
    renderChat();

    expect(screen.getByLabelText('Mensagem para a Lia')).toBeDisabled();
    expect(screen.getByText('Ainda não definido')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('radio', { name: 'Design conversacional' }));

    expect(screen.getByLabelText('Mensagem para a Lia')).toBeEnabled();
    expect(screen.getByText('Design conversacional', { selector: 'strong' })).toBeInTheDocument();
  });

  it('trims submitted text, forwards the current goal, and clears the draft', () => {
    const { props } = renderChat();
    const composer = screen.getByLabelText('Mensagem para a Lia');

    fireEvent.click(screen.getByRole('radio', { name: 'System prompt' }));
    fireEvent.change(composer, { target: { value: '  Como começo?  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Enviar mensagem' }));

    expect(props.onSendMessage).toHaveBeenCalledWith('Como começo?', 'system-prompt');
    expect(composer).toHaveValue('');
  });

  it('renders FAQ source metadata and completes the FAQ checklist item', () => {
    renderChat({
      messages: [
        assistantMessage('O mínimo começa por uma persona clara.', {
          route: 'faq',
          faqId: 'minimum-checklist',
        }),
      ],
    });

    expect(screen.getByText('O mínimo começa por uma persona clara.')).toBeInTheDocument();
    expect(screen.getByText('Fonte: FAQ · minimum-checklist')).toBeInTheDocument();
    expect(screen.getByText('1 FAQ').closest('li')).toHaveTextContent('Completo');
  });

  it('completes the memory checklist when assistant metadata reports memory use', () => {
    renderChat({
      messages: [
        assistantMessage('Isso retoma a nossa resposta anterior.', {
          route: 'faq',
          faqId: 'rule-versus-llm',
          usedMemory: true,
        }),
      ],
    });

    expect(screen.getByText('Memória de conversa').closest('li')).toHaveTextContent('Completo');
  });

  it('completes the guardrail checklist and offers the professor action for fallback', () => {
    const { props } = renderChat({
      messages: [assistantMessage('Ainda não tenho essa resposta.', { route: 'fallback' })],
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Guardrail + handoff' }));
    fireEvent.click(screen.getByRole('button', { name: 'Falar com o professor' }));

    expect(screen.getByText('1 guardrail / handoff').closest('li')).toHaveTextContent('Completo');
    expect(props.onSendMessage).toHaveBeenCalledWith(
      'Quero falar com o professor',
      'guardrail',
    );
  });

  it('locks the composer after handoff and reset restores the initial selection state', () => {
    const { props, rerender } = renderChat();
    const composer = screen.getByLabelText('Mensagem para a Lia');

    fireEvent.click(screen.getByRole('radio', { name: 'Memória + estado' }));
    fireEvent.change(composer, { target: { value: 'Uma pergunta em andamento' } });

    rerender(
      <LiaChat
        {...props}
        messages={[
          assistantMessage('Chame o professor presente para continuar.', { route: 'handoff' }),
        ]}
      />,
    );

    expect(composer).toBeDisabled();
    expect(screen.getByText(/conversa foi encaminhada/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar conversa' }));
    rerender(<LiaChat {...props} messages={[]} />);

    expect(props.onReset).toHaveBeenCalledOnce();
    expect(composer).toBeDisabled();
    expect(composer).toHaveValue('');
    expect(screen.getByText('Ainda não definido')).toBeInTheDocument();
  });

  it('announces loading and shows retry guidance without exposing raw errors', () => {
    const { props, rerender } = renderChat({ status: 'streaming' });

    expect(screen.getByText('Lia está consultando a oficina…')).toBeInTheDocument();

    rerender(
      <LiaChat
        {...props}
        status="error"
        error={new Error('GOOGLE_GENERATIVE_AI_API_KEY=secret-value')}
      />,
    );

    expect(screen.getByText(/não foi possível concluir.*tente novamente/i)).toBeInTheDocument();
    expect(screen.queryByText(/secret-value/i)).not.toBeInTheDocument();
  });

  it('exposes an accessible 500-character composer and a live near-limit count', () => {
    renderChat();
    fireEvent.click(screen.getByRole('radio', { name: 'Base de conhecimento' }));

    const composer = screen.getByLabelText('Mensagem para a Lia');
    expect(composer).toHaveAttribute('maxlength', '500');

    fireEvent.change(composer, { target: { value: 'a'.repeat(480) } });

    expect(screen.getByText('480 / 500 caracteres')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByRole('button', { name: 'Enviar mensagem' })).toBeEnabled();
  });

  it('submits with Enter while Shift+Enter preserves a multiline draft', () => {
    const { props } = renderChat();
    fireEvent.click(screen.getByRole('radio', { name: 'Design conversacional' }));
    const composer = screen.getByLabelText('Mensagem para a Lia');

    fireEvent.change(composer, { target: { value: 'linha 1' } });
    fireEvent.keyDown(composer, { key: 'Enter', shiftKey: true });
    expect(props.onSendMessage).not.toHaveBeenCalled();

    fireEvent.change(composer, { target: { value: 'linha 1\nlinha 2' } });
    fireEvent.keyDown(composer, { key: 'Enter' });

    expect(props.onSendMessage).toHaveBeenCalledWith(
      'linha 1\nlinha 2',
      'design',
    );
  });

  it('summarizes conversation telemetry and every checklist state in the live panel', () => {
    renderChat({
      messages: [
        userMessage('user-1', 'Primeira pergunta'),
        userMessage('user-2', 'Segunda pergunta'),
        assistantMessage('Resposta ancorada.', {
          route: 'faq',
          faqId: 'testing-demo',
          usedMemory: true,
        }),
      ],
    });

    expect(screen.getByText('Turnos do usuário').closest('div')).toHaveTextContent('2');
    expect(screen.getByText('Última rota').closest('div')).toHaveTextContent('faq');
    expect(screen.getByText('Última FAQ').closest('div')).toHaveTextContent('testing-demo');
    expect(screen.getByText('Modelo').closest('div')).toHaveTextContent('gemini-flash-latest');
    expect(screen.getByText('Persona + regras').closest('li')).toHaveTextContent('Completo');
    expect(screen.getByText('1 slot / estado').closest('li')).toHaveTextContent('Pendente');
  });

  it('shows empty-session metric rates as unavailable and error count as zero', () => {
    renderChat();

    expect(screen.getByRole('heading', { name: 'Métricas da sessão' })).toBeInTheDocument();
    expect(metricsRow('FAQ-hit')).toHaveTextContent('—');
    expect(metricsRow('Fallback')).toHaveTextContent('—');
    expect(metricsRow('Handoff')).toHaveTextContent('—');
    expect(metricsRow('Resolução')).toHaveTextContent('—');
    expect(metricsRow('Erros')).toHaveTextContent('0');
  });

  it('offers resolution feedback only for completed FAQ messages', () => {
    renderChat({
      messages: [
        assistantMessage('Resposta FAQ.', { route: 'faq', faqId: 'faq-1' }),
        assistantMessage('Resposta fallback.', { route: 'fallback' }),
        assistantMessage('Resposta handoff.', { route: 'handoff' }),
        assistantMessage('Resposta erro.', { route: 'error' }),
      ],
    });

    expect(screen.getByRole('group', { name: 'Isso resolveu sua dúvida?' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sim' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Não' })).toBeInTheDocument();
  });

  it('calculates rounded route rates and keeps errors outside the route total', () => {
    renderChat({
      messages: [
        assistantMessage('FAQ.', { route: 'faq', faqId: 'faq-1' }),
        assistantMessage('Fallback.', { route: 'fallback' }),
        assistantMessage('Handoff.', { route: 'handoff' }),
        assistantMessage('Erro.', { route: 'error' }),
      ],
    });

    expect(metricsRow('FAQ-hit')).toHaveTextContent('1/3');
    expect(metricsRow('FAQ-hit')).toHaveTextContent('33%');
    expect(metricsRow('Fallback')).toHaveTextContent('1/3');
    expect(metricsRow('Fallback')).toHaveTextContent('33%');
    expect(metricsRow('Handoff')).toHaveTextContent('1/3');
    expect(metricsRow('Handoff')).toHaveTextContent('33%');
    expect(metricsRow('Erros')).toHaveTextContent('1');
  });

  it('replaces a FAQ evaluation when the learner changes the feedback choice', () => {
    renderChat({
      messages: [assistantMessage('FAQ.', { route: 'faq', faqId: 'faq-1' })],
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    expect(metricsRow('Resolução')).toHaveTextContent('100%');
    expect(metricsRow('Resolução')).toHaveTextContent('1/1 avaliadas');

    fireEvent.click(screen.getByRole('radio', { name: 'Não' }));
    expect(metricsRow('Resolução')).toHaveTextContent('0%');
    expect(metricsRow('Resolução')).toHaveTextContent('0/1 avaliadas');
  });

  it('keeps multiple FAQ feedback groups independent and derives mixed resolution', () => {
    renderChat({
      messages: [
        { ...assistantMessage('FAQ 1.', { route: 'faq', faqId: 'faq-1' }), id: 'faq-one' },
        { ...assistantMessage('FAQ 2.', { route: 'faq', faqId: 'faq-2' }), id: 'faq-two' },
      ],
    });

    const feedbackGroups = screen.getAllByRole('group', { name: 'Isso resolveu sua dúvida?' });
    expect(feedbackGroups).toHaveLength(2);

    fireEvent.click(within(feedbackGroups[0]).getByRole('radio', { name: 'Sim' }));
    fireEvent.click(within(feedbackGroups[1]).getByRole('radio', { name: 'Não' }));

    expect(within(feedbackGroups[0]).getByRole('radio', { name: 'Sim' })).toBeChecked();
    expect(within(feedbackGroups[1]).getByRole('radio', { name: 'Não' })).toBeChecked();
    expect(metricsRow('Resolução')).toHaveTextContent('50%');
    expect(metricsRow('Resolução')).toHaveTextContent('1/2 avaliadas');
  });

  it.each(['submitted', 'streaming'] as const)(
    'keeps FAQ feedback visible but disabled while status is %s',
    status => {
      renderChat({
        status,
        messages: [assistantMessage('FAQ.', { route: 'faq', faqId: 'faq-1' })],
      });

      const feedbackGroup = screen.getByRole('group', { name: 'Isso resolveu sua dúvida?' });
      expect(within(feedbackGroup).getByRole('radio', { name: 'Sim' })).toBeDisabled();
      expect(within(feedbackGroup).getByRole('radio', { name: 'Não' })).toBeDisabled();
    },
  );

  it('clears feedback and metrics when the conversation is reset', () => {
    const faq = assistantMessage('FAQ.', { route: 'faq', faqId: 'faq-1' });
    const { props, rerender } = renderChat({
      messages: [faq, assistantMessage('Handoff.', { route: 'handoff' })],
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));
    expect(metricsRow('Resolução')).toHaveTextContent('100%');

    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar conversa' }));
    expect(props.onReset).toHaveBeenCalledOnce();

    rerender(<LiaChat {...props} messages={[]} />);

    expect(metricsRow('FAQ-hit')).toHaveTextContent('—');
    expect(metricsRow('Resolução')).toHaveTextContent('—');
    expect(metricsRow('Erros')).toHaveTextContent('0');
    expect(screen.queryByRole('group', { name: 'Isso resolveu sua dúvida?' })).not.toBeInTheDocument();

    rerender(<LiaChat {...props} messages={[faq]} />);
    expect(screen.getByRole('radio', { name: 'Sim' })).not.toBeChecked();
    expect(metricsRow('Resolução')).toHaveTextContent('—');
  });

  it('does not send a chat message when recording FAQ feedback', () => {
    const { props } = renderChat({
      messages: [assistantMessage('FAQ.', { route: 'faq', faqId: 'faq-1' })],
    });

    fireEvent.click(screen.getByRole('radio', { name: 'Sim' }));

    expect(props.onSendMessage).not.toHaveBeenCalled();
  });
});
