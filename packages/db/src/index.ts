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
