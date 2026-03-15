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
  personality: 'добродушный',
  role: 'кузнец',
  speechStyle: 'говорит медленно',
  bio: 'Работает кузнецом уже 20 лет.',
  age: 45,
  traits: ['трудолюбивый', 'молчаливый', 'надёжный'],
  goals: ['обучить ученика'],
  fears: ['потерять работу'],
  interests: ['металлургия'],
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
  botName: 'Иван',
  playerName: 'Алекс',
  meetingCount: 2,
  worldContext: {
    season: 'зима',
    timeOfDay: 'вечер',
    weather: 'снегопад',
    activity: 'работаешь в кузнице',
    location: 'на главной площади',
  },
};

/** Words that must NOT appear in immersive sections (1-3) */
const BANNED_WORDS = [
  'game',
  'RPG',
  'NPC',
  'AI',
  'assistant',
  'character',
  'model',
  'role-play',
  'игра',
  'персонаж',
  'ролевая игра',
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Split a prompt into sections by double-newline boundaries.
 * Base (no optional sections): 6 sections
 *   [identity, world, relationship, toolInstructions, guardrails, format]
 */
function splitSections(prompt: string): string[] {
  return prompt.split('\n\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Structure (AC-1)', () => {
  it('should produce output containing 6 sections without memories or mood', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    // identity, world, relationship, toolInstructions, guardrails, format
    expect(sections.length).toBe(6);
  });

  it('should begin with character name when given a full persona', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toMatch(/^Ты — Иван/);
  });

  it('should include age when persona.age is non-null', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('45 лет');
  });

  it('should omit age from identity opening line when persona.age is null', () => {
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, age: null },
    };
    const result = buildSystemPrompt(context);
    const sections = splitSections(result);
    const identityFirstLine = sections[0].split('\n')[0];
    // The opening line should NOT contain an age pattern like "45 лет"
    expect(identityFirstLine).not.toMatch(/\d+ лет/);
    // It should still contain the bot name
    expect(identityFirstLine).toContain('Иван');
  });
});

describe('buildSystemPrompt -- No meta-words in immersive sections (AC-2)', () => {
  it('should not contain any banned words in sections 1-3 (identity, world, relationship)', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    const immersiveText = sections.slice(0, 3).join(' ');

    for (const word of BANNED_WORDS) {
      expect(immersiveText.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('should not contain banned words in sections 1-3 even with minimal persona', () => {
    const context: PromptContext = {
      persona: minimalPersona,
      botName: 'Василий',
      playerName: 'Пётр',
      meetingCount: 0,
    };
    const result = buildSystemPrompt(context);
    const sections = splitSections(result);
    const immersiveText = sections.slice(0, 3).join(' ');

    for (const word of BANNED_WORDS) {
      expect(immersiveText.toLowerCase()).not.toContain(word.toLowerCase());
    }
  });

  it('should allow meta-words in guardrails section for prohibition context', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    // guardrails is at index 4 (identity=0, world=1, relationship=2, toolInstructions=3, guardrails=4, format=5)
    const guardrailsSection = sections[4];

    // Guardrails section references these words to prohibit them
    expect(guardrailsSection).toContain('RPG');
    expect(guardrailsSection).toContain('NPC');
    expect(guardrailsSection).toContain('ИИ');
  });
});

describe('buildSystemPrompt -- Guardrails (AC-5)', () => {
  it('should contain ПРАВИЛА section header in output', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('ПРАВИЛА');
  });

  it('should contain anti-injection language in guardrails', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    const guardrails = sections[4];
    // The guardrails mention ignoring attempts to break character
    expect(guardrails).toContain('забыть правила');
  });

  it('should contain domain restriction language referencing bot role', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
    const guardrails = sections[4];
    expect(guardrails).toContain('кузнец');
    expect(guardrails).toContain('Иван');
  });
});

