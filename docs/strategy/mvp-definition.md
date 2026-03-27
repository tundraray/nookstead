# MVP Definition: Nookstead

**Date**: 2026-03-22
**Analyst**: Product Planner Agent
**MVP Type**: Single-Feature MVP (AI NPC system is the single differentiating feature; all other systems are minimum viable implementations of genre table stakes)
**Confidence**: Medium -- MVP scope is well-grounded in 15 strategy documents and WSJF prioritization (HIGH for scope decisions), but all success metrics and validation thresholds are pre-launch estimates (MEDIUM-LOW). Zero player data exists.

## MVP with 6 Must-Have features completing the Core Job for Segment 1 in ~22 weeks, validated through a 3-gate sequence costing $150-300 before committing to full development

---

## Core Job Being Served

- **Core Job**: "When I have finished the main content in my current cozy game and the NPCs repeat the same dialogue, I want a cozy world where surprising things still happen because of who I am and what I have done -- accessible instantly without installing anything." -- segments.md, Segment 1
- **Big Job**: "Feel like I belong to a living community that knows me and evolves with me" -- the digital equivalent of a small town where everyone knows my name. -- segments.md, Segment 1
- **Primary Segment**: Content-Exhausted Cozy Escapist (Segment 1, 48% of SAM, weighted attractiveness 4.65/5). Adults 25-40 (60/40 female/male), professionals who use gaming as primary stress relief. -- segments.md
- **Critical Job Sequence** (from jobs-graph.md):
  1. **Job 1**: Discover and enter the world (browser instant-play)
  2. **Job 3**: Have first meaningful NPC interaction (THE AHA MOMENT -- severity 9/10)
  3. **Job 4**: Build and personalize homestead (creative anchor)
  4. **Job 5**: Develop NPC relationships over time (retention driver -- severity 8/10)
  5. **Job 8**: Feel progression and mastery (farming loop sustains daily engagement)

Jobs 3 and 5 are the critical differentiators. Jobs 1, 4, and 8 are genre table stakes that must meet a quality floor.

---

## MVP Scope (MoSCoW)

### Must-Have (MVP is not viable without these)

| # | Feature | Spec | Job Served | Appetite |
|---|---------|------|-----------|----------|
| 1 | NPC Personality & Dialogue Engine | [features/feature-001-npc-personality-engine.md](features/feature-001-npc-personality-engine.md) | Job 3: First meaningful NPC interaction (severity 9/10) | L (6 wk) |
| 2 | NPC Memory & Relationship System | [features/feature-002-npc-memory-system.md](features/feature-002-npc-memory-system.md) | Job 5: Develop relationships over time (severity 8/10) | L (5 wk) |
| 3 | Browser Instant-Play & Onboarding | [features/feature-004-browser-instant-play.md](features/feature-004-browser-instant-play.md) | Job 1: Discover and enter the world (severity 7/10) | M (3 wk) |
| 4 | Farming & Seasonal Crop System | [features/feature-005-farming-system.md](features/feature-005-farming-system.md) | Job 4/8: Build homestead + feel progression (severity 7-8/10) | L (5 wk) |
| 5 | Homestead Building & Customization | [features/feature-006-homestead-building.md](features/feature-006-homestead-building.md) | Job 4: Build and personalize homestead (severity 7/10) | L (5 wk) |
| 6 | Low-Pop Server Resilience | [features/feature-015-low-pop-resilience.md](features/feature-015-low-pop-resilience.md) | Job 7: World feels alive even with few players (severity 8/10) | S (2 wk) |

**Total Must-Have appetite**: ~26 weeks (solo developer, sequential). With parallel work on independent features (F-005 and F-006 can be built simultaneously; F-015 is small and independent), effective timeline is ~22 weeks.

**Rule check**: Must-Haves are 26 of 43 total weeks of effort across all 15 features = **60%** of total effort. Target ~60%. **PASSES.**

