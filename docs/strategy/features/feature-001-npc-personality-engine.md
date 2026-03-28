# Feature: NPC Personality & Dialogue Engine

**ID**: F-001
**Date**: 2026-03-22
**Priority**: Now
**Kano Category**: Must-Be
**WSJF Score**: CoD 58 / Duration 3 = 19.3
**Appetite**: L (4-6 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 3: "Have my first meaningful NPC interaction" | The critical "aha moment" where AI NPCs prove their worth |
| Segment | segments.md -> Segment 1: "Content-Exhausted Cozy Escapist" (48% SAM) | Primary audience whose #1 unmet need is NPCs that feel alive |
| Problem | jobs-graph.md -> Job 3, Problem 1: "AI response quality inconsistency", Severity 9/10 | Some responses charming, others generic/robotic/off-character |
| Risk | rat.md -> Risk 1: "AI NPC Engagement Gap", P4xI5=20 | Entire USP collapses if NPCs feel like chatbots |
| Strategy | strategy-canvas.md -> RAISE: NPC Intelligence & Memory (2->5) | The primary Blue Ocean differentiation factor |
| Initiative | prioritized-initiatives.md -> #1 (ICE=810), #3 (ICE=504), #16 (ICE=240) | AI NPC playtest, activation design, personality engine |
| Opportunity | opportunity-map.md -> Opportunity 1.1, 1.2, 1.4 | NPC quality, uncanny valley, personality drift |

## Problem

**Job context**: "When a player approaches an NPC for their first conversation (Job 3), they expect a response that feels authored, reveals the NPC's personality, and acknowledges something specific about the player -- but AI response quality is inconsistent (severity 9/10), with some responses charming and others generic or robotic, and 85% of gamers hold negative attitudes toward AI in games."

The first NPC interaction is the make-or-break moment. Players arrive with high expectations set by the recommendation or clip that brought them. They subconsciously compare the NPC to their favorite Stardew Valley or Animal Crossing character. If the NPC says something that feels like ChatGPT rather than a character, the illusion is permanently broken. 85% of gamers already have negative attitudes toward AI in games -- the NPC must pass as a character, not a technology demonstration.

**Current workaround**: Players accept scripted NPCs with hand-written dialogue that repeats after 40 hours. No current cozy game offers AI NPCs.
**Cost of inaction**: The entire product has no reason to exist. Without compelling AI NPCs, Nookstead is a content-thin version of Stardew Valley.

## Appetite

**Size**: L (4-6 weeks)
**Duration**: 6 weeks maximum
**Rationale**: This is the existential feature -- the product IS this system. The 12-24 month exclusivity window demands rapid execution. If it cannot be solved in 6 weeks, the approach needs fundamental rethinking, not more time.

## Solution

The NPC Personality Engine is the system that transforms raw LLM output into character-consistent, contextually aware, emotionally textured dialogue that feels authored rather than generated.

**Key elements**:

1. **Seed Persona Profiles**: Each NPC has a JSON personality definition including: name, role, personality traits (Big Five), speech patterns (vocabulary, sentence length, verbal tics), backstory, relationships, opinions on topics, emotional baseline, and 20+ example responses calibrated to the character's voice.

2. **Character Voice Calibration**: The system prompt for each NPC includes the seed persona plus example responses showing how THIS character speaks in different situations (greeting a stranger, talking about their work, reacting to a gift, discussing town gossip). The LLM is instructed to match tone, vocabulary, and personality -- not just content.

3. **Response Quality Classifier**: Before displaying an NPC response, a lightweight quality check scores it on: (a) character consistency (does this sound like this NPC?), (b) context relevance (does it acknowledge the current situation?), (c) emotional appropriateness (does the tone match the NPC's current mood?). Responses below threshold are regenerated. Target: <200ms additional latency.

4. **Character Framing (Anti-Chatbot Design)**: NPCs speak through pixel art speech bubbles (not a chat input box). NPCs initiate conversations (they approach the player, not just respond). Responses include personality-appropriate pauses, filler words, and emotional markers ("*adjusts glasses*", "*sighs happily*"). No chat UI elements (no text cursor, no typing indicator, no "send" button).

5. **Multi-Model Routing**: Routine NPC behavior (ambient dialogue, daily plans) uses GPT-5 nano ($0.05/$0.40 per 1M tokens). Player-initiated conversations use Claude Haiku ($0.25/$1.25 per 1M tokens). Significant story moments (confessions, conflicts, celebrations) use Claude Sonnet ($3/$15 per 1M tokens). Router selects model based on interaction type and NPC relationship depth.

6. **Adversarial Input Guardrails**: When players test boundaries (offensive input, attempts to break character), the NPC stays in character with an in-world response ("I don't appreciate that kind of talk. Perhaps we should talk about something else." -- spoken as the CHARACTER, not as a system message). NPCs can become cold or walk away if repeatedly tested.

## Rabbit Holes

1. **Prompt engineering perfectionism** -- Spending weeks tuning prompts for diminishing returns. Mitigation: Set a quality floor (70% playtester approval), not a ceiling. Ship at floor and iterate.
2. **Response latency at scale** -- Quality classifier adds latency on top of LLM API response time. Mitigation: Classifier must run in <200ms. Use streaming responses to show the NPC "thinking" with pixel art animation while waiting.
3. **LLM API rate limits during peak usage** -- 100 concurrent players each talking to NPCs could overwhelm API quotas. Mitigation: Request queue with graceful degradation (NPC says "Hmm, let me think about that..." while waiting). Batch non-urgent NPC operations.
4. **Context window management** -- As conversation history grows, prompt size increases cost and latency. Mitigation: Use RAG-based memory retrieval (F-002) to inject only the 10 most relevant memories per conversation, not full history.

## No-Gos

- **Voice synthesis or audio**: NPCs communicate through text speech bubbles only. Audio is out of scope for MVP. Why: Audio synthesis adds latency, cost, and quality risk without proven player demand.
- **Player-to-NPC free-text input**: Players interact through pre-composed response options or simple text input -- NOT a full chat interface. Why: Full chat input creates the "chatbot" perception that the anti-uncanny-valley design must avoid.
- **Real-time NPC emotion animation**: NPCs do not have dynamic facial expressions or body language. Emotion is conveyed through text markers and speech bubble styling. Why: Pixel art animation at this scale exceeds solo dev capacity.
- **NPC-to-NPC real-time conversations visible to players**: Ambient NPC-NPC dialogue is handled by F-003 (Emergent Story Framework), not this feature. Why: Scope control.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| WAP3 (Weekly Active Players with 3+ NPC Conversations) | N/A | 5,000 (90 days post-launch) | Server analytics |
| Playtester NPC quality approval | N/A | >70% rate as "better than scripted NPCs" | Prototype playtest survey |
| NPC response latency (p95) | N/A | <3 seconds including quality check | Server-side timing |
| "Chatbot" perception rate | N/A | <20% use "AI/chatbot" unprompted in interviews | Post-playtest qualitative interview |
| NPC dialogues per session | N/A | >3 | Session analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a new player enters town for the first time, When they approach the first NPC, Then the NPC greets them by name, comments on the time of day, and reveals a personality trait within the first response -- delivered in <3 seconds |
| 2 | Given a player sends adversarial input to an NPC, When the NPC detects off-topic or offensive content, Then the NPC responds in character (not with a system message) and may reduce relationship warmth |
| 3 | Given the same NPC is spoken to 50 times over 7 days, When personality consistency is scored, Then the NPC maintains >80% consistency with its seed persona profile |
| 4 | Given a player initiates dialogue, When the quality classifier scores the response below threshold, Then the response is regenerated within 500ms without the player seeing the rejected response |
| 5 | Given 20 concurrent players on one server, When all are in dialogue with NPCs simultaneously, Then no player experiences response latency >5 seconds (p99) |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 20 | The entire product IS this feature. Without compelling NPC dialogue, there is no USP, no switching cost, no viral moment engine. |
| Time Criticality | 18 | 12-24 month exclusivity window before Inworld AI enables competitors. Every week of delay reduces the competitive moat. |
| Risk Reduction | 20 | Validates RAT Risk 1 (P4xI5=20) -- the single highest-risk assumption in the business. |
| **Cost of Delay** | **58** | |
| Job Duration | 3 | L appetite: 4-6 weeks for a solo developer. Includes prompt engineering, quality classifier, model routing, and character framing. |
| **WSJF** | **19.3** | |
