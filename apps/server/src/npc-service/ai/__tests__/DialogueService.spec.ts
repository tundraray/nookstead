import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DialogueService } from '../DialogueService.js';
import type { SeedPersona } from '../DialogueService.js';

// Mock the 'ai' package's streamText function
jest.mock('ai', () => ({
  streamText: jest.fn(),
}));

// Mock '@ai-sdk/openai' createOpenAI
jest.mock('@ai-sdk/openai', () => ({
  createOpenAI: jest.fn(() => ({
    chat: jest.fn(() => 'mock-model'),
  })),
}));

import { streamText } from 'ai';
const mockStreamText = streamText as jest.MockedFunction<typeof streamText>;

/** Helper: create an async iterable from an array of strings */
async function* makeTextStream(chunks: string[]): AsyncIterable<string> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/** Full SeedPersona fixture with bio non-null (triggers 6-section prompt) */
const fullSeedPersona: SeedPersona = {
  personality: 'grumpy but kind',
  role: 'farmer',
  speechStyle: 'rustic dialect',
  bio: 'A seasoned farmer who loves the land.',
  age: 50,
  traits: ['grumpy', 'kind'],
  goals: null,
  fears: null,
  interests: null,
};

/** SeedPersona with bio null (triggers legacy prompt path) */
const legacySeedPersona: SeedPersona = {
  personality: 'grumpy but kind',
  role: 'farmer',
  speechStyle: 'rustic dialect',
  bio: null,
  age: null,
  traits: null,
  goals: null,
  fears: null,
  interests: null,
};

describe('DialogueService', () => {
  let service: DialogueService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DialogueService({ apiKey: 'test-key' });
  });

  it('yields text chunks from AI textStream', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream(['Hello', ' world']),
    } as never);

    const chunks: string[] = [];
    for await (const chunk of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'Hi there',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['Hello', ' world']);
  });

  it('yields fallback message on AI error', async () => {
    mockStreamText.mockImplementation(() => {
      throw new Error('API error');
    });

    const chunks: string[] = [];
    for await (const chunk of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'Hi there',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['*shrugs*']);
  });

  it('stops stream cleanly when aborted', async () => {
    const controller = new AbortController();
    mockStreamText.mockImplementation(() => {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' });
    });

    const chunks: string[] = [];
    for await (const chunk of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'Hi',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
      abortSignal: controller.signal,
    })) {
      chunks.push(chunk);
    }

    expect(chunks).toEqual(['*shrugs*']);
  });

  it('includes persona in system prompt when provided', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream([]),
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of service.streamResponse({
      botName: 'Farmer Bob',
      persona: fullSeedPersona,
      playerText: 'Hello',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      system?: string;
    };
    // Full persona (bio non-null) triggers buildSystemPrompt with Russian text
    expect(callArgs?.system).toContain('Ты —');
    expect(callArgs?.system).toContain('farmer');
    expect(callArgs?.system).toContain('rustic dialect');
    expect(callArgs?.system).toContain('ПРАВИЛА');
  });

  it('uses default system prompt when persona is null', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream([]),
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of service.streamResponse({
      botName: 'Villager',
      persona: null,
      playerText: 'Hello',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      system?: string;
    };
    // Null persona triggers buildLegacyPrompt with Russian fallback
    expect(callArgs?.system).toContain('Ты —');
    expect(callArgs?.system).toContain('Villager');
    expect(callArgs?.system).toContain('ПРАВИЛА');
  });

  it('includes conversation history in messages array', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream([]),
    } as never);

    const history = [
      { role: 'user', content: 'Good morning' },
      { role: 'assistant', content: 'Good morning to you!' },
    ];

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'How are you?',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: history,
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    expect(callArgs?.messages).toHaveLength(3); // 2 history + 1 user
    expect(callArgs?.messages?.[0]).toEqual({
      role: 'user',
      content: 'Good morning',
    });
    expect(callArgs?.messages?.[1]).toEqual({
      role: 'assistant',
      content: 'Good morning to you!',
    });
    expect(callArgs?.messages?.[2]).toEqual({
      role: 'user',
      content: 'How are you?',
    });
  });

  it('truncates playerText to 500 characters', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream([]),
    } as never);

    const longText = 'a'.repeat(600);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: longText,
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      messages?: Array<{ role: string; content: string }>;
    };
    const lastMessage = callArgs?.messages?.at(-1);
    expect(lastMessage?.content).toHaveLength(500);
    expect(lastMessage?.content).toBe('a'.repeat(500));
  });

  // --- Prompt selection path tests ---

  it('should use 6-section prompt when persona has non-null bio', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream([]),
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of service.streamResponse({
      botName: 'Farmer Bob',
      persona: fullSeedPersona,
      playerText: 'Hello',
      playerName: 'TestPlayer',
      meetingCount: 2,
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      system?: string;
    };
    const prompt = callArgs?.system ?? '';
    const sections = prompt.split('\n\n');

    // buildSystemPrompt produces 5 sections without memories (identity, world, relationship, guardrails, format)
    expect(sections).toHaveLength(5);
    // Identity section starts with Russian character intro
    expect(prompt).toMatch(/^Ты — Farmer Bob/);
    // Relationship section references playerName and meetingCount
    expect(prompt).toContain('TestPlayer');
    expect(prompt).toContain('2 раз');
    // Guardrails section present
    expect(prompt).toContain('ПРАВИЛА');
  });

  it('should use legacy prompt when persona has null bio', async () => {
    mockStreamText.mockReturnValue({
      textStream: makeTextStream([]),
    } as never);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    for await (const _ of service.streamResponse({
      botName: 'Farmer Bob',
      persona: legacySeedPersona,
      playerText: 'Hello',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      system?: string;
    };
    const prompt = callArgs?.system ?? '';
    const sections = prompt.split('\n\n');

    // Legacy prompt produces 3 sections: identity, guardrails, format
    expect(sections).toHaveLength(3);
    // Should contain identity with bot name
    expect(prompt).toContain('Ты —');
    expect(prompt).toContain('Farmer Bob');
    // Should contain personality (used by buildLegacyPrompt)
    expect(prompt).toContain('grumpy but kind');
    // Guardrails present
    expect(prompt).toContain('ПРАВИЛА');
    // Should NOT have the 6-section markers like memory placeholder
    expect(prompt).not.toContain('Пока нет воспоминаний');
  });
});
