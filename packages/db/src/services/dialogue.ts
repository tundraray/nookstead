import { and, asc, count, desc, eq, sql } from 'drizzle-orm';
import type { DrizzleClient } from '../core/client';
import {
  dialogueSessions,
  type DialogueSession,
} from '../schema/dialogue-sessions';
import {
  dialogueMessages,
  type DialogueMessage,
} from '../schema/dialogue-messages';
import { users } from '../schema/users';

export interface CreateSessionData {
  botId: string;
  userId: string;
}

export interface AddMessageData {
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Create a new dialogue session record.
 * Errors propagate to caller (fail-fast).
 */
export async function createDialogueSession(
  db: DrizzleClient,
  data: CreateSessionData
): Promise<DialogueSession> {
  const result = await db
    .insert(dialogueSessions)
    .values({
      botId: data.botId,
      userId: data.userId,
    })
    .returning();

  if (result.length === 0) {
    throw new Error('[dialogue] createDialogueSession: insert returned no rows');
  }

  return result[0];
}

/**
 * Mark a dialogue session as ended by setting endedAt.
 * Errors propagate to caller.
 */
export async function endDialogueSession(
  db: DrizzleClient,
  sessionId: string
): Promise<void> {
  await db
    .update(dialogueSessions)
    .set({ endedAt: new Date() })
    .where(eq(dialogueSessions.id, sessionId));
}

/**
 * Add a message to a dialogue session.
 * Errors propagate to caller (caller handles fire-and-forget).
 */
export async function addDialogueMessage(
  db: DrizzleClient,
  data: AddMessageData
): Promise<DialogueMessage> {
  const result = await db
    .insert(dialogueMessages)
    .values({
      sessionId: data.sessionId,
      role: data.role,
      content: data.content,
    })
    .returning();

  if (result.length === 0) {
    throw new Error('[dialogue] addDialogueMessage: insert returned no rows');
  }

  return result[0];
}

/**
 * Get recent dialogue messages between a bot and a user (by persistent userId).
 * Returns messages across all sessions, ordered by createdAt descending,
 * limited to the most recent N messages.
 */
export async function getRecentDialogueHistory(
  db: DrizzleClient,
  botId: string,
  userId: string,
  limit = 20
): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
  const rows = await db
    .select({
      role: dialogueMessages.role,
      content: dialogueMessages.content,
      createdAt: dialogueMessages.createdAt,
    })
    .from(dialogueMessages)
    .innerJoin(
      dialogueSessions,
      eq(dialogueMessages.sessionId, dialogueSessions.id)
    )
    .where(
      and(
        eq(dialogueSessions.botId, botId),
        eq(dialogueSessions.userId, userId)
      )
    )
    .orderBy(desc(dialogueMessages.createdAt))
    .limit(limit);

  // Return in chronological order (oldest first)
  return rows.reverse();
}

/**
 * Get all messages for a specific dialogue session.
 */
export async function getDialogueSessionMessages(
  db: DrizzleClient,
  sessionId: string
): Promise<DialogueMessage[]> {
  return await db
    .select()
    .from(dialogueMessages)
    .where(eq(dialogueMessages.sessionId, sessionId))
    .orderBy(dialogueMessages.createdAt);
}

export interface DialogueSessionWithMessages {
  sessionId: string;
  startedAt: Date;
  endedAt: Date | null;
  messages: Array<{ role: string; content: string; createdAt: Date }>;
}

/**
 * Get dialogue history for a bot-user pair, grouped by session.
 * Returns ended sessions ordered by startedAt (oldest first),
 * each containing their messages in chronological order.
 */
