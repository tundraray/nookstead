# Feature: Living Economy & NPC Merchants

**ID**: F-007
**Date**: 2026-03-22
**Priority**: Next
**Kano Category**: Performance
**WSJF Score**: CoD 21 / Duration 2 = 10.5
**Appetite**: M (2-3 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 8: "Feel progression and mastery over time" | Economic progression gives purpose to farming |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist" | Needs meaningful progression beyond NPC chat |
| Problem | jobs-graph.md -> Job 8, Problem 2: "AI NPCs may not compensate for shallow mechanics", Severity 7/10 | Game mechanics must exist independently of AI novelty |
| Risk | rat.md -> Risk 3: "Solo Dev MMO Scope Mismatch", P4xI4=16 | Must be simple enough for solo dev |
| Strategy | strategy-canvas.md -> Farming/Crafting Depth: Maintain at 3 | Sufficient depth without over-investment |
| Initiative | prioritized-initiatives.md -> #24 (ICE=252) | NPC gift reaction monetization loop |
| Opportunity | opportunity-map.md -> Opportunity 2.4 | AI NPCs may not compensate for shallow mechanics |

## Problem

**Job context**: "When a player is in week 3+ and the initial excitement has settled (Job 8), they need economic purpose -- a reason to farm, craft, and sell. Without an economy, crops have no value and progression stalls (severity 7/10)."

**Current workaround**: Stardew Valley's Pierre's General Store with fixed prices. No cozy game has AI-driven dynamic pricing.
**Cost of inaction**: Farming loop lacks purpose. Players ask "why am I growing these crops?" and churn.

## Appetite

**Size**: M (2-3 weeks)
**Duration**: 3 weeks
**Rationale**: Economy adds progression purpose without being the differentiator. Keep simple -- NPC-run shops with personality-driven inventory are the AI integration point.

## Solution

**Key elements**:

1. **NPC Merchant Shops**: 3-5 NPC-run shops (general store, bakery, blacksmith, clothing, seeds). Each merchant has a personality that affects inventory and pricing. The baker stocks bread ingredients at premium, values wheat highly.

2. **Dynamic Pricing**: Prices shift based on supply (what players sell) and seasonal events. Oversupply of tomatoes -> tomato price drops. Approaching festival -> festival ingredients rise. NPCs comment on market conditions ("Tomatoes are flooding the market! I can barely sell mine.").

3. **Player Trading**: Players can trade items directly with each other through a simple trade interface. No auction house (too complex for MVP). Trade requests are face-to-face in the game world.

4. **Currency System**: Single currency (Gold). Earned through selling crops/crafted goods, completing NPC requests, and finding treasure. Spent at shops, on homestead upgrades, and cosmetics (ties to F-013).

## Rabbit Holes

1. **Economy balancing** -- Exploitable economic loops (buy low, sell high infinitely). Mitigation: Daily purchase limits per shop. Price floor/ceiling for all items.

## No-Gos

- **Auction house or marketplace UI**: Why: Too complex for solo dev and encourages min-maxing over cozy play.
- **Real-money trading (RMT)**: Why: Destroys cozy economy. Zero tolerance.
- **Complex supply chains**: No multi-step manufacturing. Why: Scope control.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Daily transactions per player | N/A | >3 | Transaction logs |
| Player-to-player trades per week | N/A | >1 per active player | Trade analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a player sells 50 tomatoes to the general store, When they check the price the next day, Then tomato buy price has decreased by 5-15% |
| 2 | Given the harvest festival is 2 days away, When the player checks wheat prices, Then wheat price has increased reflecting NPC demand |
| 3 | Given two players are standing next to each other, When one initiates a trade, Then both see a trade interface showing offered/requested items |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 10 | Adds purpose to farming loop and creates progression. AI-driven pricing is a minor differentiator. |
| Time Criticality | 6 | Can launch with basic fixed-price shops and add dynamics later. |
| Risk Reduction | 5 | Does not address top risks directly. |
| **Cost of Delay** | **21** | |
| Job Duration | 2 | M appetite: 2-3 weeks for shop system, basic pricing, trade interface, currency. |
| **WSJF** | **10.5** | |
