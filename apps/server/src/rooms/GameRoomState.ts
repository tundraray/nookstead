import { Schema, MapSchema, type } from '@colyseus/schema';

export class Player extends Schema {
  @type('string') userId = '';
  @type('number') x = 0;
  @type('number') y = 0;
  @type('string') name = '';
  @type('boolean') connected = true;
}

export class GameRoomState extends Schema {
  @type({ map: Player }) players = new MapSchema<Player>();
}
