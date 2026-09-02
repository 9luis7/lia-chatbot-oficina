'use client';

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import type { ChatStatus } from 'ai';

import {
  MAX_INPUT_LENGTH,
  MODEL_ID,
  type LearningGoal,
  type WorkshopMessage,
} from '../lib/chat';

export interface LiaChatProps {
  messages: WorkshopMessage[];
  status: ChatStatus;
  error?: Error;
  onSendMessage: (text: string, learningGoal: LearningGoal) => void | Promise<void>;
  onReset: () => void;
}

const GOALS: ReadonlyArray<{ value: LearningGoal; label: string; number: string }> = [
  { value: 'design', label: 'Design conversacional', number: '01' },
  { value: 'system-prompt', label: 'System prompt', number: '02' },
  { value: 'memory-state', label: 'Memória + estado', number: '03' },
  { value: 'guardrail', label: 'Guardrail + handoff', number: '04' },
  { value: 'faq', label: 'Base de conhecimento', number: '05' },
];

function ChecklistItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <li className={complete ? 'check-item is-complete' : 'check-item is-pending'}>
      <span className="check-icon" aria-hidden="true">
        {complete ? '✓' : '○'}
      </span>
      <span className="check-label">{label}</span>
      <span className="check-state">{complete ? 'Completo' : 'Pendente'}</span>
    </li>
  );
}

