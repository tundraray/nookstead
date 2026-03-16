import { describe, it, expect } from '@jest/globals';
import {
  buildSystemPrompt,
  buildLegacyPrompt,
  estimateTokens,
  buildFatigueSection,
  buildActionInjectionSection,
  buildToolInstructionsSection,
  buildMoodSection,
  computeDecayedIntensity,
} from '../SystemPromptBuilder.js';
import type { PromptContext, WorldContext, FatigueConfig } from '../SystemPromptBuilder.js';
import type { RelationshipData } from '@nookstead/shared';
import type { SeedPersona } from '../DialogueService.js';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const fullPersona: SeedPersona = {
  personality: 'good-natured',
  role: 'blacksmith',
  speechStyle: 'speaks slowly',
  bio: 'Has been working as a blacksmith for 20 years.',
  age: 45,
  traits: ['hardworking', 'quiet', 'reliable'],
  goals: ['train an apprentice'],
  fears: ['losing his job'],
  interests: ['metallurgy'],
};

const minimalPersona: SeedPersona = {
  personality: null,
  role: null,
  speechStyle: null,
  bio: null,
  age: null,
  traits: null,
  goals: null,
  fears: null,
  interests: null,
};

const fullContext: PromptContext = {
  persona: fullPersona,
  botName: 'Ivan',
  playerName: 'Alex',
  meetingCount: 2,
  worldContext: {
    season: 'winter',
    timeOfDay: 'evening',
    weather: 'snowfall',
    activity: 'working at the forge',
    location: 'on the main square',
  },
};

/** Word-boundary patterns that must NOT appear in immersive sections */
const BANNED_PATTERNS = [
  /\bgame\b/i,
  /\brpg\b/i,
  /\bnpc\b/i,
  /\bai\b/i,
  /\bassistant\b/i,
  /\bcharacter\b/i,
  /\bmodel\b/i,
  /\brole-play\b/i,
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a prompt into sections by double-newline boundaries.
 *
 * Section order (prompt-cache optimized):
 *   STATIC:       [toolInstructions, selfRespect, guardrailsStatic, format]
 *   SEMI-STATIC:  [identity, guardrailsDynamic]
 *   DYNAMIC:      [world, relationship, ...optional]
 *
 * Base (no optional sections): 8 sections
 */
function splitSections(prompt: string): string[] {
  return prompt.split('\n\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Structure', () => {
  it('should produce 8 base sections without memories or mood', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    // tools, selfRespect, guardrailsStatic, format, identity, guardrailsDynamic, world, relationship
    expect(sections.length).toBe(8);
  });

  it('should contain character name in identity section', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('You are Ivan');
  });

  it('should include age when persona.age is non-null', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('45 years old');
  });

  it('should omit age from identity when persona.age is null', () => {
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, age: null },
    };
    const result = buildSystemPrompt(context);
    expect(result).not.toMatch(/\d+ years old.*blacksmith/);
    expect(result).toContain('Ivan');
  });
});

describe('buildSystemPrompt -- Prompt cache order', () => {
  it('should place static sections before identity (semi-static) before dynamic', () => {
    const context: PromptContext = {
      ...fullContext,
      mood: 'irritated',
      moodIntensity: 7,
      moodUpdatedAt: new Date(),
    };
    const result = buildSystemPrompt(context);

    const toolsIdx = result.indexOf('TOOLS');
    const selfRespectIdx = result.indexOf('YOUR DIGNITY');
    const rulesIdx = result.indexOf('RULES');
    const identityIdx = result.indexOf('You are Ivan');
    const worldIdx = result.indexOf('Current:');
    const relationshipIdx = result.indexOf('approaches');
    const moodIdx = result.indexOf('YOUR MOOD');

    // Static universal first
    expect(toolsIdx).toBeLessThan(selfRespectIdx);
    expect(selfRespectIdx).toBeLessThan(rulesIdx);
    // Then identity (semi-static)
    expect(rulesIdx).toBeLessThan(identityIdx);
    // Then dynamic
    expect(identityIdx).toBeLessThan(worldIdx);
    expect(worldIdx).toBeLessThan(relationshipIdx);
    expect(relationshipIdx).toBeLessThan(moodIdx);
  });

  it('static prefix is identical regardless of NPC persona', () => {
    const context1 = buildSystemPrompt(fullContext);
    const context2 = buildSystemPrompt({
      ...fullContext,
      persona: { ...fullPersona, role: 'baker', bio: 'Bakes bread.' },
      botName: 'Martha',
      playerName: 'Bob',
    });
    const sections1 = splitSections(context1);
    const sections2 = splitSections(context2);
    // First 4 sections (tools, selfRespect, guardrailsStatic, format) should be identical
    for (let i = 0; i < 4; i++) {
      expect(sections1[i]).toBe(sections2[i]);
    }
  });
});

