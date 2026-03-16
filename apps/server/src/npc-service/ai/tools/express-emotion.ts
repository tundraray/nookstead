import { z } from 'zod';
import { tool, type Tool } from 'ai';
import { ServerMessage } from '@nookstead/shared';
import type { ToolContext } from './index.js';

export const EMOTIONS = [
  'happy', 'sad', 'angry', 'surprised', 'disgusted', 'fearful',
  'neutral', 'amused', 'grateful', 'annoyed', 'shy', 'proud',
] as const;

export const expressEmotionSchema = z.object({
  emotion: z.enum(EMOTIONS),
  intensity: z.number().int().min(1).max(5),
});

export function expressEmotionTool(context: ToolContext): Tool {
  return tool({
    description: 'Express an emotion for character animation',
    inputSchema: expressEmotionSchema,
    execute: async ({ emotion, intensity }) => {
      try {
        context.sendToClient(ServerMessage.DIALOGUE_EMOTION, {
          emotion,
          intensity,
        });

        return 'Emotion expressed';
      } catch (error) {
        console.error(
          `[express_emotion] Failed: bot=${context.botId}, emotion=${emotion}`,
          error
        );
        return 'Failed to express emotion';
      }
    },
  });
}
