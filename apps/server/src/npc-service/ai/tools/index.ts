import type { Tool } from 'ai';
import type { DrizzleClient } from '@nookstead/db';
import type { SeedPersona } from '../DialogueService.js';
import { adjustRelationshipTool } from './adjust-relationship.js';
import { createMemoryTool } from './create-memory.js';
import { endConversationTool } from './end-conversation.js';
import { expressEmotionTool } from './express-emotion.js';

/**
 * Context object created once per dialogue turn in ChunkRoom and passed
 * via closure to each tool's execute function.
 *
 * `cumulativeDelta` and `endRequested` are intentionally mutable --
 * tool execute functions mutate them in-place to track state across
 * multiple tool calls within a single stream iteration.
 */
export interface ToolContext {
  db: DrizzleClient;
  botId: string;
  userId: string;
  playerName: string;
  sendToClient: (type: string, payload: unknown) => void;
  endConversation: () => void;
  persona: SeedPersona;
  /** Running total of score changes this turn (mutable, per-turn cap F005) */
  cumulativeDelta: number;
  /** Deferred end flag set by end_conversation tool (F004 pattern) */
  endRequested: boolean;
}

/**
 * Factory that creates the tools map to pass to `streamText()`.
 * Each tool factory receives the shared ToolContext via closure.
 */
export function createNpcTools(
  context: ToolContext
): Record<string, Tool> {
  return {
    adjust_relationship: adjustRelationshipTool(context),
    create_memory: createMemoryTool(context),
    end_conversation: endConversationTool(context),
    express_emotion: expressEmotionTool(context),
  };
}
