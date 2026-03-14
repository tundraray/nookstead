import {
  PLAYER_MAX_PATH_LENGTH,
  PLAYER_WAYPOINT_THRESHOLD,
} from '../index';

describe('Player click-to-move pathfinding constants', () => {
  it('PLAYER_MAX_PATH_LENGTH equals 200', () => {
    expect(PLAYER_MAX_PATH_LENGTH).toBe(200);
  });

  it('PLAYER_WAYPOINT_THRESHOLD equals 2', () => {
    expect(PLAYER_WAYPOINT_THRESHOLD).toBe(2);
  });
});
