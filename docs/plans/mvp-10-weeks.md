# Work Plan: MVP 10 Weeks -- Core Game Loop + NPC Memory Vertical Slice

Created Date: 2026-02-19
Status: PLANNED
Type: feature
Estimated Duration: 10 weeks
Estimated Impact: 40+ files across `apps/game`, `apps/server`, `packages/shared`, `packages/db`
Related Issue/PR: N/A

## Objective

Ship a playable MVP that proves the core Nookstead loop:
`homestead -> farming -> town visit -> NPC dialogue with memory -> trade -> progression`.

## Scope (MVP)

- One public town zone + one private homestead zone
- Inventory + item economy baseline
- Farming v1 (3 crops)
- Market sell flow
- Reputation v1 with 2 unlocks
- 1-3 key NPCs with memory-based dialogue
- Onboarding story chain (30-45 min) without late-story spoilers
- Telemetry for retention, dialogue quality, and economy signals

Out of scope: guilds, full professions set, full Act II/III story content, large seasonal event system.

## Phases

### Phase 1 (Weeks 1-2): World and Controls Foundation

- [ ] task-01: Stabilize player movement/collision in town and homestead scenes
- [ ] task-02: Implement zone transition flow (homestead <-> town)
- [ ] task-03: Add baseline HUD (time/season/currency/inventory quick bar)
- [ ] task-04: Add interaction prompts and action radius checks

Completion criteria:
- 30-minute continuous session with no critical crash/desync
- Player can reliably move, interact, and change zones

### Phase 2 (Weeks 3-4): Farming + Inventory + Market Core

- [ ] task-05: Implement inventory v1 (stacking, add/remove, persistence)
- [ ] task-06: Implement farming v1 (plant/water/grow/harvest for 3 crops)
- [ ] task-07: Implement market sell flow (NPC vendor, payout, receipts/log)
- [ ] task-08: Add economy constants and balancing table (seed price, sell price, growth time)

Completion criteria:
- Full loop works: buy/plant/harvest/sell
- Currency and item state persist across reconnect

### Phase 3 (Weeks 5-6): NPC Dialogue + Memory Vertical Slice

- [ ] task-09: Finalize dialogue UI/UX (quick replies + free text + turn cap)
- [ ] task-10: Implement memory write path for dialogue events
- [ ] task-11: Implement memory retrieval in prompt context
- [ ] task-12: Add one daily reflection job for MVP NPC set
- [ ] task-13: Add safety and fallback behavior (timeout/toxicity/error path)

Completion criteria:
- NPC references at least one prior interaction in a new session
- p50 dialogue latency and cost are within team budget targets

### Phase 4 (Week 7): Progression + Onboarding Story

- [ ] task-14: Add reputation v1 (single track + milestone events)
- [ ] task-15: Add 2 unlocks tied to reputation milestones
- [ ] task-16: Implement onboarding quest chain (intro to town, market, NPCs)
- [ ] task-17: Integrate no-spoiler lore text in onboarding flow

Completion criteria:
- New player reaches first meaningful unlock in one play session
- Onboarding covers all systems in MVP scope

### Phase 5 (Week 8): Social Layer (Minimal)

- [ ] task-18: Implement homestead guest visit baseline (invite/join/leave)
- [ ] task-19: Add local interaction signals (wave/emote or lightweight social action)
- [ ] task-20: Add simple daily board tasks (3 rotating tasks)

Completion criteria:
- Two players can share a short co-presence session without blockers

### Phase 6 (Weeks 9-10): Hardening, Metrics, and Go/No-Go

- [ ] task-21: Add telemetry dashboards/events (session, farming, dialogue, economy)
- [ ] task-22: Run regression suite (`lint/test/build/typecheck/e2e` where applicable)
- [ ] task-23: Conduct closed playtest (target: 20-50 users or internal equivalent)
- [ ] task-24: Execute balance pass and bug-fix sprint
- [ ] task-25: Compile MVP go/no-go report

Completion criteria:
- Quality gates pass
- MVP success metrics evaluated with real session data

## Dependencies

- Phase 2 depends on Phase 1 scene/input stability
- Phase 3 depends on server dialogue and DB reliability from Phase 2 persistence work
- Phase 4 depends on Phase 2 + Phase 3 complete loop
- Phase 6 depends on all previous phases

## MVP Success Metrics (Go/No-Go)

- Core loop completion rate (new users): target >= 60%
- Median session length: target >= 15 min
- Dialogue memory recall correctness (manual sampled): target >= 70%
- Critical crash rate: target < 2%
- AI cost per active player-hour: within agreed internal budget cap

Go if:
- Core loop is stable, memorable NPC behavior is visible, and cost/perf are sustainable.

No-go if:
- NPC memory effect is not perceptible, or stability/cost blocks scaling beyond internal tests.

## Verification Commands

```bash
pnpm nx run-many -t lint test build typecheck
pnpm nx test server
pnpm nx test game
pnpm nx e2e game-e2e
```

## Notes

- Keep feature cuts aggressive: protect the memory-driven NPC experience first.
- Prefer shipping one polished loop over broad but shallow content.
- Use `docs/lore-onboarding-nospoilers-ru.md` for early narrative text to avoid spoiler leakage in MVP.
