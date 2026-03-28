import { z } from 'zod';

/**
 * Valid mood values for NPC reflections.
 *
 * Must match the EMOTIONS array from
 * apps/server/src/npc-service/ai/tools/express-emotion.ts
 * for consistency across the game server and steward worker.
 */
export const REFLECTION_MOOD_ENUM = [
  'happy',
  'sad',
  'angry',
  'surprised',
  'disgusted',
  'fearful',
  'neutral',
  'amused',
  'grateful',
  'annoyed',
  'shy',
  'proud',
] as const;

/**
 * Zod schema for structured LLM output from generateObject().
 * Defines the shape of a single NPC daily reflection.
 */
export const reflectionOutputSchema = z.object({
  summary: z
    .string()
    .min(1)
    .max(500)
    .describe(
      'A 1-3 sentence summary of the day from the NPC perspective'
    ),
  mood: z
    .enum(REFLECTION_MOOD_ENUM)
    .describe(
      'The NPC current emotional state after reflecting on the day'
    ),
  moodIntensity: z
    .number()
    .int()
    .min(1)
    .max(10)
    .describe(
      'How strongly the NPC feels this mood, 1=barely, 10=overwhelmingly'
    ),
  moodRationale: z
    .string()
    .min(1)
    .max(300)
    .describe('Brief explanation of why the NPC feels this way'),
  plan: z
    .string()
    .min(1)
    .max(300)
    .describe('What the NPC intends to do tomorrow, 1-2 sentences'),
});

export type ReflectionOutput = z.infer<typeof reflectionOutputSchema>;
