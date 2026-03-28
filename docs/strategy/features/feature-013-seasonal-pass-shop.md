# Feature: Seasonal Pass & Cosmetic Shop

**ID**: F-013
**Date**: 2026-03-22
**Priority**: Next
**Kano Category**: Performance
**WSJF Score**: CoD 26 / Duration 2 = 13.0
**Appetite**: M (2-3 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | No direct player job -- monetization feature | Revenue generation to sustain operations |
| Segment | segments.md -> Segment 4: "Social Nester" (highest cosmetic spend $5-20/mo) | Social expression drives purchasing |
| Problem | business-model.md -> "F2P model requires 3-5% conversion at $8-10 ARPPU" | Without monetization, the game cannot sustain itself |
| Risk | rat.md -> Risk 4: "LLM Cost Blowout", P3xI5=15 | Revenue must exceed LLM costs |
| Strategy | strategy-canvas.md -> Price/Entry Barrier: Maintain at 5 (F2P) | Cosmetic-only monetization, no pay-to-win |
| Initiative | prioritized-initiatives.md -> #24 (ICE=252) | NPC gift reaction monetization loop |
| Opportunity | opportunity-map.md -> Opportunity 5.2 | Free-rider LLM cost drain |

## Problem

**Job context**: "The F2P model requires revenue from 3-5% of players to subsidize the 95-97% who play free. LLM costs of $5,000-7,500/month at 25K MAU require at least $10,000/month in revenue. Without a compelling monetization system that cozy gamers accept (no pay-to-win, no gacha), the business model collapses."

**Current workaround**: Palia uses cosmetic shop. Stardew is premium one-time. No cozy game combines seasonal pass + cosmetic shop in F2P browser.
**Cost of inaction**: Zero revenue. Game cannot sustain server costs, let alone LLM costs.

## Appetite

**Size**: M (2-3 weeks)
**Duration**: 3 weeks
**Rationale**: Monetization is needed by launch but not for prototype validation. Build the infrastructure during Phase 2, populate with content during Phase 3.

## Solution

**Key elements**:

1. **Seasonal Pass ($5/season)**: Free track (basic rewards for daily activity) + Paid track (exclusive cosmetics, companion pet, special title). 7-14 day seasons. Pass progress through daily play -- farming, NPC interactions, exploration.

2. **Cosmetic Shop**: A la carte items: clothing skins ($3-5), furniture sets ($5-8), emote animations ($1-3), portrait frames ($1-2). Rotates weekly. Items are COSMETIC ONLY -- no gameplay advantage.

3. **Supporter Subscription ($5/month)**: All seasonal pass content automatically + unlimited NPC interactions + monthly exclusive cosmetic + priority server access. Premium convenience option.

4. **NPC Gift Reactions**: Certain cosmetic items trigger unique NPC responses when worn or placed. The baker notices your new apron. NPCs comment on seasonal outfits. This ties cosmetics to the AI NPC differentiator.

5. **Anti-Pay-to-Win Commitment**: No crop growth acceleration, no better seeds, no gameplay-affecting items, no NPC content gating, no loot boxes. Prominently displayed on the store page.

## Rabbit Holes

1. **Cosmetic content creation velocity** -- Need 20-30 items at launch and new items every season. Mitigation: Use LimeZu asset packs as base. Recolor/reskin for seasonal variants.
2. **Subscription vs. seasonal pass cannibalization** -- Subscribers have no reason to buy the pass. Mitigation: Designed intentionally -- subscribers are the premium tier. Run both 3 months, kill the underperformer.

## No-Gos

- **Loot boxes or gacha mechanics**: Non-negotiable. Why: Brand positioning and cozy audience trust.
- **Pay-to-win items**: No gameplay-affecting purchases ever. Why: GDD anti-monetization principles.
- **Real-money NPC content**: Cannot pay to access NPC storylines or exclusive dialogue. Why: Violates core value proposition.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Paying conversion rate | N/A | 3-5% | Payment analytics |
| ARPPU | N/A | $8-10/month | Revenue / paying players |
| Seasonal pass attach rate (of payers) | N/A | 30-50% | Pass purchase analytics |
| Monthly revenue (Month 12) | N/A | $8,330 (base case) | Revenue tracking |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a player purchases the seasonal pass, When they complete daily activities, Then they progress on both free and paid reward tracks |
| 2 | Given a player buys a cosmetic clothing item, When they wear it near an NPC with Friend+ relationship, Then there is a chance the NPC comments on the new outfit |
| 3 | Given a Supporter subscriber, When a new season begins, Then they automatically receive all paid track rewards without additional purchase |
| 4 | Given any player browses the cosmetic shop, When they view an item, Then no item provides any gameplay advantage (verified by design review) |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 10 | Monetization sustains operations. Without revenue, the game shuts down. |
| Time Criticality | 8 | Not needed until launch/open alpha. Premature monetization during prototype testing wastes effort. |
| Risk Reduction | 8 | Validates the 3-5% conversion rate assumption. |
| **Cost of Delay** | **26** | |
| Job Duration | 2 | M appetite: 2-3 weeks for pass system, shop UI, subscription infrastructure, and initial content. |
| **WSJF** | **13.0** | |