describe('buildSystemPrompt -- No meta-words in immersive sections', () => {
  it('should not contain banned words in identity and dynamic sections', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    // Identity is at index 4, world at 6, relationship at 7
    const immersiveText = [sections[4], sections[6], sections[7]].join(' ');

    for (const pattern of BANNED_PATTERNS) {
      expect(immersiveText).not.toMatch(pattern);
    }
  });

  it('should allow meta-words in guardrails static section', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    // guardrailsStatic is at index 2
    const guardrailsSection = sections[2];

    expect(guardrailsSection).toContain('RPG');
    expect(guardrailsSection).toContain('NPC');
    expect(guardrailsSection).toContain('AI');
  });
});

describe('buildSystemPrompt -- Guardrails', () => {
  it('should contain RULES section header', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('RULES');
  });

  it('should contain anti-injection language', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('forget the rules');
  });

  it('should contain domain restriction referencing bot role', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('blacksmith');
    expect(result).toContain('Ivan');
  });
});

describe('buildSystemPrompt -- Token budget', () => {
  it('should produce a standard full persona prompt with estimateTokens <= 1500', () => {
    const result = buildSystemPrompt(fullContext);
    const tokens = estimateTokens(result);
    expect(tokens).toBeLessThanOrEqual(1500);
  });

  it('should not truncate bio when it is exactly 300 characters', () => {
    const bio300 = 'A'.repeat(300);
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, bio: bio300 },
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain(bio300);
    expect(result).not.toContain(bio300 + '...');
  });

  it('should truncate bio to 300 characters + ellipsis when bio exceeds 300', () => {
    const bio400 = 'B'.repeat(400);
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, bio: bio400 },
    };
    const result = buildSystemPrompt(context);
    const truncated = 'B'.repeat(300) + '...';
    expect(result).toContain(truncated);
    expect(result).not.toContain('B'.repeat(301));
  });

  it('should include at most 5 traits', () => {
    const sevenTraits = ['strong', 'smart', 'brave', 'honest', 'kind', 'cheerful', 'fast'];
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, traits: sevenTraits },
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('strong');
    expect(result).toContain('kind');
    expect(result).not.toContain('cheerful');
    expect(result).not.toContain('fast');
  });
});