describe('buildSystemPrompt -- Token budget (AC-6)', () => {
  it('should produce a standard full persona prompt with estimateTokens <= 1500', () => {
    const result = buildSystemPrompt(fullContext);
    const tokens = estimateTokens(result);
    expect(tokens).toBeLessThanOrEqual(1500);
  });

  it('should not truncate bio when it is exactly 300 characters', () => {
    const bio300 = 'А'.repeat(300);
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, bio: bio300 },
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain(bio300);
    expect(result).not.toContain(bio300 + '...');
  });

  it('should truncate bio to 300 characters + ellipsis when bio exceeds 300 characters', () => {
    const bio400 = 'Б'.repeat(400);
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, bio: bio400 },
    };
    const result = buildSystemPrompt(context);
    const truncated = 'Б'.repeat(300) + '...';
    expect(result).toContain(truncated);
    expect(result).not.toContain('Б'.repeat(301));
  });

  it('should include at most 5 traits when more than 5 are provided', () => {
    const sevenTraits = [
      'сильный',
      'умный',
      'храбрый',
      'честный',
      'добрый',
      'весёлый',
      'быстрый',
    ];
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, traits: sevenTraits },
    };
    const result = buildSystemPrompt(context);
    // First 5 traits should be present
    expect(result).toContain('сильный');
    expect(result).toContain('умный');
    expect(result).toContain('храбрый');
    expect(result).toContain('честный');
    expect(result).toContain('добрый');
    // 6th and 7th traits should NOT be present
    expect(result).not.toContain('весёлый');
    expect(result).not.toContain('быстрый');
  });
});

