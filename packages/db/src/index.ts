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
  saveMap,
  loadMap,
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
} from './services/map-import-export';
export * from './services/material';
export * from './services/tileset';
export * from './services/tileset-tag';
export {
  createBot,
  loadBots,
  saveBotPositions,
  type CreateBotData,
  type BotPositionUpdate,
} from './services/npc-bot';
