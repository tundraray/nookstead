export type TimePeriod = 'dawn' | 'day' | 'dusk' | 'night';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface GameClockConfig {
  serverEpoch: number;
  dayDurationSeconds: number;
  seasonDurationDays: number;
}

export interface GameClockState {
  day: number;
  hour: number;
  minute: number;
  season: Season;
  timePeriod: TimePeriod;
  timeString: string; // "HH:MM" zero-padded
}
