import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import {
  buildSystemPrompt,
  buildLegacyPrompt,
  PromptContext,
} from './SystemPromptBuilder';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_PLAYER_TEXT_LENGTH = 500;
const MAX_TOKENS = 300;
const FALLBACK_MESSAGE = '*shrugs*';

export interface SeedPersona {
  personality: string | null;
  role: string | null;
  speechStyle: string | null;
  bio: string | null;
  age: number | null;
  traits: string[] | null;
  goals: string[] | null;
  fears: string[] | null;
  interests: string[] | null;
}

export interface StreamResponseParams {
  botName: string;
  persona: SeedPersona | null;
  playerText: string;
  playerName: string;
  meetingCount: number;
  conversationHistory: Array<{ role: string; content: string }>;
  abortSignal?: AbortSignal;
  memories?: import('../memory/MemoryRetrieval').ScoredMemory[];
  relationship?: import('@nookstead/shared').RelationshipData;
  turnCount?: number;
  pendingInjection?: string | null;
}

export class DialogueService {
  private readonly model: string;
  private readonly openai: ReturnType<typeof createOpenAI>;

  constructor(options: { apiKey: string; model?: string }) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.openai = createOpenAI({ apiKey: options.apiKey });
  }

  async *streamResponse(params: StreamResponseParams): AsyncGenerator<string> {
    console.log(
      `[DialogueService] streamResponse: meetingCount=${params.meetingCount}, playerName=${params.playerName}`
    );

    const { playerText, conversationHistory, abortSignal } = params;

    const truncatedText = playerText.slice(0, MAX_PLAYER_TEXT_LENGTH);

    const system = this.buildSystemPrompt(params);

    const messages = [
      ...conversationHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: truncatedText },
    ];

    try {
      const result = streamText({
        model: this.openai.chat(this.model),
        system,
        messages,
        abortSignal,
        maxOutputTokens: MAX_TOKENS,
      });

      for await (const chunk of result.textStream) {
        yield chunk;
      }
    } catch (error) {
      console.error(
        '[DialogueService] streamResponse failed, using fallback:',
        error
      );
      yield FALLBACK_MESSAGE;
    }
  }

  private buildSystemPrompt(params: StreamResponseParams): string {
    const { persona, botName, playerName, meetingCount, memories, relationship, turnCount, pendingInjection } = params;
    if (persona && persona.bio !== null) {
      const context: PromptContext = {
        persona,
        botName,
        playerName,
        meetingCount,
        memories,
        relationship,
        turnCount,
        pendingInjection,
      };
      return buildSystemPrompt(context);
    }
    return buildLegacyPrompt(botName, persona);
  }
}
