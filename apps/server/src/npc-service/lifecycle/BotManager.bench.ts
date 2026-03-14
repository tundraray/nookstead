/**
 * BotManager performance benchmark.
 * NOT a Jest test — run directly with ts-node or as a script.
 *
 * Target: average tick < 1ms, p99 < 2ms for MAX_BOTS_PER_HOMESTEAD bots.
 *
 * AC-8.2: All bots in homestead processed in single tick cycle.
 */
import { BotManager } from './BotManager';
import {
  MAX_BOTS_PER_HOMESTEAD,
  TILE_SIZE,
  BOT_NAMES,
} from '@nookstead/shared';

function makeWalkableGrid(size: number): boolean[][] {
  return Array.from({ length: size }, () => Array(size).fill(true));
}

function makeBotRecord(index: number) {
  return {
    id: `bot-bench-${index}`,
    mapId: 'bench-map',
    name: BOT_NAMES[index % BOT_NAMES.length],
    skin: 'scout_1' as const,
    worldX: (10 + index * 4) * TILE_SIZE,
    worldY: (10 + index * 4) * TILE_SIZE,
    direction: 'down',
    personality: null,
    role: null,
    speechStyle: null,
    bio: null,
    age: null,
    traits: null,
    goals: null,
    fears: null,
    interests: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function runBenchmark(): Promise<void> {
  const BOT_COUNT = MAX_BOTS_PER_HOMESTEAD; // 5
  const MAP_SIZE = 64;
  const TICK_COUNT = 1000;
  const DELTA_MS = 100;

  const manager = new BotManager();
  const records = Array.from({ length: BOT_COUNT }, (_, i) =>
    makeBotRecord(i)
  );

  manager.init(
    {
      mapWalkable: makeWalkableGrid(MAP_SIZE),
      mapWidth: MAP_SIZE,
      mapHeight: MAP_SIZE,
      mapId: 'bench-map',
      tickIntervalMs: DELTA_MS,
    },
    records
  );

  const durations: number[] = [];

  for (let i = 0; i < TICK_COUNT; i++) {
    const start = performance.now();
    manager.tick(DELTA_MS);
    const end = performance.now();
    durations.push(end - start);
  }

  const sorted = [...durations].sort((a, b) => a - b);
  const avg = durations.reduce((s, d) => s + d, 0) / durations.length;
  const p99 = sorted[Math.floor(TICK_COUNT * 0.99)];
  const max = sorted[TICK_COUNT - 1];

  console.log(
    `\nBotManager Benchmark Results (${BOT_COUNT} bots, ${TICK_COUNT} ticks, ${MAP_SIZE}x${MAP_SIZE} map)`
  );
  console.log(`  Average: ${avg.toFixed(3)} ms`);
  console.log(`  p99:     ${p99.toFixed(3)} ms`);
  console.log(`  Max:     ${max.toFixed(3)} ms`);
  console.log(`\nTargets:`);
  console.log(`  Average < 1ms:  ${avg < 1 ? 'PASS' : 'FAIL'}`);
  console.log(`  p99 < 2ms:      ${p99 < 2 ? 'PASS' : 'FAIL'}`);

  if (avg >= 1 || p99 >= 2) {
    process.exit(1);
  }
}

runBenchmark().catch((err) => {
  console.error('Benchmark error:', err);
  process.exit(1);
});
