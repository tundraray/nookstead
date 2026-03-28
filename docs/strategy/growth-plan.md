# Growth Plan: Nookstead

**Date**: 2026-03-22
**Analyst**: Growth Strategist Agent
**Confidence**: Medium -- Growth motion and experiment design are well-grounded in market data and AJTBD job analysis (HIGH), but all metrics are pre-launch projections with zero validation data (MEDIUM-LOW). Funnel benchmarks are adapted from F2P mobile/browser gaming (Tier 2) and cozy game market data (Tier 2), not Nookstead-specific measurements.

---

## Activation is the biggest bottleneck -- the "aha moment" (Job 3: first meaningful AI NPC interaction) determines whether Nookstead achieves viral growth or joins the 70% of indie games that fail silently

The growth strategy for Nookstead is fundamentally different from a typical SaaS or mobile game because the product's viral loop is built into its core mechanic: AI NPCs that create shareable, surprising moments. The North Star metric -- Weekly Active Players with 3+ NPC Conversations -- directly measures whether the AI NPC system is delivering the "living world" promise that separates Nookstead from every competitor. The AARRR funnel audit reveals that Activation (the first AI NPC interaction that proves "this is different") is the make-or-break stage: if the "aha moment" at Job 3 fails, no amount of acquisition effort can save the funnel. The recommended growth motion is Community-Led Growth (CLG) + Product-Led Growth (PLG), leveraging browser-native zero-install access and AI NPC "clip moments" as the dual engines of organic acquisition. All 15 experiments are designed for a solo developer with $0 marketing budget, prioritizing game-mechanic-driven growth over traditional marketing.

---

## North Star Metric

| Field | Value |
|-------|-------|
| **Metric** | Weekly Active Players with 3+ NPC Conversations (WAP3) |
| **Why** | This metric sits at the intersection of engagement (player returns multiple times per week), value delivery (NPC conversations are the core differentiator), and monetization potential (players who talk to NPCs 3+ times/week are the most likely to form relationships that create switching costs and drive cosmetic purchases). It is the leading indicator for both retention and referral -- players who have 3+ NPC conversations per week are having emergent moments worth sharing. |
| **Current** | N/A (pre-launch) |
| **Target (90 days post-launch)** | 5,000 WAP3 (20% of target 25K MAU) |

### Supporting Metrics

| Metric | Current | Target | Role |
|--------|---------|--------|------|
| NPC dialogues per session | N/A | >3 | Measures whether players seek out NPC interactions (core job completion) |
| Unique NPC dialogue ratio | N/A | >90% | Measures whether AI NPCs deliver novel content (content freshness) |
| NPC moment clips shared per 100 DAU | N/A | >5 | Measures viral loop activation (referral engine) |
| D7 retention | N/A | >20% | Measures whether the "aha moment" converts to sustained engagement |
| Session length (minutes) | N/A | 25-40 | Measures depth of engagement per visit |

---

## AARRR Funnel Audit

| Stage | Current | Benchmark | Gap | Bottleneck Score (1-5) | Priority | Job-Completion Lens |
|-------|---------|-----------|-----|----------------------|----------|---------------------|
| **Acquisition** | N/A (pre-launch) | 5K-10K new players/month (indie F2P browser) | Unknown | 3 | #3 | Does the player discover Nookstead and find a reason to click? Browser URL removes install friction but has zero storefront discovery. |
| **Activation** | N/A | 40-50% first-session-to-NPC-interaction rate; 80% target | Unknown -- CRITICAL | **5** | **#1** | Does the player experience the "aha moment" of Job 3 (first meaningful NPC interaction) within 10 minutes? This IS the product-market fit test. |
| **Retention** | N/A | D1: 40%, D7: 20%, D30: 8% (F2P benchmark) | Unknown | 4 | #2 | Do AI NPC relationships (Job 5) and emergent stories (Job 6) keep the player coming back daily? The farming loop alone is insufficient against Stardew. |
| **Revenue** | N/A (pre-launch) | 3-5% F2P conversion, $8-10 ARPPU | Unknown | 2 | #4 | Is the player willing to pay for cosmetics and seasonal passes that enhance their NPC relationship experience? |
| **Referral** | N/A | K=0.3-0.5 (organic viral coefficient) | Unknown | 3 | #3 (tied) | Do AI NPC "clip moments" create shareable content that drives word-of-mouth? Does job completion create advocacy? |

**Biggest bottleneck**: **Activation** -- The first AI NPC interaction (Job 3, problem severity 9/10) is simultaneously the product's greatest opportunity and greatest risk. If a new player's first NPC conversation feels like "just another chatbot" rather than "this character is ALIVE," they leave within 10 minutes and never return. Every downstream metric (retention, revenue, referral) depends on this single moment landing. No other funnel stage matters if Activation fails.

### Per-Stage Analysis

#### Activation -- Priority #1

- **Current state**: Unvalidated. The AI NPC system is in prototype (Phase 0, M0.3 NPC Talks milestone). Zero real players have experienced the "aha moment." The jobs graph identifies four severity 7-9 problems at this stage: quality inconsistency (9/10), uncanny valley detection (8/10), response latency (7/10), and adversarial testing (6/10).
- **Root cause**: No player testing has been conducted. The activation experience is designed but not validated. The "aha moment" is defined (Job 3: NPC acknowledges something specific about the player, reveals personality, sets up future interaction) but not measured.
- **Improvement potential**: If activation rate reaches 60%+ (player has meaningful NPC interaction AND returns for session 2), the downstream funnel can sustain 25K MAU. At 30% activation, MAU caps at ~12K even with strong acquisition. The delta between 30% and 60% activation = 2x revenue.
- **Key actions**: (1) Validate activation in Phase 0 prototype playtest (10-20 players). (2) Optimize first NPC interaction for <2 second response time. (3) Ensure first NPC acknowledges player name, time of day, and sets up a reason to return. (4) Frame NPCs through pixel art speech bubbles, not chat UI (avoid "chatbot" perception).

