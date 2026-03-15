export type RelationshipSocialType =
  | 'stranger'
  | 'acquaintance'
  | 'friend'
  | 'close_friend'
  | 'romantic'
  | 'rival';

export interface RelationshipData {
  botId: string;
  userId: string;
  socialType: RelationshipSocialType;
  isWorker: boolean;
  score: number;
  hiredAt: string | null;
  updatedAt: string;
}

export type GiftCategory =
  | 'flowers'
  | 'food'
  | 'craft'
  | 'book'
  | 'luxury'
  | 'tool'
  | 'romantic';

export type GiftId =
  | 'flowers'
  | 'pie'
  | 'mushrooms'
  | 'herbs'
  | 'fishing_rod'
  | 'carved_wood'
  | 'pottery'
  | 'knitted_scarf'
  | 'old_book'
  | 'recipe_book'
  | 'silver_ring'
  | 'love_letter'
  | 'perfume'
  | 'candles'
  | 'honey_cake';

export interface GiftDefinition {
  id: GiftId;
  label: string;
  category: GiftCategory;
  scoreBonus: number;
  importance: number;
  memoryTemplate: string;
}

export type DialogueActionType = 'give_gift' | 'hire' | 'dismiss' | 'ask_about';

export interface GiveGiftAction {
  type: 'give_gift';
  params: { giftId: GiftId };
}

export interface HireAction {
  type: 'hire';
}

export interface DismissAction {
  type: 'dismiss';
}

export interface AskAboutAction {
  type: 'ask_about';
  params: { topic: string };
}

export type DialogueAction =
  | GiveGiftAction
  | HireAction
  | DismissAction
  | AskAboutAction;

export interface DialogueActionResult {
  success: boolean;
  actionType: DialogueActionType;
  message?: string;
  promptInjection?: string;
  updatedRelationship?: RelationshipData;
  availableActions?: DialogueActionType[];
}

export interface DialogueActionPayload {
  action: DialogueAction;
}

export type DialogueActionResultPayload = DialogueActionResult;
