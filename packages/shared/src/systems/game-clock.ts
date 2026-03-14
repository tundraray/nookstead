import type { GameClockConfig, GameClockState, TimePeriod } from '../types/clock';
import {
  TIME_PERIOD_DAWN_START,
  TIME_PERIOD_DAY_START,
  TIME_PERIOD_DUSK_START,
  TIME_PERIOD_NIGHT_START,
} from '../constants';

const SEASONS = ['spring', 'summer', 'autumn', 'winter'] as const;

function getTimePeriod(hour: number): TimePeriod {
  if (hour >= TIME_PERIOD_DAWN_START && hour < TIME_PERIOD_DAY_START) return 'dawn';
  if (hour >= TIME_PERIOD_DAY_START && hour < TIME_PERIOD_DUSK_START) return 'day';
  if (hour >= TIME_PERIOD_DUSK_START && hour < TIME_PERIOD_NIGHT_START) return 'dusk';
  return 'night';
}

/**
 * Pure function: computes the current game clock state from a wall-clock timestamp
 * and the server-provided configuration. Has no side effects.
 *
 * @param nowMs   Current time in milliseconds (e.g. Date.now())
 * @param config  Clock configuration received from the server via CLOCK_CONFIG message
 */
export function computeGameClock(nowMs: number, config: GameClockConfig): GameClockState {
  const elapsedMs = Math.max(0, nowMs - config.serverEpoch);
  const dayDurationMs = config.dayDurationSeconds * 1000;

  const day = Math.floor(elapsedMs / dayDurationMs) + 1;
  const dayProgressMs = elapsedMs % dayDurationMs;
  const dayFraction = dayProgressMs / dayDurationMs;
  const totalMinutes = Math.floor(dayFraction * 1440); // 24 * 60
  const hour = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;

  const seasonIndex = Math.floor((day - 1) / config.seasonDurationDays) % 4;
  const season = SEASONS[seasonIndex];
  const timePeriod = getTimePeriod(hour);

  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  const timeString = `${hh}:${mm}`;

  return { day, hour, minute, season, timePeriod, timeString };
}
