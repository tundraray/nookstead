'use client';

import { useChat } from '@ai-sdk/react';
import { useEffect, useRef, useState } from 'react';
import type { ColyseusTransport } from '@/services/ColyseusTransport';
import { GameModal } from './GameModal';

interface ChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  botName: string;
  transport: ColyseusTransport | null;
}

export function ChatModal({
  open,
  onOpenChange,
  botName,
  transport,
}: ChatModalProps) {
  const [input, setInput] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: transport ?? undefined,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    const el = messageListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages]);

  // Handle close: clear messages and notify parent
  function handleClose(nextOpen: boolean) {
    if (!nextOpen) {
      // Stop any active stream
      if (isStreaming) {
        stop();
      }
      // Clear chat messages on close
      setMessages([]);
      setInput('');
    }
    onOpenChange(nextOpen);
  }

  // Handle form submission
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    sendMessage({ text: trimmed });
    setInput('');
  }

  return (
    <GameModal
      open={open}
      onOpenChange={handleClose}
      title={botName}
      className="chat-modal"
    >
      <div className="chat-modal__body">
        {/* Message list */}
        <div ref={messageListRef} className="chat-modal__messages">
          {messages.length === 0 && (
            <p className="chat-modal__empty">
              Say something to {botName}...
            </p>
          )}
          {messages.map((message) => (
            <div
              key={message.id}
              className={`chat-modal__bubble ${
                message.role === 'user'
                  ? 'chat-modal__bubble--user'
                  : 'chat-modal__bubble--bot'
              }`}
            >
              <span className="chat-modal__role">
                {message.role === 'user' ? 'You' : botName}
              </span>
              <span className="chat-modal__text">
                {message.parts.map((part, index) =>
                  part.type === 'text' ? (
                    <span key={index}>{part.text}</span>
                  ) : null
                )}
              </span>
            </div>
          ))}

          {/* Typing indicator */}
          {isStreaming && (
            <div className="chat-modal__typing" aria-label="Bot is typing">
              <span className="chat-modal__typing-dot" />
              <span className="chat-modal__typing-dot" />
              <span className="chat-modal__typing-dot" />
            </div>
          )}
        </div>

        {/* Input form */}
        <form className="chat-modal__form" onSubmit={handleSubmit}>
          <input
            className="chat-modal__input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Type a message..."
            disabled={isStreaming}
            aria-label="Chat message input"
          />
          <button
            className="chat-modal__send"
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
          >
            Send
          </button>
        </form>
      </div>
    </GameModal>
  );
}