export function LiaChat({ messages, status, error, onSendMessage, onReset }: LiaChatProps) {
  const [learningGoal, setLearningGoal] = useState<LearningGoal>();
  const [draft, setDraft] = useState('');

  const selectedGoal = GOALS.find(goal => goal.value === learningGoal);
  const userTurnCount = messages.filter(message => message.role === 'user').length;
  const lastAssistantMetadata = [...messages]
    .reverse()
    .find(message => message.role === 'assistant' && message.metadata)?.metadata;
  const hasFaq = messages.some(
    message => message.role === 'assistant' && message.metadata?.route === 'faq',
  );
  const hasMemory = messages.some(
    message => message.role === 'assistant' && message.metadata?.usedMemory === true,
  );
  const hasGuardrail = messages.some(
    message =>
      message.role === 'assistant' &&
      (message.metadata?.route === 'fallback' || message.metadata?.route === 'handoff'),
  );
  const hasHandoff = messages.some(
    message => message.role === 'assistant' && message.metadata?.route === 'handoff',
  );
  const isBusy = status === 'submitted' || status === 'streaming';
  const composerDisabled = !learningGoal || isBusy || hasHandoff;

  function sendDraft() {
    const text = draft.trim();
    if (!learningGoal || !text || isBusy || hasHandoff) return;

    void onSendMessage(text, learningGoal);
    setDraft('');
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    sendDraft();
  }

  function handleComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendDraft();
    }
  }

  function reset() {
    setDraft('');
    setLearningGoal(undefined);
    onReset();
  }

  return (
    <main className="lia-shell">
      <header className="masthead">
        <div className="masthead-mark" aria-hidden="true">L</div>
        <div>
          <p className="eyebrow">Oficina prática · Chatbot com IA</p>
          <h1>
            Pergunte, teste,<br />
            <em>aprenda fazendo.</em>
          </h1>
        </div>
        <p className="edition-note">Lia / laboratório 01</p>
      </header>

      <div className="editorial-grid">
        <section className="chat-canvas" aria-labelledby="conversation-title">
          <div className="section-rule">
            <span>Conversa de oficina</span>
            <span aria-hidden="true">••••••••••••</span>
          </div>

          <div
            className="conversation"
            role="log"
            aria-label="Conversa com a Lia"
            aria-live="polite"
            aria-relevant="additions text"
          >
            <article className="message message-assistant welcome-message">
              <div className="speaker-mark" aria-hidden="true">Li</div>
              <div className="message-body">
                <p className="speaker" id="conversation-title">Lia · mentora da oficina</p>
                <p>
                  Oi! Eu acompanho seu raciocínio enquanto você monta o chatbot. Para começar,
                  escolha um objetivo de aprendizagem — ele será o estado desta conversa.
                </p>
              </div>
            </article>

            {messages.map(message => (
              <article
                className={`message message-${message.role}`}
                key={message.id}
                data-route={message.metadata?.route}
              >
                <div className="speaker-mark" aria-hidden="true">
                  {message.role === 'assistant' ? 'Li' : 'Eu'}
                </div>
                <div className="message-body">
                  <p className="speaker">{message.role === 'assistant' ? 'Lia' : 'Você'}</p>
                  {message.parts.map((part, index) =>
                    part.type === 'text' ? <p key={`${message.id}-${index}`}>{part.text}</p> : null,
                  )}
                  {message.role === 'assistant' &&
                  message.metadata?.route === 'faq' &&
                  message.metadata.faqId ? (
                    <p className="source-line">Fonte: FAQ · {message.metadata.faqId}</p>
                  ) : null}
                  {message.role === 'assistant' && message.metadata?.route === 'fallback' ? (
                    <button
                      className="text-action"
                      type="button"
                      disabled={!learningGoal || isBusy || hasHandoff}
                      onClick={() =>
                        learningGoal &&
                        void onSendMessage('Quero falar com o professor', learningGoal)
                      }
                    >
                      Falar com o professor <span aria-hidden="true">→</span>
                    </button>
                  ) : null}
                </div>
              </article>
            ))}

            {isBusy ? (
              <div className="system-note loading-note" role="status" aria-live="polite">
                <span className="loading-dots" aria-hidden="true">•••</span>
                Lia está consultando a oficina…
              </div>
            ) : null}
            {error ? (
              <p className="system-note error-note" role="alert">
                Não foi possível concluir a resposta. Confira sua conexão e tente novamente.
              </p>
            ) : null}
          </div>

          <fieldset className="goal-picker" disabled={isBusy || hasHandoff}>
            <legend>Escolha seu objetivo de aprendizagem</legend>
            <div className="goal-options">
              {GOALS.map(goal => (
                <label className="goal-option" key={goal.value}>
                  <input
                    type="radio"
                    name="learning-goal"
                    value={goal.value}
                    aria-label={goal.label}
                    checked={learningGoal === goal.value}
                    onChange={() => setLearningGoal(goal.value)}
                  />
                  <span className="goal-number">{goal.number}</span>
                  <span>{goal.label}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <form className="composer" onSubmit={submit}>
            <label htmlFor="lia-message">Mensagem para a Lia</label>
            <div className="composer-box">
              <textarea
                id="lia-message"
                maxLength={MAX_INPUT_LENGTH}
                aria-describedby="lia-message-hint lia-message-count"
                disabled={composerDisabled}
                placeholder={
                  learningGoal
                    ? 'Ex.: Como transformo meu objetivo em um bom fluxo?'
                    : 'Escolha um objetivo acima para liberar a conversa'
                }
                value={draft}
                onChange={event => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
              />
              <button
                className="send-button"
                type="submit"
                disabled={composerDisabled || !draft.trim()}
                aria-label="Enviar mensagem"
              >
                <span>Enviar</span><span aria-hidden="true">↗</span>
              </button>
            </div>
            <div className="composer-meta">
              <span id="lia-message-hint">Enter envia · Shift + Enter quebra a linha</span>
              <span
                id="lia-message-count"
                className={draft.length >= 450 ? 'char-count is-near-limit' : 'char-count'}
                aria-live={draft.length >= 450 ? 'polite' : 'off'}
              >
                {draft.length} / {MAX_INPUT_LENGTH} caracteres
              </span>
            </div>
          </form>

          {hasHandoff ? (
            <section className="handoff-notice" role="status" aria-live="polite">
              <div>
                <p className="eyebrow">Handoff ativado</p>
                <p>A conversa foi encaminhada. Chame o professor presente para continuar.</p>
              </div>
              <button type="button" onClick={reset}>Reiniciar conversa</button>
            </section>
          ) : null}
        </section>

        <aside className="live-rail" aria-label="Estado ao vivo">
          <div className="rail-heading">
            <p className="eyebrow">Estado ao vivo</p>
            <span className="live-pulse"><span aria-hidden="true">●</span> Atualizando</span>
          </div>

          <section className="goal-summary" aria-labelledby="goal-summary-label">
            <span id="goal-summary-label">Objetivo selecionado</span>
            <strong>{selectedGoal?.label ?? 'Ainda não definido'}</strong>
          </section>

          <dl className="telemetry">
            <div><dt>Turnos do usuário</dt><dd>{userTurnCount}</dd></div>
            <div><dt>Última rota</dt><dd>{lastAssistantMetadata?.route ?? '—'}</dd></div>
            <div><dt>Última FAQ</dt><dd>{lastAssistantMetadata?.faqId ?? '—'}</dd></div>
            <div><dt>Modelo</dt><dd>{MODEL_ID}</dd></div>
          </dl>

          <section className="checklist" aria-labelledby="checklist-title">
            <h2 id="checklist-title">Checklist mínimo</h2>
            <ul>
              <ChecklistItem label="Persona + regras" complete />
              <ChecklistItem label="1 slot / estado" complete={Boolean(learningGoal)} />
              <ChecklistItem label="Memória de conversa" complete={hasMemory} />
              <ChecklistItem label="1 guardrail / handoff" complete={hasGuardrail} />
              <ChecklistItem label="1 FAQ" complete={hasFaq} />
            </ul>
          </section>

          <p className="rail-footnote">
            <span aria-hidden="true">✦</span> Cada resposta atualiza este painel a partir dos
            metadados da conversa.
          </p>
        </aside>
      </div>
    </main>
  );
}
