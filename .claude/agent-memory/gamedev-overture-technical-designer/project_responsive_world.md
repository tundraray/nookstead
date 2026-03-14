---
name: Responsive World Design Doc (Design-012)
description: NPC Responsive World architecture - 4 new subsystems for Action Awareness, Gossip, Organic Quests, and NPC Initiative
type: project
---

Design-012 (NPC Responsive World) created on 2026-03-14.

**Why:** Strategic pivot from "dialogue-only NPC" to "NPCs that notice and react to everything players do." This is the core USP differentiator for Nookstead.

**How to apply:**
- Design doc at `docs/design/design-012-npc-responsive-world.md` (2900+ lines)
- 4 new subsystems: ActionAwarenessService, GossipService, OrganicQuestGenerator, NPCInitiativeService
- Key design decisions: 90%+ observations use templates (zero LLM cost), gossip max 2 hops, quests from reflections
- Cost constraint: new systems < 5% of total LLM costs (verified: ~4.7% at 15K DAU)
- Current NPC codebase uses Vercel AI SDK (not Anthropic SDK directly) and gpt-4o-mini model
- SystemPromptBuilder has modular section-based architecture — easy to extend
- BotManager is deliberately decoupled from Colyseus
- Implementation: 5 phases over weeks 6-11, vertical slice approach
