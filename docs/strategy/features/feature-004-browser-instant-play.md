# Feature: Browser Instant-Play & Onboarding

**ID**: F-004
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 39 / Duration 2 = 19.5
**Appetite**: M (2-3 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 1: "Discover and enter the world" | Zero-friction entry from link to playing |
| Segment | segments.md -> Segment 3: "Emergent AI Explorer" (browser preference) | The one segment where browser is a genuine platform PREFERENCE |
| Problem | jobs-graph.md -> Job 1, Problem 1: "No storefront discovery", Severity 7/10 | Browser games have zero organic discovery |
| Risk | rat.md -> Risk 5: "Browser Distribution Dead Zone", P3xI3=9 | Browser-only may limit acquisition |
| Strategy | strategy-canvas.md -> RAISE: Browser/Instant Accessibility (1->5); ELIMINATE: Native App Download | The secondary differentiator after AI NPCs |
| Initiative | prioritized-initiatives.md -> #6 (ICE=378) | Content marketing requiring a playable URL |
| Opportunity | opportunity-map.md -> Opportunity 3.1 | No storefront discovery |

## Problem

**Job context**: "When a content-exhausted cozy gamer sees a compelling link or clip of an AI NPC interaction (Job 1), they want to start playing within 120 seconds -- zero download, zero payment, no mandatory tutorial -- but no cozy game is browser-native, and all require purchase + install (severity 7/10)."

**Current workaround**: Download and install games through Steam or Switch eShop. Accept 5-50GB installs and platform lock-in.
**Cost of inaction**: The viral loop breaks. Viewer sees clip -> clicks link -> encounters download page -> abandons. The entire community-led growth strategy depends on instant play.

## Appetite

**Size**: M (2-3 weeks)
**Duration**: 3 weeks
**Rationale**: The Next.js + Phaser.js architecture is already in place. This feature is about optimizing the first 120 seconds -- asset loading, character creation, and initial world entry.

## Solution

**Key elements**:

1. **Progressive Asset Loading**: Load only the town center area and 3-5 nearby NPCs initially (~2MB). Stream remaining world assets in background while the player is in character creation. Target: playable state in <30 seconds on 10Mbps connection.

2. **60-Second Character Creation**: Name, appearance (5 skin tones, 8 hair styles, 6 hair colors, 4 body types), and starter outfit. No class selection, no stats, no backstory questionnaire. Keep it simple -- the game teaches complexity through play, not forms.

3. **NPC-Initiated Welcome**: Within 60 seconds of entering the world, an NPC approaches the player (not vice versa) and greets them by name, comments on the time of day, and sets up a reason to return tomorrow. This is the activation moment (Job 3).

4. **No Account Required to Start**: Players play as guest for their first session. Account creation prompted after 15 minutes of play or at end of first session. Browser localStorage saves guest progress. Account creation = email only (no social login complexity).

5. **Gentle Onboarding Through World**: No tutorial popups. The NPC greeting teaches dialogue interaction. A visible garden plot teaches farming. Ambient NPC behavior teaches the world's rhythms. Contextual hints appear only when the player tries a new mechanic.

## Rabbit Holes

1. **Mobile browser performance** -- Phaser.js on mobile WebGL may not hit 30 FPS with 100 entities. Mitigation: Desktop-first. Mobile browser is degraded but functional. Cap visible entities at 30 on mobile.
2. **Guest progress loss** -- If player clears browser data before creating account, progress is lost. Mitigation: Prompt account creation after 15 minutes with clear "save your progress" framing. Accept some loss.

## No-Gos

- **Native app wrapper**: No Electron, Capacitor, or TWA at this stage. Why: Browser-native IS the strategy.
- **Complex character backstory**: No backstory questionnaire or personality quiz. Why: 60-second target for character creation.
- **Mandatory email before play**: Players must be able to play immediately with no form whatsoever. Why: Every form field reduces conversion.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Time from click to play | N/A | <120 seconds | Client-side timing |
| Activation rate (meaningful NPC conversation in session 1) | N/A | >80% | Session analytics |
| Character creation completion rate | N/A | >90% | Funnel analytics |
| Guest-to-account conversion | N/A | >60% (of session 2+ players) | Registration analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a new visitor clicks the game URL, When assets load on a 10Mbps connection, Then the character creation screen appears in <30 seconds |
| 2 | Given a player completes character creation, When they enter the world, Then an NPC approaches them within 60 seconds with a personalized greeting |
| 3 | Given a player has not created an account, When they have played for 15 minutes, Then a non-intrusive prompt offers to save progress with email registration |
| 4 | Given a returning guest player, When they open the same browser, Then their previous session progress is restored from localStorage |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 15 | Browser instant-play is the secondary differentiator and the enabler of the viral loop. Without it, the CLG growth strategy fails. |
| Time Criticality | 14 | Must be ready for any public playtest or community seeding. Every test requires a working URL. |
| Risk Reduction | 10 | Validates RAT Risk 5 (P3xI3=9) -- whether browser delivery converts viewers to players. |
| **Cost of Delay** | **39** | |
| Job Duration | 2 | M appetite: 2-3 weeks. Progressive loading, character creation, NPC welcome, guest accounts. |
| **WSJF** | **19.5** | |
