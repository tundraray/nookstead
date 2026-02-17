import type { Client, Room } from 'colyseus';
import { ServerMessage } from '@nookstead/shared';
import type { SessionKickedPayload } from '@nookstead/shared';

interface SessionEntry {
  client: Client;
  room: Room;
}

/**
 * Tracks active sessions per userId in memory.
 * Enforces single-session-per-user: when a new session connects for an existing userId,
 * the old session is kicked before the new one proceeds.
 */
export class SessionTracker {
  private sessions: Map<string, SessionEntry> = new Map();

  /**
   * Register a new session for a userId.
   * Should be called after checkAndKick in ChunkRoom.onJoin.
   */
  register(userId: string, client: Client, room: Room): void {
    this.sessions.set(userId, { client, room });
    console.log(
      `[SessionTracker] Session registered: userId=${userId}, sessionId=${client.sessionId}`
    );
  }

  /**
   * Remove a session entry for a userId.
   * Should be called in ChunkRoom.onLeave.
   */
  unregister(userId: string): void {
    this.sessions.delete(userId);
    console.log(`[SessionTracker] Session unregistered: userId=${userId}`);
  }

  /**
   * If an existing session exists for userId, send SESSION_KICKED and force-disconnect.
   * Errors during kick are logged but not thrown (must not block new session).
   * Should be called in ChunkRoom.onAuth before accepting the new session.
   */
  async checkAndKick(userId: string): Promise<void> {
    const existing = this.sessions.get(userId);
    if (!existing) {
      return; // No existing session -- no-op
    }

    console.log(
      `[SessionTracker] Duplicate detected: userId=${userId}, kicking old session=${existing.client.sessionId}`
    );

    // Clean up entry BEFORE kick attempt (prevents re-entrancy issues)
    this.sessions.delete(userId);

    try {
      const payload: SessionKickedPayload = {
        reason: 'You logged in from another location',
      };
      existing.client.send(ServerMessage.SESSION_KICKED, payload);
      existing.client.leave();
    } catch (err) {
      // Log but do not throw -- must not block the new session
      console.error(
        `[SessionTracker] Error during kick for userId=${userId}:`,
        err
      );
    }
  }
}
