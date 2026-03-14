import { Player } from '../../src/game/entities/Player';
import { StateMachine, type State } from '../../src/game/entities/StateMachine';
import { InputController } from '../../src/game/input/InputController';
import { IdleState } from '../../src/game/entities/states/IdleState';
import { WalkState } from '../../src/game/entities/states/WalkState';
import { getActiveSkin } from '../../src/game/characters/skin-registry';
import {
  PLAYER_SPEED,
  MAP_WIDTH,
  MAP_HEIGHT,
  TILE_SIZE,
} from '../../src/game/constants';
import type { GeneratedMap } from '../../src/game/mapgen/types';

// ---------------------------------------------------------------------------
// Mock Phaser.GameObjects.Sprite
// ---------------------------------------------------------------------------

// Shared mock holder -- populated inside jest.mock factory (which is hoisted).
// Using var so it's accessible before const/let initialization.
const phaserMocks = {
  setOrigin: jest.fn().mockReturnThis(),
  setDepth: jest.fn().mockReturnThis(),
  play: jest.fn().mockReturnThis(),
  setPosition: jest.fn().mockReturnThis(),
  preUpdate: jest.fn(),
};

jest.mock('phaser', () => {
  // Build mock fns lazily from the phaserMocks bag. Class field assignments
  // (= syntax) run at construction time, so the outer `phaserMocks` const
  // is already initialised by then. The prototype assignment for preUpdate
  // also runs at construction time via the factory return, not at hoist time.
  class MockSprite {
    scene: unknown;
    x: number;
    y: number;
    texture: string;

    constructor(scene: unknown, x: number, y: number, texture: string) {
      this.scene = scene;
      this.x = x;
      this.y = y;
      this.texture = texture;
    }

    setOrigin(...args: unknown[]) { return phaserMocks.setOrigin(...args); }
    setDepth(...args: unknown[]) { return phaserMocks.setDepth(...args); }
    play(...args: unknown[]) { return phaserMocks.play(...args); }
    setPosition(...args: unknown[]) { return phaserMocks.setPosition(...args); }
    preUpdate(...args: unknown[]) { return phaserMocks.preUpdate(...args); }
  }

  return {
    __esModule: true,
    default: {
      GameObjects: {
        Sprite: MockSprite,
      },
    },
    GameObjects: {
      Sprite: MockSprite,
    },
  };
});

// ---------------------------------------------------------------------------
// Mock dependencies
// ---------------------------------------------------------------------------

jest.mock('../../src/game/input/InputController', () => ({
  InputController: jest.fn().mockImplementation(() => ({
    getDirection: jest.fn().mockReturnValue({ x: 0, y: 0 }),
    isMoving: jest.fn().mockReturnValue(false),
    getFacingDirection: jest.fn().mockReturnValue('down'),
    destroy: jest.fn(),
  })),
}));

const mockStateMachineUpdate = jest.fn();
let capturedStates: Record<string, State> = {};
let capturedInitialState = '';

jest.mock('../../src/game/entities/StateMachine', () => ({
  StateMachine: jest.fn().mockImplementation(
    (_context: unknown, initialState: string, states: Record<string, State>) => {
      capturedStates = states;
      capturedInitialState = initialState;
      return {
        currentState: initialState,
        update: mockStateMachineUpdate,
        setState: jest.fn(),
        context: _context,
      };
    }
  ),
}));

jest.mock('../../src/game/entities/states/IdleState', () => ({
  IdleState: jest.fn().mockImplementation(() => ({
    name: 'idle',
    enter: jest.fn(),
    update: jest.fn(),
  })),
}));

jest.mock('../../src/game/entities/states/WalkState', () => ({
  WalkState: jest.fn().mockImplementation(() => ({
    name: 'walk',
    enter: jest.fn(),
    update: jest.fn(),
  })),
}));

jest.mock('../../src/game/characters/skin-registry', () => ({
  getDefaultSkin: jest.fn().mockReturnValue({
    key: 'scout',
    sheetPath: 'characters/scout_6.png',
    sheetKey: 'char-scout',
    type: 'preset',
    textureWidth: 927,
  }),
  getActiveSkin: jest.fn().mockReturnValue({
    key: 'scout',
    sheetPath: 'characters/scout_6.png',
    sheetKey: 'char-scout',
    type: 'preset',
    textureWidth: 927,
  }),
}));

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function createMockScene(): Phaser.Scene {
  return {
    add: {
      existing: jest.fn(),
    },
    input: {
      keyboard: {
        createCursorKeys: jest.fn(),
        addKeys: jest.fn(),
      },
    },
  } as unknown as Phaser.Scene;
}

