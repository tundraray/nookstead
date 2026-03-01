/**
 * @jest-environment node
 */

// Game Object Client Rendering - game-data API Integration Test
// Design Doc: design-011-game-object-client-rendering.md
// Generated: 2026-03-01 | Budget Used: 3/3 integration
//
// Tests the GET /api/game-data route handler to verify it returns
// game object definitions, sprite metadata, and atlas frame data
// alongside existing materials and tilesets.

// Mock @nookstead/db before importing route handler
jest.mock('@nookstead/db');

// Mock @nookstead/s3 before importing route handler
jest.mock('@nookstead/s3');

import { GET } from '../route';
import {
  getDb,
  listMaterials,
  listTilesets,
  listGameObjects,
  getSprite,
  getFramesBySprite,
} from '@nookstead/db';
import { generatePresignedGetUrl } from '@nookstead/s3';

const mockGetDb = getDb as jest.MockedFunction<typeof getDb>;
const mockListMaterials = listMaterials as jest.MockedFunction<
  typeof listMaterials
>;
const mockListTilesets = listTilesets as jest.MockedFunction<
  typeof listTilesets
>;
const mockListGameObjects = listGameObjects as jest.MockedFunction<
  typeof listGameObjects
>;
const mockGetSprite = getSprite as jest.MockedFunction<typeof getSprite>;
const mockGetFramesBySprite = getFramesBySprite as jest.MockedFunction<
  typeof getFramesBySprite
>;
const mockGeneratePresignedGetUrl =
  generatePresignedGetUrl as jest.MockedFunction<
    typeof generatePresignedGetUrl
  >;

const mockDb = {} as ReturnType<typeof getDb>;

function setupBaseMocks() {
  mockGetDb.mockReturnValue(mockDb);
  mockListMaterials.mockResolvedValue([]);
  mockListTilesets.mockResolvedValue([]);
  mockListGameObjects.mockResolvedValue([]);
  mockGetSprite.mockResolvedValue(null);
  mockGetFramesBySprite.mockResolvedValue([]);
  mockGeneratePresignedGetUrl.mockResolvedValue(
    'https://s3.example.com/signed'
  );
}