**Rationale for each Must-Have**:
- **F-001 + F-002** (NPC Personality + Memory): The entire USP. Without these, Nookstead is a worse version of Stardew Valley. These validate RAT Risks 1 and 2 (P4xI5=20 each). If these fail, the product has no reason to exist.
- **F-004** (Browser Instant-Play): The delivery mechanism. Without browser access, the viral loop (clip -> click -> play in 60 seconds) is impossible. Also required for any playtest or validation activity.
- **F-005 + F-006** (Farming + Homestead): Genre table stakes. Cozy gamers will not engage with a product that lacks farming and building. These provide the daily gameplay loop between NPC interactions. The "deep not wide" strategy means 15 crops and basic building, not Stardew-level breadth.
- **F-015** (Low-Pop Resilience): At 25K MAU base case, servers will have 5-10 concurrent players. Without AI NPCs filling the world, new players encounter a ghost town and leave. This feature makes the "MMO" viable at launch population.

---

### Should-Have (Important, workaround exists)

| # | Feature | Spec | Why Not Must | Workaround |
|---|---------|------|-------------|-----------|
| 1 | Clip Moment Capture & Sharing | [features/feature-012-clip-moment-sharing.md](features/feature-012-clip-moment-sharing.md) | Players can manually screenshot and share (higher friction but functional) | Players use OS screenshot tools (Windows Snipping Tool, browser extensions) and post manually to social media |
| 2 | NPC Interaction Cap | [features/feature-011-interaction-cap.md](features/feature-011-interaction-cap.md) | Not needed during closed prototype testing (small player count = low LLM costs). Required before any open/scaled access | During closed testing with 10-30 players, uncapped LLM costs are ~$5-15/day. Manageable. Implement before open alpha. |
| 3 | Multiplayer & Social Features | [features/feature-009-multiplayer-social.md](features/feature-009-multiplayer-social.md) | Core Job can be completed single-player with AI NPCs. Multiplayer adds MMO dimension but is not required for the "NPC aha moment" validation | Players interact only with AI NPCs during prototype. Multiplayer tested in Phase 1 vertical slice. NPC relationships provide the primary social experience. |

**Total Should-Have appetite**: ~8 weeks. These features should be built immediately after Must-Haves, before any public launch.

---

### Could-Have (If time permits within Phase 1)

| # | Feature | Spec | Value Add |
|---|---------|------|----------|
| 1 | Living Economy & NPC Merchants | [features/feature-007-living-economy.md](features/feature-007-living-economy.md) | Gives farming a purpose (sell crops, buy supplies). Can use fixed-price shops as placeholder. |
| 2 | Emergent Story Framework | [features/feature-003-emergent-story-framework.md](features/feature-003-emergent-story-framework.md) | The differentiation proof -- emergent NPC stories. But requires F-001 and F-002 to be refined first. Better to ship with excellent NPC dialogue than mediocre emergent stories. |
| 3 | Organic Quest System | [features/feature-008-organic-quest-system.md](features/feature-008-organic-quest-system.md) | Provides directed daily goals from NPC reflections. Can be added after base NPC system is validated. |

---

### Won't-Have (This Release)

| # | Feature | Why Not Now | When |
|---|---------|-----------|------|
| 1 | Seasonal Pass & Cosmetic Shop | Monetization is premature before D30 retention >5% is validated. No revenue needed during prototype/early access. | Next (Phase 2 alpha) |
| 2 | Town Events System | Delighter, not required for core experience validation. Events need stable emergent story system first. | Later (Phase 3 beta) |
| 3 | World Navigation & Transport | Single-town world does not need transport. Walking is sufficient. | Later (Phase 3-4, when world expands) |

---

## Success Metrics

### North Star Metric

- **Metric**: Weekly Active Players with 3+ NPC Conversations (WAP3) -- from growth-plan.md
- **MVP Target**: 50 WAP3 during closed prototype testing (10-30 testers); 500 WAP3 during open early access (target 2,500 MAU)
- **Why this metric**: WAP3 sits at the intersection of engagement (player returns), value delivery (NPC conversations are the differentiator), and monetization potential (players who talk to NPCs 3+ times/week form relationships that create switching costs). -- Tier 3 (growth-plan.md analysis)

### Leading Indicators (measure in first 2 weeks of each test)

| Metric | Target | Source |
|--------|--------|--------|
| Activation rate (meaningful NPC conversation in session 1) | >80% | growth-plan.md -- AARRR Activation |
| D1 retention (return for session 2) | >40% | business-model.md -- F2P benchmark |
| NPC dialogues per session | >3 | growth-plan.md -- supporting metric |
| "Chatbot" perception rate (unprompted in qualitative interviews) | <20% | brand-positioning.md -- anti-AI framing |
| NPC response latency (p95) | <3 seconds | feature-001 acceptance criteria |
| Time from URL click to first NPC conversation | <5 minutes | feature-004 + growth-plan.md Experiment 5 |

