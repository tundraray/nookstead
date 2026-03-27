# Feature: Low-Pop Server Resilience

**ID**: F-015
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 34 / Duration 1 = 34.0
**Appetite**: S (1-2 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 7: "Share and connect with other players" | World must feel alive even with few players |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist" | Must not encounter empty-feeling world on first visit |
| Problem | jobs-graph.md -> Job 7, Problem 1: "Empty servers kill MMO value proposition", Severity 8/10 | At 25K MAU, servers may have only 3-5 concurrent players |
| Risk | rat.md -> Risk 3: "Solo Dev MMO Scope Mismatch", P4xI4=16 | Player population may be low at launch |
| Strategy | strategy-canvas.md -> RAISE: Social Features (1->4) | MMO must feel populated from day one |
| Initiative | prioritized-initiatives.md -> #29 (ICE=168) | Low-pop resilience design |
| Opportunity | opportunity-map.md -> Opportunity 4.1 | Empty servers kill MMO value |

## Problem

**Job context**: "At the 25K MAU base case, average concurrent players may be only 500-1,000 across multiple servers -- potentially 5-10 players per server. During off-peak hours, servers may have 1-3 players. An 'MMO' with 2 visible humans feels like a ghost town, destroying the 'living world' promise (severity 8/10)."

**Current workaround**: Palia's servers feel empty at 7,769 concurrent (Steam). Their mitigation: none visible. Players churn.
**Cost of inaction**: New players arrive, see an empty world, and leave. The "MMO" label becomes a liability rather than an asset.

## Appetite

**Size**: S (1-2 weeks)
**Duration**: 2 weeks
**Rationale**: High WSJF (34.0) because small investment solves a critical launch problem. AI NPCs already exist (F-001) -- this feature makes them COMPENSATE for low player counts.

## Solution

**Key elements**:

1. **AI NPCs as Primary Population**: 10-15 NPCs visible at all times, walking between locations, chatting with each other, doing activities. The town LOOKS populated even with 0 human players. NPC presence fills the "living world" feeling.

2. **NPC Behavior Intensification at Low Pop**: When fewer than 5 players are online, NPCs become MORE active -- more ambient conversations, more NPC-initiated interactions with the player, more visible daily activities. The fewer humans, the more NPCs compensate.

3. **Server Auto-Merge**: When a server drops below 3 concurrent players for >30 minutes, offer to merge them with another low-pop server. Players from both servers see each other in the same town. Homesteads remain on original server. Merge is reversible when populations recover.

4. **Dynamic Server Allocation**: New players are assigned to the most populated server that has capacity. Prevents new players from landing on empty servers.

## Rabbit Holes

1. **Server merge state conflicts** -- Two servers merged may have NPCs in different states. Mitigation: Use the "host" server's NPC state. Merged players see the host's NPC world.
2. **NPC behavior scaling costs** -- More NPC activity at low pop means more LLM calls per server. Mitigation: Intensification uses cached/pre-generated NPC behaviors, not additional LLM calls. NPCs repeat ambient behaviors from a larger pool.

## No-Gos

- **Bot players**: No fake human players. Why: Deceptive. NPCs are transparently NPCs, never disguised as humans.
- **Forced server assignment**: Players can choose their server. Auto-merge is offered, not forced. Why: Player agency.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| "World feels alive" player rating | N/A | >70% rate positively even with <5 concurrent players | Playtest survey |
| NPC visibility (visible NPCs at any time) | N/A | >8 NPCs visible from town center at all times | Entity count monitoring |
| Empty server encounter rate | N/A | <5% of new players encounter <3 total entities in first session | Session analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given only 1 human player is online, When they walk through town, Then at least 8 NPCs are visible doing activities, chatting, and moving between locations |
| 2 | Given a server has <3 concurrent players for 30 minutes, When the merge offer appears, Then the player can accept to join a more populated server or stay on their current one |
| 3 | Given 2 concurrent players are on a server, When NPC behavior is evaluated, Then NPCs initiate 50% more ambient conversations and player-directed interactions than at full capacity |
| 4 | Given a new player creates a character, When they are assigned to a server, Then they are placed on the server with the highest current population that has available capacity |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 12 | Solves the chicken-and-egg problem. Makes the MMO viable at low player counts. |
| Time Criticality | 12 | Must be ready at launch. A dead-feeling server at first login kills the product. |
| Risk Reduction | 10 | Addresses the "empty server" risk that makes the MMO promise hollow. |
| **Cost of Delay** | **34** | |
| Job Duration | 1 | S appetite: 1-2 weeks. NPC behavior scaling, dynamic allocation, and basic merge system. |
| **WSJF** | **34.0** | |
