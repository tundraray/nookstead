import { streamText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_PLAYER_TEXT_LENGTH = 500;
const MAX_TOKENS = 300;
const FALLBACK_MESSAGE = '*shrugs*';

export interface NpcPersona {
  personality?: string | null;
  role?: string | null;
  speechStyle?: string | null;
}

export interface StreamResponseParams {
  botName: string;
  persona: NpcPersona | null;
  playerText: string;
  conversationHistory: Array<{ role: string; content: string }>;
  abortSignal?: AbortSignal;
}

export class DialogueService {
  private readonly model: string;
  private readonly openai: ReturnType<typeof createOpenAI>;

  constructor(options: { apiKey: string; model?: string }) {
    this.model = options.model ?? DEFAULT_MODEL;
    this.openai = createOpenAI({ apiKey: options.apiKey });
  }

  async *streamResponse(params: StreamResponseParams): AsyncGenerator<string> {
    const { botName, persona, playerText, conversationHistory, abortSignal } =
      params;

    const truncatedText = playerText.slice(0, MAX_PLAYER_TEXT_LENGTH);

    const system = this.buildSystemPrompt(botName, persona);

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

  private buildSystemPrompt(
    botName: string,
    persona: NpcPersona | null
  ): string {
    if (
      persona &&
      (persona.personality || persona.role || persona.speechStyle)
    ) {
      const parts: string[] = [
        `You are ${botName}, a character in a farming RPG called Nookstead.`,
      ];
      if (persona.role) {
        parts.push(`Your role: ${persona.role}.`);
      }
      if (persona.personality) {
        parts.push(`Your personality: ${persona.personality}.`);
      }
      if (persona.speechStyle) {
        parts.push(`Your speech style: ${persona.speechStyle}.`);
      }
      parts.push('Keep responses concise (1-3 sentences). Stay in character.');
      return parts.join(' ');
    }

    return `You are ${botName}, a friendly NPC in a farming RPG called Nookstead. Keep responses concise (1-3 sentences) and stay in character as a helpful town resident.`;
  }
}
