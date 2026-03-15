export type MemoryType = 'interaction' | 'observation' | 'reflection' | 'gossip';

export interface NpcMemory {
  id: string;
  botId: string;
  userId: string;
  type: MemoryType;
  content: string;
  importance: number;
  dialogueSessionId: string | null;
  createdAt: string; // ISO string for client consumption
}

export interface MemoryStreamConfig {
  topK: number;
  halfLifeHours: number;
  recencyWeight: number;
  importanceWeight: number;
  maxMemoriesPerNpc: number;
  tokenBudget: number;
  importanceFirstMeeting: number;
  importanceNormalDialogue: number;
  importanceEmotionalDialogue: number;
  importanceGiftReceived: number;
  importanceQuestRelated: number;
}

export interface NpcMemoryOverride {
  botId: string;
  topK?: number | null;
  halfLifeHours?: number | null;
  recencyWeight?: number | null;
  importanceWeight?: number | null;
  maxMemoriesPerNpc?: number | null;
  tokenBudget?: number | null;
}
