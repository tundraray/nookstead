import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { createPlayerStatus } from '@nookstead/db';
import type { ToolContext } from './index.js';

export const endConversationSchema = z.object({
  reason: z.string().min(1).max(200),
  setIgnore: z.boolean().optional().default(false),
  ignoreDurationMinutes: z.number().int().min(5).max(1440).optional().default(60),
});

export function endConversationTool(context: ToolContext): Tool {
  return tool({
    description: 'Завершить разговор с игроком',
    inputSchema: endConversationSchema,
    execute: async ({ reason, setIgnore, ignoreDurationMinutes }) => {
      // Set deferred end flag unconditionally (F004 pattern).
      // The session is NOT closed here -- ChunkRoom handles cleanup
      // after the stream finishes when it detects endRequested === true.
      context.endRequested = true;

      try {
        if (setIgnore) {
          await createPlayerStatus(
            context.db,
            context.botId,
            context.userId,
            'ignore',
            reason,
            ignoreDurationMinutes
          );
        }
      } catch (error) {
        console.error(
          `[end_conversation] Failed to create ignore status: bot=${context.botId}, user=${context.userId}`,
          error
        );
        // endRequested is already set -- conversation still ends
        // even if ignore status creation fails
        return 'Разговор завершён (статус игнорирования не установлен)';
      }

      return 'Разговор завершён';
    },
  });
}
