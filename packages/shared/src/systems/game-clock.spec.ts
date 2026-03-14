import { computeGameClock } from './game-clock';
import type { GameClockConfig } from '../types/clock';

describe('computeGameClock()', () => {
  const EPOCH = 1000000;

  function makeConfig(overrides: Partial<GameClockConfig> = {}): GameClockConfig {
    return {
      serverEpoch: EPOCH,
      dayDurationSeconds: 86400,
      seasonDurationDays: 7,
      ...overrides,
    };
  }

  /** Helper: convert hours and minutes to milliseconds offset from epoch. */
  function hoursToMs(hours: number, minutes = 0): number {
    const config = makeConfig();
    const dayDurationMs = config.dayDurationSeconds * 1000;
    return ((hours * 60 + minutes) / 1440) * dayDurationMs;
  }

  describe('day computation', () => {
    it('should return day=1 at epoch (AC-3.1)', () => {
      const result = computeGameClock(EPOCH, makeConfig());
      expect(result.day).toBe(1);
    });

    it('should return day=2 after one full day (AC-3.1)', () => {
      const nowMs = EPOCH + 86400 * 1000;
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.day).toBe(2);
    });
  });

  describe('hour and minute computation', () => {
    it('should return hour=14, timePeriod=day for 14h elapsed at real-time speed (AC-7)', () => {
      const nowMs = EPOCH + hoursToMs(14);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.hour).toBe(14);
      expect(result.timePeriod).toBe('day');
    });

    it('should return hour=23, minute=59 near midnight (AC-4.1)', () => {
      const nowMs = EPOCH + hoursToMs(23, 59);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.hour).toBe(23);
      expect(result.minute).toBe(59);
    });

    it('should return timeString="05:30" for 5.5h elapsed (AC-4.1)', () => {
      const nowMs = EPOCH + hoursToMs(5, 30);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timeString).toBe('05:30');
    });

    it('should return timeString="00:00" at epoch', () => {
      const result = computeGameClock(EPOCH, makeConfig());
      expect(result.timeString).toBe('00:00');
    });
  });

  describe('season computation', () => {
    it('should return spring for day 1 with seasonDays=7 (AC-6)', () => {
      const result = computeGameClock(EPOCH, makeConfig());
      expect(result.season).toBe('spring');
    });

    it('should return summer for day 8 with seasonDays=7 (AC-6.1)', () => {
      const nowMs = EPOCH + 7 * 86400 * 1000;
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.day).toBe(8);
      expect(result.season).toBe('summer');
    });

    it('should return autumn for day 15 with seasonDays=7 (AC-6.1)', () => {
      const nowMs = EPOCH + 14 * 86400 * 1000;
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.day).toBe(15);
      expect(result.season).toBe('autumn');
    });

    it('should return winter for day 22 with seasonDays=7 (AC-6.1)', () => {
      const nowMs = EPOCH + 21 * 86400 * 1000;
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.day).toBe(22);
      expect(result.season).toBe('winter');
    });

    it('should cycle back to spring for day 29 with seasonDays=7 (AC-6.1)', () => {
      const nowMs = EPOCH + 28 * 86400 * 1000;
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.day).toBe(29);
      expect(result.season).toBe('spring');
    });
  });

  describe('time period computation (AC-5)', () => {
    it('should return night for hour=4', () => {
      const nowMs = EPOCH + hoursToMs(4);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('night');
    });

    it('should return dawn for hour=5 (AC-5)', () => {
      const nowMs = EPOCH + hoursToMs(5);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('dawn');
    });

    it('should return dawn for hour=6 (AC-5)', () => {
      const nowMs = EPOCH + hoursToMs(6);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('dawn');
    });

    it('should return day for hour=7 (AC-5)', () => {
      const nowMs = EPOCH + hoursToMs(7);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('day');
    });

    it('should return day for hour=16 (AC-5)', () => {
      const nowMs = EPOCH + hoursToMs(16);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('day');
    });

    it('should return dusk for hour=17 (AC-5)', () => {
      const nowMs = EPOCH + hoursToMs(17);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('dusk');
    });

    it('should return dusk for hour=18', () => {
      const nowMs = EPOCH + hoursToMs(18);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('dusk');
    });

    it('should return night for hour=19 (AC-5.2)', () => {
      const nowMs = EPOCH + hoursToMs(19);
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.timePeriod).toBe('night');
    });

    it('should return night for hour=0', () => {
      const result = computeGameClock(EPOCH, makeConfig());
      expect(result.timePeriod).toBe('night');
    });
  });

  describe('time period transitions', () => {
    it('should transition from night to dawn at hour 5 (AC-5.1)', () => {
      const config = makeConfig();
      const at4 = computeGameClock(EPOCH + hoursToMs(4), config);
      const at5 = computeGameClock(EPOCH + hoursToMs(5), config);
      expect(at4.timePeriod).toBe('night');
      expect(at5.timePeriod).toBe('dawn');
    });

    it('should transition from dusk to night at hour 19 (AC-5.2)', () => {
      const config = makeConfig();
      const at18 = computeGameClock(EPOCH + hoursToMs(18), config);
      const at19 = computeGameClock(EPOCH + hoursToMs(19), config);
      expect(at18.timePeriod).toBe('dusk');
      expect(at19.timePeriod).toBe('night');
    });
  });

  describe('edge cases', () => {
    it('should handle future epoch (nowMs < serverEpoch) as day=1, hour=0 (AC-3.2)', () => {
      const nowMs = EPOCH - 5000;
      const result = computeGameClock(nowMs, makeConfig());
      expect(result.day).toBe(1);
      expect(result.hour).toBe(0);
      expect(result.minute).toBe(0);
      expect(result.season).toBe('spring');
      expect(result.timePeriod).toBe('night');
      expect(result.timeString).toBe('00:00');
    });
  });

  describe('speed multiplier', () => {
    it('should compute hour=12 after 12 real minutes at 60x speed (AC-7.1)', () => {
      const config = makeConfig({ dayDurationSeconds: 1440 });
      const twelveRealMinMs = 12 * 60 * 1000;
      const nowMs = EPOCH + twelveRealMinMs;
      const result = computeGameClock(nowMs, config);
      expect(result.hour).toBe(12);
    });
  });
});