export async function getDialogueHistoryByUser(
  db: DrizzleClient,
  botId: string,
  userId: string,
  sessionLimit = 10
): Promise<DialogueSessionWithMessages[]> {
  // Fetch ended sessions for this bot-user pair
  const sessions = await db
    .select({
      id: dialogueSessions.id,
      startedAt: dialogueSessions.startedAt,
      endedAt: dialogueSessions.endedAt,
    })
    .from(dialogueSessions)
    .where(
      and(
        eq(dialogueSessions.botId, botId),
        eq(dialogueSessions.userId, userId)
      )
    )
    .orderBy(desc(dialogueSessions.startedAt))
    .limit(sessionLimit);

  if (sessions.length === 0) {
    return [];
  }

  // Fetch messages for all sessions in one query
  const sessionIds = sessions.map((s) => s.id);
  const allMessages = await db
    .select({
      sessionId: dialogueMessages.sessionId,
      role: dialogueMessages.role,
      content: dialogueMessages.content,
      createdAt: dialogueMessages.createdAt,
    })
    .from(dialogueMessages)
    .innerJoin(
      dialogueSessions,
      eq(dialogueMessages.sessionId, dialogueSessions.id)
    )
    .where(
      and(
        eq(dialogueSessions.botId, botId),
        eq(dialogueSessions.userId, userId)
      )
    )
    .orderBy(asc(dialogueMessages.createdAt));

  // Group messages by session
  const messagesBySession = new Map<
    string,
    Array<{ role: string; content: string; createdAt: Date }>
  >();
  for (const msg of allMessages) {
    if (!sessionIds.includes(msg.sessionId)) continue;
    const list = messagesBySession.get(msg.sessionId) ?? [];
    list.push({ role: msg.role, content: msg.content, createdAt: msg.createdAt });
    messagesBySession.set(msg.sessionId, list);
  }

  // Build result in chronological order (oldest session first)
  return sessions.reverse().map((s) => ({
    sessionId: s.id,
    startedAt: s.startedAt,
    endedAt: s.endedAt,
    messages: messagesBySession.get(s.id) ?? [],
  }));
}

/**
 * Admin view of a dialogue session with user info and message count.
 */
export interface AdminDialogueSession {
  sessionId: string;
  startedAt: Date;
  endedAt: Date | null;
  userId: string;
  userName: string | null;
  userEmail: string;
  messageCount: number;
}

/**
 * Get dialogue sessions for a specific bot with user info and message counts.
 * Used by the admin NPC editor to browse conversations.
 * Returns sessions ordered by start time (newest first).
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param botId - Bot UUID
 * @param params - Pagination parameters (limit defaults to 20, offset defaults to 0)
 * @returns Array of AdminDialogueSession records
 */
export async function getAdminDialogueSessions(
  db: DrizzleClient,
  botId: string,
  params?: { limit?: number; offset?: number }
): Promise<AdminDialogueSession[]> {
  const limit = params?.limit ?? 20;
  const offset = params?.offset ?? 0;

  const rows = await db
    .select({
      sessionId: dialogueSessions.id,
      startedAt: dialogueSessions.startedAt,
      endedAt: dialogueSessions.endedAt,
      userId: dialogueSessions.userId,
      userName: users.name,
      userEmail: users.email,
      messageCount: sql<number>`cast(count(${dialogueMessages.id}) as int)`,
    })
    .from(dialogueSessions)
    .leftJoin(users, eq(dialogueSessions.userId, users.id))
    .leftJoin(
      dialogueMessages,
      eq(dialogueSessions.id, dialogueMessages.sessionId)
    )
    .where(eq(dialogueSessions.botId, botId))
    .groupBy(
      dialogueSessions.id,
      dialogueSessions.startedAt,
      dialogueSessions.endedAt,
      dialogueSessions.userId,
      users.name,
      users.email
    )
    .orderBy(desc(dialogueSessions.startedAt))
    .limit(limit)
    .offset(offset);

  return rows.map((r) => ({
    sessionId: r.sessionId,
    startedAt: r.startedAt,
    endedAt: r.endedAt,
    userId: r.userId,
    userName: r.userName,
    userEmail: r.userEmail ?? '',
    messageCount: r.messageCount ?? 0,
  }));
}

/**
 * Get the number of dialogue sessions between a specific bot and user.
 * Used for relationship context (meetingCount).
 * Leverages the idx_ds_bot_user index for efficient lookup.
 * Errors propagate to caller (fail-fast principle).
 *
 * @param db - Drizzle database instance
 * @param botId - Bot UUID
 * @param userId - User UUID
 * @returns The count of dialogue sessions as a number
 */
export async function getSessionCountForPair(
  db: DrizzleClient,
  botId: string,
  userId: string,
): Promise<number> {
  const result = await db
    .select({ count: count() })
    .from(dialogueSessions)
    .where(
      and(
        eq(dialogueSessions.botId, botId),
        eq(dialogueSessions.userId, userId),
      ),
    );

  return Number(result[0]?.count ?? 0);
}
