import { StateMachine, type State } from '../../src/game/entities/StateMachine';

/** Helper: create a State stub with jest.fn() hooks */
function createState(name: string, hooks?: Partial<Pick<State, 'enter' | 'update' | 'exit'>>): State {
  return {
    name,
    enter: hooks?.enter ?? jest.fn(),
    update: hooks?.update ?? jest.fn(),
    exit: hooks?.exit ?? jest.fn(),
  };
}

describe('StateMachine', () => {
  // -----------------------------------------------------------
  // Construction
  // -----------------------------------------------------------
  describe('construction', () => {
    it('should call enter() on the initial state', () => {
      const idle = createState('idle');
      new StateMachine({}, 'idle', { idle });
      expect(idle.enter).toHaveBeenCalledTimes(1);
    });

    it('should set currentState to the initial state name', () => {
      const idle = createState('idle');
      const sm = new StateMachine({}, 'idle', { idle });
      expect(sm.currentState).toBe('idle');
    });

    it('should throw when initial state does not exist in states', () => {
      const idle = createState('idle');
      expect(() => new StateMachine({}, 'running', { idle })).toThrow(
        'Unknown state: running'
      );
    });

    it('should not crash when initial state has no enter hook', () => {
      const minimal: State = { name: 'idle' };
      expect(() => new StateMachine({}, 'idle', { idle: minimal })).not.toThrow();
    });
  });

  // -----------------------------------------------------------
  // setState
  // -----------------------------------------------------------
  describe('setState', () => {
    it('should call exit() on the old state and enter() on the new state', () => {
      const idle = createState('idle');
      const walk = createState('walk');
      const sm = new StateMachine({}, 'idle', { idle, walk });

      sm.setState('walk');

      expect(idle.exit).toHaveBeenCalledTimes(1);
      expect(walk.enter).toHaveBeenCalledTimes(1);
    });

    it('should call exit before enter during transition', () => {
      const callOrder: string[] = [];
      const idle = createState('idle', {
        exit: jest.fn(() => callOrder.push('idle.exit')),
      });
      const walk = createState('walk', {
        enter: jest.fn(() => callOrder.push('walk.enter')),
      });
      const sm = new StateMachine({}, 'idle', { idle, walk });

      sm.setState('walk');

      expect(callOrder).toEqual(['idle.exit', 'walk.enter']);
    });

    it('should update currentState after transition', () => {
      const idle = createState('idle');
      const walk = createState('walk');
      const sm = new StateMachine({}, 'idle', { idle, walk });

      sm.setState('walk');

      expect(sm.currentState).toBe('walk');
    });

    it('should throw when transitioning to an unknown state', () => {
      const idle = createState('idle');
      const sm = new StateMachine({}, 'idle', { idle });

      expect(() => sm.setState('flying')).toThrow('Unknown state: flying');
    });

    it('should not crash when old state has no exit hook', () => {
      const idle: State = { name: 'idle' };
      const walk = createState('walk');
      const sm = new StateMachine({}, 'idle', { idle, walk });

      expect(() => sm.setState('walk')).not.toThrow();
      expect(walk.enter).toHaveBeenCalledTimes(1);
    });

    it('should not crash when new state has no enter hook', () => {
      const idle = createState('idle');
      const walk: State = { name: 'walk' };
      const sm = new StateMachine({}, 'idle', { idle, walk });

      expect(() => sm.setState('walk')).not.toThrow();
      expect(idle.exit).toHaveBeenCalledTimes(1);
    });

    it('should allow transitioning to the same state', () => {
      const idle = createState('idle');
      const sm = new StateMachine({}, 'idle', { idle });

      sm.setState('idle');

      // exit and enter should both be called again (re-entry)
      // enter: 1 from construction + 1 from setState = 2
      expect(idle.exit).toHaveBeenCalledTimes(1);
      expect(idle.enter).toHaveBeenCalledTimes(2);
    });
  });

  // -----------------------------------------------------------
  // update
  // -----------------------------------------------------------
  describe('update', () => {
    it('should delegate to current state update() with delta', () => {
      const idle = createState('idle');
      const sm = new StateMachine({}, 'idle', { idle });

      sm.update(16.67);

      expect(idle.update).toHaveBeenCalledTimes(1);
      expect(idle.update).toHaveBeenCalledWith(16.67);
    });

    it('should delegate to the correct state after transition', () => {
      const idle = createState('idle');
      const walk = createState('walk');
      const sm = new StateMachine({}, 'idle', { idle, walk });

      sm.setState('walk');
      sm.update(33.33);

      expect(walk.update).toHaveBeenCalledWith(33.33);
      // idle.update should not have been called (only walk)
      expect(idle.update).not.toHaveBeenCalled();
    });

    it('should not crash when current state has no update hook', () => {
      const idle: State = { name: 'idle' };
      const sm = new StateMachine({}, 'idle', { idle });

      expect(() => sm.update(16.67)).not.toThrow();
    });
  });

  // -----------------------------------------------------------
  // currentState getter
  // -----------------------------------------------------------
  describe('currentState', () => {
    it('should return the initial state name immediately after construction', () => {
      const idle = createState('idle');
      const sm = new StateMachine({}, 'idle', { idle });
      expect(sm.currentState).toBe('idle');
    });

    it('should reflect the latest state after multiple transitions', () => {
      const idle = createState('idle');
      const walk = createState('walk');
      const run = createState('run');
      const sm = new StateMachine({}, 'idle', { idle, walk, run });

      sm.setState('walk');
      expect(sm.currentState).toBe('walk');

      sm.setState('run');
      expect(sm.currentState).toBe('run');

      sm.setState('idle');
      expect(sm.currentState).toBe('idle');
    });
  });

  // -----------------------------------------------------------
  // State with no optional hooks (minimal state)
  // -----------------------------------------------------------
  describe('minimal state (no optional hooks)', () => {
    it('should construct, transition, and update without crashing', () => {
      const a: State = { name: 'a' };
      const b: State = { name: 'b' };
      const sm = new StateMachine({}, 'a', { a, b });

      expect(sm.currentState).toBe('a');
      sm.update(16);
      sm.setState('b');
      expect(sm.currentState).toBe('b');
      sm.update(16);
    });
  });

  // -----------------------------------------------------------
  // Context passthrough (stored but not directly tested by FSM)
  // -----------------------------------------------------------
  describe('context', () => {
    it('should accept any context value without error', () => {
      const idle = createState('idle');
      const context = { player: { x: 0, y: 0 }, speed: 100 };
      expect(() => new StateMachine(context, 'idle', { idle })).not.toThrow();
    });

    it('should accept null context', () => {
      const idle = createState('idle');
      expect(() => new StateMachine(null, 'idle', { idle })).not.toThrow();
    });
  });

  // -----------------------------------------------------------
  // Multiple states registry
  // -----------------------------------------------------------
  describe('multiple states', () => {
    it('should handle a registry of many states', () => {
      const states: Record<string, State> = {};
      for (const name of ['idle', 'walk', 'run', 'sit', 'hit', 'punch', 'hurt']) {
        states[name] = createState(name);
      }

      const sm = new StateMachine({}, 'idle', states);
      expect(sm.currentState).toBe('idle');

      sm.setState('walk');
      expect(sm.currentState).toBe('walk');

      sm.setState('hit');
      expect(sm.currentState).toBe('hit');

      sm.setState('idle');
      expect(sm.currentState).toBe('idle');
    });
  });
});
