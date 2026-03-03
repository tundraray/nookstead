'use client';

import { useChat } from '@ai-sdk/react';
import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import type { ColyseusTransport } from '@/services/ColyseusTransport';
import { GameModal } from './GameModal';

interface HistoryMessage {
  role: string;
  content: string;
  createdAt: string;
}

interface HistorySession {
  sessionId: string;
  startedAt: string;
  endedAt: string | null;
  messages: HistoryMessage[];
}

interface ChatModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  botId: string;
  botName: string;
  transport: ColyseusTransport | null;
}

export function ChatModal({
  open,
  onOpenChange,
  botId,
  botName,
  transport,
}: ChatModalProps) {
  const [input, setInput] = useState('');
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: transport ?? undefined,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Fetch dialogue history when modal opens
  const fetchHistory = useCallback(async () => {
    if (!botId) return;
    setHistoryLoading(true);
    try {
      const res = await fetch(
        `/api/dialogue-history?botId=${encodeURIComponent(botId)}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistorySessions(data.sessions ?? []);
      }
    } catch {
      // Silently fail - history is a nice-to-have
    } finally {
      setHistoryLoading(false);
    }
  }, [botId]);

  useEffect(() => {
    if (open && botId) {
      fetchHistory();
    }
    if (!open) {
      setHistorySessions([]);
    }
  }, [open, botId, fetchHistory]);

  // Auto-scroll to bottom when new messages arrive or during streaming
  useEffect(() => {
    const el = messageListRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, historySessions]);

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

  const hasHistory = historySessions.some((s) => s.messages.length > 0);

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
          {/* History loading indicator */}
          {historyLoading && (
            <p className="chat-modal__empty">Loading history...</p>
          )}

          {/* Past sessions */}
          {historySessions.map((session) => {
            if (session.messages.length === 0) return null;
            const date = new Date(session.startedAt);
            const label = formatSessionDate(date);
            return (
              <Fragment key={session.sessionId}>
                <div className="chat-modal__session-divider">
                  <span className="chat-modal__session-divider-text">
                    {label}
                  </span>
                </div>
                {session.messages.map((msg, i) => (
                  <div
                    key={`${session.sessionId}-${i}`}
                    className={`chat-modal__bubble ${
                      msg.role === 'user'
                        ? 'chat-modal__bubble--user'
                        : 'chat-modal__bubble--bot'
                    }`}
                  >
                    <span className="chat-modal__role">
                      {msg.role === 'user' ? 'You' : botName}
                    </span>
                    <span className="chat-modal__text">{msg.content}</span>
                  </div>
                ))}
              </Fragment>
            );
          })}

          {/* Divider between history and current session */}
          {hasHistory && (
            <div className="chat-modal__session-divider">
              <span className="chat-modal__session-divider-text">Now</span>
            </div>
          )}

          {/* Current session empty state */}
          {!historyLoading && !hasHistory && messages.length === 0 && (
            <p className="chat-modal__empty">
              Say something to {botName}...
            </p>
          )}

          {/* Current session messages */}
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

function formatSessionDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