### Lagging Indicators (measure after 1-3 months)

| Metric | Target | Source |
|--------|--------|--------|
| D7 retention | >20% | business-model.md -- F2P benchmark |
| D30 retention | >8% | business-model.md -- F2P benchmark; growth-plan.md |
| NPC interaction frequency decline (week-over-week) | <30% decline | growth-plan.md -- content freshness proxy |
| Sean Ellis test ("very disappointed" if could no longer play) | >40% | business-model.md -- PMF threshold |
| LLM cost per server per hour | <$0.50 (target), <$1.00 (acceptable) | business-model.md -- unit economics |
| Unique NPC dialogue ratio (non-repeated responses) | >90% | growth-plan.md -- content freshness |
| Memory accuracy at D14 (significant interactions recalled correctly) | >80% | feature-002 success metrics |
| Clips shared per 100 DAU (if F-012 built) | >5 | growth-plan.md -- referral proxy |

### Kill Criteria

These are non-negotiable thresholds. If any kill criterion triggers, development halts and the team pivots or stops.

| # | Kill Criterion | Threshold | Timeframe | Decision |
|---|---------------|-----------|-----------|----------|
| 1 | **AI NPC engagement fails** | <30% of prototype playtesters voluntarily return for session 3 | After 3-week prototype playtest | **STOP** -- reassess entire product concept. Consider: pivot to single-player premium game with AI NPCs (lower scope, no MMO infrastructure), or abandon AI NPC approach entirely. |
| 2 | **LLM costs are structurally unviable** | Actual cost >$2.50/server/hour (5x target) with no path to reduction below $1.00 | After 24-hour cost benchmark | **PIVOT pricing model** -- switch from F2P to subscription ($5-10/month), or dramatically reduce NPC count (5 NPCs instead of 50), or investigate local model inference. |
| 3 | **Retention collapses despite engagement** | D7 retention <10% AND NPC interaction frequency declines >50% week-over-week | After 4-week retention cohort | **REASSESS scope** -- reduce to single-player with optional multiplayer. AI NPCs may work for single-player but not sustain MMO engagement. Cut server infrastructure investment. |
| 4 | **Content-exhaustion repeats within 2 weeks** | >50% of D14 retained players report "I've seen everything the NPCs have to say" | After 4-week retention cohort | **REASSESS AI quality** -- NPC dialogue variety is insufficient. Invest in broader NPC personality range, more diverse conversation topics, or add F-003 (Emergent Stories) as immediate priority. |
| 5 | **Browser platform is rejected** | <10% play rate from community post clicks (viewers click but do not play) | After community seeding test | **ADD Steam distribution** -- list on Steam Coming Soon ($100). Browser remains available but is no longer the sole platform strategy. |

**So what?** Kill criteria prevent the worst outcome for a bootstrapped solo developer: investing 12+ months of full-time effort into a product concept that does not work. Each criterion is designed to trigger at the earliest possible moment -- during the $150-300 validation period, not after months of building.

**Now what?** Print these kill criteria and review them before each validation gate. The emotional difficulty of stopping a project you have been building for weeks is significant. Having pre-committed thresholds removes the temptation to rationalize negative results.

**Confidence**: High for kill criteria design (grounded in RAT analysis and business model constraints). Medium for threshold values (based on F2P benchmarks, not Nookstead-specific data).

---

## Validation Plan

### Risk-First Validation (from rat.md) -- 3-Gate Sequence

The three validation gates are sequential and dependent. Gate 1 must pass before Gate 2 begins. This sequence minimizes wasted effort: the cheapest, fastest test comes first, and each subsequent test only runs if the previous one passes.

