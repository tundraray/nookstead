import type { NpcMemoryRow } from '@nookstead/db';
import { estimateTokens } from '../ai/SystemPromptBuilder';

export const SEMANTIC_TOP_K = 20;

export interface RetrievalConfig {
  topK: number;
  halfLifeHours: number;
  recencyWeight: number;
  importanceWeight: number;
  semanticWeight: number;
  tokenBudget: number;
}

export interface ScoredMemory {
  memory: NpcMemoryRow;
  recencyScore: number;
  importanceScore: number;
  semanticScore: number;
  totalScore: number;
}

const LN2 = 0.693;

/**
 * Calculate recency score using exponential decay.
 * recency = exp(-0.693 * hoursElapsed / halfLifeHours)
 * At t=0: 1.0, at t=halfLife: 0.5, at t=2*halfLife: 0.25
 */
function calculateRecency(
  createdAt: Date,
  now: Date,
  halfLifeHours: number
): number {
  const hoursElapsed =
    (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  if (hoursElapsed <= 0) return 1.0;
  return Math.exp((-LN2 * hoursElapsed) / halfLifeHours);
}

/**
 * Normalize importance from 1-10 scale to 0-1 range.
 */
function normalizeImportance(importance: number): number {
  return importance / 10;
}

/**
 * Retrieve and score memories for a bot-user pair.
 * 1. Score each memory by recency + importance + semantic similarity
 * 2. Sort by total score descending
 * 3. Take top-K
 * 4. Trim to fit within token budget
 *
 * When semanticScores is undefined or semanticWeight is 0, behavior is
 * identical to Phase 0 (two-dimensional scoring).
 */
export function scoreAndRankMemories(
  memories: NpcMemoryRow[],
  config: RetrievalConfig,
  now?: Date,
  semanticScores?: Map<string, number>
): ScoredMemory[] {
  const currentTime = now ?? new Date();

  // Score each memory
  const scored: ScoredMemory[] = memories.map((memory) => {
    const recencyScore = calculateRecency(
      memory.createdAt,
      currentTime,
      config.halfLifeHours
    );
    const importanceScore = normalizeImportance(memory.importance);
    const semanticScore = semanticScores?.get(memory.id) ?? 0.0;
    const totalScore =
      config.recencyWeight * recencyScore +
      config.importanceWeight * importanceScore +
      config.semanticWeight * semanticScore;

    return { memory, recencyScore, importanceScore, semanticScore, totalScore };
  });

  // Sort by total score descending
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Take top-K
  const topK = scored.slice(0, config.topK);

  // Trim to fit within token budget
  return trimToTokenBudget(topK, config.tokenBudget);
}

/**
 * Remove lowest-scored memories until total tokens fit within budget.
 */
function trimToTokenBudget(
  memories: ScoredMemory[],
  tokenBudget: number
): ScoredMemory[] {
  const result: ScoredMemory[] = [];
  let totalTokens = 0;

  for (const scored of memories) {
    const tokens = estimateTokens(`- ${scored.memory.content}`);
    if (totalTokens + tokens > tokenBudget) break;
    totalTokens += tokens;
    result.push(scored);
  }

  return result;
}
