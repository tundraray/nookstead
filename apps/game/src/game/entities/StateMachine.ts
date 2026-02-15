/**
 * Represents a single behavioral state with optional lifecycle hooks.
 *
 * Each state has a unique `name` and may define `enter`, `update`, and `exit`
 * callbacks that the {@link StateMachine} invokes during state transitions and
 * frame updates.
 */
export interface State {
  /** Unique identifier for this state (e.g. "idle", "walk", "hit"). */
  name: string;

  /** Called when the state machine transitions into this state. */
  enter?(): void;

  /** Called every frame while this state is active. */
  update?(delta: number): void;

  /** Called when the state machine transitions out of this state. */
  exit?(): void;
}

/**
 * A lightweight finite state machine that manages behavioral states with
 * enter/update/exit lifecycle hooks.
 *
 * The FSM enforces single-state invariance: exactly one state is active at any
 * time. Transitions call `exit()` on the old state, then `enter()` on the new
 * state. The `update()` method delegates to the currently active state.
 *
 * This module is framework-agnostic and has no dependency on Phaser or any
 * other game engine.
 *
 * @example
 * ```ts
 * const idle: State = { name: 'idle', enter() { ... }, update(dt) { ... } };
 * const walk: State = { name: 'walk', enter() { ... }, update(dt) { ... } };
 * const fsm = new StateMachine(player, 'idle', { idle, walk });
 * fsm.update(16.67);
 * fsm.setState('walk');
 * ```
 */
export class StateMachine {
  private readonly states: Record<string, State>;
  private current: State;

  /**
   * Create a new StateMachine.
   *
   * @param context - An arbitrary owner object stored for reference (e.g. a
   *   player entity). The state machine itself does not use it, but consumer
   *   code may access it via state hooks.
   * @param initialState - The key of the state to activate immediately. Must
   *   exist in `states`.
   * @param states - A record mapping state keys to {@link State} objects.
   * @throws {Error} If `initialState` is not a key in `states`.
   */
  constructor(
    public readonly context: unknown,
    initialState: string,
    states: Record<string, State>,
  ) {
    this.states = states;

    const state = this.states[initialState];
    if (!state) {
      throw new Error(`Unknown state: ${initialState}`);
    }

    this.current = state;
    this.current.enter?.();
  }

  /**
   * The name of the currently active state.
   */
  get currentState(): string {
    return this.current.name;
  }

  /**
   * Transition to a new state.
   *
   * Calls `exit()` on the current state (if defined), then `enter()` on the
   * target state (if defined). The transition is allowed even when the target
   * is the same as the current state (re-entry).
   *
   * @param name - The key of the state to transition to. Must exist in the
   *   states registry.
   * @throws {Error} If `name` is not a known state key.
   */
  setState(name: string): void {
    const next = this.states[name];
    if (!next) {
      throw new Error(`Unknown state: ${name}`);
    }

    this.current.exit?.();
    this.current = next;
    this.current.enter?.();
  }

  /**
   * Delegate a frame update to the active state.
   *
   * @param delta - Elapsed time since the last frame, in milliseconds.
   */
  update(delta: number): void {
    this.current.update?.(delta);
  }
}
