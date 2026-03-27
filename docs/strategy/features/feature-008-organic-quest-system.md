# Feature: Organic Quest System

**ID**: F-008
**Date**: 2026-03-22
**Priority**: Next
**Kano Category**: Performance
**WSJF Score**: CoD 36 / Duration 3 = 12.0
**Appetite**: L (4-6 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 6: "Experience emergent stories"; Job 8: "Feel progression" | Quests provide directed goals from emergent NPC behavior |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist"; Segment 2: "Story-Starved Narrative Discoverer" | Both need content that regenerates, not scripted quest lists |
| Problem | jobs-graph.md -> Job 8, Problem 2: "AI NPCs may not compensate for shallow mechanics", Severity 7/10 | Quests bridge AI novelty and gameplay structure |
| Risk | rat.md -> Risk 2: "AI Content Retention Cliff", P4xI5=20 | Quests extend content longevity beyond conversation |
| Strategy | strategy-canvas.md -> RAISE: Content Freshness/Longevity (2->5) | AI-generated quests solve content exhaustion structurally |
| Initiative | prioritized-initiatives.md -> #19 (ICE=200) | Emergent Story Framework (parent system) |
| Opportunity | opportunity-map.md -> Opportunity 2.1 | Shallow emergent stories |

## Problem

**Job context**: "When AI NPC conversations begin to normalize after week 2 (Job 6/8), players need structured goals beyond 'talk to NPCs.' Organic quests generated from NPC reflections provide directed activities that emerge from relationship context -- the baker needs wheat for the festival, the blacksmith wants a specific ore for a project. Without quests, the game lacks the 'something to do today' pull that sustains daily engagement (severity 7/10)."

**Current workaround**: Stardew's scripted quest board with random fetch quests. No game generates quests from NPC reflections.
**Cost of inaction**: Players exhaust farming/building content and have no directed goals. Retention drops.

## Appetite

**Size**: L (4-6 weeks)
**Duration**: 5 weeks
**Rationale**: Quests are the bridge between AI novelty and structured gameplay. They make NPC relationships feel consequential -- NPCs ask for help based on their actual needs, not scripted triggers.

## Solution

**Key elements**:

1. **NPC Request Generation**: During daily reflection (F-002), NPCs may generate requests based on their current situation, relationship with the player, and active story arcs. The baker who is preparing for a festival needs wheat. The blacksmith whose tools are old needs materials. Requests are natural extensions of NPC behavior, not random fetch quests.

2. **Quest Types**: Gather (bring X items), Deliver (take item to NPC Y), Socialize (introduce NPC A to NPC B), Build (place a specific item on homestead), and Explore (visit a new area). Each type has 3-5 template variations filled by NPC context.

3. **Relationship-Gated Quests**: Higher relationship tiers unlock deeper quest types. Stranger: basic fetch. Friend: personal favors. Close Friend: help with NPC conflicts. Confidant: assist with NPC life decisions.

4. **Emergent Quest Chains**: When a quest completion triggers NPC state changes, follow-up quests may generate automatically. Helping the baker with wheat -> baker is grateful -> baker introduces you to the farmer -> farmer has a request -> chain continues.

5. **Rewards**: Gold, reputation, relationship points, recipe unlocks, rare decorative items, and NPC gratitude (unique dialogue). No XP-grind rewards -- rewards are relational and cosmetic.

## Rabbit Holes

1. **Quest quality variance** -- AI-generated quest descriptions may be generic or nonsensical. Mitigation: Use templates with NPC-specific fill-in, not fully generated quest text.
2. **Quest item availability** -- NPC requests items the player cannot yet obtain. Mitigation: Quest generator checks player's progression level and available resources before issuing.

## No-Gos

- **Quest journal/log UI**: No complex quest tracker. Simple notification: "The baker asked you for wheat." Why: Cozy games minimize UI overhead.
- **Timed quests**: No countdown timers on quests. Why: Time pressure is anti-cozy.
- **Combat quests**: No "defeat 10 slimes" quests. Why: No combat system exists.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Quests completed per player per week | N/A | >3 | Quest completion logs |
| Quest-driven NPC interaction rate | N/A | 30% of NPC conversations are quest-related | Interaction tagging |
| Quest chain length (average) | N/A | >2 connected quests | Chain tracking |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given the baker NPC is preparing for a festival, When their daily reflection generates needs, Then a "Bring 5 wheat" request appears for players at Friend+ relationship tier |
| 2 | Given a player completes a quest for an NPC, When the NPC receives the items, Then the NPC provides a unique thank-you response referencing the specific request context |
| 3 | Given a quest is generated, When the required items are checked, Then all items are obtainable at the player's current progression level |
| 4 | Given a player has completed 3 quests for one NPC, When the NPC reflects on the relationship, Then a follow-up quest chain may be generated (not guaranteed every time) |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 14 | Bridges AI novelty with structured gameplay. Makes NPC relationships feel consequential. |
| Time Criticality | 12 | Content longevity depends on this. Without quests, the "something to do" well dries up faster. |
| Risk Reduction | 10 | Addresses content depth deficit by generating directed activities from AI reflections. |
| **Cost of Delay** | **36** | |
| Job Duration | 3 | L appetite: 4-6 weeks for quest generation, templates, relationship gating, chains, and rewards. |
| **WSJF** | **12.0** | |
