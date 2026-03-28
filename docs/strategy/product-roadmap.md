# Product Roadmap: Nookstead

**Date**: 2026-03-22
**Analyst**: Product Planner Agent
**Total Features**: 15
**MVP Features**: 8 Must-Haves + 1 Should-Have prioritized into Now
**Confidence**: Medium -- Feature definitions grounded in 15 validated strategy documents. Timelines are solo developer estimates with built-in uncertainty. All features are pre-validation.

## Build the AI NPC core first (60% of effort), layer game mechanics second (20%), and defer monetization and social expansion until validation gates pass -- aligned with the 14-month development timeline and 12-24 month exclusivity window

---

## Now (Phase 0-1: Prototype + Vertical Slice, Weeks 1-24) -- Committed

The AI NPC system and minimum viable game loop. Everything needed to validate the core hypothesis and deliver the "aha moment."

| # | Feature | Spec | Kano | WSJF | Appetite | Segment | Phase |
|---|---------|------|------|------|----------|---------|-------|
| 1 | NPC Personality & Dialogue Engine | [feature-001-npc-personality-engine.md](features/feature-001-npc-personality-engine.md) | Must-Be | 19.3 | L (6 wk) | Seg 1, 2, 3 | P0 |
| 2 | NPC Memory & Relationship System | [feature-002-npc-memory-system.md](features/feature-002-npc-memory-system.md) | Must-Be | 17.3 | L (5 wk) | Seg 1, 2 | P0-P1 |
| 3 | Browser Instant-Play & Onboarding | [feature-004-browser-instant-play.md](features/feature-004-browser-instant-play.md) | Must-Be | 19.5 | M (3 wk) | All | P0 |
| 4 | Clip Moment Capture & Sharing | [feature-012-clip-moment-sharing.md](features/feature-012-clip-moment-sharing.md) | Attractive | 36.0 | S (2 wk) | Seg 3 | P0 |
| 5 | NPC Interaction Cap | [feature-011-interaction-cap.md](features/feature-011-interaction-cap.md) | Must-Be | 34.0 | S (1 wk) | All | P0 |
| 6 | Low-Pop Server Resilience | [feature-015-low-pop-resilience.md](features/feature-015-low-pop-resilience.md) | Must-Be | 34.0 | S (2 wk) | All | P1 |
| 7 | Farming & Seasonal Crop System | [feature-005-farming-system.md](features/feature-005-farming-system.md) | Must-Be | 10.7 | L (5 wk) | Seg 1 | P1 |
| 8 | Homestead Building & Customization | [feature-006-homestead-building.md](features/feature-006-homestead-building.md) | Must-Be | 9.0 | L (5 wk) | Seg 1, 4 | P1 |
| 9 | Multiplayer & Social Features | [feature-009-multiplayer-social.md](features/feature-009-multiplayer-social.md) | Must-Be | 9.3 | L (5 wk) | Seg 4 | P1 |

**Phase goal**: A playable browser game where 10-20 players can farm, build homesteads, and talk to 10-15 AI NPCs that remember them -- sufficient for prototype validation and the 3-gate validation sequence.

**Dependencies**:
- F-001 (NPC Personality) must be functional before F-002 (Memory), F-011 (Cap), and F-012 (Clip Sharing) can be tested
- F-004 (Browser Play) is the foundation -- all features run in the browser
- F-005 (Farming) and F-006 (Homestead) can be built in parallel
- F-009 (Multiplayer) requires F-004 (browser infrastructure) and benefits from F-015 (low-pop resilience)

**Total Now appetite**: ~34 weeks (solo developer). With parallel work on independent features and the Phase 0 prototype already in progress, this maps to months 1-6 of development (April-September 2026).

**Resource allocation**: AI NPC (F-001, F-002, F-011) = 12 weeks (35%). Game mechanics (F-005, F-006) = 10 weeks (29%). Infrastructure (F-004, F-009, F-015) = 10 weeks (29%). Marketing tools (F-012) = 2 weeks (6%).

---

## Next (Phase 2: Alpha, Weeks 24-40) -- Planned

Performance features that deepen engagement, extend content longevity, and enable monetization.

| # | Feature | Spec | Kano | WSJF | Appetite | Segment | Phase |
|---|---------|------|------|------|----------|---------|-------|
| 1 | Emergent Story Framework | [feature-003-emergent-story-framework.md](features/feature-003-emergent-story-framework.md) | Performance | 15.7 | L (6 wk) | Seg 1, 3 | P2 |
| 2 | Seasonal Pass & Cosmetic Shop | [feature-013-seasonal-pass-shop.md](features/feature-013-seasonal-pass-shop.md) | Performance | 13.0 | M (3 wk) | Seg 4 | P2 |
| 3 | Organic Quest System | [feature-008-organic-quest-system.md](features/feature-008-organic-quest-system.md) | Performance | 12.0 | L (5 wk) | Seg 1, 2 | P2 |
| 4 | Living Economy & NPC Merchants | [feature-007-living-economy.md](features/feature-007-living-economy.md) | Performance | 10.5 | M (3 wk) | Seg 1 | P2 |

**Phase goal**: Emergent stories create shareable viral content. Quests provide directed gameplay from NPC reflections. Economy gives farming purpose. Monetization infrastructure is live and generating revenue.