#### Retention -- Priority #2

- **Current state**: No retention data. Palia's 57% concurrent decline over 10 months (18,179 to ~7,769 on Steam -- Tier 1) is the cautionary benchmark. Character.AI's 20M MAU with declining revenue ($32.2M in 2024) demonstrates that pure AI conversation without game loops does not sustain engagement.
- **Root cause**: Content exhaustion is the #1 churn driver in cozy games. The hypothesis is that AI NPCs generate "infinite" novel content, but this is unvalidated (RAT Risk 2, score 20/25).
- **Improvement potential**: If D30 retention improves from F2P benchmark 8% to the GDD target of 15%, lifetime value nearly doubles ($11.88 to $19.80+ per paying player). Each percentage point of D30 retention = ~$1.50 additional LTV.
- **Key actions**: (1) Design the daily farming loop to intersect with NPC schedules (harvest -> sell to NPC -> NPC comments on your crops). (2) Implement NPC-initiated re-engagement (NPC "notices" player absence). (3) Create seasonal content cadence (7-day seasons with unique NPC events). (4) Run 4-week retention cohort test after activation validation.

#### Acquisition -- Priority #3

- **Current state**: Zero players, zero community presence, zero brand awareness. No Steam listing, no app store presence. Browser-only distribution means zero organic discovery through storefronts. -- Tier 1 (RAT Risk 5, score 9/25)
- **Root cause**: Browser games have no equivalent of Steam's recommendation algorithm. Discovery depends entirely on direct links, community posts, and word-of-mouth. 60% of cozy gamers prefer Nintendo Switch (Tier 1, Nintendo data), not browser.
- **Improvement potential**: Palia's 6M churned accounts represent a pre-qualified audience. Reaching even 1% of Palia's churned players = 60K potential users. Reddit/Discord/TikTok cozy communities collectively reach millions of target segment players at $0 CAC.
- **Key actions**: (1) Begin Discord community building NOW (Phase 0), targeting 1,000 members pre-launch. (2) Create 10+ "NPC moment" clips for Reddit/TikTok seeding. (3) Seed 5-10 small cozy game streamers with prototype access. (4) List on Steam Coming Soon page ($100) as discovery hedge.

#### Referral -- Priority #3 (tied)

