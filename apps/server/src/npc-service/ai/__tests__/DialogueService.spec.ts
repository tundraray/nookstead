import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { DialogueService } from '../DialogueService.js';

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
      persona: {
        personality: 'grumpy but kind',
        role: 'farmer',
        speechStyle: 'rustic dialect',
      },
      playerText: 'Hello',
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      system?: string;
    };
    expect(callArgs?.system).toContain('grumpy but kind');
    expect(callArgs?.system).toContain('farmer');
    expect(callArgs?.system).toContain('rustic dialect');
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
      conversationHistory: [],
    })) {
      // drain
    }

    const callArgs = mockStreamText.mock.calls[0]?.[0] as {
      system?: string;
    };
    expect(callArgs?.system).toContain('friendly NPC');
    expect(callArgs?.system).toContain('Villager');
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
});
