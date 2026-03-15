# ADR-0017: NPC AI Tools and Mood System

## Status

Accepted

## Context

The current NPC dialogue system (design-024) applies a fixed +2 relationship score delta (`SCORE_DELTAS.normalDialogue`) at dialogue end, regardless of conversation content. This means a player who insults the NPC gets the same relationship boost as one who is kind. Additionally, NPCs have no way to autonomously react to player behavior during dialogue -- they cannot create memories, end conversations, or express emotions without player-initiated actions.

The AI SDK v6 (`ai@^6.0.105`) supports a `tools` parameter on `streamText()` that allows the LLM to invoke server-side functions during text generation. This enables NPCs to autonomously make decisions about relationship changes, memory creation, emotional expression, and conversation termination based on dialogue content.

Additionally, NPCs currently lack persistent emotional state (mood) and the ability to impose behavioral consequences on players (status effects like ignoring a rude player). These features are needed to make NPCs feel like living characters rather than stateless chat interfaces.

### Key Constraints

- AI SDK `tool()` helper requires Zod schemas for input validation -- Zod is not currently a project dependency
- Tool `execute` functions run server-side and need DB access via closure
- The existing `streamText()` call in `DialogueService` processes only `textStream` chunks
- NPC prompts are entirely in Russian; tool usage instructions must be in Russian
- Score is clamped to [-50, 100] by the existing DB service
- OpenAI `gpt-4o-mini` supports function calling

## Decision

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Use AI SDK `tool()` with Zod schemas to give NPCs four autonomous capabilities (adjust_relationship, create_memory, end_conversation, express_emotion), add NPC mood as persistent DB state, and add status effects for player consequences |
| **Why now** | The relationship system (design-024) is implemented; fixed scoring produces unrealistic behavior that undermines the NPC personality system |
| **Why this** | AI SDK tool calling is the native, type-safe mechanism for LLM-to-server communication; alternatives require custom parsing of unstructured text or a separate evaluation pass |
| **Known unknowns** | LLM reliability in using tools appropriately vs over-using them; token budget impact of tool definitions in the system prompt; mood decay rate tuning |
| **Kill criteria** | If tool calls add > 500ms latency to median dialogue turn time, or if the LLM makes score adjustments on > 80% of turns (should be occasional, not every turn) |

## Rationale

### Options Considered

#### 1. Post-hoc Sentiment Analysis (Separate LLM call)
- **Overview**: After each dialogue turn, run a separate `generateText()` call analyzing the conversation for sentiment and deriving a score delta
- Pros:
  - No changes to `streamText()` flow
  - Independent from dialogue generation
  - Can use a cheaper model for analysis
- Cons:
  - Doubles LLM API calls per turn (2x cost, 2x latency)
  - Sentiment analysis is disconnected from the NPC's "lived experience" -- the NPC did not decide the score change
  - Cannot handle real-time actions (end conversation, express emotion) because analysis happens after the turn
  - No Zod schema benefit -- would need custom JSON parsing

#### 2. Structured Output Parsing (Custom Format in NPC Response)
- **Overview**: Instruct the NPC to include structured metadata in its response (e.g., `[SCORE:+2]` or JSON block), then parse it server-side
- Pros:
  - No new dependencies (no Zod)
  - Works with any LLM that follows instructions
  - Lower token overhead than tool definitions
- Cons:
  - Fragile parsing -- LLMs produce inconsistent format compliance, especially with creative text
  - Metadata leaks into the visible response text (players see `[SCORE:+2]`)
  - No input validation -- invalid values crash or produce silent bugs
  - Cannot trigger server-side actions mid-stream (only after full response)
  - Contradicts AI SDK design philosophy; fights the framework instead of using it

#### 3. AI SDK `tool()` with Zod Schemas (Selected)
- **Overview**: Define tools using AI SDK's `tool()` helper with Zod input schemas; pass them to `streamText()` so the LLM can invoke server-side functions during generation
- Pros:
  - Native AI SDK pattern -- type-safe, validated inputs, documented API
  - Tool execution happens mid-stream with full server context (DB access via closure)
  - Clean separation: text generation is text, actions are tool calls
  - Zod schemas provide runtime validation preventing invalid deltas/states
  - Future extensibility: adding new tools is declarative
  - Works with `onChunk` callbacks for real-time processing
