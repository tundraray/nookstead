# Feature: Farming & Seasonal Crop System

**ID**: F-005
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 32 / Duration 3 = 10.7
**Appetite**: L (4-6 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 4: "Build and personalize my homestead"; Job 8: "Feel progression and mastery" | The daily gameplay loop that creates habitual engagement |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist" | Genre table stakes -- cozy gamers expect farming |
| Problem | jobs-graph.md -> Job 8, Problem 1: "Content depth vs. 14-month timeline", Severity 8/10 | Must meet a quality floor without matching Stardew's breadth |
| Risk | rat.md -> Risk 3: "Solo Dev MMO Scope Mismatch", P4xI4=16 | 14 months cannot replicate 10+ years of content |
| Strategy | strategy-canvas.md -> REDUCE: Content Depth (5->3), Farming/Crafting Depth: Maintain at 3 | "Deep not wide" -- fewer crops, richer interactions |
| Initiative | prioritized-initiatives.md -> #12 (ICE=270) | MVP scope audit |
| Opportunity | opportunity-map.md -> Opportunity 2.3 | Content depth vs. timeline |

## Problem

**Job context**: "When a player has had their first NPC interaction and starts building their homestead (Job 4/8), they expect a satisfying farming loop with seasonal crops, growth mechanics, and progression -- but Stardew has 100+ crops after 10+ years of development while Nookstead has 14 months (severity 8/10)."

**Current workaround**: Play Stardew Valley for farming depth. No alternative combines farming with AI NPCs.
**Cost of inaction**: Without farming, Nookstead is not a "cozy game" -- it loses genre classification and the primary segment's trust.

## Appetite

**Size**: L (4-6 weeks)
**Duration**: 5 weeks
**Rationale**: Farming is genre table stakes but NOT the differentiator. "Deep not wide": 15 crops with rich NPC reactions > 100 crops with no AI integration.

## Solution

**Key elements**:

1. **15 Launch Crops** across 4 seasons (7-day seasons): Spring (4 crops), Summer (4), Fall (4), Winter (3 forage-only). Each crop has: growth stages with visual progression, watering requirements, quality tiers (normal/silver/gold based on care), and unique NPC reactions when gifted or sold.

2. **Seasonal Rotation**: 7-day real-time seasons. Each season has unique crops, weather patterns, and NPC behaviors. Transitioning seasons change the visual palette of the world and unlock new activities.

3. **NPC-Reactive Farming**: When the player sells crops or gives them as gifts, NPCs react based on their personality. The baker values wheat differently than the blacksmith. NPCs comment on the player's farm when visiting ("Your tomatoes look incredible this season!"). This ties farming directly to the AI NPC differentiator.

4. **Farming Skill Progression**: Planting, watering, and harvesting earn farming XP. Skill levels unlock: faster growth, higher quality yields, new crop recipes, and expanded plot options. 10 skill levels provide 3+ months of progression.

5. **Simple Crafting**: Crops become ingredients for basic recipes (cooking, potions, gifts). 20-30 recipes at launch. Recipes unlock through NPC relationships (the baker teaches cooking when you reach "Friend" tier).

## Rabbit Holes

1. **Scope creep toward Stardew depth** -- Adding "just one more crop" or "just one more recipe." Mitigation: Hard cap at 15 crops, 30 recipes. Every addition must integrate with NPC reactions or it is cut.
2. **Seasonal timing balance** -- 7-day seasons may feel too fast or too slow. Mitigation: Configurable game speed multiplier (mentioned in GDD). Default 1x, options for 0.5x and 2x.

## No-Gos

- **Mining/dungeon system**: No combat, no mines, no monster fighting. Why: Out of scope for cozy MVP. Farming + NPC relationships are the focus.
- **Animal husbandry**: No chickens, cows, or barn animals at launch. Why: Scope control. Add in post-launch updates.
- **Crop breeding/genetics**: No complex crop hybridization. Why: Exceeds solo dev capacity for launch.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Daily farming engagement rate | N/A | >60% of DAU interact with farming daily | Session analytics |
| Crops sold to NPC merchants per session | N/A | >5 | Transaction logs |
| Farming skill progression rate | N/A | Average player reaches level 3 by D7 | Progression analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a player plants a spring crop, When 3 in-game days pass with daily watering, Then the crop progresses through visible growth stages and becomes harvestable |
| 2 | Given a player harvests a gold-quality crop, When they gift it to an NPC, Then the NPC's response reflects both the crop type and quality ("A gold-quality tomato! You have a real gift for farming.") |
| 3 | Given the season transitions from spring to summer, When the player's spring crops are still in the ground, Then unharvested spring crops wither and summer planting becomes available |
| 4 | Given a player reaches farming skill level 5, When they check their skills, Then at least 2 new crop types and 3 new recipes are unlocked |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 14 | Genre table stakes. Without farming, Nookstead cannot be classified as a "cozy life sim." But farming alone is not the differentiator. |
| Time Criticality | 10 | Needed for retention loop but not time-critical vs. AI NPC validation. Can iterate post-launch. |
| Risk Reduction | 8 | Partially validates scope feasibility (RAT Risk 3). |
| **Cost of Delay** | **32** | |
| Job Duration | 3 | L appetite: 4-6 weeks for 15 crops, seasonal system, NPC reactions, skill progression, and basic crafting. |
| **WSJF** | **10.7** | |
