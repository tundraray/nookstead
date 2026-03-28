export * from './core';
export * from './schema';
export { getDb, closeDb } from './adapters/next';
export { getGameDb, closeGameDb } from './adapters/colyseus';
export {
  findOrCreateUser,
  type FindOrCreateUserParams,
  type FindOrCreateUserResult,
} from './services/auth';
export {
  savePosition,
  loadPosition,
  type SavePositionData,
  type LoadPositionResult,
} from './services/player';
export {
  createMap,
  saveMap,
  loadMap,
  findMapByUser,
  findMapByType,
  listMapsByUser,
  listMapsByUserAndType,
  type MapType,
  listAllMapsLite,
  type MapLite,
  type CreateMapData,
  type SaveMapData,
  type LoadMapResult,
} from './services/map';
export {
  createSprite,
  getSprite,
  listSprites,
  deleteSprite,
  countFramesBySprite,
  findGameObjectsReferencingSprite,
  type CreateSpriteData,
  type ListSpritesParams,
} from './services/sprite';
export {
  batchSaveFrames,
  getFramesBySprite,
  getFramesByFilename,
  deleteFramesBySprite,
  searchFrameFilenames,
  listDistinctFilenames,
  type FrameInput,
} from './services/atlas-frame';
export {
  createGameObject,
  getGameObject,
  listGameObjects,
  updateGameObject,
  deleteGameObject,
  validateFrameReferences,
  getDistinctValues,
  type CreateGameObjectData,
  type UpdateGameObjectData,
} from './services/game-object';
export {
  createEditorMap,
  getEditorMap,
  listEditorMaps,
  updateEditorMap,
  deleteEditorMap,
  type CreateEditorMapData,
  type ListEditorMapsParams,
  type UpdateEditorMapData,
} from './services/editor-map';
export {
  createTemplate,
  getTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  publishTemplate,
  getPublishedTemplates,
  type CreateTemplateData,
  type UpdateTemplateData,
  type ListTemplatesParams,
} from './services/map-template';
export {
  createMapZone,
  getZonesForMap,
  updateMapZone,
  deleteMapZone,
  type CreateMapZoneData,
  type UpdateMapZoneData,
} from './services/map-zone';
export {
  listPlayerMaps,
  importPlayerMap,
  exportToPlayerMap,
  editPlayerMapDirect,
  savePlayerMapDirect,
  type SavePlayerMapDirectData,
} from './services/map-import-export';
export * from './services/material';
export * from './services/tileset';
export * from './services/tileset-tag';
export {
  createBot,
  createBotAdmin,
  getBotById,
  listAllBots,
  updateBot,
  deleteBot,
  loadBots,
  saveBotPositions,
  type CreateBotData,
  type AdminCreateBotData,
  type UpdateBotData,
  type BotPositionUpdate,
} from './services/npc-bot';
export {
  createDialogueSession,
  endDialogueSession,
  addDialogueMessage,
  getRecentDialogueHistory,
  getDialogueSessionMessages,
  getDialogueHistoryByUser,
  getAdminDialogueSessions,
  getSessionCountForPair,
  type CreateSessionData,
  type AddMessageData,
  type DialogueSessionWithMessages,
  type AdminDialogueSession,
} from './services/dialogue';
export {
  createMemory,
  getMemoriesForBot,
  getMemoryCount,
  deleteOldestMemories,
  deleteMemory,
  listMemoriesAdmin,
  getAllMemoriesForBackfill,
  type CreateMemoryData,
  type ListMemoriesAdminParams,
} from './services/npc-memory';
export {
  getRecentMemoriesForBot,
  getReflectionMemories,
  getBotsNeedingReflection,
  createReflectionMemory,
} from './services/npc-reflection';
export {
  getGlobalConfig,
  updateGlobalConfig,
  getNpcOverride,
  upsertNpcOverride,
  deleteNpcOverride,
  getEffectiveConfig,
  type MemoryConfigValues,
} from './services/memory-config';
export {
  getRelationship,
  getOrCreateRelationship,
  updateRelationship,
  adjustRelationshipScore,
  listRelationshipsForBot,
  listRelationshipsForUser,
  type UpsertRelationshipData,
} from './services/npc-relationship';
export {
  hasActiveStatus,
  createPlayerStatus,
  cleanupExpiredStatuses,
  listActiveStatusesForBot,
} from './services/npc-player-status';
export {
  createInventory,
  loadInventory,
  saveSlots,
  findEmptySlot,
  deleteInventory,
} from './services/inventory';
