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

/** Server -> Client: dialogue start with relationship context */
export interface DialogueStartWithRelationshipPayload {
  botId: string;
  botName: string;
  relationship?: import('./relationship').RelationshipData;
  availableActions?: import('./relationship').DialogueActionType[];
}
