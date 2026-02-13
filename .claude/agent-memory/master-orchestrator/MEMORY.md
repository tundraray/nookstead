# Master Orchestrator Memory

## Project: Nookstead
- GDD v1: `docs/nookstead-gdd.md` (Russian, 620 lines - original)
- GDD v2: `docs/nookstead-gdd-v2.md` (Russian, 1708 lines - comprehensive)
- GDD v3: `docs/nookstead-gdd-v3.md` (English, ~1750 lines - DEFINITIVE, real-time clock)
- Project config: `docs/project-config.json`
- Current phase: Phase 0 (Prototype)
- Branch: `add-game-studio-agents`
- Domain: nookstead.land
- Market Decision: GO (2026-02-14)

## Documentation Structure (Generated 2026-02-14)
All project docs under `docs/`:
- `project-config.json` - Full project config with milestones, team, risks
- `resources/market-research/market-analysis.md` - Market analysis report (GO)
- `documentation/technical/engine-setup.md` - Architecture, code patterns, DB schema
- `documentation/technical/analytics-setup.md` - Telemetry events, dashboards
- `documentation/design/mechanics/feature-spec-m01-walking-on-tiles.md`
- `documentation/design/mechanics/feature-spec-m02-multiplayer-sync.md`
- `documentation/design/mechanics/feature-spec-m03-npc-talks.md`
- `documentation/design/mechanics/feature-spec-m04-npc-remembers.md`
- `documentation/production/timeline.md` - Week-by-week Phase 0 plan
- `documentation/production/handoff-design-to-prototype.md` - Design-to-dev handoff

## Monorepo Structure
- Nx 22.5.0, npm workspaces
- `apps/game` - Next.js 16 client (exists, scaffolded)
- `apps/game-e2e` - Playwright E2E tests (exists)
- `apps/server` - Colyseus game server (TO CREATE in M0.2)
- `apps/ai-service` - NPC AI microservice (TO CREATE in M0.3)
- `libs/shared` - Shared types (TO CREATE in M0.2)

## Key Technical Decisions
- Phaser.js 3 for 2D rendering, dynamic import (no SSR)
- Colyseus 0.15+ for multiplayer, 10 ticks/sec
- Claude Haiku for routine AI, Sonnet for dialogues/reflections
- PostgreSQL + pgvector for NPC memory/embeddings
- Redis for caching (plans, greetings, game state)
- 16x16 pixel art, top-down, LimeZu assets
- Base resolution 480x270, scaled 3x-4x
- Real-time clock (1:1 ratio) with configurable speed multiplier (server setting)
- Season length: 7 real days (configurable per server)
- NPC plans/reflections: once per real day (not compressed)

## Agent Ecosystem
- 13+ agent definitions in `.claude/agents/`
- Phase 0 active: producer, market_analyst, sr_game_designer, mechanics_developer, qa_agent, data_scientist
- Full development adds: mid_game_designer, game_feel_developer, sr_game_artist, technical_artist, ui_ux_agent

## Phase 0 Milestones (8 weeks: Feb 14 - Apr 10, 2026)
- M0.1: Walking on Tiles (Feb 14-27)
- M0.2: Multiplayer Sync (Feb 28 - Mar 13)
- M0.3: NPC Talks (Mar 14-27)
- M0.4: NPC Remembers (Mar 28 - Apr 10)
- Go/No-Go: Apr 10

## Critical Metrics
- LLM cost target: < $0.01/player-hour (improved from $0.03 due to real-time model)
- NPC dialogue latency: < 3 seconds
- FPS: 60 desktop, 30 mobile
- Retention targets: D1=50%, D7=25%, D30=15%

## Templates
All templates in `docs/templates/` - use for any new documents.
