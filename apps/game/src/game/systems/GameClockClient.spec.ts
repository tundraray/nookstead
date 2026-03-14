import type { GameClockConfig, GameClockState } from '@nookstead/shared';

// Mock EventBus before importing GameClockClient
const mockEmit = jest.fn();

jest.mock('../EventBus', () => ({
  EventBus: {
    emit: (...args: unknown[]) => mockEmit(...args),
  },
}));

import { GameClockClient } from './GameClockClient';

const BASE_EPOCH = 1_000_000_000_000; // a stable ms timestamp
const TEST_CONFIG: GameClockConfig = {
  serverEpoch: BASE_EPOCH,
  dayDurationSeconds: 86400,
  seasonDurationDays: 7,
};

describe('GameClockClient', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(BASE_EPOCH + 14 * 3600 * 1000); // 14:00
    mockEmit.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('emits hud:time immediately on construction (AC-4)', () => {
    const client = new GameClockClient(TEST_CONFIG);
    expect(mockEmit).toHaveBeenCalledTimes(1);
    expect(mockEmit).toHaveBeenCalledWith(
      'hud:time',
      expect.any(Number),
      expect.any(String),
      expect.any(String),
    );
    client.destroy();
  });

  it('emits hud:time with correct positional args: (day, timeString, season)', () => {
    const client = new GameClockClient(TEST_CONFIG);
    const [event, day, timeString, season] = mockEmit.mock.calls[0] as [
      string,
      number,
      string,
      string,
    ];
    expect(event).toBe('hud:time');
    expect(typeof day).toBe('number');
    expect(timeString).toMatch(/^\d{2}:\d{2}$/); // HH:MM format (AC-4.1)
    expect(['spring', 'summer', 'autumn', 'winter']).toContain(season);
    client.destroy();
  });

  it('emits updated values after 1 second (AC-4)', () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValueOnce(BASE_EPOCH + 14 * 3600 * 1000) // constructor call
      .mockReturnValue(BASE_EPOCH + 14 * 3600 * 1000 + 1000); // interval tick

    const client = new GameClockClient(TEST_CONFIG);
    mockEmit.mockClear();

    jest.advanceTimersByTime(1000);

    expect(mockEmit).toHaveBeenCalledTimes(1);
    client.destroy();
  });

  it('getState() returns current GameClockState', () => {
    const client = new GameClockClient(TEST_CONFIG);
    const state: GameClockState = client.getState();
    expect(state).toHaveProperty('day');
    expect(state).toHaveProperty('hour');
    expect(state).toHaveProperty('minute');
    expect(state).toHaveProperty('season');
    expect(state).toHaveProperty('timePeriod');
    expect(state).toHaveProperty('timeString');
    client.destroy();
  });

  it('destroy() stops interval; no further emissions after destroy()', () => {
    const client = new GameClockClient(TEST_CONFIG);
    mockEmit.mockClear();
    client.destroy();

    jest.advanceTimersByTime(5000);

    expect(mockEmit).not.toHaveBeenCalled();
  });
});
