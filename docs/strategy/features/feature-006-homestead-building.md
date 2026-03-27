# Feature: Homestead Building & Customization

**ID**: F-006
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 27 / Duration 3 = 9.0
**Appetite**: L (4-6 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 4: "Build and personalize my homestead" | Creative expression and ownership investment |
| Segment | segments.md -> Segment 4: "Community-Seeking Social Nester" | Highest cosmetic spend, builds for social appreciation |
| Problem | jobs-graph.md -> Job 4, Problem 1: "Content depth vs. solo dev capacity", Severity 7/10 | Need enough customization to feel personal without matching Stardew/AC breadth |
| Risk | rat.md -> Risk 3: "Solo Dev MMO Scope Mismatch", P4xI4=16 | Scope must fit 14-month timeline |
| Strategy | strategy-canvas.md -> REDUCE: Content Depth (5->3) | Accept below-industry content breadth |
| Initiative | prioritized-initiatives.md -> #12 (ICE=270) | MVP scope audit |
| Opportunity | opportunity-map.md -> Opportunity 2.3 | Content depth vs. timeline |

## Problem

**Job context**: "When a player has explored the town and had NPC interactions (Job 4), they want to claim a plot of land and make it their own -- a space that reflects their personality and that other players can visit and appreciate. But pixel art asset production is a bottleneck and Stardew has 100+ craftable items after 4+ years of solo development (severity 7/10)."

**Current workaround**: Play Stardew or Animal Crossing for building depth. No alternative combines building with AI NPC reactions.
**Cost of inaction**: Players have no investment anchor. Without a homestead, there is nothing personal to lose -- no switching cost beyond NPC memories.

## Appetite

**Size**: L (4-6 weeks)
**Duration**: 5 weeks
**Rationale**: Building is essential for player investment but not the differentiator. Use purchased LimeZu pixel art assets for visual consistency. Focus on placement mechanics and NPC integration, not asset volume.

## Solution

**Key elements**:

1. **Plot Claiming**: New players claim a homestead plot near the town (assigned by server). Plots are persistent and visible to other players walking by. Starting plot: 8x8 tiles, expandable through progression.

2. **Building Placement**: Drag-and-drop, snap-to-grid building placement. 5 building types at launch: house (upgradeable), barn/storage, greenhouse, workshop, decorative fence/path. Buildings use LimeZu Modern Interior/Exterior asset packs for consistent pixel art style.

3. **Interior Decorating**: Inside the house, players place furniture, wall decorations, and rugs. 30-50 decorative items at launch (furniture sets, plants, lighting, wall art). Decorating uses a simple grid-based system similar to Stardew.

4. **NPC Homestead Reactions**: NPCs who visit the player's homestead comment on changes ("You redecorated! I love the new bookshelf."). NPC visits occur naturally as part of their daily schedules (F-001/F-003). Higher relationship tiers = more frequent NPC visits.

5. **Progressive Expansion**: As the player earns resources and reputation, they unlock: larger plots, additional buildings, rare decorative items, and themed customization options. Expansion milestones tied to farming skill and NPC relationship tiers.

## Rabbit Holes

1. **Pixel art asset volume** -- Decorating systems need hundreds of items to feel satisfying. Mitigation: Use LimeZu asset packs (purchased, consistent style). Supplement with seasonal items and NPC-relationship-gated items. Quality > quantity.
2. **Multiplayer homestead synchronization** -- 100 players with persistent homesteads visible to all. Mitigation: Homesteads are loaded on-demand when a player approaches. Only the owner's homestead is fully simulated; others are static snapshots updated periodically.

## No-Gos

- **Freeform terrain editing**: No terraforming, no water placement, no path sculpting. Why: Grid-based placement keeps scope manageable.
- **Multiplayer building**: Other players cannot place items on your homestead. Why: Griefing prevention, scope control.
- **Building destruction/damage**: No weather damage, no fire, no NPC vandalism. Why: Cozy genre contract -- player creations are safe.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Homestead customization engagement | N/A | >40% of D7 players have placed 5+ items | Building analytics |
| Homestead visit rate | N/A | >20% of DAU visit another player's homestead weekly | Visit analytics |
| NPC homestead comment rate | N/A | NPCs comment on 50% of homestead changes | Event logging |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a new player enters the game, When they reach the homestead area, Then they can claim a plot and place their first building within 5 minutes |
| 2 | Given a player places a new piece of furniture, When an NPC with Friend+ relationship visits, Then the NPC comments on the new addition |
| 3 | Given player A visits player B's homestead, When they arrive, Then they see player B's current building and decoration layout accurately rendered |
| 4 | Given a player has reached farming level 5, When they check the building shop, Then at least 2 new building options and 10 new decorative items are unlocked |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 13 | Creative expression anchor. Creates investment and pride. Social Nesters (highest cosmetic spend) need this. |
| Time Criticality | 8 | Not time-critical vs. AI NPC validation. Can launch with basic version. |
| Risk Reduction | 6 | Partially validates content depth feasibility. |
| **Cost of Delay** | **27** | |
| Job Duration | 3 | L appetite: 4-6 weeks for plot system, building placement, interior decorating, NPC reactions, and expansion. |
| **WSJF** | **9.0** | |
