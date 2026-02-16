/**
 * Colyseus Client Connection Service
 *
 * Manages the WebSocket connection lifecycle between the browser (Phaser game
 * client) and the Colyseus game server. Provides singleton access to the
 * Colyseus client, session token retrieval via API route, and room join/leave
 * operations.
 *
 * This module is designed to be imported by Phaser scenes when ready to
 * establish a multiplayer connection. It uses lazy initialization -- no
 * connection is created on import.
 *
 * **SSR Safety:** All browser-dependent operations (cookie access) return null
 * during server-side rendering.
 *
 * ## Integration with Phaser Scenes (Task 4.4)
 *
 * To connect the Phaser game to the Colyseus server, import and call
 * `joinGameRoom()` from your scene's `create()` method:
 *
 * ```typescript
 * // In apps/game/src/game/scenes/Game.ts
 * import { joinGameRoom, leaveGameRoom, getRoom } from '@/services/colyseus';
 * import { Callbacks } from '@colyseus/sdk';
 *
 * export class Game extends Phaser.Scene {
 *   async create() {
 *     try {
 *       const room = await joinGameRoom();
 *       const callbacks = Callbacks.get(room);
 *
 *       // Listen for player additions
 *       callbacks.onAdd('players', (player, sessionId) => {
 *         // Create a Phaser sprite for this player
 *         console.log('Player joined:', sessionId, player);
 *       });
 *
 *       // Listen for player removals
 *       callbacks.onRemove('players', (player, sessionId) => {
 *         // Destroy the Phaser sprite for this player
 *         console.log('Player left:', sessionId);
 *       });
 *
 *       // Send movement messages
 *       room.send('move', { x: this.player.x, y: this.player.y });
 *
 *     } catch (error) {
 *       console.error('Failed to connect to game server:', error);
 *       // Handle connection failure (show error UI, retry, etc.)
 *     }
 *   }
 *
 *   shutdown() {
 *     // Clean up connection when scene shuts down
 *     leaveGameRoom();
 *   }
 * }
 * ```
 *
 * @module services/colyseus
 */

import { Client, Room } from '@colyseus/sdk';
import { COLYSEUS_PORT, ROOM_NAME } from '@nookstead/shared';
import type { GameRoomState } from '@nookstead/shared';

/**
 * Default Colyseus server URL, constructed from the NEXT_PUBLIC_COLYSEUS_URL
 * environment variable with a fallback to localhost using the shared
 * COLYSEUS_PORT constant.
 */
const COLYSEUS_URL =
  process.env['NEXT_PUBLIC_COLYSEUS_URL'] ??
  `http://localhost:${COLYSEUS_PORT}`;

/** Singleton Colyseus client instance. */
let client: Client | null = null;

/** Currently joined room instance. */
let currentRoom: Room<unknown, GameRoomState> | null = null;

/**
 * Fetch the session token from the server-side API route.
 *
 * The Auth.js session cookie is httpOnly, so client-side JS cannot read it
 * directly. Instead we call `/api/colyseus-token` which reads the cookie
 * server-side and returns the raw JWE token value.
 *
 * @returns The session token string, or null if not authenticated or in SSR.
 */
async function fetchSessionToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const res = await fetch('/api/colyseus-token');
  if (!res.ok) {
    return null;
  }

  const data = await res.json();
  return data.token ?? null;
}

/**
 * Get or create the singleton Colyseus client.
 *
 * The client connects to the URL specified by the `NEXT_PUBLIC_COLYSEUS_URL`
 * environment variable, falling back to `http://localhost:2567`.
 *
 * @returns The Colyseus Client instance.
 */
export function getClient(): Client {
  if (!client) {
    client = new Client(COLYSEUS_URL);
  }
  return client;
}

/**
 * Join or create the game room with the current session token.
 *
 * Extracts the NextAuth session token from cookies and uses it to authenticate
 * with the Colyseus server. The server's `onAuth` hook decrypts the token
 * to verify the player's identity.
 *
 * @returns The joined Room instance for state observation and message sending.
 * @throws Error if no session token is found (user not logged in).
 * @throws Error if the connection or authentication fails.
 */
export async function joinGameRoom(): Promise<
  Room<unknown, GameRoomState>
> {
  const token = await fetchSessionToken();
  if (!token) {
    throw new Error('No session token found. Please log in first.');
  }

  const colyseusClient = getClient();
  currentRoom = await colyseusClient.joinOrCreate<GameRoomState>(ROOM_NAME, {
    token,
  });

  return currentRoom;
}

/**
 * Leave the current game room.
 *
 * @param consented Whether the leave is intentional. Defaults to true.
 *   Pass false to simulate an unexpected disconnect.
 */
export async function leaveGameRoom(consented = true): Promise<void> {
  if (currentRoom) {
    await currentRoom.leave(consented);
    currentRoom = null;
  }
}

/**
 * Get the current room instance.
 *
 * @returns The current Room instance, or null if not connected to a room.
 */
export function getRoom(): Room<unknown, GameRoomState> | null {
  return currentRoom;
}

/**
 * Disconnect from the Colyseus server and clean up all resources.
 *
 * Leaves the current room (if any) and releases the client singleton.
 * Call this on logout or when the game is fully torn down.
 */
export async function disconnect(): Promise<void> {
  await leaveGameRoom(true);
  client = null;
}

// Re-export types for consumers of the connection service
export type { Room, Client } from '@colyseus/sdk';
export type { GameRoomState } from '@nookstead/shared';