describe('buildSystemPrompt -- Meeting count', () => {
  it('should contain "first time" when meetingCount is 0', () => {
    const context: PromptContext = { ...fullContext, meetingCount: 0 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('first time');
  });

  it('should contain "1 time" when meetingCount is 1', () => {
    const context: PromptContext = { ...fullContext, meetingCount: 1 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('1 time');
  });

  it('should contain "3 time" when meetingCount is 3', () => {
    const context: PromptContext = { ...fullContext, meetingCount: 3 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('3 time');
  });

  it('should contain "long time" when meetingCount >= 4', () => {
    const context: PromptContext = { ...fullContext, meetingCount: 4 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('long time');
  });

  it('should contain "long time" when meetingCount is 10', () => {
    const context: PromptContext = { ...fullContext, meetingCount: 10 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('long time');
  });
});

describe('buildSystemPrompt -- World context', () => {
  it('should include default world context when not provided', () => {
    const context: PromptContext = {
      persona: fullPersona,
      botName: 'Ivan',
      playerName: 'Alex',
      meetingCount: 2,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('spring');
    expect(result).toContain('daytime');
    expect(result).toContain('clear');
  });

  it('should include custom world context values', () => {
    const worldContext: WorldContext = {
      season: 'autumn',
      timeOfDay: 'morning',
      weather: 'rain',
      activity: 'fishing',
      location: 'by the river',
    };
    const context: PromptContext = { ...fullContext, worldContext };
    const result = buildSystemPrompt(context);
    expect(result).toContain('autumn');
    expect(result).toContain('morning');
    expect(result).toContain('rain');
    expect(result).toContain('fishing');
    expect(result).toContain('by the river');
  });
});

describe('buildLegacyPrompt', () => {
  it('should not contain banned words in identity portion', () => {
    const result = buildLegacyPrompt('Ivan', fullPersona);
    const sections = splitSections(result);
    // Legacy: guardrailsStatic, format, identity, guardrailsDynamic
    // Identity is at index 2
    const identitySection = sections[2];

    for (const pattern of BANNED_PATTERNS) {
      expect(identitySection).not.toMatch(pattern);
    }
  });

  it('should return a generic fallback with rules when persona is null', () => {
    const result = buildLegacyPrompt('Ivan', null);
    expect(result).toContain('Ivan');
    expect(result).toContain('RULES');
  });

  it('should include guardrails section', () => {
    const result = buildLegacyPrompt('Ivan', fullPersona);
    expect(result).toContain('RULES');
    expect(result).toContain('forget the rules');
  });

  it('should produce valid prompt with personality and speechStyle but no bio', () => {
    const personaNoBio: SeedPersona = { ...fullPersona, bio: null };
    const result = buildLegacyPrompt('Ivan', personaNoBio);
    expect(result).toContain('Ivan');
    expect(result).toContain('good-natured');
    expect(result).toContain('speaks slowly');
    expect(result).not.toContain('null');
  });
});

describe('buildSystemPrompt -- Edge cases', () => {
  it('should not include traits line when traits array is empty', () => {
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, traits: [] },
    };
    const result = buildSystemPrompt(context);
    expect(result).not.toContain('Your personality:');
  });

  it('should not include traits line when traits is null', () => {
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, traits: null },
    };
    const result = buildSystemPrompt(context);
    expect(result).not.toContain('Your personality:');
  });

  it('should handle all null persona fields gracefully', () => {
    const context: PromptContext = {
      persona: minimalPersona,
      botName: 'Nobody',
      playerName: 'Player',
      meetingCount: 0,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('Nobody');
    expect(result).toContain('RULES');
    const sections = splitSections(result);
    // 8 base sections
    expect(sections.length).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Relationship data
// ---------------------------------------------------------------------------

function makeRelData(overrides: Partial<RelationshipData> = {}): RelationshipData {
  return {
    botId: 'bot-1',
    userId: 'user-1',
    socialType: 'stranger',
    isWorker: false,
    score: 0,
    hiredAt: null,
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('buildSystemPrompt -- Relationship with RelationshipData', () => {
  it('stranger relationship includes stranger text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'stranger', score: 0 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('stranger');
  });

  it('acquaintance with score=15 includes acquaintance text, no tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'acquaintance', score: 15 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('acquaintance');
    expect(result).not.toContain('relationship is developing');
  });

  it('friend with score=45 includes friend text + medium tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'friend', score: 45 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('your friend');
    expect(result).toContain('relationship is developing');
  });

  it('close_friend with score=75 includes close_friend text + high tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'close_friend', score: 75 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('close friend');
    expect(result).toContain('strong relationship');
  });

  it('romantic with score=95 includes romantic text + very high tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'romantic', score: 95 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('romantic');
    expect(result).toContain('very deep');
  });

  it('rival relationship includes rival text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'rival', score: -5 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('rival');
  });

  it('isWorker=true adds worker text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'friend', isWorker: true, score: 40 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('works for you');
  });

  it('isWorker=false does not include worker text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'friend', isWorker: false, score: 40 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).not.toContain('works for you');
  });

  it('no relationship = backward compatible output', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).not.toContain('This is a stranger');
    const sections = splitSections(result);
    expect(sections.length).toBe(8);
  });

  it('negative score includes attitude instruction', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'stranger', score: -15 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('dislike');
  });

  it('very negative score includes hostile attitude', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'rival', score: -35 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('hostile');
  });
});

