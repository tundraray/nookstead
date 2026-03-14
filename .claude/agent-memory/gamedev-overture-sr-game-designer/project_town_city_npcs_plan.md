---
name: Town Map & City NPCs Design Plan
description: Game design document for Quiet Haven town (64x64) and 5 city NPCs (Marko, Lena, Viktor, Ira, Oleg). Rewritten as pure design doc (v2.0) -- no technical details.
type: project
---

Design plan at `docs/documentation/plans/plan-town-and-city-npcs.md`, rewritten on 2026-03-14 as v2.0 (pure game design, zero tech).

**Key decisions:**
- Town map: 64x64 tiles, 6 zones around central square, open interiors
- 5 MVP NPCs: Marko (baker), Lena (gardener), Viktor (mayor), Ira (cafe owner), Oleg (fisherman)
- 3 deferred to Phase 2: Anna (librarian), Sara (confectioner), Zoya (mysterious)
- City NPCs and homestead bots are TWO SEPARATE systems with different philosophies
- Each NPC has: personality, schedule, trade goods, gift preferences, 5-level relationship arc, 3 signature moments
- Gossip propagation through NPC social network (Ira = hub, Oleg = dead end)
- "City pulse" design: town feels different at morning/day/evening/night

**Why:** City NPCs are the core of the "responsive world" USP. Town creates the social fabric where NPC reactions to player actions happen naturally.

**How to apply:** Technical implementation details (CityNPCManager, A*, ChunkRoom integration) need a separate technical design doc. The game design doc is the creative vision.
