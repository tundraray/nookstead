import {
  updateRelationship,
  type DrizzleClient,
  type NpcRelationshipRow,
} from '@nookstead/db';
import type {
  RelationshipData,
  RelationshipSocialType,
  DialogueAction,
  DialogueActionType,
  DialogueActionResult,
} from '@nookstead/shared';
import { getGift } from './gift-registry';

// ── Constants ──────────────────────────────────────────────

export const SCORE_DELTAS = {
  hire: 3,
  dismiss: -5,
} as const;

export const RELATIONSHIP_THRESHOLDS = {
  acquaintance: 10,
  friend: 30,
  close_friend: 60,
  romantic: 90,
  rival: -1, // any score < 0
} as const;

export const FATIGUE_DEFAULTS = {
  maxTurnsBeforeTired: 8,
  maxTurnsBeforeEnd: 12,
} as const;

// ── Helpers ────────────────────────────────────────────────

export function rowToRelationshipData(row: NpcRelationshipRow): RelationshipData {
  return {
    botId: row.botId,
    userId: row.userId,
    socialType: row.socialType as RelationshipSocialType,
    isWorker: row.isWorker,
    score: row.score,
    hiredAt: row.hiredAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Validation ─────────────────────────────────────────────

/**
 * Returns an error message if the action is invalid, or null if valid.
 */
export function validateAction(
  action: DialogueAction,
  relationship: RelationshipData
): string | null {
  if (relationship.socialType === 'rival') {
    return 'Этот персонаж не желает взаимодействовать с вами.';
  }

  switch (action.type) {
    case 'give_gift':
      if (relationship.socialType === 'stranger') {
        return 'Недостаточно близкие отношения для подарка.';
      }
      return null;

    case 'hire':
      if (relationship.isWorker) {
        return 'Этот персонаж уже работает на вас.';
      }
      if (!['friend', 'close_friend', 'romantic'].includes(relationship.socialType)) {
        return 'Недостаточно близкие отношения для найма.';
      }
      return null;

    case 'dismiss':
      if (!relationship.isWorker) {
        return 'Этот персонаж не работает на вас.';
      }
      return null;

    case 'ask_about':
      if (!['close_friend', 'romantic'].includes(relationship.socialType)) {
        return 'Недостаточно близкие отношения для этого вопроса.';
      }
      return null;

    default:
      return 'Неизвестное действие.';
  }
}

// ── Action Processing ──────────────────────────────────────

/**
 * Process a dialogue action. Never throws — returns success=false on errors.
 */
export async function processAction(
  db: DrizzleClient,
  botId: string,
  userId: string,
  action: DialogueAction,
  relationship: RelationshipData,
  playerName: string
): Promise<DialogueActionResult> {
  try {
    const validationError = validateAction(action, relationship);
    if (validationError) {
      return { success: false, actionType: action.type, message: validationError };
    }

    switch (action.type) {
      case 'give_gift': {
        const gift = getGift(action.params.giftId);
        const newScore = relationship.score + gift.scoreBonus;
        const updatedRow = await updateRelationship(db, botId, userId, {
          score: newScore,
        });
        return {
          success: true,
          actionType: 'give_gift',
          promptInjection: `${playerName} подарил(а) тебе ${gift.label}. Отреагируй искренне.`,
          updatedRelationship: rowToRelationshipData(updatedRow),
        };
      }

      case 'hire': {
        const updatedRow = await updateRelationship(db, botId, userId, {
          isWorker: true,
          hiredAt: new Date(),
          score: relationship.score + SCORE_DELTAS.hire,
        });
        return {
          success: true,
          actionType: 'hire',
          promptInjection: `${playerName} предложил(а) тебе работу. Прими с радостью.`,
          updatedRelationship: rowToRelationshipData(updatedRow),
        };
      }

      case 'dismiss': {
        const updatedRow = await updateRelationship(db, botId, userId, {
          isWorker: false,
          hiredAt: null,
          score: relationship.score + SCORE_DELTAS.dismiss,
        });
        return {
          success: true,
          actionType: 'dismiss',
          promptInjection: `${playerName} завершил(а) твою работу. Отреагируй с достоинством.`,
          updatedRelationship: rowToRelationshipData(updatedRow),
        };
      }

      case 'ask_about': {
        return {
          success: true,
          actionType: 'ask_about',
          promptInjection: `${playerName} хочет узнать о ${action.params.topic}. Ответь искренне, как близкому другу.`,
          updatedRelationship: relationship,
        };
      }

      default:
        return { success: false, actionType: (action as DialogueAction).type, message: 'Неизвестное действие.' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
    return { success: false, actionType: action.type, message };
  }
}

// ── Progression ────────────────────────────────────────────

/**
 * Pure function: evaluate what socialType the score corresponds to.
 */
export function evaluateProgression(
  relationship: RelationshipData,
  npcTraits?: string[] | null
): RelationshipSocialType {
  const { score } = relationship;

  if (score < 0) return 'rival';
  if (score < RELATIONSHIP_THRESHOLDS.acquaintance) return 'stranger';
  if (score < RELATIONSHIP_THRESHOLDS.friend) return 'acquaintance';
  if (score < RELATIONSHIP_THRESHOLDS.close_friend) return 'friend';
  if (score < RELATIONSHIP_THRESHOLDS.romantic) return 'close_friend';

  // score >= 90
  if (npcTraits?.includes('romanceable')) return 'romantic';
  return 'close_friend'; // romantic cap
}

/**
 * Pure function: return available actions based on relationship state.
 */
export function getAvailableActions(
  relationship: RelationshipData
): DialogueActionType[] {
  const { socialType, isWorker } = relationship;

  if (socialType === 'stranger' || socialType === 'rival') return [];

  const actions: DialogueActionType[] = ['give_gift'];

  if (['friend', 'close_friend', 'romantic'].includes(socialType)) {
    if (isWorker) {
      actions.push('dismiss');
    } else {
      actions.push('hire');
    }
  } else if (socialType === 'acquaintance' && isWorker) {
    // Edge case: demoted back to acquaintance but still worker
    actions.push('dismiss');
  }

  if (['close_friend', 'romantic'].includes(socialType)) {
    actions.push('ask_about');
  }

  return actions;
}
