# Feature: NPC Memory & Relationship System

**ID**: F-002
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 52 / Duration 3 = 17.3
**Appetite**: L (4-5 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 5: "Develop relationships with NPCs over time" | The primary retention driver -- NPC relationships must deepen meaningfully |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist"; Segment 2: "Story-Starved Narrative Discoverer" | Both high-priority segments care most about NPC relationship depth |
| Problem | jobs-graph.md -> Job 5, Problem 1: "Memory coherence over long periods", Severity 8/10 | LLMs may hallucinate or contradict past conversations |
| Risk | rat.md -> Risk 2: "AI Content Retention Cliff", P4xI5=20 | AI content may not sustain D30 retention above 8% |
| Strategy | strategy-canvas.md -> CREATE: NPC Relationship Memory as Switching Cost | The only switching cost in a genre with zero switching costs |
| Initiative | prioritized-initiatives.md -> #7 (ICE=360), #21 (ICE=180) | Retention cohort test, RAG memory system |
| Opportunity | opportunity-map.md -> Opportunity 1.3, 1.4 | Memory coherence, personality drift |

## Problem

**Job context**: "When a player returns on day 2, 3, 5, 7+ and seeks out a specific NPC to continue a conversation (Job 5), they want the NPC to accurately reference past conversations, evolve their attitude based on shared history, and reveal new personality facets as trust grows -- but LLMs may hallucinate or contradict past conversations when memory context grows large (severity 8/10)."

Retention depends entirely on NPC relationships feeling real. If the baker who said she was worried about the harvest festival on Tuesday acts like she never mentioned it on Thursday, the illusion shatters. Character.AI users report personality inconsistency as a primary frustration -- Nookstead cannot repeat this failure.

**Current workaround**: No current cozy game has NPC memory. Players accept that NPCs reset each day.
**Cost of inaction**: Retention cliff -- players churn at D7-D14 when NPC novelty fades and relationships feel static.

## Appetite

**Size**: L (4-5 weeks)
**Duration**: 5 weeks maximum
**Rationale**: The memory system is the second most critical feature after the personality engine. It transforms single interactions into sustained relationships. The switching cost moat grows linearly with play time.

## Solution

A RAG-based persistent memory system that stores, retrieves, and surfaces contextually relevant memories during NPC conversations.

**Key elements**:

1. **Memory Stream**: Chronological log of all significant events per NPC-player pair. Each memory entry includes: timestamp, event type (conversation, gift, action observed), content summary (50-100 tokens), importance score (1-10, assigned by LLM at creation), emotional valence (positive/neutral/negative), and embedding vector for semantic search.

2. **Importance Scoring**: When an event occurs, a lightweight LLM call scores its importance (1-10). High-importance events: first meeting (8), gifts (7), personal revelations (9), conflicts (9), milestone celebrations (8). Low-importance: routine greetings (2), weather comments (1), repeated interactions (3). Only events scoring >4 are persisted long-term.

3. **Memory Retrieval (RAG)**: When generating a response, the system retrieves the top 10 most relevant memories using a weighted combination of: recency (exponential decay), importance (linear weight), and semantic similarity (cosine similarity to current conversation context). These memories are injected into the NPC's prompt as "things you remember about this player."

4. **Relationship Tiers**: Player-NPC relationships progress through tiers: Stranger -> Acquaintance -> Friend -> Close Friend -> Confidant. Each tier unlocks new NPC behaviors: Acquaintance (NPC uses player's name), Friend (NPC shares personal opinions), Close Friend (NPC reveals backstory), Confidant (NPC seeks player's advice, shares secrets). Tier progression is based on: interaction frequency, gift-giving, quest completion, and time invested.

5. **Ground Truth Validation**: A structured "fact sheet" per NPC-player pair stores key deterministic facts (first meeting date, gifts given, significant events). Before displaying a memory reference, the system cross-checks against the fact sheet to prevent hallucination of events that never happened.

6. **NPC Daily Reflection**: Each NPC runs a daily batch LLM call that summarizes their most significant interactions of the day, updating their internal state (mood, opinions, relationship scores). This creates the "NPCs have lives between your visits" feeling.

## Rabbit Holes

1. **Embedding storage at scale** -- Storing vector embeddings for every NPC-player memory pair across 50 NPCs and hundreds of players. Mitigation: Use PostgreSQL with pgvector extension. Prune memories below importance 3 after 30 days. Cap at 500 memories per NPC-player pair.
2. **Memory retrieval latency** -- RAG retrieval adding 500ms+ to response time. Mitigation: Pre-compute top memories when player logs in. Cache recent memories in Redis. Target: <100ms retrieval.
3. **Hallucination despite guardrails** -- LLM referencing a memory that is semantically similar but factually wrong. Mitigation: Fact sheet validation layer catches contradictions. If uncertain, NPC uses vague phrasing ("I seem to recall..." rather than "You told me...").

## No-Gos

- **Full conversation transcript storage**: Store summaries and key facts, not verbatim transcripts. Why: Storage cost and privacy. Summaries are sufficient for memory-informed responses.
- **Player-visible memory log**: Players cannot see what an NPC "remembers" about them. Why: Breaks immersion. The magic is in the NPC surfacing memories naturally, not in a database view.
- **Cross-NPC memory sharing**: NPCs do not automatically share memories with other NPCs. Why: Handled by F-003 (Emergent Story Framework) NPC gossip system.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Memory accuracy at D14 | N/A | >80% of significant interactions recalled correctly | Retention cohort memory audit |
| D7 retention | N/A | >20% (F2P benchmark) | Cohort analytics |
| D30 retention | N/A | >8% (F2P benchmark) | Cohort analytics |
| NPC interaction frequency decay | N/A | <30% decline week-over-week | Session analytics |
| Relationship tier progression rate | N/A | 50% of D7 retained players reach "Friend" tier with at least 1 NPC | Server analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a player gave a gift to an NPC 3 days ago, When the player talks to that NPC today, Then the NPC references the specific gift naturally in conversation (not forced) |
| 2 | Given an NPC's fact sheet records 10 key events with a player, When the LLM generates a response referencing past events, Then 0 of those references contradict the fact sheet |
| 3 | Given a player has interacted with an NPC 15 times over 2 weeks, When the relationship tier is calculated, Then the player has progressed from Stranger to at least Acquaintance |
| 4 | Given the memory retrieval system receives a query, When it searches the memory stream, Then it returns the top 10 results in <100ms |
| 5 | Given an NPC runs daily reflection at end of game day, When it summarizes the day's interactions, Then the summary is stored and influences the NPC's mood and behavior the following day |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 18 | NPC memory is what creates the "they remember me!" moment that converts skeptics into evangelists. Also creates the only switching cost in the genre. |
| Time Criticality | 16 | Must be validated in Phase 0 to determine whether the retention hypothesis holds. Delays retention testing. |
| Risk Reduction | 18 | Validates RAT Risk 2 (P4xI5=20) -- whether AI content sustains engagement past the novelty period. |
| **Cost of Delay** | **52** | |
| Job Duration | 3 | L appetite: 4-5 weeks including RAG pipeline, importance scoring, fact sheet validation, and daily reflection system. |
| **WSJF** | **17.3** | |