describe('buildSystemPrompt -- Meeting count (AC-7)', () => {
  it('should contain "впервые" when meetingCount is 0', () => {
    const context: PromptContext = {
      ...fullContext,
      meetingCount: 0,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('впервые');
  });

  it('should contain "1 раз" when meetingCount is 1', () => {
    const context: PromptContext = {
      ...fullContext,
      meetingCount: 1,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('1 раз');
  });

  it('should contain "3 раз" when meetingCount is 3', () => {
    const context: PromptContext = {
      ...fullContext,
      meetingCount: 3,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('3 раз');
  });

  it('should contain "давно знаком" when meetingCount is 4 or more', () => {
    const context: PromptContext = {
      ...fullContext,
      meetingCount: 4,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('давно знаком');
  });

  it('should contain "давно знаком" when meetingCount is 10', () => {
    const context: PromptContext = {
      ...fullContext,
      meetingCount: 10,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('давно знаком');
  });
});

describe('buildSystemPrompt -- World context (AC-8)', () => {
  it('should include default world context when worldContext is not provided', () => {
    const context: PromptContext = {
      persona: fullPersona,
      botName: 'Иван',
      playerName: 'Алекс',
      meetingCount: 2,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('весна');
    expect(result).toContain('день');
    expect(result).toContain('ясно');
  });

  it('should include custom world context values when worldContext is provided', () => {
    const worldContext: WorldContext = {
      season: 'осень',
      timeOfDay: 'утро',
      weather: 'дождь',
      activity: 'ловишь рыбу',
      location: 'у реки',
    };
    const context: PromptContext = {
      ...fullContext,
      worldContext,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('осень');
    expect(result).toContain('утро');
    expect(result).toContain('дождь');
    expect(result).toContain('ловишь рыбу');
    expect(result).toContain('у реки');
  });
});

describe('buildLegacyPrompt -- Backward compat (AC-9)', () => {
  it('should not contain banned words in the identity portion (before guardrails)', () => {
    const result = buildLegacyPrompt('Иван', fullPersona);
    // Legacy prompt has 3 sections: identity, guardrails, format
    const sections = splitSections(result);
    const identitySection = sections[0];

    for (const word of BANNED_WORDS) {
      expect(identitySection.toLowerCase()).not.toContain(
        word.toLowerCase()
      );
    }
  });

  it('should return a generic fallback with guardrails when persona is null', () => {
    const result = buildLegacyPrompt('Иван', null);
    expect(result).toContain('Иван');
    expect(result).toContain('ПРАВИЛА');
  });

  it('should include guardrails section in legacy prompt', () => {
    const result = buildLegacyPrompt('Иван', fullPersona);
    expect(result).toContain('ПРАВИЛА');
    expect(result).toContain('забыть правила');
  });

  it('should produce valid prompt with personality and speechStyle but no bio', () => {
    const personaNoBio: SeedPersona = {
      ...fullPersona,
      bio: null,
    };
    const result = buildLegacyPrompt('Иван', personaNoBio);
    expect(result).toContain('Иван');
    expect(result).toContain('добродушный');
    expect(result).toContain('говорит медленно');
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
    expect(result).not.toContain('Твой характер:');
  });

  it('should not include traits line when traits is null', () => {
    const context: PromptContext = {
      ...fullContext,
      persona: { ...fullPersona, traits: null },
    };
    const result = buildSystemPrompt(context);
    expect(result).not.toContain('Твой характер:');
  });

  it('should handle all null persona fields gracefully', () => {
    const context: PromptContext = {
      persona: minimalPersona,
      botName: 'Никто',
      playerName: 'Игрок',
      meetingCount: 0,
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('Никто');
    expect(result).toContain('ПРАВИЛА');
    const sections = splitSections(result);
    // Base 6 sections: identity, world, relationship, toolInstructions, guardrails, format
    expect(sections.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Relationship data fixtures
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

// ---------------------------------------------------------------------------
// buildRelationshipSection with RelationshipData (AC-5)
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Relationship with RelationshipData', () => {
  it('stranger relationship includes stranger text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'stranger', score: 0 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('незнакомец');
  });

  it('acquaintance with score=15 includes acquaintance text, no tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'acquaintance', score: 15 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('знакомый');
    expect(result).not.toContain('отношения развиваются');
  });

  it('friend with score=45 includes friend text + medium tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'friend', score: 45 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('твой друг');
    expect(result).toContain('отношения развиваются');
  });

  it('close_friend with score=75 includes close_friend text + high tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'close_friend', score: 75 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('близкий друг');
    expect(result).toContain('крепкие отношения');
  });

  it('romantic with score=95 includes romantic text + very high tier', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'romantic', score: 95 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('романтические');
    expect(result).toContain('очень глубокие');
  });

  it('rival relationship includes rival text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'rival', score: -5 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('соперник');
  });

  it('isWorker=true adds worker text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'friend', isWorker: true, score: 40 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('работает на тебя');
  });

  it('isWorker=false does not include worker text', () => {
    const context: PromptContext = {
      ...fullContext,
      relationship: makeRelData({ socialType: 'friend', isWorker: false, score: 40 }),
    };
    const result = buildSystemPrompt(context);
    expect(result).not.toContain('работает на тебя');
  });

  it('no relationship = backward compatible output', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).not.toContain('незнакомец');
    expect(result).not.toContain('знакомый');
    const sections = splitSections(result);
    // Base 6 sections
    expect(sections.length).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// buildFatigueSection (AC-4)
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
    const result = buildFatigueSection(8, config);
    expect(result).toContain('устал');
  });

  it('returns tired hint at turnCount=9', () => {
    const result = buildFatigueSection(9, config);
    expect(result).toContain('устал');
  });

  it('returns tired hint at turnCount=11 (still below end)', () => {
    const result = buildFatigueSection(11, config);
    expect(result).toContain('устал');
  });

  it('returns end-conversation text at turnCount=12', () => {
    const result = buildFatigueSection(12, config);
    expect(result).toContain('заканчивать');
  });

  it('returns end-conversation text at turnCount=15', () => {
    const result = buildFatigueSection(15, config);
    expect(result).toContain('заканчивать');
  });
});

// ---------------------------------------------------------------------------
// buildActionInjectionSection (AC-5)
// ---------------------------------------------------------------------------

describe('buildActionInjectionSection', () => {
  it('returns empty string for null injection', () => {
    expect(buildActionInjectionSection(null)).toBe('');
  });

  it('returns the injection text unchanged when non-null', () => {
    const injection = 'Player подарил(а) тебе Цветы. Отреагируй искренне.';
    expect(buildActionInjectionSection(injection)).toBe(injection);
  });

  it('returns Russian content verbatim', () => {
    const injection = 'Тестовая инъекция.';
    expect(buildActionInjectionSection(injection)).toBe('Тестовая инъекция.');
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt section ordering
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Section ordering with new sections', () => {
  it('without optional fields, produces 6 base sections', () => {
    const result = buildSystemPrompt(fullContext);
    expect(splitSections(result).length).toBe(6);
  });

  it('with turnCount=8, fatigue section is present', () => {
    const context: PromptContext = { ...fullContext, turnCount: 8 };
    const result = buildSystemPrompt(context);
    expect(result).toContain('Отвечай короче');
    expect(splitSections(result).length).toBe(7);
  });

  it('with pendingInjection, injection section is present', () => {
    const context: PromptContext = { ...fullContext, pendingInjection: 'test injection' };
    const result = buildSystemPrompt(context);
    expect(result).toContain('test injection');
    expect(splitSections(result).length).toBe(7);
  });

  it('injection appears before fatigue, both before guardrails', () => {
    const context: PromptContext = {
      ...fullContext,
      turnCount: 8,
      pendingInjection: 'INJECTION_MARKER',
    };
    const result = buildSystemPrompt(context);
    const sections = splitSections(result);
    // 8 sections: identity, world, relationship, toolInstructions, injection, fatigue, guardrails, format
    expect(sections.length).toBe(8);

    const injectionIdx = sections.findIndex(s => s.includes('INJECTION_MARKER'));
    const fatigueIdx = sections.findIndex(s => s.includes('Отвечай короче'));
    const guardrailsIdx = sections.findIndex(s => s.includes('ПРАВИЛА'));

    expect(injectionIdx).toBeLessThan(fatigueIdx);
    expect(fatigueIdx).toBeLessThan(guardrailsIdx);
  });
});

describe('estimateTokens', () => {
  it('should return a positive number for non-empty text', () => {
    const tokens = estimateTokens('Hello world');
    expect(tokens).toBeGreaterThan(0);
  });

  it('should return 0 for empty text', () => {
    const tokens = estimateTokens('');
    expect(tokens).toBe(0);
  });

  it('should estimate roughly text.length / 3.5 rounded up', () => {
    const text = 'A'.repeat(35);
    const tokens = estimateTokens(text);
    expect(tokens).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// buildToolInstructionsSection (Task 17/19)
// ---------------------------------------------------------------------------

describe('buildToolInstructionsSection', () => {
  it('should return a string containing ИНСТРУМЕНТЫ section header', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toContain('ИНСТРУМЕНТЫ');
  });

  it('should contain Russian descriptions for all 4 tools', () => {
    const result = buildToolInstructionsSection(fullPersona);
    // adjust_relationship
    expect(result).toContain('adjust_relationship');
    expect(result).toMatch(/отношен/i);
    // create_memory
    expect(result).toContain('create_memory');
    expect(result).toMatch(/воспоминан|запомни/i);
    // end_conversation
    expect(result).toContain('end_conversation');
    expect(result).toMatch(/разговор/i);
    // express_emotion
    expect(result).toContain('express_emotion');
    expect(result).toMatch(/эмоц/i);
  });

  it('should contain ВАЖНО block with personality calibration guidance', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toContain('ВАЖНО');
  });

  it('should contain personality archetype guidance for forgiving and distrustful', () => {
    const result = buildToolInstructionsSection(fullPersona);
    // Forgiving archetype
    expect(result).toMatch(/добродушный|отходчивый/);
    // Distrustful archetype
    expect(result).toMatch(/недоверчивый|замкнутый/);
  });

  it('should reference свой характер without duplicating trait list', () => {
    const result = buildToolInstructionsSection(fullPersona);
    expect(result).toMatch(/свой характер|своим характером/);
    // Should NOT duplicate actual trait values from persona
    expect(result).not.toContain('трудолюбивый');
    expect(result).not.toContain('молчаливый');
    expect(result).not.toContain('надёжный');
  });

  it('should include character-dependent guidelines for adjust_relationship', () => {
    const result = buildToolInstructionsSection(fullPersona);
    // Varying penalty ranges
    expect(result).toMatch(/-1\.\.-3/);
    expect(result).toMatch(/-4\.\.-7/);
  });

  it('should include character-dependent guidelines for express_emotion', () => {
    const result = buildToolInstructionsSection(fullPersona);
    // Reserved = 1-2, emotional = 3-5
    expect(result).toMatch(/сдержанный.*1-2/);
    expect(result).toMatch(/эмоциональный.*3-5/);
  });

  it('should include character-dependent guidelines for end_conversation', () => {
    const result = buildToolInstructionsSection(fullPersona);
    // Forgiving = 5-15 min, grudge-holding = 30-120 min
    expect(result).toMatch(/отходчивый.*5-15/);
    expect(result).toMatch(/обидчивый.*30-120/);
  });
});

// ---------------------------------------------------------------------------
// buildMoodSection (Task 18/19)
// ---------------------------------------------------------------------------

describe('buildMoodSection', () => {
  it('should return empty string when mood is null', () => {
    expect(buildMoodSection(null, 5, new Date())).toBe('');
  });

  it('should return empty string when mood is undefined', () => {
    expect(buildMoodSection(undefined, 5, new Date())).toBe('');
  });

  it('should return empty string when moodUpdatedAt is 12 hours ago with intensity=4', () => {
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
    // 4 * 2^(-12/2) = 4 * 2^(-6) = 4/64 = 0.0625 < 1
    const result = buildMoodSection('раздражён', 4, twelveHoursAgo);
    expect(result).toBe('');
  });

  it('should return non-empty Russian text when mood is set and recent', () => {
    const result = buildMoodSection('раздражён', 7, new Date());
    expect(result).not.toBe('');
    expect(result).toContain('ТВОЁ НАСТРОЕНИЕ');
    expect(result).toContain('раздражён');
  });

  it('should return non-empty text at decay boundary: intensity=8, 6h ago', () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    // 8 * 2^(-6/2) = 8 * 2^(-3) = 8/8 = 1.0 (exactly at threshold, should be included)
    const result = buildMoodSection('раздражён', 8, sixHoursAgo);
    expect(result).not.toBe('');
    expect(result).toContain('раздражён');
  });

  it('should return empty string when decayed intensity < 1: intensity=1, 3h ago', () => {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    // 1 * 2^(-3/2) = 1 * 2^(-1.5) = ~0.354 < 1
    const result = buildMoodSection('раздражён', 1, threeHoursAgo);
    expect(result).toBe('');
  });

  it('should clamp: extreme elapsed time produces 0, not negative', () => {
    const longAgo = new Date(Date.now() - 1000 * 60 * 60 * 1000);
    const decayed = computeDecayedIntensity(10, longAgo);
    expect(decayed).toBeGreaterThanOrEqual(0);
  });

  it('should show strong intensity description for decayed >= 7', () => {
    const result = buildMoodSection('раздражён', 9, new Date());
    expect(result).toContain('сильно раздражён');
  });

  it('should show moderate description for decayed 4-6', () => {
    const result = buildMoodSection('раздражён', 5, new Date());
    // Decayed ~5 (just now), should show just the mood without qualifier
    expect(result).toContain('раздражён');
    expect(result).not.toContain('сильно');
    expect(result).not.toContain('слегка');
  });

  it('should show mild description for decayed 1-3', () => {
    const result = buildMoodSection('раздражён', 2, new Date());
    expect(result).toContain('слегка раздражён');
  });
});

// ---------------------------------------------------------------------------
// buildSystemPrompt integration with tool instructions and mood
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Tool instructions and mood integration', () => {
  it('should include tool instructions section in output', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).toContain('ИНСТРУМЕНТЫ');
    expect(result).toContain('ВАЖНО');
  });

  it('should include mood section when mood is set and not decayed', () => {
    const context: PromptContext = {
      ...fullContext,
      mood: 'раздражён',
      moodIntensity: 7,
      moodUpdatedAt: new Date(),
    };
    const result = buildSystemPrompt(context);
    expect(result).toContain('ТВОЁ НАСТРОЕНИЕ');
    // With mood: 7 sections (identity, world, relationship, mood, toolInstructions, guardrails, format)
    expect(splitSections(result).length).toBe(7);
  });

  it('should not include mood section when mood is null', () => {
    const result = buildSystemPrompt(fullContext);
    expect(result).not.toContain('ТВОЁ НАСТРОЕНИЕ');
    // No mood: 6 sections
    expect(splitSections(result).length).toBe(6);
  });

  it('should order sections: mood after relationship, tool instructions after memory, guardrails after fatigue', () => {
    const context: PromptContext = {
      ...fullContext,
      mood: 'раздражён',
      moodIntensity: 7,
      moodUpdatedAt: new Date(),
      turnCount: 8,
      pendingInjection: 'INJECTION_MARKER',
    };
    const result = buildSystemPrompt(context);
    const sections = splitSections(result);

    const relationshipIdx = sections.findIndex(s => s.includes('подходит'));
    const moodIdx = sections.findIndex(s => s.includes('НАСТРОЕНИЕ'));
    const toolIdx = sections.findIndex(s => s.includes('ИНСТРУМЕНТЫ'));
    const injectionIdx = sections.findIndex(s => s.includes('INJECTION_MARKER'));
    const fatigueIdx = sections.findIndex(s => s.includes('Отвечай короче'));
    const guardrailsIdx = sections.findIndex(s => s.includes('ПРАВИЛА'));

    expect(relationshipIdx).toBeLessThan(moodIdx);
    expect(moodIdx).toBeLessThan(toolIdx);
    expect(toolIdx).toBeLessThan(injectionIdx);
    expect(injectionIdx).toBeLessThan(fatigueIdx);
    expect(fatigueIdx).toBeLessThan(guardrailsIdx);
  });
});
