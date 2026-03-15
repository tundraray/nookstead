export interface ImportanceScorerConfig {
  firstMeeting: number;
  normalDialogue: number;
  emotionalDialogue: number;
  giftReceived: number;
  questRelated: number;
}

export interface ImportanceContext {
  isFirstMeeting: boolean;
  hasGift?: boolean;
  giftImportance?: number;
}

/**
 * Rule-based importance scoring for Phase 0.
 * Distinguishes first meeting vs. normal dialogue, and gift events.
 */
export function scoreImportance(
  config: ImportanceScorerConfig,
  context: ImportanceContext
): number {
  if (context.hasGift && context.giftImportance !== undefined) {
    return context.giftImportance;
  }
  return context.isFirstMeeting ? config.firstMeeting : config.normalDialogue;
}
