# Feature: NPC Interaction Cap & Free-Rider Mitigation

**ID**: F-011
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be (for business viability)
**WSJF Score**: CoD 34 / Duration 1 = 34.0
**Appetite**: S (1 week)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | No direct player job -- business viability feature | Ensures F2P model can sustain LLM costs |
| Segment | All segments (infrastructure constraint) | Free players across all segments |
| Problem | pricing-analysis.md -> "Free-rider NPC interaction drain consuming 50-75% of revenue" | Uncapped free interactions make F2P structurally unprofitable |
| Risk | rat.md -> Risk 4: "LLM Infrastructure Cost Blowout", P3xI5=15 | LLM costs must stay below $0.50/server/hour |
| Strategy | strategy-canvas.md -> Price/Entry Barrier: Maintain at 5 (F2P) | F2P is non-negotiable for viral loop; cost control is the lever |
| Initiative | prioritized-initiatives.md -> #33 (ICE=144) | Free-tier NPC interaction limits |
| Opportunity | opportunity-map.md -> Opportunity 5.1, 5.2 | LLM cost blowout, free-rider drain |

## Problem

**Job context**: "Each NPC dialogue costs ~$0.001 in LLM API fees. An uncapped free player doing 50 dialogues/day = $1.50/month in pure cost with $0 revenue. At 25K MAU with 96% free players, uncapped interactions = $36K/month in LLM costs vs. $10K/month revenue. The F2P model breaks without interaction limits."

**Current workaround**: No comparable game has per-interaction AI costs. This is a novel problem.
**Cost of inaction**: Business model is structurally unprofitable. LLM costs exceed revenue permanently.

## Appetite

**Size**: S (1 week)
**Duration**: 1 week
**Rationale**: The cap is a simple counter + warm in-character message. Implementation is trivial. The design decision (15/day, warm messaging) is already made in pricing-analysis.md. Execution is straightforward.

## Solution

**Key elements**:

1. **15 Dialogues/Day Cap for Free Players**: Player-initiated NPC conversations are capped at 15 per game day. Cap resets at midnight game time. Counter is per-player, not per-NPC.

2. **Warm In-Character Cap Message**: When cap is reached, the NPC says something in-character: "I'm getting tired and heading to bed early tonight. See you tomorrow!" or "I have so much to do today, let's catch up tomorrow!" -- NEVER a system message or paywall prompt.

3. **Exempt Interactions**: The following do NOT count against the cap: NPC-initiated ambient dialogue (walking past NPCs), overhearing NPC-NPC conversations, server-wide emergent event dialogue, and quest-related interactions.

4. **Supporter Tier Upgrade**: Supporters ($5/month or seasonal pass) get 30 dialogues/day (seasonal pass) or unlimited (subscription). Upgrade prompt appears only when cap is hit, framed warmly: "Want to keep talking? Become a Supporter and your friends in town will always have time for you."

## Rabbit Holes

1. **Cap frustration for engaged free players** -- If >20% of players express frustration, the cap may reduce activation and retention. Mitigation: Monitor cap-hit rate in first week. If <5% of players ever hit it, cap is irrelevant and can be raised. If >20% hit it daily, lower the messaging friction.

## No-Gos

- **Slower responses for free players**: No degraded quality or speed. Why: Breaks immersion, makes AI feel like tech not characters.
- **Visible counter**: No "12/15 dialogues remaining" UI. Why: Breaks immersion. Cap should feel natural, not gamified.
- **Ads as alternative**: No ad-supported free tier. Why: Ads destroy cozy immersion.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| LLM cost per server per hour | N/A | <$0.50 | Cost monitoring |
| Free player cap-hit rate | N/A | <15% of daily active free players | Counter analytics |
| Cap-to-conversion rate | N/A | >5% of cap-hitters upgrade within 7 days | Conversion funnel |
| Cap frustration reports | N/A | <3% of players report cap as negative in surveys | Player feedback |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a free player has initiated 15 NPC conversations today, When they try to start a 16th, Then the NPC responds with a warm in-character reason to end conversation (not a system message) |
| 2 | Given a free player is walking past NPCs, When NPCs initiate ambient dialogue, Then these interactions do NOT count against the daily cap |
| 3 | Given a free player hits the cap, When they see the upgrade prompt, Then it is framed as "keep talking" not "you've hit a limit" |
| 4 | Given a Supporter player, When they initiate conversations all day, Then they experience no cap (subscription) or a 30/day cap (seasonal pass) |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 8 | Not player value -- business viability. F2P model is unprofitable without this. |
| Time Criticality | 12 | Must be ready before any public launch or extended playtest with real costs. |
| Risk Reduction | 14 | Directly addresses RAT Risk 4 (LLM cost blowout). Makes F2P model viable. |
| **Cost of Delay** | **34** | |
| Job Duration | 1 | S appetite: 1 week. Simple counter, message system, exemption rules, upgrade prompt. |
| **WSJF** | **34.0** | |
