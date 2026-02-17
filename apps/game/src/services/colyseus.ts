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
 * @module services/colyseus
 */

import { Client, Room } from '@colyseus/sdk';
import {
  COLYSEUS_PORT,
  CHUNK_ROOM_NAME,
  ServerMessage,
} from '@nookstead/shared';
import type { ChunkRoomState, ChunkTransitionPayload } from '@nookstead/shared';

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
let currentRoom: Room<unknown, ChunkRoomState> | null = null;

/** Callback invoked when the server kicks this session (duplicate login). */
let sessionKickedCallback: (() => void) | null = null;

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
 * Join a chunk room by chunkId.
 *
 * If chunkId is omitted, the server uses the player's last known chunk or
 * default spawn location.
 *
 * Registers message handlers for SESSION_KICKED and CHUNK_TRANSITION on the
 * newly joined room.
 *
 * @param chunkId - Optional chunk identifier to join a specific chunk room.
 * @returns The joined Room instance for state observation and message sending.
 * @throws Error if no session token is found (user not logged in).
 * @throws Error if the connection or authentication fails.
 */
export async function joinChunkRoom(
  chunkId?: string
): Promise<Room<unknown, ChunkRoomState>> {
  const token = await fetchSessionToken();
  if (!token) {
    throw new Error('No session token found. Please log in first.');
  }

  const colyseusClient = getClient();
  const options: Record<string, unknown> = { token };
  if (chunkId) {
    options['chunkId'] = chunkId;
  }

  const room = await colyseusClient.joinOrCreate<ChunkRoomState>(
    CHUNK_ROOM_NAME,
    options
  );
  currentRoom = room;

  // Handle SESSION_KICKED message from server
  room.onMessage(ServerMessage.SESSION_KICKED, () => {
    console.log(
      '[ColyseusService] Session kicked: You logged in from another location'
    );
    if (sessionKickedCallback) {
      sessionKickedCallback();
    }
    currentRoom = null;
  });

  // Handle CHUNK_TRANSITION message from server
  room.onMessage(
    ServerMessage.CHUNK_TRANSITION,
    async (data: ChunkTransitionPayload) => {
      console.log(
        `[ColyseusService] Chunk transition: -> ${data.newChunkId}`
      );
      await handleChunkTransition(data.newChunkId);
    }
  );

  return room;
}

/**
 * Handle chunk transition: leave current room, join new chunk room.
 *
 * @param newChunkId - The chunk identifier to transition to.
 * @returns The newly joined Room instance.
 */
export async function handleChunkTransition(
  newChunkId: string
): Promise<Room<unknown, ChunkRoomState>> {
  if (currentRoom) {
    try {
      await currentRoom.leave(false);
    } catch (err) {
      console.error(
        '[ColyseusService] Error leaving room during chunk transition:',
        err
      );
    }
    currentRoom = null;
  }
  return joinChunkRoom(newChunkId);
}

/**
 * Leave the current room gracefully.
 *
 * @param consented - If true, server does not attempt to reconnect. Defaults
 *   to true.
 */
export async function leaveCurrentRoom(consented = true): Promise<void> {
  if (currentRoom) {
    await currentRoom.leave(consented);
    currentRoom = null;
  }
}

/**
 * Register a callback for when this client receives a SESSION_KICKED message.
 * Called when a new connection from the same user forces this session out.
 *
 * @param callback - Function to invoke when session is kicked.
 */
export function onSessionKicked(callback: () => void): void {
  sessionKickedCallback = callback;
}

/**
 * Get the current room instance.
 *
 * @returns The current Room instance, or null if not connected to a room.
 */
export function getRoom(): Room<unknown, ChunkRoomState> | null {
  return currentRoom;
}

/**
 * Disconnect from the Colyseus server and clean up all resources.
 *
 * Leaves the current room (if any) and releases the client singleton.
 * Call this on logout or when the game is fully torn down.
 */
export async function disconnect(): Promise<void> {
  await leaveCurrentRoom(true);
  client = null;
  sessionKickedCallback = null;
}

// Re-export types for consumers of the connection service
export type { Room, Client } from '@colyseus/sdk';
export type { ChunkRoomState } from '@nookstead/shared';
