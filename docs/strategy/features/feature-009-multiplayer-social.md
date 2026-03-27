# Feature: Multiplayer & Social Features

**ID**: F-009
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 28 / Duration 3 = 9.3
**Appetite**: L (4-6 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 7: "Share and connect with other players" | What makes Nookstead an MMO, not a single-player game |
| Segment | segments.md -> Segment 4: "Community-Seeking Social Nester" (12% SAM) | Highest D90+ retention, highest cosmetic spend |
| Problem | jobs-graph.md -> Job 7, Problem 2: "Toxicity management without team", Severity 7/10 | Solo dev cannot moderate 24/7 |
| Risk | rat.md -> Risk 3: "Solo Dev MMO Scope Mismatch", P4xI4=16 | MMO infrastructure for one developer |
| Strategy | strategy-canvas.md -> RAISE: Multiplayer Scale (1->4), RAISE: Social Features (1->4) | Move from 4-player co-op to 100-player MMO |
| Initiative | prioritized-initiatives.md -> #32 (ICE=150) | Automated text moderation |
| Opportunity | opportunity-map.md -> Opportunity 4.1, 4.2 | Empty servers, toxicity management |

## Problem

**Job context**: "When a player has been playing for 1-2 weeks and notices other players on the server (Job 7), they want to share their experience, see what others have built, and feel part of a community -- but without meaningful multiplayer, Nookstead is a worse single-player game than Stardew (severity 8/10). And solo dev cannot moderate chat 24/7 (severity 7/10)."

**Current workaround**: Stardew has 4-player co-op. AC has 8-player visits. Palia has MMO features but toxicity issues. No cozy MMO exists in a browser.
**Cost of inaction**: "MMO" claim is hollow. Players see other avatars but cannot meaningfully interact.

## Appetite

**Size**: L (4-6 weeks)
**Duration**: 5 weeks
**Rationale**: Multiplayer is infrastructure-heavy but essential for the MMO promise. Colyseus handles the server architecture. Focus on player-facing social features.

## Solution

**Key elements**:

1. **Text Chat**: Server-wide and proximity-based text chat. Profanity filter (basic word list + regex patterns). Chat bubbles appear above player avatars. No voice chat (scope control).

2. **Emote System**: 10-15 emotes at launch (wave, smile, heart, clap, dance, point, sit, laugh). Emotes trigger pixel art animations. Additional emotes are cosmetic unlocks (F-013).

3. **Homestead Visiting**: Players can walk to other players' homesteads on the same server. Visitors can see builds and leave a "like" (heart reaction). NPCs may comment on visitors ("I see you have a guest today!").

4. **Item Trading**: Face-to-face trade interface. Both players must agree on items. No remote trading or auction house. Prevents exploitation while encouraging social interaction.

5. **Player Reporting**: One-click report for harassment/toxicity. Automated escalation: 3 reports from different players = temporary mute (1 hour). 5 reports = 24-hour chat ban. 10 reports = flagged for manual review.

6. **Server Identity**: Each server has a name and a shared "Server Story" board showing recent emergent NPC events. This creates community identity ("our server's baker is the best").

## Rabbit Holes

1. **Colyseus scaling** -- 100 concurrent players with real-time state sync. Mitigation: Use Colyseus room-based architecture. Limit sync frequency for distant entities. Priority sync for nearby players.
2. **Chat abuse vectors** -- Subtle harassment that evades word filters. Mitigation: Player reporting system with automated escalation. Accept that perfect moderation is impossible for solo dev.

## No-Gos

- **Voice chat**: Why: Moderation impossible for solo dev. Text-only is manageable.
- **PvP of any kind**: No player combat, no griefing mechanics. Why: Cozy genre contract. Eliminated in strategy-canvas.
- **Auction house**: Why: Too complex, encourages min-maxing over social play.
- **Guild system at launch**: Why: Needs critical mass of players. Add post-launch if server populations support it.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Daily chat messages per active player | N/A | >5 | Chat analytics |
| Homestead visits per week | N/A | >2 per active player | Visit logs |
| Player report rate | N/A | <5% of players receive reports | Report analytics |
| Server identity engagement | N/A | >30% of players check Server Story board weekly | Board view analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given two players are near each other, When one types a message, Then both see a chat bubble above the sender's avatar within 200ms |
| 2 | Given a player uses a profanity-filtered word, When the message is sent, Then the word is replaced with asterisks and the message is delivered |
| 3 | Given a player receives 3 reports from different players, When the threshold is reached, Then the reported player is automatically muted for 1 hour |
| 4 | Given a player visits another's homestead, When they click "like," Then the homestead owner receives a notification and the like count increases |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 12 | Makes Nookstead an actual MMO. Social features enable Social Nesters (highest cosmetic spend, best retention). |
| Time Criticality | 8 | Needed at launch but not before AI NPC validation. |
| Risk Reduction | 8 | Validates whether cozy gamers will engage with MMO social features without toxicity. |
| **Cost of Delay** | **28** | |
| Job Duration | 3 | L appetite: 4-6 weeks for chat, emotes, visiting, trading, reporting, and server identity. |
| **WSJF** | **9.3** | |
