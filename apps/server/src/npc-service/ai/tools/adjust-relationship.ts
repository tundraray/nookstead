import { z } from 'zod';
import { tool, type Tool } from 'ai';
import {
  adjustRelationshipScore,
  updateRelationship,
  npcBots,
  eq,
} from '@nookstead/db';
import { ServerMessage } from '@nookstead/shared';
import {
  evaluateProgression,
  rowToRelationshipData,
} from '../../relationships/index.js';
import type { ToolContext } from './index.js';

export const adjustRelationshipSchema = z.object({
  delta: z.number().int().min(-7).max(3),
  reason: z.string().max(200),
});

/** Per-turn cumulative delta caps (F005) */
const CUMULATIVE_CAP_NEGATIVE = -10;
const CUMULATIVE_CAP_POSITIVE = 5;

/**
 * Derive mood direction and intensity contribution from delta magnitude.
 */
function deriveMood(delta: number): { mood: string; intensity: number } {
  if (delta <= -5) return { mood: 'angry', intensity: 3 };
  if (delta <= -2) return { mood: 'annoyed', intensity: 2 };
  if (delta < 0) return { mood: 'annoyed', intensity: 1 };
  if (delta >= 3) return { mood: 'happy', intensity: 2 };
  return { mood: 'happy', intensity: 1 };
}

export function adjustRelationshipTool(context: ToolContext): Tool {
  return tool({
    description: 'Change relationship level with the player',
    inputSchema: adjustRelationshipSchema,
    execute: async ({ delta, reason }) => {
      try {
        // F005: Per-turn cumulative delta cap check
        const projected = context.cumulativeDelta + delta;
        if (projected < CUMULATIVE_CAP_NEGATIVE || projected > CUMULATIVE_CAP_POSITIVE) {
          return 'Turn change limit exceeded';
        }

        // 1. Score adjustment
        const updatedRow = await adjustRelationshipScore(
          context.db,
          context.botId,
          context.userId,
          delta
        );

        // Update cumulative tracking on success
        context.cumulativeDelta += delta;

        // 2. Progression evaluation
        const relData = rowToRelationshipData(updatedRow);
        const newSocialType = evaluateProgression(
          relData,
          context.persona?.traits
        );

        // Update social type if changed
        if (newSocialType !== relData.socialType) {
          await updateRelationship(
            context.db,
            context.botId,
            context.userId,
            { socialType: newSocialType }
          );
        }

        // 3. Mood update (best-effort, separate try/catch to avoid blocking score change)
        try {
          const { mood, intensity } = deriveMood(delta);
          await context.db
            .update(npcBots)
            .set({
              mood,
              moodIntensity: Math.min(10, intensity),
              moodUpdatedAt: new Date(),
            })
            .where(eq(npcBots.id, context.botId));
        } catch (moodError) {
          console.error(
            `[adjust_relationship] Mood update failed: bot=${context.botId}`,
            moodError
          );
        }

        // 4. Client notification
        context.sendToClient(ServerMessage.DIALOGUE_SCORE_CHANGE, {
          delta,
          newScore: updatedRow.score,
          reason,
          newSocialType,
        });

        return `Relationship changed by ${delta}`;
      } catch (error) {
        console.error(
          `[adjust_relationship] Failed: bot=${context.botId}, user=${context.userId}, delta=${delta}`,
          error
        );
        return 'Failed to change relationship';
      }
    },
  });
}
