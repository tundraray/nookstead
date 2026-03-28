# Feature: Emergent Story Framework

**ID**: F-003
**Date**: 2026-03-22
**Priority**: Next
**Kano Category**: Performance
**WSJF Score**: CoD 47 / Duration 3 = 15.7
**Appetite**: L (4-6 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 6: "Experience emergent stories unique to my server" | The differentiation proof -- stories nobody scripted |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist"; Segment 3: "Emergent AI Explorer" | Seg 1 needs fresh content; Seg 3 needs shareable AI moments |
| Problem | jobs-graph.md -> Job 6, Problem 1: "AI-generated stories feeling shallow", Severity 9/10 | The hardest technical challenge in AI gaming |
| Risk | rat.md -> Risk 2: "AI Content Retention Cliff", P4xI5=20 | Content freshness determines retention |
| Strategy | strategy-canvas.md -> CREATE: Per-Server Emergent Narratives | New factor no competitor offers |
| Initiative | prioritized-initiatives.md -> #19 (ICE=200) | Emergent Story Framework |
| Opportunity | opportunity-map.md -> Opportunity 2.1, 2.2 | Shallow stories, NPC-NPC interactions |

## Problem

**Job context**: "When a player is in week 2+ of active play and the initial novelty of AI dialogue has normalized (Job 6), they need STORIES -- not just conversations. Something unexpected must happen: an NPC who was friendly suddenly seems cold, two NPCs are in conflict, the baker organizes an unscripted celebration. Without emergent stories, Nookstead offers nothing that Stardew + a chatbot mod cannot replicate (severity 9/10)."

**Current workaround**: No game delivers true emergent narrative from autonomous AI agents. Players accept scripted event systems.
**Cost of inaction**: Nookstead becomes "interesting tech demo, not a game." Content freshness drops to zero, following Palia's churn trajectory.

## Appetite

**Size**: L (4-6 weeks)
**Duration**: 6 weeks
**Rationale**: This is the most complex and unproven feature. No game has demonstrated this at scale. The appetite reflects the difficulty, but the scope must be constrained to what one developer can build in 6 weeks.

## Solution

A "Story Director" system that orchestrates emergent narratives by giving NPCs goals, facilitating NPC-NPC interactions, and channeling autonomous behavior through story arc templates.

**Key elements**:

1. **NPC Daily Planning**: Each morning (game time), every NPC generates a daily plan through an LLM call: "Today I want to [goal] because [motivation based on recent events and personality]." Plans create NPC movement, activities, and conversation topics that feel purposeful rather than random.

2. **NPC Social Graph**: A relationship matrix tracking how each NPC feels about every other NPC and each player. Updated daily through batch reflection. Stores: sentiment score (-10 to +10), relationship type (friend, rival, neutral, romantic interest), and last significant interaction summary.

3. **Story Arc Templates**: Pre-defined narrative structures (tension -> development -> climax -> resolution) that the Story Director can activate when conditions align. Example templates: "NPC Feud" (two NPCs with declining sentiment trigger escalating disagreements), "Festival Planning" (NPC with high community spirit organizes an event), "New Hobby" (NPC explores a new interest based on player interactions). Templates ensure coherence -- the AI fills the content, not the structure.

4. **Story Director**: A server-level system that monitors NPC state and triggers story arcs when conditions are met. Rules: max 1-2 active arcs per server per week (prevents narrative inflation), arcs must stay within cozy genre tone (no NPC deaths, no grimdark, no irreversible negative outcomes), and arcs must involve at least one player-connected NPC (personal relevance).

5. **NPC-NPC Spontaneous Conversations**: 5-10 visible NPC-NPC conversations per game day. Players can overhear these as they walk through town. Content reflects NPC relationships, current story arcs, and reactions to recent player actions ("Did you see that new player's farm? Impressive for a newcomer.").

## Rabbit Holes

1. **Narrative coherence at scale** -- 50 NPCs with autonomous goals creating contradictory or nonsensical narratives. Mitigation: Story Director limits active arcs and enforces consistency rules. Only 2-3 NPCs per arc.
2. **LLM cost explosion from NPC-NPC interactions** -- 50 NPCs doing autonomous planning and spontaneous chats. Mitigation: Daily plans are batch-processed once per game day (50 calls). Spontaneous chats use GPT-5 nano (cheapest tier). Budget: $0.10-0.30/server/hour for ambient NPC behavior.
3. **Tone violations** -- LLM generates a story that breaks the cozy genre contract. Mitigation: All story arc templates include tone guardrails. Content filter on NPC dialogue catches dark themes.

## No-Gos

- **Player-directed story creation**: Players cannot instruct NPCs to start specific storylines. Why: Emergent means unscripted -- player direction defeats the purpose.
- **Permanent negative consequences**: No NPC leaves town permanently, no relationships are permanently destroyed. Why: Cozy genre contract.
- **More than 2 active story arcs simultaneously**: Why: Narrative inflation makes nothing feel special.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Emergent events per 10 hours of play | N/A | >1 event described as "surprising and interesting" | Player survey + event logging |
| NPC moment clips shared (referral proxy) | N/A | >5 per 100 DAU | Sharing tool analytics |
| Per-server narrative divergence | N/A | Noticeable story differences between servers after 30 days | Manual comparison of 3 server logs |
| Story quality rating | N/A | >6/10 average (blind comparison vs. Stardew events) | 3 independent reviewers |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given two NPCs have declining sentiment scores, When their sentiment drops below -5, Then the Story Director activates a "Feud" arc with visible NPC disagreements over 3 game days |
| 2 | Given a story arc is active, When it reaches the resolution phase, Then the outcome reflects player intervention (if they participated) or NPC autonomy (if they did not) |
| 3 | Given a server has been running for 14 days, When emergent events are counted, Then at least 2 distinct emergent events have occurred that were not scripted |
| 4 | Given an NPC-NPC spontaneous conversation occurs, When a player walks within earshot, Then the conversation is displayed in speech bubbles and references current NPC relationships or story arcs |
| 5 | Given the Story Director monitors for arc triggers, When a potential arc violates cozy genre tone, Then the arc is blocked and an alternative template is selected |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 17 | The differentiation proof. Without this, Nookstead is "AI dialogue engine, not a living world." Creates the viral shareable moments that drive acquisition. |
| Time Criticality | 15 | Needed before launch for content freshness, but can launch with basic version and iterate. |
| Risk Reduction | 15 | Validates whether AI-generated stories are compelling enough to share -- the core viral loop. |
| **Cost of Delay** | **47** | |
| Job Duration | 3 | L appetite: 4-6 weeks. Story Director, NPC social graph, arc templates, and spontaneous conversation system. |
| **WSJF** | **15.7** | |