| # | Gate | RAT Risk | Score (PxI) | Validation Method | When | Cost | Go/No-Go Threshold | Decision |
|---|------|---------|------------|------------------|------|------|---------------------|---------|
| 1 | **NPC Engagement** | Risk 1: AI NPC Engagement Gap | 20/25 | Prototype playtest with 10-20 cozy gamers recruited from r/StardewValley, r/CozyGamers, and cozy gaming Discord servers. 3 play sessions over 2 weeks. Measure: unprompted return rate, NPC quality rating, qualitative interviews. | Before MVP (Phase 0, Week 6-8, target April 2026) | $0 (use existing prototype + volunteer testers) | >50% of testers voluntarily return for session 3 AND cite NPC interactions as primary reason. <20% use "AI/chatbot" language unprompted. | **GO**: Proceed to Gate 2 + Phase 1 development. **NO-GO**: Kill Criterion 1 triggers. |
| 2 | **LLM Cost** | Risk 4: LLM Infrastructure Cost Blowout | 15/25 | 24-hour simulated load benchmark: 50 NPCs + 20 bot players doing 10 dialogues/hour each. Measure actual API cost by model tier. Calculate cost-per-player-hour. Test multi-model routing (80% nano / 15% Haiku / 5% Sonnet). | During Phase 0 (Week 6-7, parallel with Gate 1 prep). Can run overnight. | $50-100 (LLM API costs during test) | Actual cost <$1.00/server/hour. Cost-per-player-hour <$0.05. Multi-model routing achieves >50% cost reduction vs. single-model. | **GO**: F2P model validated. Proceed. **PIVOT**: If cost is $1.00-2.50, adjust pricing (add subscription tier, reduce NPC count). **NO-GO**: Kill Criterion 2 triggers if >$2.50 with no reduction path. |
| 3 | **Retention Cohort** | Risk 2: AI Content Retention Cliff | 20/25 | 4-week retention cohort with 20-30 players (expanded from Gate 1 testers + new recruits). Track D1/D7/D14/D30 retention, session length, NPC interaction frequency over time, content freshness audit (review NPC conversation logs for repetition), and qualitative "I've seen everything" assessment. | After Gate 1 passes (Phase 1, Weeks 9-12, target May-June 2026) | $100-200 (LLM API costs for 4 weeks of testing) | D7 retention >15%. D30 retention >5%. NPC interaction frequency does not decline >30% week-over-week. <50% of D14 players report "seen everything." | **GO**: Full commitment to Phase 1-4 development. **REASSESS**: Kill Criterion 3 or 4 triggers if thresholds missed. |

**Total validation cost**: $150-300
**Total validation time**: 8-10 weeks (Weeks 6-16 of development timeline, April-June 2026)
**Validation sequence**: Gate 1 (2-3 weeks) -> Gate 2 (1-2 days, parallel) -> Gate 3 (4 weeks, sequential after Gate 1)

### Parallel Validation (Non-Gate)

| # | Validation | Method | Timeline | Cost | Purpose |
|---|-----------|--------|----------|------|---------|
| A | Community seeding test | Post prototype in 5 cozy gaming communities. Measure CTR and play rate. | 1 week, during/after Gate 1 | $0 | Validates browser distribution thesis (RAT Risk 5) |
| B | Platform preference survey | Survey 100 cozy gamers: browser vs. Steam vs. Switch preference | 3 days, anytime | $0 | Informs whether to add Steam listing ($100) |
| C | Sprint decomposition | Break 14-month timeline into 2-week sprints with concrete deliverables. Compare estimated hours to capacity. | 2 days, after Gate 1 results | $0 | Validates scope feasibility (RAT Risk 3) |
| D | Palia review mining | Analyze 200+ Steam reviews mentioning "NPCs" or "characters" for churn reasons | 2 days, anytime | $0 | Market intelligence for NPC quality targets |

**So what?** The 3-gate validation sequence costs $150-300 and takes 8-10 weeks. The alternative -- building for 14 months without validation -- carries 64% risk exposure (80/125 from RAT analysis). The validation investment is the highest-leverage $300 a bootstrapped developer can spend.

**Now what?** Begin recruiting 10-20 playtesters from r/StardewValley and r/CozyGamers immediately. Prepare post copy that describes the game as "a cozy game where NPCs actually remember you" (never mention AI). Target Phase 0 prototype completion by April 10, 2026, and Gate 1 playtest start by April 14.

**Confidence**: High for validation design (clear go/no-go criteria, grounded in RAT and business model). Medium for threshold values (adapted from F2P benchmarks, not game-specific).

---

### Beta User Plan

