'use client';

import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';

import { LiaChat } from '../components/LiaChat';
import type { LearningGoal, WorkshopMessage } from '../lib/chat';

export default function Home() {
  const { messages, status, error, sendMessage, setMessages, clearError } =
    useChat<WorkshopMessage>({
      transport: new DefaultChatTransport({ api: '/api/chat' }),
    });

  function handleSendMessage(text: string, learningGoal: LearningGoal) {
    return sendMessage({ text }, { body: { learningGoal } });
  }

  function handleReset() {
    setMessages([]);
    clearError();
  }

  return (
    <LiaChat
      messages={messages}
      status={status}
      error={error}
      onSendMessage={handleSendMessage}
      onReset={handleReset}
    />
  );
}
