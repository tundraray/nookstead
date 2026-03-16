import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const MODEL = 'gpt-5-mini';

export interface GeneratedSeedPersona {
  role: string;
  personality: string;
  speechStyle: string;
  bio: string;
  age: number;
  traits: string[];
  goals: string[];
  fears: string[];
  interests: string[];
}

/** @deprecated Use GeneratedSeedPersona instead */
export type GeneratedCharacter = GeneratedSeedPersona;

/**
 * Validate raw parsed JSON and apply per-field defaults.
 * Ensures robust recovery from malformed AI output.
 */
export function validateAndDefault(raw: unknown): GeneratedSeedPersona {
  const obj =
    typeof raw === 'object' && raw !== null
      ? (raw as Record<string, unknown>)
      : {};

  const defaults: Record<string, boolean> = {};

  const role =
    typeof obj.role === 'string' ? obj.role.slice(0, 64) : undefined;
  if (role === undefined) defaults['role'] = true;

  const personality =
    typeof obj.personality === 'string' ? obj.personality : undefined;
  if (personality === undefined) defaults['personality'] = true;

  const speechStyle =
    typeof obj.speechStyle === 'string' ? obj.speechStyle : undefined;
  if (speechStyle === undefined) defaults['speechStyle'] = true;

  const bio = typeof obj.bio === 'string' ? obj.bio : undefined;
  if (bio === undefined) defaults['bio'] = true;

  const rawAge = obj.age;
  const age =
    typeof rawAge === 'number' && rawAge >= 18 && rawAge <= 70
      ? Math.floor(rawAge)
      : undefined;
  if (age === undefined) defaults['age'] = true;

  const traits = Array.isArray(obj.traits)
    ? (obj.traits as unknown[])
        .filter((t): t is string => typeof t === 'string')
        .slice(0, 5)
    : undefined;
  if (traits === undefined) defaults['traits'] = true;

  const goals = Array.isArray(obj.goals)
    ? (obj.goals as unknown[])
        .filter((g): g is string => typeof g === 'string')
        .slice(0, 3)
    : undefined;
  if (goals === undefined) defaults['goals'] = true;

  const fears = Array.isArray(obj.fears)
    ? (obj.fears as unknown[])
        .filter((f): f is string => typeof f === 'string')
        .slice(0, 3)
    : undefined;
  if (fears === undefined) defaults['fears'] = true;

  const interests = Array.isArray(obj.interests)
    ? (obj.interests as unknown[])
        .filter((i): i is string => typeof i === 'string')
        .slice(0, 3)
    : undefined;
  if (interests === undefined) defaults['interests'] = true;

  const defaultedFields = Object.keys(defaults);
  if (defaultedFields.length > 0) {
    console.warn(
      `[generateNpcCharacter] Missing fields using defaults: ${defaultedFields.join(', ')}`
    );
  }

  return {
    role: role ?? 'villager',
    personality: personality ?? 'ordinary',
    speechStyle: speechStyle ?? 'speaks plainly',
    bio: bio ?? 'Lives in the village.',
    age: age ?? 30,
    traits: traits ?? ['hardworking'],
    goals: goals ?? ['live peacefully'],
    fears: fears ?? [],
    interests: interests ?? [],
  };
}

/**
 * Generate NPC character traits using OpenAI.
 * Shared between admin editor (genmap) and game server.
 *
 * @param apiKey - OpenAI API key
 * @param botName - NPC name (used for context)
 * @param concept - Optional concept hint (e.g., "friendly blacksmith")
 */
export async function generateNpcCharacter(
  apiKey: string,
  botName: string,
  concept?: string
): Promise<GeneratedSeedPersona> {
  const openai = createOpenAI({ apiKey });

  const conceptLine = concept
    ? `Character concept: "${concept}".`
    : '';

  const prompt = `You are creating a description of a resident of a small rural settlement. Respond with JSON only.

Resident name: "${botName}".
${conceptLine}

Create a unique, interesting village resident with a backstory.
IMPORTANT: Characters must feel like REAL people, not idealized kind NPCs.
- At least 2 of the 5 traits MUST be flaws or difficult personality aspects (e.g., stubborn, suspicious, hot-tempered, proud, sarcastic, grumpy, impatient, vindictive, jealous, blunt, pessimistic, lazy, gossip-prone, stingy).
- The personality description should include how the character reacts to rudeness or conflict — NOT everyone is patient and understanding.
- Some characters should be easily offended, some should be confrontational, some should be cold or dismissive.

Return ONLY a JSON object (no markdown, no comments):
{
  "role": "Short role title, up to 64 characters (e.g., Baker, Innkeeper, Herbalist)",
  "personality": "2-3 sentences about character traits and behavior, INCLUDING how they handle conflict and rudeness",
  "speechStyle": "1-2 sentences about HOW the character speaks (tone, habits, vocabulary)",
  "bio": "2-3 sentences of biography: where from, why in the village, what they do, a hidden conflict",
  "age": number from 18 to 70,
  "traits": ["trait1", "trait2", "trait3", "trait4", "trait5"] — exactly 5 character traits (at least 2 must be flaws),
  "goals": ["goal1", "goal2"] — 1 to 3 life goals,
  "fears": ["fear1"] — 1 to 3 fears,
  "interests": ["interest1", "interest2", "interest3"] — 2 to 5 interests
}`;

  const result = await generateText({
    model: openai.chat(MODEL),
    prompt,
    maxOutputTokens: 500,
  });

  const parsed = JSON.parse(result.text);
  return validateAndDefault(parsed);
}