function createMockMapData(): GeneratedMap {
  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    seed: 42,
    grid: [[{ terrain: 'grass', elevation: 0, meta: {} }]],
    layers: [],
    walkable: [[true]],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Player', () => {
  let scene: Phaser.Scene;
  let mapData: GeneratedMap;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedStates = {};
    capturedInitialState = '';
    scene = createMockScene();
    mapData = createMockMapData();
  });

  // -----------------------------------------------------------
  // Construction
  // -----------------------------------------------------------
  describe('construction', () => {
    it('should call getActiveSkin to determine the sprite sheet', () => {
      new Player(scene, 100, 200, mapData);
      expect(getActiveSkin).toHaveBeenCalledTimes(1);
    });

    it('should store the sheetKey from the default skin', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.sheetKey).toBe('char-scout');
    });

    it('should default facingDirection to "down"', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.facingDirection).toBe('down');
    });

    it('should store mapData reference', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.mapData).toBe(mapData);
    });

    it('should set speed to PLAYER_SPEED (100)', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.speed).toBe(PLAYER_SPEED);
      expect(player.speed).toBe(100);
    });

    it('should set mapWidth to MAP_WIDTH (64)', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.mapWidth).toBe(MAP_WIDTH);
      expect(player.mapWidth).toBe(64);
    });

    it('should set mapHeight to MAP_HEIGHT (64)', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.mapHeight).toBe(MAP_HEIGHT);
      expect(player.mapHeight).toBe(64);
    });

    it('should set tileSize to TILE_SIZE (16)', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.tileSize).toBe(TILE_SIZE);
      expect(player.tileSize).toBe(16);
    });
  });

  // -----------------------------------------------------------
  // Sprite setup
  // -----------------------------------------------------------
  describe('sprite setup', () => {
    it('should set origin to (0.5, 1.0) for bottom-center anchor', () => {
      new Player(scene, 100, 200, mapData);
      expect(phaserMocks.setOrigin).toHaveBeenCalledTimes(1);
      expect(phaserMocks.setOrigin).toHaveBeenCalledWith(0.5, 1.0);
    });

    it('should not set a static depth (depth is y-sorted in preUpdate)', () => {
      new Player(scene, 100, 200, mapData);
      // Player no longer sets depth in constructor — it uses this.setDepth(this.y) in preUpdate
      expect(phaserMocks.setDepth).not.toHaveBeenCalled();
    });

    it('should add itself to the scene display list', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect((scene.add.existing as jest.Mock)).toHaveBeenCalledTimes(1);
      expect((scene.add.existing as jest.Mock)).toHaveBeenCalledWith(player);
    });
  });

  // -----------------------------------------------------------
  // InputController
  // -----------------------------------------------------------
  describe('input controller', () => {
    it('should create an InputController with the scene', () => {
      new Player(scene, 100, 200, mapData);
      expect(InputController).toHaveBeenCalledTimes(1);
      expect(InputController).toHaveBeenCalledWith(scene);
    });

    it('should expose the input controller as a public property', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.inputController).toBeDefined();
    });
  });

  // -----------------------------------------------------------
  // StateMachine
  // -----------------------------------------------------------
  describe('state machine', () => {
    it('should create a StateMachine with the player as context', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(StateMachine).toHaveBeenCalledTimes(1);
      expect((StateMachine as jest.Mock).mock.calls[0][0]).toBe(player);
    });

    it('should start the StateMachine in "idle" state', () => {
      new Player(scene, 100, 200, mapData);
      expect(capturedInitialState).toBe('idle');
    });

    it('should register all 7 states in the state machine', () => {
      new Player(scene, 100, 200, mapData);
      const stateNames = Object.keys(capturedStates).sort();
      expect(stateNames).toEqual(
        ['hit', 'hurt', 'idle', 'punch', 'sit', 'waiting', 'walk'].sort()
      );
    });

    it('should use IdleState instance for the idle state', () => {
      new Player(scene, 100, 200, mapData);
      expect(IdleState).toHaveBeenCalledTimes(1);
    });

    it('should use WalkState instance for the walk state', () => {
      new Player(scene, 100, 200, mapData);
      expect(WalkState).toHaveBeenCalledTimes(1);
    });

    it('should pass the player as context to IdleState', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect((IdleState as jest.Mock).mock.calls[0][0]).toBe(player);
    });

    it('should pass the player as context to WalkState', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect((WalkState as jest.Mock).mock.calls[0][0]).toBe(player);
    });

    it('should expose the stateMachine as a public property', () => {
      const player = new Player(scene, 100, 200, mapData);
      expect(player.stateMachine).toBeDefined();
    });
  });

  // -----------------------------------------------------------
  // Placeholder states
  // -----------------------------------------------------------
  describe('placeholder states', () => {
    const placeholderNames = ['waiting', 'sit', 'hit', 'punch', 'hurt'];

    it.each(placeholderNames)(
      'should register "%s" as a placeholder state with correct name',
      (stateName) => {
        new Player(scene, 100, 200, mapData);
        expect(capturedStates[stateName]).toBeDefined();
        expect(capturedStates[stateName].name).toBe(stateName);
      }
    );

    it.each(placeholderNames)(
      'should give "%s" an enter function',
      (stateName) => {
        new Player(scene, 100, 200, mapData);
        expect(typeof capturedStates[stateName].enter).toBe('function');
      }
    );
  });

  // -----------------------------------------------------------
  // preUpdate
  // -----------------------------------------------------------
  describe('preUpdate', () => {
    it('should call super.preUpdate with time and delta', () => {
      const player = new Player(scene, 100, 200, mapData);
      player.preUpdate(1000, 16.67);
      expect(phaserMocks.preUpdate).toHaveBeenCalledTimes(1);
      expect(phaserMocks.preUpdate).toHaveBeenCalledWith(1000, 16.67);
    });

    it('should call stateMachine.update with delta', () => {
      const player = new Player(scene, 100, 200, mapData);
      player.preUpdate(1000, 16.67);
      expect(mockStateMachineUpdate).toHaveBeenCalledTimes(1);
      expect(mockStateMachineUpdate).toHaveBeenCalledWith(16.67);
    });

    it('should call super.preUpdate before stateMachine.update', () => {
      const callOrder: string[] = [];
      phaserMocks.preUpdate.mockImplementation(() => callOrder.push('super.preUpdate'));
      mockStateMachineUpdate.mockImplementation(() =>
        callOrder.push('stateMachine.update')
      );

      const player = new Player(scene, 100, 200, mapData);
      player.preUpdate(1000, 16.67);

      expect(callOrder).toEqual(['super.preUpdate', 'stateMachine.update']);
    });
  });
});
