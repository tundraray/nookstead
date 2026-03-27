# Feature: Clip Moment Capture & Sharing

**ID**: F-012
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Attractive
**WSJF Score**: CoD 36 / Duration 1 = 36.0
**Appetite**: S (1-2 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 6: "Experience emergent stories" | Shareable moments are the product's marketing engine |
| Segment | segments.md -> Segment 3: "Emergent AI Explorer" | Generates viral clips, provides technical feedback |
| Problem | jobs-graph.md -> Job 1, Problem 1: "No storefront discovery", Severity 7/10 | Clips ARE the discovery channel |
| Risk | rat.md -> Risk 5: "Browser Distribution Dead Zone", P3xI3=9 | Viral clips compensate for zero storefront discovery |
| Strategy | strategy-canvas.md -> CREATE: AI-Generated "Clip Moments" | Self-marketing engine built into the product |
| Initiative | prioritized-initiatives.md -> #5 (ICE=504) | NPC moment screenshot/clip sharing tool |
| Opportunity | opportunity-map.md -> Opportunity 3.1 | No storefront discovery |

## Problem

**Job context**: "Nookstead has $0 marketing budget and zero storefront discovery (Job 1). Every single player must arrive through a direct link. AI NPC moments are inherently shareable (unexpected, emotional, unique), but without capture/sharing tools, players must manually screenshot, alt-tab, and post -- friction that kills 90% of sharing impulses."

**Current workaround**: Players manually screenshot and post on social media. Most do not bother.
**Cost of inaction**: The viral loop never activates. A single viral clip can generate more acquisition than $10K in ads.

## Appetite

**Size**: S (1-2 weeks)
**Duration**: 2 weeks
**Rationale**: Highest WSJF score (36.0) because the smallest investment (S appetite) enables the primary acquisition channel. Screenshot capture with branding overlay is standard web capability.

## Solution

**Key elements**:

1. **One-Click Screenshot**: Keyboard shortcut (F12 or dedicated button) captures the current game screen with NPC dialogue visible. Screenshot includes game branding ("Nookstead") and "Play Free at nookstead.land" URL as a subtle overlay bar at the bottom.

2. **NPC Moment Detection**: Heuristic system that detects when something noteworthy happens: NPC says something surprising (sentiment deviation from baseline), NPC references a past player interaction for the first time, NPC-NPC conflict visible to player. When detected, a subtle camera icon pulses in the corner -- prompting (not forcing) capture.

3. **Share Integration**: After capture, a share panel offers: copy to clipboard, share to Twitter/X, share to Discord (via webhook URL), and save locally. Pre-populated caption: "This just happened in my town. Nobody scripted this. [Play Free]"

4. **Server Story Card**: Weekly auto-generated summary card of the server's top emergent moments, formatted as a shareable image. Players can share "what happened on our server this week."

## Rabbit Holes

1. **Moment detection accuracy** -- False positives (prompting capture at boring moments) train players to ignore the prompt. Mitigation: Conservative detection threshold. Better to miss moments than annoy with false prompts. Players can always manually capture.

## No-Gos

- **Video recording**: No 15-second clip capture at this stage. Why: Video processing exceeds S appetite. Add later.
- **In-game social feed**: No Instagram-style feed of player screenshots within the game. Why: Scope creep.
- **Automatic posting**: Sharing is always player-initiated, never automatic. Why: Trust and consent.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Clips shared per 100 DAU | N/A | >5 | Share button click analytics |
| Click-through from shared clips to game | N/A | >3% CTR on shared URLs | URL tracking |
| New players from shared clips | N/A | >10% of new player acquisition | Referral attribution |
| Moment detection prompt rate | N/A | 1-3 prompts per play session | Detection event logs |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a player presses the screenshot key, When the capture is taken, Then the image includes the current game screen with NPC dialogue visible and a "Play Free at nookstead.land" URL bar |
| 2 | Given an NPC references a past player interaction for the first time, When the moment detection fires, Then a subtle camera icon pulses in the corner for 5 seconds |
| 3 | Given a player opens the share panel, When they click "Copy to clipboard," Then the image and pre-populated caption are copied and ready to paste into social media |
| 4 | Given a week has passed on a server, When the Server Story Card is generated, Then it contains 3-5 notable emergent moments formatted as a shareable image |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 12 | The viral loop engine. Zero-cost marketing through player-generated content. |
| Time Criticality | 14 | Every day without sharing tools is a day of lost viral potential. First streamer access requires this. |
| Risk Reduction | 10 | Validates whether AI NPC moments are genuinely shareable -- the core acquisition thesis. |
| **Cost of Delay** | **36** | |
| Job Duration | 1 | S appetite: 1-2 weeks for screenshot capture, branding overlay, share integration, and basic moment detection. |
| **WSJF** | **36.0** | |
