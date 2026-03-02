// NPC Bot Companion E2E Test - Design Doc: design-019-npc-bot-companion.md
// Generated: 2026-03-01 | Budget Used: 1/2 E2E
// Test Type: End-to-End Test
// Implementation Timing: After all feature implementations complete
//
// Prerequisites:
//   - Game server running on port 2567 with ChunkRoom registered
//   - Next.js game client running on port 3000 (Playwright webServer handles this)
//   - PostgreSQL database accessible with npc_bots table migrated
//   - Authenticated user session with an owned homestead
//   - At least one published homestead template with walkable tiles
//
// Note: These E2E tests verify the complete bot companion user journey from
// server spawn through Colyseus synchronization to client rendering in Phaser.
// The Playwright webServer config starts the game client; the game server
// must be started separately or via a test setup script.

import { test } from '@playwright/test';

/* ================================================================ */
/*  E2E-1: Bot Rendering and Movement on Homestead                   */
/*  ROI: 57 | Business Value: 10 (core visual) | Frequency: 10      */
/*  Legal: false                                                     */
/* ================================================================ */

// User Journey: Player authenticates -> navigates to homestead ->
//   bot appears on screen with name label -> bot is using correct skin ->
//   over time, bot moves smoothly (interpolation) -> bot animation updates
//   with direction change
//
// Covers:
//   AC-4.2: "Bot name is displayed above its sprite (via PlayerSprite name label)"
//   AC-9.1: "When server updates bot position, client applies interpolation
//     via PlayerSprite.setTarget() (analogous to remote players)"
//   AC-9.2: "When bot changes direction or state, client updates animation
//     via PlayerSprite.updateAnimation()"
//   AC-10.1: "Bot uses skin from AVAILABLE_SKINS (scout_1..scout_6),
//     assigned at creation"
//
// @category: e2e
// @dependency: full-system (game-client, game-server, database, Colyseus)
// @complexity: high

test.describe('Bot rendering and movement on homestead', () => {
  test('E2E-1: Player joins homestead, sees bot with name and skin, bot moves smoothly', async ({
    page,
  }) => {
    // Arrange:
    //   - Navigate to the game page (baseURL from Playwright config)
    //   - Authenticate the user (via auth flow or test token injection)
    //   - Wait for the Phaser game canvas to be visible on the page
    //   - Wait for the game to finish loading (LoadingScene -> Game scene transition)
    //   - The user must have a homestead (or one is auto-created on first visit)
    //   - Navigate to the homestead (chunkId = 'player:{userId}')
    //   - Wait for Colyseus room join to complete (state sync received)
    //
    // Verify - Phase 1 (Bot visible with name):
    //   - The Phaser canvas is rendered (canvas element exists and has dimensions)
    //   - Use page.evaluate() to access the Phaser game instance and verify:
    //     a. The Game scene is active
    //     b. PlayerManager has created at least one bot sprite
    //        (botSprites Map or equivalent has entries)
    //     c. Each bot sprite has a visible name label text object
    //     d. The name label text is a non-empty string from BOT_NAMES list
    //     e. The bot sprite's texture key includes a valid skin
    //        (one of 'scout_1' through 'scout_6')
    //   - Take a screenshot for visual verification (.screenshots/bot-spawn.png)
    //
    // Verify - Phase 2 (Bot moves with interpolation):
    //   - Record the initial position of the first bot sprite
    //     (use page.evaluate() to get sprite.x, sprite.y)
    //   - Wait sufficient time for the bot to receive a wander tick and begin moving
    //     (~4-5 seconds to account for BOT_WANDER_INTERVAL_TICKS = 30 ticks at 100ms)
    //   - Record the bot sprite's position again
    //   - The bot's position should have changed from the initial position
    //     (worldX or worldY different, proving server-driven movement reached client)
    //   - Take a screenshot for visual verification (.screenshots/bot-moved.png)
    //
    // Verify - Phase 3 (Animation and direction):
    //   - Use page.evaluate() to check the bot sprite's current animation key
    //   - The animation key should correspond to a valid direction
    //     ('up', 'down', 'left', 'right') and state ('idle' or 'walk')
    //   - If the bot moved, the animation should reflect the walking state
    //     and the direction of movement
    //
    // Pass criteria:
    //   - Bot spawns and is visible on the homestead (server → client sync works)
    //   - Bot has a name label displayed above its sprite
    //   - Bot uses a valid scout skin from AVAILABLE_SKINS
    //   - Bot position changes over time (server-driven wander → client interpolation)
    //   - Bot animation reflects its current state and direction
    //   - Full pipeline verified: DB → BotManager → ChunkRoomState.bots →
    //     Colyseus patch → PlayerManager.setupBotCallbacks → PlayerSprite
  });
});
