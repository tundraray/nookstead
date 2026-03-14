/**
 * Custom AI SDK ChatTransport over Colyseus WebSocket.
 *
 * Bridges the AI SDK `useChat` hook with Colyseus room messaging by converting
 * `DIALOGUE_STREAM_CHUNK` and `DIALOGUE_END_TURN` server messages into a
 * `ReadableStream<UIMessageChunk>` consumable by the AI SDK.
 *
 * This transport is designed to be per-dialogue-session: created when a
 * dialogue starts and discarded when it ends. The Colyseus room reference
 * is injected via the constructor.
 *
 * @module services/ColyseusTransport
 */

import type { Room } from '@colyseus/sdk';
import type { ChatTransport, UIMessage, UIMessageChunk } from 'ai';
import {
  ClientMessage,
  ServerMessage,
  type DialogueStreamChunkPayload,
  type DialogueAction,
  type DialogueActionResultPayload,
} from '@nookstead/shared';

/** Generate a simple unique ID for text part tracking. */
function generatePartId(): string {
  return `text-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Extract the text content from the last user message in the conversation.
 *
 * AI SDK v6 UIMessage stores content in `parts` array. Each part has a `type`
 * field; user text is stored in parts with `type: 'text'`.
 */
function extractLastUserText(messages: UIMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role !== 'user') continue;
    for (let j = msg.parts.length - 1; j >= 0; j--) {
      const part = msg.parts[j];
      if (part.type === 'text' && part.text) {
        return part.text;
      }
    }
  }
  return null;
}

/**
 * Custom AI SDK ChatTransport that bridges Colyseus WebSocket messaging
 * with the `useChat` hook's streaming interface.
 *
 * Usage:
 * ```ts
 * const transport = new ColyseusTransport(room);
 * const { messages, sendMessage } = useChat({ transport });
 * ```
 */
export class ColyseusTransport implements ChatTransport<UIMessage> {
  private room: Room | null;

  /** Controller for the currently active ReadableStream. */
  private activeController: ReadableStreamDefaultController<UIMessageChunk> | null =
    null;

  /** ID of the text part currently being streamed. */
  private activeTextPartId: string | null = null;

  /** Unsubscribe functions for Colyseus message listeners. */
  private unsubscribers: (() => void)[] = [];

  /** AbortSignal listener cleanup for the current stream. */
  private abortCleanup: (() => void) | null = null;

  constructor(room: Room | null) {
    this.room = room;

    if (this.room) {
      this.registerListeners();
    }
  }

  /**
   * Register Colyseus message listeners for dialogue stream events.
   * These listeners persist for the lifetime of this transport instance.
   */
  private registerListeners(): void {
    if (!this.room) return;

    const unsubChunk = this.room.onMessage(
      ServerMessage.DIALOGUE_STREAM_CHUNK,
      (data: DialogueStreamChunkPayload) => {
        this.handleStreamChunk(data);
      }
    );
    this.unsubscribers.push(unsubChunk);

    const unsubEndTurn = this.room.onMessage(
      ServerMessage.DIALOGUE_END_TURN,
      () => {
        this.handleEndTurn();
      }
    );
    this.unsubscribers.push(unsubEndTurn);
  }

  /**
   * Handle an incoming DIALOGUE_STREAM_CHUNK message from the server.
   * Pushes a text-delta UIMessageChunk to the active stream.
   */
  private handleStreamChunk(data: DialogueStreamChunkPayload): void {
    if (!this.activeController || !this.activeTextPartId) return;

    try {
      this.activeController.enqueue({
        type: 'text-delta',
        id: this.activeTextPartId,
        delta: data.text,
      });
    } catch {
      // Stream already closed or errored; ignore
    }
  }

  /**
   * Handle an incoming DIALOGUE_END_TURN message from the server.
   * Closes the active stream with proper finish chunks.
   */
  private handleEndTurn(): void {
    if (!this.activeController || !this.activeTextPartId) return;

    try {
      const textPartId = this.activeTextPartId;

      this.activeController.enqueue({ type: 'text-end', id: textPartId });
      this.activeController.enqueue({ type: 'finish-step' });
      this.activeController.enqueue({ type: 'finish', finishReason: 'stop' });
      this.activeController.close();
    } catch {
      // Stream already closed; ignore
    } finally {
      this.cleanupActiveStream();
    }
  }

  /**
   * Clean up the active stream state without closing the controller.
   * Called after stream closes or errors.
   */
  private cleanupActiveStream(): void {
    this.activeController = null;
    this.activeTextPartId = null;

    if (this.abortCleanup) {
      this.abortCleanup();
      this.abortCleanup = null;
    }
  }

  /**
   * Cancel the active stream if one exists.
   * Used when a new sendMessages call arrives while a previous stream is active.
   */
  private cancelActiveStream(): void {
    if (!this.activeController) return;

    try {
      this.activeController.error(
        new Error('Stream cancelled: new request started')
      );
    } catch {
      // Stream already closed; ignore
    }

    this.cleanupActiveStream();
  }

  /**
   * Send messages to the server and return a streaming response.
   *
   * Extracts the last user message text, sends it to the Colyseus room as a
   * `DIALOGUE_MESSAGE`, and returns a `ReadableStream<UIMessageChunk>` that
   * emits text deltas as `DIALOGUE_STREAM_CHUNK` messages arrive from the
   * server. The stream closes when `DIALOGUE_END_TURN` is received.
   */
  sendMessages(options: {
    trigger: 'submit-message' | 'regenerate-message';
    chatId: string;
    messageId: string | undefined;
    messages: UIMessage[];
    abortSignal: AbortSignal | undefined;
  }): Promise<ReadableStream<UIMessageChunk>> {
    const { messages, abortSignal } = options;

    // Cancel any active stream before starting a new one
    this.cancelActiveStream();

    // Null room check: return stream that immediately errors
    if (!this.room) {
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({
            type: 'error',
            errorText: 'No room connection available',
          });
          controller.close();
        },
      });
      return Promise.resolve(stream);
    }

    // Extract user message text
    const text = extractLastUserText(messages);
    if (!text) {
      const stream = new ReadableStream<UIMessageChunk>({
        start(controller) {
          controller.enqueue({
            type: 'error',
            errorText: 'No user message text found',
          });
          controller.close();
        },
      });
      return Promise.resolve(stream);
    }

    // Send the message to the Colyseus room
    const room = this.room;
    room.send(ClientMessage.DIALOGUE_MESSAGE, { text });

    // Generate a unique ID for the text part in this response
    const textPartId = generatePartId();
    this.activeTextPartId = textPartId;

    // Create the ReadableStream
    const stream = new ReadableStream<UIMessageChunk>({
      start: (controller) => {
        this.activeController = controller;

        // Emit stream start sequence
        controller.enqueue({ type: 'start' });
        controller.enqueue({ type: 'start-step' });
        controller.enqueue({ type: 'text-start', id: textPartId });
      },
      cancel: () => {
        // Stream cancelled by consumer (e.g., useChat cleanup)
        this.cleanupActiveStream();
      },
    });

    // Set up AbortSignal listener
    if (abortSignal) {
      if (abortSignal.aborted) {
        // Already aborted: send DIALOGUE_END and close immediately
        room.send(ClientMessage.DIALOGUE_END, {});
        this.cancelActiveStream();
      } else {
        const onAbort = () => {
          room.send(ClientMessage.DIALOGUE_END, {});
          this.cancelActiveStream();
        };
        abortSignal.addEventListener('abort', onAbort, { once: true });
        this.abortCleanup = () => {
          abortSignal.removeEventListener('abort', onAbort);
        };
      }
    }

    return Promise.resolve(stream);
  }

  /**
   * Reconnect to an existing stream.
   * Not supported for Colyseus transport -- returns null.
   */
  reconnectToStream(): Promise<ReadableStream<UIMessageChunk> | null> {
    return Promise.resolve(null);
  }

  /**
   * Send a dialogue action (give_gift, hire, dismiss, ask_about) to the server.
   * Actions are sent outside the AI SDK streaming flow, directly via the room.
   */
  sendDialogueAction(action: DialogueAction): void {
    this.room?.send(ClientMessage.DIALOGUE_ACTION, { action });
  }

  /**
   * Register a callback for DIALOGUE_ACTION_RESULT messages from the server.
   * Returns a cleanup function to unregister the listener.
   */
  onDialogueActionResult(
    callback: (result: DialogueActionResultPayload) => void
  ): () => void {
    if (!this.room) {
      return () => {
        /* no-op: no room */
      };
    }

    const unsub = this.room.onMessage(
      ServerMessage.DIALOGUE_ACTION_RESULT,
      (result: DialogueActionResultPayload) => {
        callback(result);
      }
    );
    this.unsubscribers.push(unsub);

    return unsub;
  }

  /**
   * Dispose of the transport, cleaning up all Colyseus message listeners.
   * Call this when the dialogue session ends.
   */
  dispose(): void {
    this.cancelActiveStream();

    for (const unsub of this.unsubscribers) {
      unsub();
    }
    this.unsubscribers.length = 0;

    this.room = null;
  }
}