- **First 10 users**: Content-Exhausted Cozy Escapists (Segment 1) recruited from r/StardewValley, r/CozyGamers, and cozy gaming Discord servers. Must be active cozy game players who have completed at least one game's main content recently. -- customer-segments.md
- **First 10 expansion users**: Emergent AI Explorers (Segment 3) recruited from r/MachineLearning, r/LocalLLaMA, Hacker News, and AI Twitter/X. Must be interested in AI agent technology. -- customer-segments.md
- **Recruitment method**: Authentic community posts with no marketing language. "I'm building a cozy game where NPCs actually remember you. Looking for 10 players to try the prototype and give honest feedback. Free, browser-based, takes 30 minutes per session." Include direct game URL. -- gtm-plan.md community-led approach
- **Recruitment criteria**: Must play cozy games actively (Stardew, AC, Palia, or similar). Must be willing to play 3 sessions over 2 weeks. Must be willing to participate in a 15-minute post-session feedback interview (voice or text).
- **Feedback loop**:
  1. **After each session**: 3-question survey (How was the NPC interaction? What surprised you? Will you come back tomorrow?)
  2. **After session 3**: 15-minute qualitative interview focusing on NPC perception, relationship quality, and unprompted vocabulary (does the player say "AI" or "character"?)
  3. **Weekly**: Developer reviews NPC conversation logs for quality, consistency, and repetition patterns
  4. **Post-cohort**: Sean Ellis test ("How would you feel if you could no longer play Nookstead?" -- target >40% "very disappointed")

**First 10 beta users identified** (channels, not individuals):
1. r/StardewValley -- post seeking playtesters who finished 1.6 content
2. r/CozyGamers -- post seeking players tired of NPC repetition
3. r/Palia -- post seeking players who churned due to scripted content
4. Cozy Gaming Discord servers (3-5 servers with active members)
5. Personal network / indie dev communities for initial seed

---

## Launch Criteria Checklist

This checklist applies to the **Early Access / Open Alpha launch** (Phase 2, target October 2026), not the prototype playtest.

### Pre-Launch Requirements

- [ ] All 6 Must-Have features complete and tested (F-001, F-002, F-004, F-005, F-006, F-015)
- [ ] All 3 Should-Have features complete and tested (F-009, F-011, F-012)
- [ ] Gate 1 (NPC Engagement) passed: >50% playtest return rate citing NPCs
- [ ] Gate 2 (LLM Cost) passed: actual cost <$1.00/server/hour
- [ ] Gate 3 (Retention Cohort) passed: D7 >15%, D30 >5%
- [ ] Core Job can be completed end-to-end: discover game -> browser instant-play -> first NPC conversation -> build homestead -> farm crops -> develop NPC relationship over 7+ days
- [ ] NPC response latency <3 seconds (p95) under simulated 20-concurrent load
- [ ] NPC memory accuracy >80% at D14 (from Gate 3 data)
- [ ] NPC interaction cap (F-011) implemented with warm in-character messaging
- [ ] Clip sharing tool (F-012) functional with game branding and URL overlay
- [ ] Automated text moderation active (profanity filter + player reporting)
- [ ] Server auto-merge operational for <3 concurrent players
- [ ] 10-15 AI NPCs with distinct personalities, backstories, and speech patterns
- [ ] 15 crops across 4 seasons with growth stages and NPC reactions
- [ ] Basic homestead with 5 building types and 30+ decorative items
- [ ] Discord community has >500 members
- [ ] 3+ dev diary posts on Reddit/TikTok with >50 upvotes each
- [ ] "Living World Game" category language on game website
- [ ] Privacy policy and terms of service published
- [ ] Analytics instrumented for all success metrics (PostHog or equivalent)
- [ ] No critical Rabbit Holes unresolved from feature specs

### Launch Day Requirements