- **Current state**: No sharing tools built. No viral loop designed. The product naturally produces shareable moments (AI NPC surprises) but has no mechanism to capture and distribute them.
- **Root cause**: Clip/screenshot sharing is not yet a product feature. AI NPC "clip moments" are the highest-leverage zero-cost acquisition channel, but detection and capture must be built.
- **Improvement potential**: If K-factor reaches 0.3 (each player brings 0.3 new players), organic growth compounds. At K=0.5, growth becomes nearly self-sustaining. A single viral TikTok clip can generate more acquisition than $10K in ads. -- Tier 2 ([SociallyIn 2026](https://sociallyin.com/blog/viral-marketing/))
- **Key actions**: (1) Build screenshot/clip capture with game branding overlay. (2) Implement "NPC moment detection" heuristic (surprising NPC behavior triggers capture prompt). (3) Add one-click social sharing (Twitter/X, Reddit, Discord). (4) Create a daily "Server Story" digest that summarizes emergent NPC events.

#### Revenue -- Priority #4

- **Current state**: Pre-revenue. F2P model designed with cosmetic shop + seasonal pass ($5/season) + QoL expansions ($3-8). Unit economics modeled at 72-85% gross margin. -- Tier 3 (business-model.md estimates)
- **Root cause**: Revenue optimization is premature before activation and retention are validated. Monetization should not be the focus until D30 retention exceeds 5%.
- **Improvement potential**: At conservative 3% conversion and $8 ARPPU, each 1,000 MAU generates $240/month. Improving conversion from 3% to 5% = 67% revenue increase with zero additional acquisition cost.
- **Key actions**: (1) Design seasonal pass to reward NPC interaction (not just farming). (2) Cosmetics should include NPC-relationship-specific items (gifts that NPCs react to). (3) Defer monetization optimization until post-launch Month 3 (after D30 data exists).

---

## Growth Motion: Community-Led Growth (CLG) + Product-Led Growth (PLG) Hybrid

**Rationale**: Nookstead's growth motion must account for three constraints: (1) solo developer with $0 marketing budget, (2) browser-native product with zero storefront discovery, and (3) AI NPC "moments" as the primary viral mechanic. This combination maps precisely to CLG + PLG hybrid.

| Criterion | Assessment | Implication |
|-----------|-----------|------------|
| ACV | $0 (F2P) to ~$96/year for engaged payers | PLG viable -- self-serve, no sales team needed |
| Product complexity | Simple to start (click URL, create character, talk to NPC) | PLG viable -- time-to-value <5 minutes |
| Buyer = User? | Yes -- direct-to-player B2C | PLG viable -- player decides to pay, no procurement |
| Time-to-value | Target: <10 minutes to first "aha" NPC interaction | PLG viable if activation is nailed |
| Network effects? | Yes -- MMO social features, shared server stories, NPC community events | CLG viable -- community amplifies value |
| Marketing budget | $0 | CLG mandatory -- community IS the marketing |
| Viral content potential | High -- AI NPC moments are inherently shareable | CLG + PLG synergy -- product generates its own marketing content |

### CLG Engine: Community as the Growth Loop

```
NPC creates surprising moment → Player captures clip → Shares on Reddit/TikTok/Discord
→ Viewer clicks browser link → Plays instantly (PLG: zero friction) → Has own NPC moment
→ Shares → Loop continues
```

This is not a traditional CLG where a community manager drives engagement. The AI NPC system IS the community content engine. Each player's unique NPC interactions generate shareable stories that drive organic acquisition. The community (Discord, Reddit, server identity) provides the distribution channel.

### PLG Engine: Browser-Native Zero-Friction Access

The browser-native architecture is the PLG mechanism. Every shared link is a direct play button:
- No app store redirect
- No download wait
- No account creation gate (play first, account optional)
- No payment wall (F2P)

**Key metric to track**: Viral Loop Time -- the average time from "viewer sees NPC clip" to "viewer is playing the game." Target: <120 seconds. This is the PLG metric that matters most for a browser game.

---

## Growth Experiments

### Experiment 1: "The Baker Remembers" First-Touch Experience

| Field | Value |
|-------|-------|
| **Hypothesis** | "If we design the first NPC interaction so the town baker greets the player by name, comments on the time of day, and asks a personal question within 60 seconds of entering town, then D1 retention will improve by 30% (from 40% baseline to 52%) because the 'aha moment' of Job 3 will occur before the player's attention window closes" |
| **Target Job** | Job 3: Have My First Meaningful NPC Interaction (severity 9/10) |
| **AARRR Stage** | Activation |
| **ICE Score** | Impact: 9 x Confidence: 7 x Ease: 8 = **504** |
| **Target Metric** | D1 retention -- Current: N/A (assume 40% F2P baseline), Target: 52% |
| **Guard Rail** | NPC response latency must stay <2 seconds (magic breaks if player waits) |
| **Duration** | 2-3 weeks (prototype playtest with 10-20 players) |
| **If wins** | Scale to all servers. Design second NPC encounter for 30-minute mark. |
| **If loses** | Diagnose: is it quality (NPC response feels generic), timing (interaction happens too late), or framing (player perceives chatbot, not character)? A/B test speech bubble style vs. chat UI. |

### Experiment 2: "NPC Miss-You Letter" Re-Engagement System

| Field | Value |
|-------|-------|
| **Hypothesis** | "If an NPC sends the player a personalized in-game letter referencing their last interaction when they haven't logged in for 48 hours (delivered via browser notification or email), then D7 retention will improve by 25% (from 20% to 25%) because the player feels their NPC relationships are 'alive' even when offline" |
| **Target Job** | Job 5: Develop Relationships with NPCs Over Time |
| **AARRR Stage** | Retention |
| **ICE Score** | Impact: 8 x Confidence: 6 x Ease: 7 = **336** |
| **Target Metric** | D7 retention -- Current: N/A (assume 20% F2P baseline), Target: 25% |
| **Guard Rail** | Notification opt-out rate must stay <15%. Do not spam -- max 1 letter per 48-hour absence. |
| **Duration** | 4 weeks (requires live players) |
| **If wins** | Extend to D14 and D30 absence triggers. Personalize letter content based on relationship depth. |
| **If loses** | Test whether the letter content is too generic (needs more specific memory references) or whether the notification channel is wrong (email vs. push vs. Discord DM). |

### Experiment 3: "Shareable NPC Moment" Viral Screenshot Tool

| Field | Value |
|-------|-------|
| **Hypothesis** | "If we build a one-click screenshot tool that captures NPC dialogue with game branding and a 'Play Free' URL overlay, then NPC moment clips shared per 100 DAU will exceed 5, generating a K-factor of 0.2+ because players want to show friends surprising NPC behavior" |
| **Target Job** | Job 6: Experience Emergent Stories Unique to My Server |
| **AARRR Stage** | Referral |
| **ICE Score** | Impact: 8 x Confidence: 7 x Ease: 9 = **504** |
| **Target Metric** | Clips shared per 100 DAU -- Current: 0, Target: >5 |
| **Guard Rail** | Sharing must not interrupt gameplay flow. Capture tool activates on NPC moment detection, not manual trigger. |
| **Duration** | 2-4 weeks development + ongoing measurement |
| **If wins** | Add video clip capture (15-second GIFs). Add "Server Story" social post template. Track conversion from shared clips to new players. |
| **If loses** | Analyze which moments players screenshot manually (without tool). Redesign detection heuristic to match actual player-identified "share-worthy" moments. |

### Experiment 4: "Server Storyline of the Week" FOMO Content

| Field | Value |
|-------|-------|
| **Hypothesis** | "If each server generates a weekly digest summarizing its unique emergent NPC events (posted to the game's Discord and social media), then weekly new player signups will increase by 15% because non-players experience FOMO from seeing stories unique to specific servers" |
| **Target Job** | Job 6: Experience Emergent Stories Unique to My Server |
| **AARRR Stage** | Acquisition |
| **ICE Score** | Impact: 7 x Confidence: 5 x Ease: 6 = **210** |
| **Target Metric** | Weekly new player signups from Discord/social -- Current: N/A, Target: 15% uplift |
| **Guard Rail** | Digest must not contain spoilers that reduce the desire to play. Focus on intrigue, not resolution. |
| **Duration** | 4 weeks (requires live servers with emergent events) |
| **If wins** | Automate digest generation. Create per-server social media accounts. Encourage players to "subscribe" to their server's story. |
| **If loses** | Test whether the stories are too shallow (AI quality issue) or too inside-baseball (non-players can't relate). Simplify to "headline moments" rather than full narratives. |

### Experiment 5: "First 10 Minutes" Activation Speedrun

| Field | Value |
|-------|-------|
| **Hypothesis** | "If we compress the time from character creation to first 'surprising' NPC interaction from 15 minutes to under 5 minutes (NPC approaches player, not vice versa), then activation rate (% of new players who have a meaningful NPC conversation in session 1) will improve from 60% to 85% because reducing time-to-aha prevents attention drop-off" |
| **Target Job** | Job 1: Discover and Enter the World + Job 3: First NPC Interaction |
| **AARRR Stage** | Activation |
| **ICE Score** | Impact: 9 x Confidence: 8 x Ease: 7 = **504** |
| **Target Metric** | Activation rate (meaningful NPC conversation in session 1) -- Current: N/A, Target: 85% |
| **Guard Rail** | The NPC approach must not feel forced or tutorial-like. Must feel organic ("the baker noticed you're new and came over to say hello"). |
| **Duration** | 2 weeks (A/B test NPC-approaches-player vs. player-approaches-NPC) |
| **If wins** | Make NPC-initiated greeting the default. Design the greeting to set up a "come back tomorrow" hook (NPC mentions something happening tomorrow). |
| **If loses** | Test whether the NPC approach feels intrusive to some player types. Offer opt-out for players who prefer to explore solo first. |

### Experiment 6: "Cozy Streamer Seeding" Acquisition Campaign

| Field | Value |
|-------|-------|
| **Hypothesis** | "If we provide early prototype access to 10 cozy game streamers (1K-10K followers) with zero conditions, then at least 3 will create content featuring NPC interactions, generating 50K+ impressions and 500+ new player visits because AI NPC moments are inherently compelling streaming content" |
| **Target Job** | Job 1: Discover and Enter the World |
| **AARRR Stage** | Acquisition |
| **ICE Score** | Impact: 8 x Confidence: 5 x Ease: 8 = **320** |
| **Target Metric** | New players from streamer referrals -- Current: 0, Target: 500+ |
| **Guard Rail** | Do not require or incentivize positive coverage. Authentic reactions to AI NPCs are more valuable than scripted endorsements. |
| **Duration** | 2-4 weeks |
| **If wins** | Expand to 20-30 streamers. Build a "creator toolkit" with clip capture and streamer-friendly features (camera mode, NPC reaction highlights). |
| **If loses** | Diagnose: did streamers try it and not find it interesting (product quality issue), or did they not try it at all (outreach issue)? Iterate on outreach approach or product quality accordingly. |

### Experiment 7: "NPC Gift Reaction" Monetization Loop

| Field | Value |
|-------|-------|
| **Hypothesis** | "If NPCs have unique, memorable reactions to specific gifts (cosmetic items from the shop), then paying conversion rate will improve by 40% (from 3% to 4.2%) because players want to see their favorite NPC's reaction to a special gift -- creating emotional purchase motivation" |
| **Target Job** | Job 5: Develop Relationships with NPCs Over Time |
| **AARRR Stage** | Revenue |
| **ICE Score** | Impact: 7 x Confidence: 6 x Ease: 6 = **252** |
| **Target Metric** | F2P to paid conversion rate -- Current: N/A (target 3%), Target: 4.2% |
| **Guard Rail** | NPC gift reactions must NOT be gated behind payment. Free gifts exist. Paid gifts have rarer/more elaborate reactions. No pay-to-win. |
| **Duration** | 4-6 weeks (requires monetization system) |
| **If wins** | Expand gift catalog. Create seasonal limited-edition gifts with unique NPC reactions. |
| **If loses** | Test whether players value NPC reactions at all (may prefer cosmetic self-expression over NPC reactions). Pivot to cosmetics that are visible to other players. |

### Experiment 8: "Reddit Community Seeding" Organic Acquisition

| Field | Value |
|-------|-------|
| **Hypothesis** | "If we post authentic NPC moment stories (not ads) in r/CozyGamers, r/StardewValley, r/Palia, and r/gaming, then we will achieve >5% click-through rate and >30% play rate from clicks (of those who click the link, 30% actually play) because the content speaks directly to the content-exhaustion frustration these communities share" |
| **Target Job** | Job 1: Discover and Enter the World |
| **AARRR Stage** | Acquisition |
| **ICE Score** | Impact: 7 x Confidence: 6 x Ease: 9 = **378** |
| **Target Metric** | CTR from community posts -- Target: >5%. Play rate from clicks -- Target: >30%. |
| **Guard Rail** | Posts must be genuine community participation, not marketing. Share personal dev stories and NPC moments. Follow each subreddit's self-promotion rules. |
| **Duration** | Ongoing, measured weekly |
| **If wins** | Create a posting cadence (2-3 posts/week across communities). Build relationships with community moderators. Participate in community discussions beyond self-promotion (80/20 rule). |
| **If loses** | Test different content formats: video clips vs. screenshot stories vs. dev diary. If the communities reject game promotion entirely, focus on Discord and TikTok instead. |

### Experiment 9: "Seasonal FOMO" Retention Mechanic

| Field | Value |
|-------|-------|
| **Hypothesis** | "If each 7-day season introduces 1-2 season-exclusive NPC events that players can only experience during that season (NPC-initiated, not scripted), then D30 retention will improve by 20% (from 8% to 9.6%) because players return to avoid missing unique NPC stories" |
| **Target Job** | Job 8: Feel Progression and Mastery Over Time |
| **AARRR Stage** | Retention |
| **ICE Score** | Impact: 7 x Confidence: 5 x Ease: 5 = **175** |
| **Target Metric** | D30 retention -- Current: N/A (assume 8%), Target: 9.6% |
| **Guard Rail** | FOMO must not create anxiety or punish casual players. Missed events should be referenced by NPCs later ("You missed the harvest festival -- the baker won the pie contest!"), not permanently lost. |
| **Duration** | 3-4 seasonal cycles (21-28 days) |
| **If wins** | Expand seasonal events to include player-participatory elements (collaborative NPC projects). |
| **If loses** | Test whether 7-day seasons are too fast (creates FOMO fatigue) or too slow (players forget between seasons). Adjust season length. |

### Experiment 10: "NPC Gossip Network" Social Retention

| Field | Value |
|-------|-------|
| **Hypothesis** | "If NPCs gossip about player actions to other NPCs (and players overhear this gossip), then average session length will increase by 20% (from 30 to 36 minutes) because players become curious about what NPCs are saying about them and explore the social dynamics of the town" |
| **Target Job** | Job 6: Experience Emergent Stories Unique to My Server |
| **AARRR Stage** | Retention |
| **ICE Score** | Impact: 7 x Confidence: 6 x Ease: 5 = **210** |
| **Target Metric** | Average session length -- Target: 36 minutes (from 30 min baseline) |
| **Guard Rail** | Gossip must be charming, not malicious. NPCs should gossip with personality-appropriate filters (the kind baker shares good news; the grumpy fisherman complains). |
| **Duration** | 4 weeks |
| **If wins** | Expand NPC gossip to include inter-NPC relationship drama that players can influence. Create "soap opera" storylines between NPC pairs. |
| **If loses** | Test whether players find gossip entertaining (content quality) or whether they even notice it (visibility/discovery). Add gossip notification indicators. |

### Experiment 11: "Browser Push Notification" D3 Recovery

| Field | Value |
|-------|-------|
| **Hypothesis** | "If players who opt-in to browser notifications receive a personalized NPC message on Day 3 (referencing their last in-game action), then D3 return rate will improve by 35% because the notification bridges the critical drop-off between D1 and D7" |
| **Target Job** | Job 5: Develop Relationships with NPCs Over Time |
| **AARRR Stage** | Retention |
| **ICE Score** | Impact: 7 x Confidence: 7 x Ease: 7 = **343** |
| **Target Metric** | D3 return rate -- Target: 35% improvement over baseline |
| **Guard Rail** | Opt-in rate target: >40%. Unsubscribe must be easy. Max 1 notification per 48 hours. |
| **Duration** | 3 weeks |
| **If wins** | Extend to D5 and D10 with escalating personalization. Test NPC "voice" in notifications vs. generic game notifications. |
| **If loses** | Analyze opt-in rate -- if <20%, the ask is too aggressive. Test timing (day vs. evening notifications). Test channel (email vs. push vs. Discord). |

### Experiment 12: "Invite Friend to Homestead" Social Loop

| Field | Value |
|-------|-------|
| **Hypothesis** | "If players can generate a shareable 'Visit My Homestead' link that lets friends see their homestead and meet their server's NPCs (free, no account required for first visit), then K-factor will reach 0.3 because the invitation is personal, low-friction, and showcases both player creativity and NPC personality" |
| **Target Job** | Job 7: Share and Connect with Other Players |
| **AARRR Stage** | Referral |
| **ICE Score** | Impact: 8 x Confidence: 5 x Ease: 6 = **240** |
| **Target Metric** | K-factor -- Target: 0.3 |
| **Guard Rail** | Visitor experience must be compelling enough to convert (not just a static view). Visitors should be able to talk to at least one NPC. |
| **Duration** | 4-6 weeks (requires homestead visiting system) |
| **If wins** | Add "collaborative farming" for visitors. Track visitor-to-player conversion rate. Optimize the visitor first-touch NPC experience. |
| **If loses** | Analyze visitor behavior -- do they click the link but not play (landing page issue)? Do they play but not convert (product quality)? Do they not click at all (invitation not compelling)? |

### Experiment 13: "Dev Diary TikTok" Content Marketing

| Field | Value |
|-------|-------|
| **Hypothesis** | "If the developer posts 3-5 short-form videos per week showing authentic NPC moments from development (bugs, surprises, funny dialogue), then at least 2 videos will exceed 10K views within 30 days because AI NPC content is inherently viral on TikTok (#cozygaming content is growing 45% YoY)" |
| **Target Job** | Job 1: Discover and Enter the World |
| **AARRR Stage** | Acquisition |
| **ICE Score** | Impact: 7 x Confidence: 6 x Ease: 8 = **336** |
| **Target Metric** | TikTok views and follower-to-player conversion -- Target: 10K+ views on 2+ videos, 100+ new players |
| **Guard Rail** | Videos must be authentic, not polished marketing. Show real development, real NPC reactions, real bugs. Authenticity outperforms production value for indie games. -- Tier 2 ([Game-Developers.org 2026](https://www.game-developers.org/2026-indie-game-production-marketing-guide)) |
| **Duration** | Ongoing, measured monthly |
| **If wins** | Increase posting frequency. Cross-post to YouTube Shorts and Instagram Reels. Build a "best NPC moments" compilation series. |
| **If loses** | Analyze which content types get views (bugs vs. emotional moments vs. dev commentary). Pivot content strategy to match audience preferences. |

### Experiment 14: "Palia Refugee" Targeted Community Outreach

| Field | Value |
|-------|-------|
| **Hypothesis** | "If we engage authentically in r/Palia discussions about NPC frustrations and mention (when contextually appropriate) that we're building a cozy MMO where NPCs actually remember players, then Palia community conversion will exceed other communities by 3x because these players have the exact content-exhaustion frustration that Nookstead solves" |
| **Target Job** | Job 1: Discover and Enter the World (for Palia's 6M churned players) |
| **AARRR Stage** | Acquisition |
| **ICE Score** | Impact: 7 x Confidence: 7 x Ease: 8 = **392** |
| **Target Metric** | Conversion rate from r/Palia referrals vs. other subreddit referrals -- Target: 3x higher |
| **Guard Rail** | NEVER disparage Palia. Participate genuinely in the community. Only mention Nookstead when directly relevant to the conversation. Respect self-promotion rules. |
| **Duration** | Ongoing |
| **If wins** | Expand to Palia Discord communities. Create a "switching guide" for Palia players (how to start in Nookstead). |
| **If loses** | Palia community may be defensive of their game. If reception is hostile, redirect effort to r/CozyGamers and r/StardewValley where content-exhaustion conversations are more neutral. |

### Experiment 15: "NPC Memory Showcase" Onboarding Proof

| Field | Value |
|-------|-------|
| **Hypothesis** | "If the game includes a deliberate 'memory proof' moment at the 10-minute mark (NPC references something specific the player said 5 minutes ago, unprompted), then the 'aha moment' conversion rate will increase by 40% because the player receives concrete proof that 'this game is different' before their initial curiosity fades" |
| **Target Job** | Job 3: Have My First Meaningful NPC Interaction (AHA MOMENT) |
| **AARRR Stage** | Activation |
| **ICE Score** | Impact: 9 x Confidence: 7 x Ease: 7 = **441** |
| **Target Metric** | "Aha moment" conversion (% of players who express surprise/delight at NPC memory within first session) -- Target: >60% |
| **Guard Rail** | The memory reference must feel organic, not performative. The NPC should weave the reference into natural conversation, not say "I remember you said X." |
| **Duration** | 2-3 weeks (prototype test) |
| **If wins** | Design a sequence of 3 "memory proof" moments at 10min, 30min, and Day 2 return. Each escalates the memory depth. |
| **If loses** | Test whether the memory reference is too subtle (player doesn't notice) or too obvious (feels like a tech demo). Adjust NPC delivery style. |

### Experiment Ranking

| # | Experiment | Stage | ICE | Expected Impact |
|---|-----------|-------|-----|----------------|
| 1 | "The Baker Remembers" First-Touch | Activation | 504 | 30% improvement in D1 retention |
| 2 | "Shareable NPC Moment" Screenshot Tool | Referral | 504 | K-factor >0.2 from shared clips |
| 3 | "First 10 Minutes" Activation Speedrun | Activation | 504 | 85% activation rate (from 60%) |
| 4 | "NPC Memory Showcase" Onboarding Proof | Activation | 441 | 40% improvement in "aha moment" rate |
| 5 | "Palia Refugee" Community Outreach | Acquisition | 392 | 3x conversion from targeted community |
| 6 | "Reddit Community Seeding" | Acquisition | 378 | >5% CTR, >30% play rate |
| 7 | "Browser Push Notification" D3 Recovery | Retention | 343 | 35% improvement in D3 return rate |
| 8 | "NPC Miss-You Letter" Re-Engagement | Retention | 336 | 25% improvement in D7 retention |
| 9 | "Dev Diary TikTok" Content Marketing | Acquisition | 336 | 10K+ views, 100+ new players |
| 10 | "Cozy Streamer Seeding" | Acquisition | 320 | 500+ new player visits |
| 11 | "NPC Gift Reaction" Monetization Loop | Revenue | 252 | 40% improvement in conversion |
| 12 | "Invite Friend to Homestead" | Referral | 240 | K-factor 0.3 |
| 13 | "NPC Gossip Network" Social Retention | Retention | 210 | 20% increase in session length |
| 14 | "Server Storyline of the Week" | Acquisition | 210 | 15% increase in weekly signups |
| 15 | "Seasonal FOMO" Retention Mechanic | Retention | 175 | 20% improvement in D30 retention |

---

## Growth Accounting

### Pre-Launch Projections (Based on Business Model Scenarios)

Since Nookstead is pre-revenue and pre-launch, growth accounting uses projected figures from the business model analysis. All figures are Tier 3 estimates.

| Metric | Pessimistic | Base Case | Optimistic |
|--------|------------|-----------|-----------|
| New MAU (Month 12) | 10,000 | 25,000 | 60,000 |
| Paying players (Month 12) | 200 | 1,000 | 3,600 |
| Monthly Revenue (Month 12) | $1,200 | $8,330 | $43,200 |
| Monthly LLM Costs (Month 12) | $300-600 | $800-1,600 | $2,400-6,000 |
| Monthly Gross Profit (Month 12) | $350-750 | $6,030-6,730 | $35,600-40,000 |

### Quick Ratio Projection (MAU-Based, Not MRR)

For a F2P game, Quick Ratio is adapted from revenue to MAU:

```
Quick Ratio (MAU) = New MAU / Churned MAU
```

| Scenario | New MAU/month | Churned MAU/month (at 70% monthly churn) | Quick Ratio | Health |
|----------|--------------|------------------------------------------|-------------|--------|
| Pessimistic | 1,500 | 7,000 | 0.21 | Shrinking |
| Base | 4,000 | 17,500 | 0.23 | Shrinking (needs retention fix) |
| Optimistic | 10,000 | 42,000 | 0.24 | Shrinking (needs retention fix) |

**Critical insight**: At F2P benchmark retention rates (70% monthly churn), the Quick Ratio is below 1.0 in ALL scenarios -- meaning the game is structurally shrinking without continuous acquisition. This is normal for F2P games (they depend on constant acquisition) but underscores why D30 retention improvement is the highest-leverage growth lever. Improving D30 from 8% to 15% reduces monthly churn from ~70% to ~55%, changing the Quick Ratio to:

| Scenario | New MAU/month | Churned MAU/month (at 55% monthly churn) | Quick Ratio | Health |
|----------|--------------|------------------------------------------|-------------|--------|
| Base (improved retention) | 4,000 | 13,750 | 0.29 | Still needs acquisition, but approaching stability |
| Optimistic (improved retention) | 10,000 | 33,000 | 0.30 | Growth with strong acquisition |

**So what?** F2P games structurally depend on continuous acquisition. But retention improvements have dramatically higher leverage than acquisition improvements. Moving D30 from 8% to 15% has the same impact on MAU as doubling acquisition volume -- but at zero cost. This validates the experiment prioritization: activation and retention experiments (ICE 175-504) should precede acquisition experiments.

**Now what?** Set up cohort-based retention tracking from Day 1 of any player testing. Track D1/D3/D7/D14/D30 retention by acquisition source and by NPC interaction depth. The correlation between "NPC conversations per session" and "retention" is the most important metric to establish early.

**Confidence**: Low -- all figures are projections based on F2P benchmarks, not Nookstead-specific data.

---

## 90-Day Growth Sprint Plan

**Context**: This plan is calibrated for a solo developer who is simultaneously building the game and executing growth experiments. Capacity constraint: ~50 hours/week total, with ~15 hours/week allocatable to growth experiments (30% of time). Each sprint has 1-2 primary growth experiments alongside ongoing development.

### Sprint 1 (Day 1-30): Validate Activation + Build Community Foundation

**Theme**: "Does the aha moment work?"

| Experiment | Target | Resource | Hours/week |
|-----------|--------|---------|------------|
| #1 "The Baker Remembers" First-Touch | >50% playtester return for session 3 | Prototype + 10-20 recruited testers | 8 hrs/week |
| #5 "First 10 Minutes" Speedrun | Activation rate >80% in playtest | NPC greeting system design | 4 hrs/week |
| #8 Reddit Community Seeding (start) | Discord: 200 members. 3 Reddit posts. | Personal community engagement | 3 hrs/week |

**Sprint 1 success criteria**:
- Phase 0 prototype playtest completed with 10-20 real cozy game players
- >50% of playtesters voluntarily return for session 3 AND cite NPC interactions as reason
- Discord community established with 200+ members
- LLM cost benchmark completed (24-hour simulated load, target: <$1.00/server/hour)

**Sprint 1 expected learning**: Whether the AI NPC "aha moment" actually works with real players. This is the go/no-go decision point for the entire growth strategy. If it fails, the strategy must be fundamentally rethought.

### Sprint 2 (Day 31-60): Validate Retention + Seed Viral Loop

**Theme**: "Do players come back, and do they share?"

*Contingent on Sprint 1 success (>50% playtester return rate)*

| Experiment | Target | Resource | Hours/week |
|-----------|--------|---------|------------|
| #15 "NPC Memory Showcase" 10-min Proof | >60% "aha moment" rate | NPC memory system refinement | 5 hrs/week |
| #3 "Shareable NPC Moment" Tool | Build screenshot capture + branding | Development: capture tool | 5 hrs/week |
| #13 Dev Diary TikTok (start) | 3 videos/week, 1K+ views on 1 video | Content creation (evenings) | 3 hrs/week |
| #6 Cozy Streamer Seeding (start) | Identify and contact 10 streamers | Outreach emails | 2 hrs/week |

**Sprint 2 success criteria**:
- 4-week retention cohort test launched (20-30 players)
- D7 retention >15% in cohort
- Screenshot sharing tool built and functional
- 3+ TikTok dev diary videos posted
- 5+ streamers contacted with prototype access

### Sprint 3 (Day 61-90): Scale Winners + Acquisition Push

**Theme**: "Turn validated mechanics into growth engines"

*Contingent on Sprint 2 success (D7 retention >15%, sharing tool functional)*

| Experiment | Target | Resource | Hours/week |
|-----------|--------|---------|------------|
| #14 "Palia Refugee" Community Outreach | 100+ players from Palia community | Community engagement | 3 hrs/week |
| #2 "NPC Miss-You Letter" Re-Engagement | D7 retention improvement >25% | Development: notification system | 5 hrs/week |
| #11 Browser Push Notification D3 Recovery | D3 return rate improvement >35% | Development: push notifications | 4 hrs/week |
| #10 Cozy Streamer Seeding (scale) | 3+ streamers creating content | Follow-up and support | 3 hrs/week |

**Sprint 3 success criteria**:
- D30 retention data available from Sprint 2 cohort (target: >5%)
- NPC re-engagement system (miss-you letters) live and measured
- 500+ new players from community/streamer channels
- Discord community at 500+ members
- Steam Coming Soon page live ($100 investment)

### 90-Day Cumulative Targets

| Metric | Target | Measurement Method |
|--------|--------|--------------------|
| Players who have experienced the game | 100-200 (playtest + early access) | Analytics tracking |
| Discord community members | 500+ | Discord server count |
| TikTok/social media impressions | 50K+ | Platform analytics |
| Streamers who created content | 3+ | Manual tracking |
| D7 retention (validated) | >15% | Cohort analytics |
| D30 retention (preliminary) | >5% | Cohort analytics |
| "Aha moment" rate | >60% | Playtest surveys + analytics |
| LLM cost per server hour (validated) | <$1.00 | API billing data |
| Key assumptions validated | 3+ of 7 | RAT validation log |

---

## Resource Requirements

| Resource | Need | Current | Gap |
|----------|------|---------|-----|
| **Development time** | ~35 hrs/week for game development | 50 hrs/week total capacity (solo dev) | 15 hrs/week available for growth experiments |
| **Growth experiment time** | ~15 hrs/week for experiments + community | 0 hrs/week currently allocated | Must carve from development time |
| **LLM API budget (testing)** | $150-300 for Phase 0 validation tests | $0 allocated | Budget needed for cost benchmark + retention cohort |
| **Steam listing** | $100 one-time (Steamworks fee) | Not started | Apply during Sprint 3 |
| **Community tools** | Discord server (free), TikTok account (free) | Not started | Create in Sprint 1 |
| **Screenshot/clip tools** | Built-in capture tool (2-4 weeks dev) | Not built | Develop in Sprint 2 |
| **Analytics platform** | Basic event tracking (Plausible/PostHog, free tier) | Not implemented | Implement in Sprint 1 |
| **Playtest recruitment** | 10-20 cozy gamers from Reddit/Discord | 0 recruited | Recruit in Sprint 1, Week 1 |

---

## Research Sources & Date Stamps

All data retrieved on 2026-03-22.

### Tier 1 (Primary / Confirmed)
- Palia Steam concurrent: ~7,769, down 57% from May 2025 peak ([Steam Charts, Mar 2026](https://steamcharts.com/app/2707930))
- Stardew Valley: 50M+ copies sold ([VGChartz, Feb 2026](https://www.vgchartz.com/article/467162/stardew-valley-sales-top-50-million-units/))

### Tier 2 (Industry Reports / Reliable Press)
- F2P retention benchmarks: D1 40%, D7 20%, D30 8-10% ([GameAnalytics 2025](https://www.gameanalytics.com/reports/2025-mobile-gaming-benchmarks))
- F2P conversion rate: 2-5% benchmark ([StudioKrew 2026](https://studiokrew.com/blog/mobile-game-monetization-models-2026/))
- DAU/MAU ratio: 20% good, 25%+ exceptional ([Klipfolio](https://www.klipfolio.com/resources/kpi-examples/saas/dau-mau-ratio))
- TikTok gaming content growing 45% YoY ([TechTimes 2025](https://www.techtimes.com/articles/313453/20251218/viral-gameplay-2026-why-live-gaming-clips-dominate-youtube-shorts-tiktok-feeds.htm))
- Indie game marketing: start 12-18 months before launch ([Game-Developers.org 2026](https://www.game-developers.org/2026-indie-game-production-marketing-guide))
- Short-form video: 7-14 clips/week target for indie devs ([Game-Developers.org 2026](https://www.game-developers.org/roadmap-to-an-effective-indie-game-marketing-strategy-in-2026))
- Discord: 656M registered users, essential for indie game marketing ([MarketingAgent Blog 2026](https://marketingagent.blog/2026/01/10/the-complete-discord-marketing-strategy-for-2026-from-gaming-hangout-to-community-first-revenue-engine/))
- K-factor >1.0 = viral growth, 0.3-0.5 = healthy organic ([K-Factor Benchmarks, Saxifrage](https://www.saxifrage.xyz/post/k-factor-benchmarks))
- Character.AI: 20M MAU, $32.2M revenue 2024, revenue declining ([DemandSage](https://www.demandsage.com/character-ai-statistics/))
- 85% of gamers negative toward AI in games ([Whimsy Games 2026](https://whimsygames.co/blog/how-ai-disrupts-the-video-game-industry/))
- Inworld AI: $125.7M funding, 12-24 month middleware commoditization window ([Intel Capital](https://www.intelcapital.com/the-future-of-gaming-inworld-ais-ai-driven-npcs-and-immersive-experiences/))

### Tier 3 (Estimates / Inference)
- All Nookstead-specific metrics (activation rate, retention targets, K-factor projections) -- pre-launch estimates based on F2P benchmarks, not game-specific data
- Growth accounting Quick Ratio projections -- modeled from benchmark churn rates
- Experiment impact estimates -- based on analogous F2P experiments, not Nookstead A/B tests
