import { describe, it, expect } from '@jest/globals';
import {
  buildSystemPrompt,
  buildLegacyPrompt,
  estimateTokens,
} from '../SystemPromptBuilder.js';
import type { PromptContext, WorldContext } from '../SystemPromptBuilder.js';
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
 * Split a prompt into its 6 sections by double-newline boundaries.
 * Sections: [identity, world, relationship, memory, guardrails, format]
 */
function splitSections(prompt: string): string[] {
  return prompt.split('\n\n');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('buildSystemPrompt -- Structure (AC-1)', () => {
  it('should produce output containing all 6 sections when given a full persona', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
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

  it('should allow meta-words in guardrails section (section 5) for prohibition context', () => {
    const result = buildSystemPrompt(fullContext);
    const sections = splitSections(result);
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
    expect(sections.length).toBe(6);
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