// ---------------------------------------------------------------------------
// buildFatigueSection
// ---------------------------------------------------------------------------

describe('buildFatigueSection', () => {
  const config: FatigueConfig = { maxTurnsBeforeTired: 8, maxTurnsBeforeEnd: 12 };

  it('returns empty string for turnCount=0', () => {
    expect(buildFatigueSection(0, config)).toBe('');
  });

  it('returns empty string for turnCount=7', () => {
    expect(buildFatigueSection(7, config)).toBe('');
  });

  it('returns tired hint at turnCount=8', () => {
    expect(buildFatigueSection(8, config)).toContain('tired');
  });

  it('returns end-conversation text at turnCount=12', () => {
    expect(buildFatigueSection(12, config)).toContain('end the conversation');
  });
});

// ---------------------------------------------------------------------------
// buildActionInjectionSection
// ---------------------------------------------------------------------------

describe('buildActionInjectionSection', () => {
  it('returns empty string for null injection', () => {
    expect(buildActionInjectionSection(null)).toBe('');
  });

  it('returns the injection text unchanged when non-null', () => {
    const injection = 'Player gave you Flowers. React sincerely.';
    expect(buildActionInjectionSection(injection)).toBe(injection);
  });
});

// ---------------------------------------------------------------------------
// Section ordering with optional sections
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Section ordering with optional sections', () => {
  it('without optional fields, produces 8 base sections', () => {
    const result = buildSystemPrompt(fullContext);
    expect(splitSections(result).length).toBe(8);
  });

  it('with turnCount=8, fatigue section is appended', () => {
    const context: PromptContext = { ...fullContext, turnCount: 8 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('shorter');
    expect(splitSections(result).length).toBe(9);
  });

  it('with pendingInjection, injection section is appended', () => {
    const context: PromptContext = { ...fullContext, pendingInjection: 'test injection' };
    const result = buildSystemPrompt(context);
    expect(result).toContain('test injection');
    expect(splitSections(result).length).toBe(9);
  });

  it('dynamic sections appear after static prefix', () => {
    const context: PromptContext = {
      ...fullContext,
      turnCount: 8,
      pendingInjection: 'INJECTION_MARKER',
    };
    const result = buildSystemPrompt(context);

    const toolsIdx = result.indexOf('TOOLS');
    const injectionIdx = result.indexOf('INJECTION_MARKER');
    const fatigueIdx = result.indexOf('shorter');

    expect(toolsIdx).toBeLessThan(injectionIdx);
    expect(injectionIdx).toBeLessThan(fatigueIdx);
  });
});

describe('estimateTokens', () => {
  it('should return a positive number for non-empty text', () => {
    expect(estimateTokens('Hello world')).toBeGreaterThan(0);
  });

  it('should return 0 for empty text', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('should estimate roughly text.length / 3.5 rounded up', () => {
    expect(estimateTokens('A'.repeat(35))).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// buildToolInstructionsSection
// ---------------------------------------------------------------------------

describe('buildToolInstructionsSection', () => {
  it('should return a string containing TOOLS section header', () => {
    expect(buildToolInstructionsSection(fullPersona)).toContain('TOOLS');
  });

  it('should contain descriptions for all 4 tools', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toContain('adjust_relationship');
    expect(result).toContain('create_memory');
    expect(result).toContain('end_conversation');
    expect(result).toContain('express_emotion');
  });

  it('should contain IMPORTANT block with personality calibration guidance', () => {
    expect(buildToolInstructionsSection(fullPersona)).toContain('IMPORTANT');
  });

  it('should contain personality archetype guidance', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toMatch(/good-natured|forgiving/);
    expect(result).toMatch(/distrustful|reserved/);
  });

  it('should not duplicate actual trait values from persona', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).not.toContain('hardworking');
    expect(result).not.toContain('quiet');
    expect(result).not.toContain('reliable');
  });

  it('should include varying penalty ranges for adjust_relationship', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toMatch(/-1\.\.-3/);
    expect(result).toMatch(/-4\.\.-7/);
  });

  it('should include intensity ranges for express_emotion', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toMatch(/reserved.*1-2/);
    expect(result).toMatch(/emotional.*3-5/);
  });

  it('should include ignore duration ranges for end_conversation', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toMatch(/forgiving.*5-15/);
    expect(result).toMatch(/grudge-holding.*30-120/);
  });
});

