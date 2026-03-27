# Feature: Town Events System

**ID**: F-010
**Date**: 2026-03-22
**Priority**: Later
**Kano Category**: Attractive
**WSJF Score**: CoD 22 / Duration 2 = 11.0
**Appetite**: M (2-3 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 6: "Experience emergent stories"; Job 8: "Feel progression" | Variety and seasonal milestones |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist"; Segment 4: "Social Nester" | Events create shared community experiences |
| Problem | jobs-graph.md -> Job 6, Problem 4: "Narrative inflation", Severity 5/10 | Must calibrate event frequency to feel organic |
| Risk | No direct RAT risk | Low risk -- events are enhancement, not existential |
| Strategy | strategy-canvas.md -> CREATE: Per-Server Emergent Narratives | Events are the most visible form of emergent content |
| Initiative | prioritized-initiatives.md -> #28 (ICE=175) | Seasonal FOMO retention mechanic |
| Opportunity | opportunity-map.md -> Opportunity 2.4 | AI NPCs compensating for shallow mechanics |

## Problem

**Job context**: "When a player is in week 3+ and settling into routine (Job 6/8), regular and emergent town events break monotony and create shared community experiences -- the harvest festival, the fishing contest, the baker's surprise party. Without events, the world feels static between NPC conversations (severity 5/10)."

**Current workaround**: Stardew has scripted seasonal festivals (Egg Festival, Luau, etc.). No game has emergent NPC-organized events.
**Cost of inaction**: World feels less alive. Missed opportunity for community bonding and shareable moments.

## Appetite

**Size**: M (2-3 weeks)
**Duration**: 3 weeks
**Rationale**: Events are delighters, not requirements. Build 4 scripted seasonal events + enable emergent events from the Story Director (F-003).

## Solution

**Key elements**:

1. **4 Scripted Seasonal Events**: One per season -- Spring Planting Festival, Summer Fishing Contest, Fall Harvest Fair, Winter Solstice Celebration. Each lasts 1 game day with unique activities, NPC dialogue, and cosmetic rewards.

2. **Emergent NPC Events**: The Story Director (F-003) can trigger unscripted events when conditions align -- NPC birthday celebrations, impromptu gatherings, cook-offs, town meetings about server-specific issues. These emerge from NPC autonomous planning.

3. **Server-Wide Notifications**: When an event starts, all online players receive a gentle notification. Events are visible on the Server Story board.

## Rabbit Holes

1. **Event content volume** -- Each scripted event needs unique dialogue, activities, and rewards. Mitigation: Simple event structure: gathering location + 2-3 activities + NPC dialogue + 1 cosmetic reward.

## No-Gos

- **Competitive event rankings**: No leaderboards or prizes for "best farmer." Why: Anti-competitive cozy design.
- **Events requiring minimum player count**: Events work with 1 player + NPCs. Why: Low-pop resilience.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Event participation rate | N/A | >50% of online players attend scripted events | Event attendance logs |
| Emergent events per server per month | N/A | >2 | Story Director event logs |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given it is the first day of Fall season, When the Harvest Fair begins, Then all online players receive a notification and NPCs gather in the town square with unique dialogue |
| 2 | Given an emergent NPC event triggers, When a player witnesses it, Then the event appears on the Server Story board within 1 game day |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 11 | Delighter. Creates variety and shared moments. Not required for core experience. |
| Time Criticality | 6 | Nice to have at launch, not critical. |
| Risk Reduction | 5 | Low risk reduction. |
| **Cost of Delay** | **22** | |
| Job Duration | 2 | M appetite: 2-3 weeks for 4 scripted events + emergent event integration with Story Director. |
| **WSJF** | **11.0** | |
