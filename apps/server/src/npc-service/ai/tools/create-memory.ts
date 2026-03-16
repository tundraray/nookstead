import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { createMemory } from '@nookstead/db';
import type { ToolContext } from './index.js';

export const createMemorySchema = z.object({
  content: z.string().min(1).max(500),
  importance: z.number().int().min(1).max(10),
});

export function createMemoryTool(context: ToolContext): Tool {
  return tool({
    description: 'Record an important memory about the current conversation',
    inputSchema: createMemorySchema,
    execute: async ({ content, importance }) => {
      try {
        await createMemory(context.db, {
          botId: context.botId,
          userId: context.userId,
          content,
          importance,
          type: 'tool',
          // TODO: sessionId not yet threaded through ToolContext
          dialogueSessionId: undefined,
        });

        return 'Memory recorded';
      } catch (error) {
        console.error(
          `[create_memory] Failed: bot=${context.botId}, user=${context.userId}`,
          error
        );
        return 'Failed to record memory';
      }
    },
  });
}
