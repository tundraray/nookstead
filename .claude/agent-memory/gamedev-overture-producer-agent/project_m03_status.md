---
name: M0.3 Status and Implementation State (March 14, 2026)
description: Current implementation state of Nookstead at start of M0.3 milestone, including what's built, what's missing, and critical path analysis
type: project
---

## M0.3 Status as of March 14, 2026

**Phase:** 0 (Prototype), Milestone M0.3 "NPC Talks" starting today
**M0.1 and M0.2:** DONE

### What's Already Built (ahead of M0.3 schedule)
- F-001 Seed Persona: Full persona fields in npcBots table + AI generation
- F-002 Dialogue API: DialogueService with OpenAI GPT-4o-mini via Vercel AI SDK
- F-131 Dialogue Window: ChatModal.tsx with streaming, history, typing indicator
- SystemPromptBuilder: Modular architecture (identity, world, relationship, memory stub, guardrails, format)

### Critical Missing Pieces
- No `memories` table in DB -- buildMemorySection() returns hardcoded stub "(Пока нет воспоминаний)"
- No importance scoring, no memory retrieval, no reflections
- No moderation (F-004)
- No quick replies (F-003)
- No GameClock (F-035) -- blocks M0.4
- No A* pathfinding -- NPC use random wander
- SDK mismatch: using OpenAI GPT-4o-mini but strategy docs target Anthropic Claude

**Why:** This shapes all near-term planning and identifies critical path.
**How to apply:** Memory system is the #1 priority; GameClock should run parallel.
