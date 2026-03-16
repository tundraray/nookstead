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

/** Helper: create an async iterable of fullStream chunks from text strings */
async function* makeFullStream(
  chunks: Array<{ type: string; text?: string; toolName?: string; [key: string]: unknown }>
): AsyncIterable<{ type: string; text?: string; toolName?: string; [key: string]: unknown }> {
  for (const chunk of chunks) {
    yield chunk;
  }
}

/** Shorthand: create fullStream with only text-delta chunks from plain strings */
function makeTextFullStream(texts: string[]) {
  return makeFullStream(texts.map((text) => ({ type: 'text-delta', text })));
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

  it('yields text chunks from AI fullStream', async () => {
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream(['Hello', ' world']),
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
      fullStream: makeTextFullStream([]),
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
    // Full persona (bio non-null) triggers buildSystemPrompt with English text
    expect(callArgs?.system).toContain('You are');
    expect(callArgs?.system).toContain('farmer');
    expect(callArgs?.system).toContain('rustic dialect');
    expect(callArgs?.system).toContain('RULES');
  });

  it('uses default system prompt when persona is null', async () => {
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream([]),
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
    // Null persona triggers buildLegacyPrompt with English fallback
    expect(callArgs?.system).toContain('You are');
    expect(callArgs?.system).toContain('Villager');
    expect(callArgs?.system).toContain('RULES');
  });

  it('includes conversation history in messages array', async () => {
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream([]),
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
      fullStream: makeTextFullStream([]),
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

  it('should use full prompt when persona has non-null bio', async () => {
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream([]),
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

    // Static prefix starts with TOOLS (prompt-cache optimized order)
    expect(prompt).toMatch(/^TOOLS/);
    // Identity section contains character intro
    expect(prompt).toContain('You are Farmer Bob');
    // Relationship section references playerName and meetingCount
    expect(prompt).toContain('TestPlayer');
    expect(prompt).toContain('2 time');
    // Tool instructions section present
    expect(prompt).toContain('TOOLS');
    // Guardrails section present
    expect(prompt).toContain('RULES');
  });

  it('should use legacy prompt when persona has null bio', async () => {
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream([]),
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

    // Legacy prompt produces 4 sections: guardrailsStatic, format, identity, guardrailsDynamic
    expect(sections).toHaveLength(4);
    // Should contain identity with bot name
    expect(prompt).toContain('You are');
    expect(prompt).toContain('Farmer Bob');
    // Should contain personality (used by buildLegacyPrompt)
    expect(prompt).toContain('grumpy but kind');
    // Guardrails present
    expect(prompt).toContain('RULES');
    // Should NOT have full-prompt markers like TOOLS or DIGNITY
    expect(prompt).not.toContain('TOOLS');
    expect(prompt).not.toContain('YOUR DIGNITY');
  });

  // --- Tools integration tests (Phase 3) ---

  it('does not pass tools to streamText when tools param is omitted', async () => {
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream(['Hello']),
    } as never);

    const chunks: string[] = [];
    for await (const chunk of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'Hi',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      chunks.push(chunk);
    }

    // Arrange: verify streamText called without tools key
    const callArgs = mockStreamText.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs).not.toHaveProperty('tools');
    // Generator still yields text normally
    expect(chunks).toEqual(['Hello']);
  });

  it('passes tools to streamText when tools param is provided', async () => {
    const mockTool = { description: 'test tool', parameters: {} };
    mockStreamText.mockReturnValue({
      fullStream: makeTextFullStream(['OK']),
    } as never);

    const chunks: string[] = [];
    for await (const chunk of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'Hi',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
      tools: { my_tool: mockTool } as never,
    })) {
      chunks.push(chunk);
    }

    // Verify tools were forwarded to streamText
    const callArgs = mockStreamText.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArgs.tools).toEqual({ my_tool: mockTool });
    expect(chunks).toEqual(['OK']);
  });

  it('yields only text from mixed text-delta and tool-call chunks', async () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    mockStreamText.mockReturnValue({
      fullStream: makeFullStream([
        { type: 'text-delta', text: 'I feel ' },
        { type: 'tool-call', toolName: 'adjust_relationship' },
        { type: 'tool-result', toolName: 'adjust_relationship', result: 'done' },
        { type: 'text-delta', text: 'closer to you.' },
      ]),
    } as never);

    const chunks: string[] = [];
    for await (const chunk of service.streamResponse({
      botName: 'Farmer Bob',
      persona: null,
      playerText: 'Hi',
      playerName: 'TestPlayer',
      meetingCount: 0,
      conversationHistory: [],
    })) {
      chunks.push(chunk);
    }

    // Only text-delta chunks should be yielded
    expect(chunks).toEqual(['I feel ', 'closer to you.']);
    // Tool call should be logged
    const toolCallLog = consoleSpy.mock.calls.find(
      (call) => typeof call[0] === 'string' && call[0].includes('tool call: adjust_relationship')
    );
    expect(toolCallLog).toBeTruthy();

    consoleSpy.mockRestore();
  });
});