**Depends on Now**:
- F-003 (Stories) depends on F-001 (Personality) + F-002 (Memory) being validated and refined
- F-008 (Quests) depends on F-002 (Memory) + F-003 (Stories) NPC reflection system
- F-007 (Economy) depends on F-005 (Farming) producing sellable goods
- F-013 (Shop) depends on F-006 (Homestead) for cosmetic items to sell

**Total Next appetite**: ~17 weeks. Maps to months 7-10 (October 2026 - January 2027).

---

## Later (Phase 3-4: Beta + Launch, Weeks 40-56) -- Ideas

Attractive features and polish. These make the game more delightful but are not required for core experience.

| # | Feature | Spec | Kano | WSJF | Appetite | Segment | Phase |
|---|---------|------|------|------|----------|---------|-------|
| 1 | Town Events System | [feature-010-town-events.md](features/feature-010-town-events.md) | Attractive | 11.0 | M (3 wk) | Seg 1, 4 | P3 |
| 2 | World Navigation & Transport | [feature-014-world-navigation.md](features/feature-014-world-navigation.md) | Performance | 7.5 | M (2 wk) | Seg 5 | P3-P4 |

**Phase goal**: Polish, events, and QoL improvements for launch readiness. 100-player servers. Mobile browser optimization. Cosmetic content pipeline operational.

**Total Later appetite**: ~5 weeks. Maps to months 11-14 (February - May 2027). Remaining time in Phase 3-4 allocated to: content creation (crops, items, NPC personalities), bug fixing, performance optimization, community events, and launch marketing.

---

## Feature Dependencies

```
F-001 (NPC Personality) ──→ F-002 (Memory) ──→ F-003 (Stories) ──→ F-008 (Quests)
       │                           │                    │
       ├──→ F-011 (Cap)            │                    └──→ F-010 (Events)
       │                           │
       └──→ F-012 (Clip Sharing)   └──→ F-008 (Quests)

F-004 (Browser Play) ──→ F-009 (Multiplayer) ──→ F-015 (Low-Pop Resilience)

F-005 (Farming) ──→ F-007 (Economy)
                     └──→ F-013 (Shop) [also depends on F-006]

F-006 (Homestead) ──→ F-009 (Multiplayer: homestead visiting)
                       └──→ F-013 (Shop: decorative items)

F-014 (Navigation) -- no dependencies, can be added anytime
```

---

## Roadmap Summary

| Category | Now | Next | Later | Total |
|----------|-----|------|-------|-------|
| Must-Be | 7 | 0 | 0 | 7 |
| Performance | 0 | 4 | 1 | 5 |
| Attractive | 2 | 0 | 1 | 3 |
| **Total** | **9** | **4** | **2** | **15** |
| **Total Appetite** | ~34 wk | ~17 wk | ~5 wk | ~56 wk |

**Note**: 56 weeks total appetite for a solo developer maps closely to the GDD's 14-month (60-week) timeline. The ~4-week buffer accounts for testing, iteration, bug fixing, and community management overhead.

---

## Alignment with GDD Development Phases

| GDD Phase | Timeline | Roadmap Phase | Key Features |
|-----------|----------|---------------|-------------|
| Phase 0 (Prototype) | Weeks 1-8 | Now (early) | F-001 (core NPC), F-004 (browser), F-012 (clips) |
| Phase 1 (Vertical Slice) | Weeks 9-24 | Now (late) | F-002, F-005, F-006, F-009, F-011, F-015 |
| Phase 2 (Alpha) | Weeks 25-40 | Next | F-003, F-007, F-008, F-013 |
| Phase 3 (Beta) | Weeks 41-52 | Later | F-010, F-014, polish, content |
| Phase 4 (Launch) | Weeks 53-56 | Later | Final polish, marketing, launch |

---

## Validation Gates (Before Committing to Next Phase)

| Gate | Timing | Criteria | Source |
|------|--------|----------|--------|
| **Gate 1: AI NPC Engagement** | End of Phase 0 (Week 8) | >50% of 10-20 playtesters voluntarily return for session 3 citing NPC interactions | rat.md Risk 1 |
| **Gate 2: LLM Cost Viability** | During Phase 0 (Week 6-7) | Actual LLM cost <$1.00/server/hour with 50 NPCs + 20 simulated players | rat.md Risk 4 |
| **Gate 3: Retention Cohort** | End of Phase 1 (Week 20-24) | D7 >15%, D30 >5%, NPC interaction frequency decline <30% week-over-week | rat.md Risk 2 |

**If Gate 1 fails**: STOP. Reassess AI NPC approach or pivot to single-player premium game.
**If Gate 2 fails**: Adjust pricing model (add subscription, increase interaction cap, reduce NPC count).
**If Gate 3 fails**: Reduce scope to single-player with optional multiplayer. Cut MMO features.

---

## Cross-References

| Document | How It Informed This Roadmap |
|----------|----------------------------|
| prioritized-initiatives.md | ICE/RICE scores mapped to feature WSJF priority |
| strategy-canvas.md | Blue Ocean ERRC actions determined feature direction and resource allocation (60% AI NPC) |
| segments.md | Segment priority determined feature sequencing (Seg 1+3 first, Seg 4 deferred) |
| rat.md | Top risks mapped to validation gates between phases |
| growth-plan.md | North Star metric (WAP3) used as primary success measurement |
| business-model.md | Unit economics constraints drove F-011 (Cap) and F-013 (Shop) timing |
| jobs-graph.md | Critical path (Jobs 3, 5, 6) determined Now phase feature selection |
| competitive-landscape.md | 12-24 month exclusivity window drove overall timeline urgency |