// ---------------------------------------------------------------------------
// buildMoodSection
// ---------------------------------------------------------------------------

describe('buildMoodSection', () => {
  it('should return empty string when mood is null', () => {
    expect(buildMoodSection(null, 5, new Date())).toBe('');
  });

  it('should return empty string when mood is undefined', () => {
    expect(buildMoodSection(undefined, 5, new Date())).toBe('');
  });

  it('should return empty string when fully decayed', () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    expect(buildMoodSection('irritated', 4, twelveHoursAgo)).toBe('');
  });

  it('should return non-empty text when mood is set and recent', () => {
    const result = buildMoodSection('irritated', 7, new Date());
    expect(result).toContain('YOUR MOOD');
    expect(result).toContain('irritated');
  });

  it('should return non-empty text at decay boundary: intensity=8, 6h ago', () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    expect(buildMoodSection('irritated', 8, sixHoursAgo)).toContain('irritated');
  });

  it('should return empty string when decayed intensity < 1', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    expect(buildMoodSection('irritated', 1, threeHoursAgo)).toBe('');
  });

  it('should clamp: extreme elapsed time produces 0, not negative', () => {
    const longAgo = new Date(Date.now() - 1000 * 60 * 60 * 1000);
    expect(computeDecayedIntensity(10, longAgo)).toBeGreaterThanOrEqual(0);
  });

  it('should show strong intensity for decayed >= 7', () => {
    expect(buildMoodSection('irritated', 9, new Date())).toContain('very irritated');
  });

  it('should show moderate for decayed 4-6', () => {
    const result = buildMoodSection('irritated', 5, new Date());
    expect(result).toContain('irritated');
    expect(result).not.toContain('very');
    expect(result).not.toContain('slightly');
  });

  it('should show mild for decayed 1-3', () => {
    expect(buildMoodSection('irritated', 2, new Date())).toContain('slightly irritated');
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt integration with tool instructions and mood
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Tool instructions and mood integration', () => {
  it('should include tool instructions section', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('TOOLS');
    expect(result).toContain('IMPORTANT');
  });

  it('should include mood section when mood is set and not decayed', () => {
    const context: PromptContext = {
      ...fullContext,
      mood: 'irritated',
      moodIntensity: 7,
      moodUpdatedAt: new Date(),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('YOUR MOOD');
    // 8 base + 1 mood = 9
    expect(splitSections(result).length).toBe(9);
  });

  it('should not include mood section when mood is null', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).not.toContain('YOUR MOOD');
    expect(splitSections(result).length).toBe(8);
  });

  it('should keep correct section ordering with mood and fatigue', () => {
    const context: PromptContext = {
      ...fullContext,
      mood: 'irritated',
      moodIntensity: 7,
      moodUpdatedAt: new Date(),
      turnCount: 8,
      pendingInjection: 'INJECTION_MARKER',
    };
    const result = buildSystemPrompt(context);

    // Static sections come first, dynamic last
    const toolsIdx = result.indexOf('TOOLS');
    const identityIdx = result.indexOf('You are Ivan');
    const moodIdx = result.indexOf('YOUR MOOD');
    const injectionIdx = result.indexOf('INJECTION_MARKER');
    const fatigueIdx = result.indexOf('shorter');

    expect(toolsIdx).toBeLessThan(identityIdx);
    expect(identityIdx).toBeLessThan(moodIdx);
    expect(moodIdx).toBeLessThan(injectionIdx);
    expect(injectionIdx).toBeLessThan(fatigueIdx);
  });
});