- Cons:
  - Adds Zod as a new dependency (~57KB)
  - Tool definitions increase system prompt token count (~200 tokens)
  - Requires Zod schema + tool definition boilerplate per tool
  - Requires careful prompt engineering to prevent tool overuse

### Comparison

| Evaluation Axis | Option 1: Post-hoc Analysis | Option 2: Structured Output | Option 3: AI SDK Tools (Selected) |
|-----------------|---------------------------|---------------------------|----------------------------------|
| Implementation Effort | 2 days | 3 days | 3 days |
| LLM Cost/Turn | 2x (double calls) | 1x | 1x (tools are part of same call) |
| Latency Impact | +300-500ms per turn | Minimal | Minimal (inline with stream) |
| Input Validation | Manual | Manual/None | Automatic (Zod) |
| Mid-stream Actions | No | No | Yes |
| Type Safety | Low | Low | High |
| Framework Alignment | Neutral | Against AI SDK patterns | Native AI SDK pattern |
| Extensibility | Moderate | Low | High |
| Reliability | High (separate call) | Low (parsing fragility) | High (validated schemas) |

## Consequences

### Positive Consequences

- NPCs make autonomous, context-aware decisions about relationship changes during dialogue
- Relationship scoring reflects actual conversation quality (kind words = small gain, insults = larger penalty)
- NPCs can create memories about significant moments without waiting for dialogue end
- NPCs can end conversations naturally when offended, creating consequence for player behavior
- NPC mood creates cross-player effects: one rude player affects the NPC's demeanor for everyone
- Status effects (ignore) add meaningful consequences for repeated negative behavior
- Tool pattern is extensible for future NPC capabilities (quest giving, trading, etc.)

### Negative Consequences

- New dependency (Zod) added to the server package
- System prompt grows by ~200 tokens for tool instructions
- Tool execution adds DB write operations mid-stream (mitigated by fire-and-forget pattern)
- Requires careful prompt engineering to tune tool call frequency
- NPC mood introduces a new DB table/columns that must be maintained
- Status effects add a pre-dialogue check that slightly increases interaction start latency

### Neutral Consequences

- The fixed `normalDialogue: 2` delta is removed; all scoring is AI-driven
- New server messages (`DIALOGUE_SCORE_CHANGE`, `DIALOGUE_EMOTION`) added to the protocol
- Client must handle new message types (can be implemented incrementally)

## Implementation Guidance

- Use dependency injection for tool execution contexts: tools receive DB client and session state via closure, not global imports
- Tool `execute` functions must be non-throwing: catch all errors, log with context, return error results to the LLM so it can recover gracefully
- NPC mood should decay toward neutral over time using a configurable half-life, computed on read (lazy decay) rather than via scheduled jobs
- Status effects should be checked at interaction start (`handleNpcInteract`) with an efficient indexed query
- Tool usage instructions in the system prompt must be in Russian, consistent with existing prompt language
- Asymmetric score range (-7..+3 per call) should be enforced both in the Zod schema (min/max) and in the DB service (existing clamp)
- The `normalDialogue` delta constant should be removed, not zeroed, to prevent accidental double-scoring

## Related Information

- [ADR-0014: AI Dialogue OpenAI SDK](./ADR-0014-ai-dialogue-openai-sdk.md) -- Established `streamText()` pattern
- [ADR-0015: NPC Prompt Architecture](./ADR-0015-npc-prompt-architecture.md) -- SystemPromptBuilder section pattern
- [design-024: NPC Relationships & Dialogue Actions](../design/design-024-npc-relationships-dialogue-actions.md) -- Current relationship system
- [AI SDK Foundations: Tools](https://ai-sdk.dev/docs/foundations/tools) -- Tool definition API
- [AI SDK Core: streamText](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) -- streamText reference
- [AI SDK Core: Tool Calling](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling) -- Tool calling patterns
