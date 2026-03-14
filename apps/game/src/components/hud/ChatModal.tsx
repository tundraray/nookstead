'use client';

import { useChat } from '@ai-sdk/react';
import { Fragment, useEffect, useRef, useState, useCallback } from 'react';
import type { ColyseusTransport } from '@/services/ColyseusTransport';
import type {
  RelationshipData,
  DialogueActionType,
  DialogueAction,
  RelationshipSocialType,
  GiftId,
} from '@nookstead/shared';
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
  initialRelationship?: RelationshipData | null;
  initialAvailableActions?: DialogueActionType[];
}

type ActionFeedback = { type: 'success' | 'error'; message: string } | null;

const CLIENT_GIFT_OPTIONS: readonly { id: GiftId; label: string }[] = [
  { id: 'flowers', label: 'Цветы' },
  { id: 'pie', label: 'Пирог' },
  { id: 'mushrooms', label: 'Грибы' },
  { id: 'herbs', label: 'Травы' },
  { id: 'fishing_rod', label: 'Удочка' },
  { id: 'carved_wood', label: 'Деревянная фигурка' },
  { id: 'pottery', label: 'Глиняный горшок' },
  { id: 'knitted_scarf', label: 'Вязаный шарф' },
  { id: 'old_book', label: 'Старая книга' },
  { id: 'recipe_book', label: 'Книга рецептов' },
  { id: 'silver_ring', label: 'Серебряное кольцо' },
  { id: 'love_letter', label: 'Любовное письмо' },
  { id: 'perfume', label: 'Духи' },
  { id: 'candles', label: 'Свечи' },
  { id: 'honey_cake', label: 'Медовый торт' },
] as const;

const socialTypeLabels: Record<RelationshipSocialType, string> = {
  stranger: 'незнакомец',
  acquaintance: 'знакомый',
  friend: 'друг',
  close_friend: 'близкий друг',
  romantic: 'романтический интерес',
  rival: 'соперник',
};

