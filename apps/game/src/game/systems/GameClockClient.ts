import { EventBus } from '../EventBus';
import { computeGameClock } from '@nookstead/shared';
import type { GameClockConfig, GameClockState } from '@nookstead/shared';

export class GameClockClient {
  private config: GameClockConfig;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private currentState: GameClockState;

  constructor(config: GameClockConfig) {
    this.config = config;
    this.currentState = computeGameClock(Date.now(), this.config);
    this.emit(this.currentState);
    this.intervalId = setInterval(() => {
      this.currentState = computeGameClock(Date.now(), this.config);
      this.emit(this.currentState);
    }, 1000);
  }

  /** Returns the most recently computed game clock state. */
  getState(): GameClockState {
    return this.currentState;
  }

  /** Stops the update interval. Must be called on reconnect or scene shutdown. */
  destroy(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emit(state: GameClockState): void {
    EventBus.emit('hud:time', state.day, state.timeString, state.season);
  }
}