- [ ] 3+ servers provisioned with capacity for 100 concurrent each
- [ ] Cost monitoring alerts set at $0.75/server/hour and $1.00/server/hour
- [ ] Server auto-scaling rules configured (spin up new server at 80% capacity)
- [ ] Community announcement prepared for Discord, Reddit, and social media
- [ ] "Early Access" framing in all public communications (expectations management)
- [ ] 5-10 cozy game streamers have prototype access with zero-condition invitation
- [ ] Feedback channels open (Discord #feedback, in-game report button)

### Post-Launch Week 1 Requirements

- [ ] Daily monitoring of: concurrent players, NPC response latency, LLM costs, crash reports
- [ ] First community feedback reviewed within 24 hours
- [ ] Hotfix capability tested (deploy new server build within 30 minutes)
- [ ] NPC conversation log review for quality regression

---

## Capacity & Timeline for Solo Developer

### Development Phases Aligned with MVP

| Phase | Timeline | Focus | MVP Features Built | Validation Gate |
|-------|----------|-------|-------------------|-----------------|
| **Phase 0 (Prototype)** | Weeks 1-8 (Mar-Apr 2026) | AI NPC core + browser shell | F-001 (partial), F-004 (partial) | Gate 1 + Gate 2 |
| **Phase 1 (Vertical Slice)** | Weeks 9-24 (May-Sep 2026) | Complete Must-Haves + Should-Haves | F-001, F-002, F-004, F-005, F-006, F-009, F-011, F-012, F-015 | Gate 3 |
| **Phase 2 (Alpha)** | Weeks 25-40 (Oct 2026-Jan 2027) | Could-Haves + monetization | F-003, F-007, F-008, F-013 | Open alpha launch |
| **Phase 3 (Beta)** | Weeks 41-52 (Feb-May 2027) | Won't-Haves + polish | F-010, F-014, content expansion | Beta launch |
| **Phase 4 (Launch)** | Weeks 53-56 (Jun 2027) | Marketing + polish | -- | Full launch |

### Weekly Capacity Allocation (Solo Developer, 50 hrs/week)

| Activity | Hours/Week | Notes |
|----------|-----------|-------|
| Core development | 35 hrs | Feature building, bug fixing, testing |
| Community management | 5 hrs | Discord, Reddit, content posting |
| Playtest support | 5 hrs | During validation gates only |
| Operations / admin | 3 hrs | Server monitoring, costs, planning |
| Learning / research | 2 hrs | AI NPC techniques, game design |

### Risk: Solo Developer Burnout

The 14-month timeline at 50 hrs/week = 2,800 total hours. This is the maximum sustainable output for a bootstrapped solo developer. Scope creep, unexpected technical challenges, or operational burden (server issues, moderation) can push hours above sustainable levels.

**Mitigation**: The MoSCoW prioritization ensures that if time runs short, Should-Haves and Could-Haves are cut -- not Must-Haves. The kill criteria ensure that if the product concept does not validate in the first 8-10 weeks ($150-300 investment), development stops before burnout occurs.

---

## Cross-References

| Document | What It Informed |
|----------|-----------------|
| segments.md | Primary segment (Content-Exhausted Cozy Escapist) + Core Job + Big Job |
| jobs-graph.md | Critical job sequence for MVP scope (Jobs 1, 3, 4, 5, 8). Problem severity scores for Must-Have selection. |
| rat.md | 3-gate validation sequence (Risks 1, 2, 4). Kill criteria thresholds. Total risk exposure 80/125. |
| growth-plan.md | North Star metric (WAP3). AARRR funnel benchmarks. Leading/lagging indicator targets. |
| business-model.md | Unit economics constraints (LLM cost <$0.50/hr, 3-5% conversion, $8-10 ARPPU). Financial scenarios. F2P viability thresholds. |
| pricing-analysis.md | NPC interaction cap design (15/day free, warm messaging). Tier structure (free / seasonal pass / supporter). |
| customer-segments.md | Beta user recruitment channels. Segment behavior profiles for playtest design. |
| competitive-landscape.md | 12-24 month exclusivity window driving timeline urgency. Palia churn data as retention benchmark. |
| strategy-canvas.md | ERRC actions informing feature direction. Resource allocation (60% AI NPC). |
| brand-positioning.md | "Living characters" messaging requirement for playtest recruitment. Never mention "AI" in player-facing contexts. |
| prioritized-initiatives.md | ICE/RICE scores cross-validated against WSJF feature prioritization. |
| strategic-report.md | CONDITIONAL GO recommendation -- conditions are the 3 validation gates defined in this document. |
| opportunity-map.md | Feature-to-opportunity traceability. 12 opportunities mapped to 15 features. |
| product-roadmap.md | Now/Next/Later phasing aligned with MVP MoSCoW categories. |