export function ChatModal({
  open,
  onOpenChange,
  botId,
  botName,
  transport,
  initialRelationship,
  initialAvailableActions,
}: ChatModalProps) {
  const [input, setInput] = useState('');
  const [historySessions, setHistorySessions] = useState<HistorySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const messageListRef = useRef<HTMLDivElement>(null);

  // Relationship and action state
  const [relationship, setRelationship] = useState<RelationshipData | null>(
    initialRelationship ?? null
  );
  const [availableActions, setAvailableActions] = useState<
    DialogueActionType[]
  >(initialAvailableActions ?? []);
  const [showGiftSubmenu, setShowGiftSubmenu] = useState(false);
  const [showAskAboutInput, setShowAskAboutInput] = useState(false);
  const [askAboutTopic, setAskAboutTopic] = useState('');
  const [actionFeedback, setActionFeedback] = useState<ActionFeedback>(null);
  const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: transport ?? undefined,
  });

  const isStreaming = status === 'streaming' || status === 'submitted';

  // Send a dialogue action to the server via transport
  const handleAction = useCallback(
    (action: DialogueAction) => {
      transport?.sendDialogueAction(action);
    },
    [transport]
  );

  // Listen for DIALOGUE_ACTION_RESULT from the server
  useEffect(() => {
    if (!transport) return;
    const cleanup = transport.onDialogueActionResult((result) => {
      if (result.success) {
        if (result.updatedRelationship) {
          setRelationship(result.updatedRelationship);
        }
        if (result.availableActions) {
          setAvailableActions(result.availableActions);
        }
        setActionFeedback({
          type: 'success',
          message: 'Действие выполнено!',
        });
      } else {
        setActionFeedback({
          type: 'error',
          message: result.message ?? 'Не удалось выполнить действие',
        });
      }
      // Auto-clear feedback after 3 seconds
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
      feedbackTimeoutRef.current = setTimeout(
        () => setActionFeedback(null),
        3000
      );
    });
    return () => {
      cleanup();
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
      }
    };
  }, [transport]);

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
      // Reset relationship/action state
      setRelationship(null);
      setAvailableActions([]);
      setShowGiftSubmenu(false);
      setShowAskAboutInput(false);
      setAskAboutTopic('');
      setActionFeedback(null);
      if (feedbackTimeoutRef.current) {
        clearTimeout(feedbackTimeoutRef.current);
        feedbackTimeoutRef.current = null;
      }
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

  // Handle ask_about submission
  function handleAskAboutSubmit() {
    const trimmed = askAboutTopic.trim();
    if (!trimmed) return;
    handleAction({ type: 'ask_about', params: { topic: trimmed } });
    setAskAboutTopic('');
    setShowAskAboutInput(false);
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

        {/* Relationship status indicator */}
        {relationship && (
          <p className="chat-modal__relationship-status">
            Отношения: {socialTypeLabels[relationship.socialType]}
            {relationship.isWorker && ' (работник)'}
          </p>
        )}

        {/* Action buttons panel */}
        {availableActions.length > 0 && (
          <div className="chat-modal__actions" style={{ position: 'relative' }}>
            <div className="chat-modal__actions-row">
              {availableActions.includes('give_gift') && (
                <button
                  className="chat-modal__action-btn"
                  disabled={isStreaming}
                  onClick={() => setShowGiftSubmenu((prev) => !prev)}
                >
                  Подарить подарок
                </button>
              )}
              {availableActions.includes('hire') && (
                <button
                  className="chat-modal__action-btn"
                  disabled={isStreaming}
                  onClick={() => handleAction({ type: 'hire' })}
                >
                  Нанять на работу
                </button>
              )}
              {availableActions.includes('dismiss') && (
                <button
                  className="chat-modal__action-btn"
                  disabled={isStreaming}
                  onClick={() => handleAction({ type: 'dismiss' })}
                >
                  Уволить
                </button>
              )}
              {availableActions.includes('ask_about') && (
                <button
                  className="chat-modal__action-btn"
                  disabled={isStreaming}
                  onClick={() => setShowAskAboutInput((prev) => !prev)}
                >
                  Спросить о...
                </button>
              )}
            </div>

            {/* Gift selection submenu */}
            {showGiftSubmenu && (
              <>
                {/* Backdrop to close submenu on outside click */}
                <div
                  className="chat-modal__submenu-backdrop"
                  onClick={() => setShowGiftSubmenu(false)}
                />
                <div className="chat-modal__gift-submenu">
                  <p className="chat-modal__gift-submenu-title">
                    Выбери подарок:
                  </p>
                  <div className="chat-modal__gift-grid">
                    {CLIENT_GIFT_OPTIONS.map((gift) => (
                      <button
                        key={gift.id}
                        className="chat-modal__gift-option"
                        onClick={() => {
                          handleAction({
                            type: 'give_gift',
                            params: { giftId: gift.id },
                          });
                          setShowGiftSubmenu(false);
                        }}
                      >
                        {gift.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Ask about topic input */}
            {showAskAboutInput && (
              <div className="chat-modal__ask-about">
                <input
                  className="chat-modal__ask-about-input"
                  type="text"
                  value={askAboutTopic}
                  onChange={(e) => setAskAboutTopic(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === 'Enter') {
                      handleAskAboutSubmit();
                    }
                    if (e.key === 'Escape') {
                      setShowAskAboutInput(false);
                    }
                  }}
                  placeholder="О чём спросить..."
                  autoFocus
                />
                <button
                  className="chat-modal__ask-about-send"
                  onClick={handleAskAboutSubmit}
                  disabled={!askAboutTopic.trim()}
                >
                  Спросить
                </button>
              </div>
            )}

            {/* Action feedback */}
            {actionFeedback && (
              <div
                className={`chat-modal__action-feedback chat-modal__action-feedback--${actionFeedback.type}`}
              >
                {actionFeedback.message}
              </div>
            )}
          </div>
        )}

        {/* Action feedback when no actions available (still show result if received) */}
        {availableActions.length === 0 && actionFeedback && (
          <div
            className={`chat-modal__action-feedback chat-modal__action-feedback--${actionFeedback.type}`}
          >
            {actionFeedback.message}
          </div>
        )}

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