describe('GET /api/game-data', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    setupBaseMocks();
  });

  // AC-2.1: "When the game-data API receives a GET request, the response shall include
  //   a gameObjects map from objectId to { layers: GameObjectLayer[], collisionZones: CollisionZone[] }"
  // AC-2.2: "The response shall include a sprites map from spriteId to { s3Url, width, height }"
  // AC-2.3: "The response shall include an atlasFrames map from frameId to { frameX, frameY, frameW, frameH }"
  // ROI: 70 | Business Value: 7 (enables rendering pipeline) | Frequency: 10 (every game load)
  // Behavior: Client fetches game-data -> API queries DB for objects, sprites, frames ->
  //   generates presigned URLs -> returns combined response
  // @category: integration
  // @dependency: @nookstead/db (listGameObjects, getSprite, etc.), @nookstead/s3 (presigned URLs)
  // @complexity: medium

  it('should return gameObjects map in response', async () => {
    // Arrange
    const testLayers = [
      {
        frameId: 'f1',
        spriteId: 's1',
        xOffset: 0,
        yOffset: -16,
        layerOrder: 0,
      },
    ];
    const testCollisionZones = [
      {
        id: 'cz1',
        label: 'trunk',
        type: 'collision' as const,
        shape: 'rectangle' as const,
        x: 4,
        y: 12,
        width: 8,
        height: 4,
      },
    ];
    mockListGameObjects.mockResolvedValue([
      {
        id: 'obj-1',
        name: 'Oak Tree',
        description: null,
        category: null,
        objectType: null,
        layers: testLayers,
        collisionZones: testCollisionZones,
        tags: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockGetSprite.mockResolvedValue({
      id: 's1',
      name: 'oak-sprite',
      s3Key: 'sprites/oak.png',
      s3Url: 'https://s3.example.com/sprites/oak.png',
      width: 64,
      height: 128,
      fileSize: 1024,
      mimeType: 'image/png',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetFramesBySprite.mockResolvedValue([
      {
        id: 'f1',
        spriteId: 's1',
        filename: 'oak-trunk.png',
        frameX: 0,
        frameY: 0,
        frameW: 32,
        frameH: 48,
        rotated: false,
        trimmed: false,
        spriteSourceSizeX: 0,
        spriteSourceSizeY: 0,
        spriteSourceSizeW: 32,
        spriteSourceSizeH: 48,
        sourceSizeW: 32,
        sourceSizeH: 48,
        pivotX: 0.5,
        pivotY: 0.5,
        customData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockGeneratePresignedGetUrl.mockResolvedValue(
      'https://s3.example.com/sprites/oak.png?signed=1'
    );

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(body).toHaveProperty('gameObjects');
    expect(body.gameObjects['obj-1']).toBeDefined();
    expect(body.gameObjects['obj-1'].id).toBe('obj-1');
    expect(body.gameObjects['obj-1'].name).toBe('Oak Tree');
    expect(body.gameObjects['obj-1'].layers).toHaveLength(1);
    expect(body.gameObjects['obj-1'].layers[0].frameId).toBe('f1');
    expect(body.gameObjects['obj-1'].layers[0].spriteId).toBe('s1');
    expect(body.gameObjects['obj-1'].layers[0].xOffset).toBe(0);
    expect(body.gameObjects['obj-1'].layers[0].yOffset).toBe(-16);
    expect(body.gameObjects['obj-1'].collisionZones).toHaveLength(1);
    expect(body.gameObjects['obj-1'].collisionZones[0].type).toBe('collision');
    expect(body.gameObjects['obj-1'].collisionZones[0].x).toBe(4);
    expect(body.gameObjects['obj-1'].collisionZones[0].y).toBe(12);
    expect(body.gameObjects['obj-1'].collisionZones[0].width).toBe(8);
    expect(body.gameObjects['obj-1'].collisionZones[0].height).toBe(4);
  });

  it('should return sprites map with presigned S3 URLs', async () => {
    // Arrange
    mockListGameObjects.mockResolvedValue([
      {
        id: 'obj-1',
        name: 'Oak Tree',
        description: null,
        category: null,
        objectType: null,
        layers: [
          {
            frameId: 'f1',
            spriteId: 's1',
            xOffset: 0,
            yOffset: 0,
            layerOrder: 0,
          },
        ],
        collisionZones: [],
        tags: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockGetSprite.mockResolvedValue({
      id: 's1',
      name: 'oak-sprite',
      s3Key: 'sprites/oak.png',
      s3Url: 'https://s3.example.com/sprites/oak.png',
      width: 64,
      height: 128,
      fileSize: 1024,
      mimeType: 'image/png',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetFramesBySprite.mockResolvedValue([]);
    mockGeneratePresignedGetUrl.mockResolvedValue(
      'https://s3.example.com/sprites/oak.png?signed=1'
    );

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(body).toHaveProperty('sprites');
    expect(body.sprites['s1']).toBeDefined();
    expect(body.sprites['s1'].id).toBe('s1');
    expect(body.sprites['s1'].name).toBe('oak-sprite');
    expect(body.sprites['s1'].s3Url).toBe(
      'https://s3.example.com/sprites/oak.png?signed=1'
    );
  });

  it('should return atlasFrames map with frame coordinates', async () => {
    // Arrange
    mockListGameObjects.mockResolvedValue([
      {
        id: 'obj-1',
        name: 'Oak Tree',
        description: null,
        category: null,
        objectType: null,
        layers: [
          {
            frameId: 'f1',
            spriteId: 's1',
            xOffset: 0,
            yOffset: 0,
            layerOrder: 0,
          },
        ],
        collisionZones: [],
        tags: null,
        metadata: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockGetSprite.mockResolvedValue({
      id: 's1',
      name: 'oak-sprite',
      s3Key: 'sprites/oak.png',
      s3Url: 'https://s3.example.com/sprites/oak.png',
      width: 64,
      height: 128,
      fileSize: 1024,
      mimeType: 'image/png',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    mockGetFramesBySprite.mockResolvedValue([
      {
        id: 'f1',
        spriteId: 's1',
        filename: 'oak-trunk.png',
        frameX: 0,
        frameY: 0,
        frameW: 32,
        frameH: 48,
        rotated: false,
        trimmed: false,
        spriteSourceSizeX: 0,
        spriteSourceSizeY: 0,
        spriteSourceSizeW: 32,
        spriteSourceSizeH: 48,
        sourceSizeW: 32,
        sourceSizeH: 48,
        pivotX: 0.5,
        pivotY: 0.5,
        customData: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);
    mockGeneratePresignedGetUrl.mockResolvedValue(
      'https://s3.example.com/sprites/oak.png?signed=1'
    );

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(body).toHaveProperty('atlasFrames');
    expect(body.atlasFrames['f1']).toBeDefined();
    expect(body.atlasFrames['f1'].id).toBe('f1');
    expect(body.atlasFrames['f1'].spriteId).toBe('s1');
    expect(body.atlasFrames['f1'].frameX).toBe(0);
    expect(body.atlasFrames['f1'].frameY).toBe(0);
    expect(body.atlasFrames['f1'].frameW).toBe(32);
    expect(body.atlasFrames['f1'].frameH).toBe(48);
  });

  it('should return HTTP 500 when database query fails', async () => {
    // Arrange
    mockListMaterials.mockRejectedValue(new Error('DB connection failed'));

    // Act
    const response = await GET();
    const body = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(body).toEqual({ error: 'Internal server error' });
  });
});
