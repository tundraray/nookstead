/** Client -> Server: player sends a chat message */
export interface DialogueMessagePayload {
  text: string;
}

/** Server -> Client: dialogue session started */
export interface DialogueStartPayload {
  botId: string;
  botName: string;
}

/** Server -> Client: streaming text chunk */
export interface DialogueStreamChunkPayload {
  text: string;
}

/** Server -> Client: relationship score changed by AI tool */
export interface DialogueScoreChangePayload {
  delta: number;
  newScore: number;
  reason: string;
  newSocialType: string;
}

/** Server -> Client: NPC expresses emotion via AI tool */
export interface DialogueEmotionPayload {
  emotion: string;
  intensity: number;
}

/** Server -> Client: dialogue start with relationship context */
export interface DialogueStartWithRelationshipPayload {
  botId: string;
  botName: string;
  relationship?: import('./relationship').RelationshipData;
  availableActions?: import('./relationship').DialogueActionType[];
}
