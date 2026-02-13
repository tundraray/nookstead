# NOOKSTEAD -- Game Design Document v3.0

**Version:** 3.0
**Date:** February 14, 2026
**Domain:** nookstead.land
**Project Status:** Phase 0 -- Prototype (Active Development)

---

## Project Overview

**Title:** Nookstead
**Engine:** Phaser.js 3 (2D rendering) + Next.js 16 (web shell) + Colyseus 0.15+ (multiplayer server)
**Genre:** 2D Pixel Art MMO / Life Sim / Farming RPG with Generative AI Agents
**Platform:** Web (browser -- desktop and mobile)
**Target Audience:** Core audience ages 18--35, fans of Stardew Valley, Animal Crossing, The Sims, Palia
**Development Mode:** Prototype (Phase 0), then full development (Phases 1--4)
**Total Timeline:** 14 months from start to launch
**Visual Style:** 16x16 pixel art, top-down, modern setting
**Assets:** LimeZu -- Modern Interiors, Modern Exteriors, Modern Farm, Modern User Interface
**Active Agents (Phase 0):** Producer, Market Analyst, Sr Game Designer, Mechanics Developer, QA Agent, Data Scientist

---

## Table of Contents

1. [Market Intelligence](#1-market-intelligence)
2. [Vision and Concept](#2-vision-and-concept)
3. [Design Pillars](#3-design-pillars)
4. [Player Experience](#4-player-experience)
5. [Gameplay](#5-gameplay)
6. [World Structure](#6-world-structure)
7. [Generative AI Agents (NPC Service)](#7-generative-ai-agents-npc-service)
8. [Game Systems](#8-game-systems)
9. [Storyline](#9-storyline)
10. [Multiplayer and Social Systems](#10-multiplayer-and-social-systems)
11. [Progression Systems](#11-progression-systems)
12. [User Interface](#12-user-interface)
13. [Art Direction](#13-art-direction)
14. [Sound Design](#14-sound-design)
15. [Technical Architecture](#15-technical-architecture)
16. [Analytics Framework](#16-analytics-framework)
17. [Monetization](#17-monetization)
18. [Success Metrics](#18-success-metrics)
19. [Risks and Mitigations](#19-risks-and-mitigations)
20. [Development Roadmap](#20-development-roadmap)
21. [Agent Sign-offs](#21-agent-sign-offs)

---

## 1. Market Intelligence

*Prepared by Market Analyst Agent*

### 1.1 Market Overview

**Total Addressable Market (TAM):** $8.2B -- global cozy/life sim/farming RPG market (2025 estimate, all platforms).

**Serviceable Addressable Market (SAM):** $1.4B -- browser-accessible life sim and farming RPG segment for PC/web players.

**Serviceable Obtainable Market (SOM):** $2.8M -- projected first-year revenue capturing ~0.2% of SAM. Conservative estimate: 50K MAU, 3--5% conversion, $8--12 ARPPU.

**Market Growth Rate:** 12--15% annually. The cozy game segment is one of the fastest-growing genres, with growth starting during the pandemic and persisting steadily.

**Market Maturity:** Growing. The genre is well-established, but the AI-enhanced sub-segment is Emerging.

**Audience Size:** ~45M players globally interested in cozy life sim games.

### 1.2 Competitive Analysis

#### Direct Competitors

| Game | Developer | Platform | Revenue Model | Key Features | Market Position |
|------|-----------|----------|---------------|--------------|-----------------|
| Palia | Singularity 6 | PC (Epic/Steam) | F2P + Cosmetics | MMO life sim, housing, farming | Only MMO life sim; retention struggles, layoffs |
| Stardew Valley | ConcernedApe | PC/Console/Mobile | Premium ($15) | Farming, relationships, co-op (4 players) | Genre benchmark; 40M+ copies; scripted NPC dialogues |
| Animal Crossing: NH | Nintendo | Switch | Premium ($60) | Island building, NPC villagers, seasonal events | 43M copies; console-exclusive; NPCs charming but scripted |

#### Indirect Competitors

| Game | Player Overlap | Threat Level |
|------|---------------|--------------|
| The Sims 4 | 40% | Medium |
| Cozy Grove | 30% | Low |
| Sun Haven | 25% | Low |
| Coral Island | 20% | Low |
| Character.AI / AI Dungeon | 15% | Low (validates demand for AI conversations) |

#### Landscape Analysis

The cozy game market is oversaturated with Stardew Valley clones, but almost none attempt the MMO model and **no game has AI NPCs**. Players consistently express frustration that scripted NPC dialogue becomes repetitive after 20--40 hours of play.

**Barriers to Entry:** (1) Art asset quality -- high expectations for pixel art. (2) Server costs for MMO infrastructure. (3) LLM costs for AI agents. (4) Content depth for long-term retention.

### 1.3 Market Gaps and Opportunities

**1. No browser-native MMO life sim.** All competitors require an app download. The entire genre is inaccessible via URL. Browser access eliminates the entry barrier and opens instant accessibility on any device.
- Opportunity size: $300--500M underserved segment
- Competition level: zero

**2. No game has AI NPCs with genuine memory.** Character.AI with 20M+ MAU proves massive demand for AI conversations. "Repetitive NPC dialogue" is the #1 complaint in farming game communities.
- Represents a new category with high viral potential
- Competition level: zero

**3. Palia's struggles create a window of opportunity.** Palia proved demand for an MMO life sim (6M accounts in first 6 months) but failed on execution.
- 2--6M potential players looking for an alternative

### 1.4 Market Validation

- **Market Demand:** Confirmed by Palia's success (6M accounts) and Character.AI (20M+ MAU)
- **Competitive Advantage:** Generative AI NPCs with memory -- a technically novel solution that is hard to replicate quickly
- **Risk Assessment:** LLM costs are manageable with optimization (tiering, caching, limits)
- **Go-to-Market Strategy:** Launch in English-speaking markets; Reddit, TikTok/YouTube (AI clips), Discord community, gaming press (unique AI angle), early access for 50 content creators

**Decision: GO** -- Strong market gap, no direct competitor in the browser AI-driven life sim MMO niche. The USP is defensible and technically innovative.

---

## 2. Vision and Concept

### 2.1 Elevator Pitch

Nookstead is a cozy browser-based MMO where players build their homestead on the outskirts of a living town populated by AI residents with their own memory, personality, and relationships. Every NPC remembers what you told them yesterday. The town lives on, even when you are not in the game. It is Animal Crossing where every villager is a real personality.

### 2.2 Unique Selling Proposition (USP)

Nookstead is the first MMO where NPCs are full-fledged generative AI agents with memory, reflection, and autonomous planning. These are not scripted characters with dialogue trees -- they are personalities that form their own opinions about each player and each other, creating unique, emergent stories on every server.

**Positioning:** Nookstead is the cozy MMO where every character remembers your name -- a living world accessible from any browser, where AI-powered NPCs create stories that no developer scripted.

### 2.3 Target Audience

**Primary Audience:** Players ages 18--35, predominantly female (60/40 split), fans of Stardew Valley, Animal Crossing, The Sims, Palia. They value relaxation, creativity, social connection, and narrative depth. They play 25--60 minutes per session, often daily. Willing to spend on cosmetics and quality-of-life items.

**Secondary Audience:** AI/tech enthusiasts (25--40, predominantly male) attracted by generative agent technology. Streamers and content creators who see each server as a unique story generator -- shareable, unpredictable content.

---

## 3. Design Pillars

### 3.1 Living World

The town of Quiet Haven does not wait for the player. NPC agents wake up, eat breakfast, go to work, chat, argue, and reconcile on their own schedule. When a player enters the town, they step into an already-flowing life, not a static scene that starts only upon arrival. Every server develops uniquely -- on one server, Marko and Sara might reconcile and open a joint cafe; on another, Marko might close the bakery and become a fisherman.

### 3.2 Meaningful Connections

Every conversation with an NPC is remembered. Relationships are built not through a numeric "+5 friendship" bar, but through the agent's living memory: it remembers your gifts, your words, your reputation. Friendship here feels real because it is backed by an actual history of interactions stored in the agent's memory stream and transformed into high-level reflections.

### 3.3 Your Nook

The personal homestead is a space for self-expression: house, yard, farm, animals. Complete freedom to decorate and manage your household. It is the place you want to return to -- an anchor in the game world.

### 3.4 Shared Life

Players and AI residents coexist in the same town. The line between "real" and "virtual" residents is intentionally blurred. The social fabric of the town is created through the joint efforts of living people and generative agents. NPCs remember interactions with players the same way they remember interactions with other NPCs.

---

## 4. Player Experience

### 4.1 Target Emotions

- **Coziness and Belonging:** The feeling of "your own place" in a living world
- **Surprise and Delight:** The moment an NPC recalls something you said yesterday
- **Pride of Creation:** Joy from a developed homestead and deep relationships
- **Social Warmth:** A sense of genuine connection with both virtual and real residents

### 4.2 Core Fantasy

Moving to a small, cozy town where everyone knows you, building your own home, and becoming part of a real community -- one that is living, remembering, and evolving.

### 4.3 Key Moments

- **"They remember me!"** -- An NPC mentions a specific fact from a past conversation. A viral moment that generates clips and posts.
- **First Harvest** -- The player harvests and sells their first produce; the NPC merchant comments personally.
- **Overheard Gossip** -- An overheard conversation between two NPCs about events the player was involved in.
- **Server Story** -- A unique chain of events on a specific server that players want to share.

---

## 5. Gameplay

### 5.1 Core Loop

```
Wake up -> Tend the farm -> Travel to town ->
Trade / Chat with NPCs / Complete quests ->
Return home -> Improve homestead -> Rest
```

With the real-time system, a full core loop spans a real day rather than a compressed 25-minute cycle. Players are expected to engage in focused sessions of 25--60 minutes, completing portions of the loop each time: a morning session to tend the farm and sell at market, an evening session to socialize with NPCs at the Quiet Corner bar.

This real-time pacing creates a natural daily ritual -- you check on your crops in the morning, stop by the market during lunch, and catch up with NPC friends in the evening. Each element of the loop yields progress: resources, coins, reputation, and deepened relationships.

### 5.2 Meta Loop

Long-term progression and goals that retain players:

- **Homestead Development:** Expanding the plot, building new structures, unlocking new crops and animals
- **Reputation Growth:** Unlocking new town districts, transport, events
- **Deepening NPC Relationships:** From stranger to close friend with unique quests and revealed secrets
- **Profession Advancement:** Specialization in farming, cooking, fishing, carpentry, floristry
- **Main Storyline:** Uncovering the mystery of Quiet Haven through seasonal story acts

### 5.3 Success Conditions

Nookstead is an open-ended game with no final "win" state. Success is measured by:

- Depth of NPC relationships (achieving "Close Friend" status)
- Completeness of homestead development (all buildings, all crops)
- Main storyline progress (completing story acts)
- Town reputation (maximum level 30)
- Achievement and cosmetic item collection

---

## 6. World Structure

### 6.1 Zone Architecture

The world of Nookstead consists of two zone types:

**Private Zones** -- Each player's personal homestead. Exists in its own instance. Other players can only enter by invitation. This is where the player builds, farms, and rests.

**Public Zones** -- The shared town of Quiet Haven and surrounding territories. Up to 100 concurrent players and 25--50 AI agents occupy this space simultaneously. This is the social and economic center of the game.

Players travel between zones using transport (section 6.4).

### 6.2 Private Zone: Player Homestead

Each new player receives an abandoned plot on the outskirts of town.

**House.** A single-story building, expandable to two floors and extensions. Fully customizable interior: furniture, decor, wall colors, room layout. All objects from the Modern Interiors asset pack.

**Yard.** The area around the house: fence and gate, garden paths, decorative elements (benches, lanterns, flower beds), utility buildings. All objects from the Modern Exteriors asset pack.

**Farm.** A dedicated agricultural zone: beds for 19 crop varieties (from Modern Farm), fruit trees, animal pens (chickens, cows, pigs, sheep), a doghouse. Crafting stations: butter churn, cheese press, kitchen, loom.

**Dock / Garage.** Transport departure point to town.

**Mailbox.** For receiving letters from NPC agents and other players.

**Plot Dimensions:**
- Starting: 32x32 tiles (512x512 pixels at 16x16 tiles)
- Maximum after expansion: 64x64 tiles
- Expansion purchased with in-game currency from the NPC mayor

### 6.3 Public Zone: Town of Quiet Haven

The town is divided into districts, each with its own function and atmosphere:

**Central Square.** Town Hall, notice board (quests and events), fountain (meeting place). Mayor Victor stands here every morning.

**Market Street.** Marko's Bakery, grocery store, hardware store, cafe, flower shop. Each shop has an NPC owner with their own schedule and personality. Shops operate on real-time schedules.

**Farmers' Market.** An open trading area. Operates daily from 8:00 to 18:00 (real time; adjusted by server speed multiplier if active). An NPC merchant sets prices based on supply and demand.

**Residential Quarter.** Homes of NPC agents. Players can visit (if the NPC is home and the relationship is strong enough). Each home has a unique interior.

**Park.** A green area with trees, benches, and a pond. NPC agents take walks here in the evening. Gardener Lena tends the park during the day.

**Library.** A two-story building. Librarian Anna works here. Contains in-game books (lore, recipes, tips) updated with content patches.

**Dock and Beach.** Fishing zone. Fisherman Oleg. Ferry to other regions (unlocked in updates). Fishing mini-game.

**"Quiet Corner" Bar.** Open from 18:00 to 00:00 (real time). Evening gathering spot for NPCs. Here agents relax, gossip, and share opinions. A prime location for gathering information.

**Outskirts and Forest.** Resource-gathering zone: wood, stone, berries, mushrooms, wildflowers. Home of Mysterious Zoya -- key to the main storyline.

### 6.4 Transport System

Travel between the homestead and town is an animated scene (5--15 seconds), maintaining immersion and separating "your own" space from the "shared" space.

| Level | Transport | Unlock | Travel Time | Cargo Capacity | Features |
|-------|-----------|--------|-------------|----------------|----------|
| 1 | Bicycle | From start | 12 sec | 10 units | Basic transport |
| 2 | Scooter | Reputation level 5 | 7 sec | 25 units | Purchased from NPC mechanic |
| 3 | Pickup Truck | Reputation level 15 | 5 sec | 100 units | Color customization |
| 4 | Car | Endgame | 3 sec | 30 units | Prestige item |

**City Bus.** Instant travel between districts for a token (1 token = 50 coins). NPCs can be encountered at bus stops.

**Ferry.** Crossing to other regions. The ferry deck is a full zone (10--15 players and NPCs, socializing, trading, fishing over the railing). Travel time: 60 seconds.

### 6.5 Game Time and Weather

**Time System: Real-Time with Configurable Multiplier**

Nookstead operates on **real time by default**. If it is 14:00 in the real world, it is 14:00 in the game. This creates a natural daily rhythm that mirrors real life -- morning farming, afternoon market, evening socializing.

| Parameter | Default Value | Configurable | Notes |
|-----------|---------------|-------------|-------|
| Time ratio | 1:1 (real-time) | Yes (server) | Speed multiplier, e.g. 2x = 2 game hours per 1 real hour |
| Season length | 7 real days | Yes (server) | 1 real week = 1 game season |
| Year length | 28 real days | Derived | 4 seasons x 7 days |
| Day/night cycle | Real-time | Derived | Follows local server time (or multiplied time) |

**Speed Multiplier (Server Configuration):**
Admins can set a speed multiplier (default: 1.0) to accelerate game time. At 2x, one real hour equals two game hours. This affects day/night cycle, NPC schedule pacing, and season progression. It does NOT affect farming growth timers (those are always in real time). The multiplier is a server-level setting, not a player setting -- all players on a server experience the same time flow.

**Server Tick Rate:** 10 ticks/sec (100ms per tick). Ticks synchronize entity positions and state. The game clock is derived from real system time multiplied by the speed multiplier, not advanced by ticks.

**Day/Night Cycle:** Dawn (5:00--7:00), day (7:00--17:00), dusk (17:00--19:00), night (19:00--5:00). Lighting changes smoothly via tint overlay. At night, streetlights turn on and windows glow. At multiplier > 1, these transitions accelerate accordingly.

**Sleep Mechanic:** Because this is an MMO, sleeping does NOT fast-forward time. When a player puts their character to bed, the character rests (gaining any rest-related buffs) but the world continues at the same pace. Other players and NPCs are unaffected. The player can log out and return later.

**Seasons:** Spring, Summer, Autumn, Winter. Each season lasts 7 real days by default (configurable per server). Seasons affect: available crops, NPC behavior, map visuals (greenery, yellowed trees, snow, blossoms), and available events.

**Weather:** Sunny, cloudy, rain, thunderstorm, snow (winter). Rain boosts crop growth rate by 25%. During thunderstorms, NPCs take shelter indoors (revise their plans). Snow covers the map in winter -- a separate snow tile layer.

---

## 7. Generative AI Agents (NPC Service)

### 7.1 System Overview

Every NPC in Quiet Haven is a generative agent built on architecture inspired by the research paper "Generative Agents: Interactive Simulacra of Human Behavior" (Stanford, Joon Sung Park et al.). An agent is not a dialogue tree or a finite state machine. It is an LLM model enriched with personalized memory, a reflection system, and autonomous planning.

The NPC Service is a unified server-side subsystem managing the full NPC lifecycle: from spawning to daily planning, from navigation to dialogue and memory.

### 7.2 NPC Service Architecture

```
                    NPC SERVICE
  +--------------+  +--------------+  +------------------+
  |  Lifecycle    |  |  Movement    |  |  AI / Dialogue   |
  |  Manager      |  |  Engine      |  |  Engine          |
  |              |  |              |  |                  |
  | - spawn/     |  | - A* path-   |  | - prompt builder |
  |   despawn    |  |   finding    |  | - Claude API     |
  | - daily plan |  | - schedule   |  | - conversation   |
  | - tick loop  |  |   executor   |  |   state machine  |
  | - state FSM  |  | - collision  |  | - quick replies  |
  | - tier mgmt  |  |   avoidance  |  | - moderation     |
  +------+-------+  +------+-------+  +--------+---------+
         |                 |                    |
  +------+-----------------+--------------------+---------+
  |                   Memory System                        |
  |                                                       |
  |  - memory stream (write/read)                         |
  |  - importance scoring (Haiku)                         |
  |  - embedding generation (vector search)               |
  |  - retrieval (recency + importance + semantic)         |
  |  - reflection (daily synthesis via Sonnet)             |
  +-------------------------------------------------------+
                           |
  +------------------------+------------------------------+
  |                   Data Layer                           |
  |  PostgreSQL (npc_agents, memories, reflections)        |
  |  Redis (cached plans, dialogue locks, state)           |
  +-------------------------------------------------------+
```

**Deployment Model (Phase 0):** The NPC Service runs **inside the Colyseus server process** (not as a separate microservice) to eliminate network latency between game state and NPC logic. LLM calls are the only external I/O.

### 7.3 Agent Components

#### Seed Persona

A JSON document describing the agent's core identity. It sets a "direction" -- the LLM generates behavior consistent with the personality but not limited by it.

```json
{
  "name": "Marko",
  "age": 38,
  "profession": "Baker",
  "traits": ["extrovert", "generous", "impulsive", "creative", "anxious"],
  "bio": "Marko moved to Quiet Haven 5 years ago from a big city where he worked at a restaurant. He always dreamed of having his own bakery. He opened a shop on Market Street and is proud of every loaf. He fears his business won't survive if competitors appear.",
  "interests": ["baking", "football", "loud music"],
  "fears": ["bankruptcy", "loneliness"],
  "goals": ["expand the bakery", "find an apprentice"],
  "speech_style": "Loud, emotional, frequently uses exclamations. Constantly offers people to try fresh bread.",
  "daily_routine": {
    "06:00": { "action": "wake_up", "location": "home" },
    "06:30": { "action": "walk_to_bakery", "location": "bakery" },
    "07:00": { "action": "baking", "location": "bakery", "icon": "bread" },
    "12:00": { "action": "walk_to_cafe", "location": "cafe" },
    "12:30": { "action": "eating_lunch", "location": "cafe", "icon": "food" },
    "13:00": { "action": "walk_to_bakery", "location": "bakery" },
    "13:30": { "action": "selling", "location": "bakery", "icon": "coins" },
    "18:00": { "action": "walk_to_bar", "location": "bar" },
    "18:30": { "action": "socializing", "location": "bar", "icon": "beer" },
    "21:00": { "action": "walk_home", "location": "home" },
    "22:00": { "action": "sleeping", "location": "home" }
  },
  "locations": {
    "home": { "x": 10, "y": 45 },
    "bakery": { "x": 32, "y": 18 },
    "cafe": { "x": 28, "y": 22 },
    "bar": { "x": 40, "y": 25 }
  }
}
```

Note: NPC daily routines use 24-hour real-time hours. At the default 1:1 time ratio, Marko wakes at 06:00 real time and sleeps at 22:00 real time. If the server speed multiplier is set to 2x, these times are reached twice as fast (Marko's full day cycle takes 12 real hours instead of 24).

#### Memory Stream

A chronological list of all events the agent has "observed." Each memory is stored as a structure:

```json
{
  "timestamp": "2026-03-15T14:30:00Z",
  "description": "Player CoolFarmer gave me a basket of strawberries",
  "importance": 7,
  "type": "interaction",
  "related_entities": ["CoolFarmer"],
  "embedding": [0.12, -0.34, ...]
}
```

Events that create memories:

| Event | Description Template | Default Importance |
|-------|---------------------|-------------------|
| Dialogue turn | "Player {name} said: '{summary}'. I responded about {topic}." | Scored by Haiku |
| Gift received | "Player {name} gave me {item}." | 6--8 |
| Shop visit | "{name} visited my shop at {time}." | 3 |
| Weather change | "It started raining today." | 2 |
| Town event | "The town held {event}. {observation}." | 5--7 |
| NPC-NPC conversation | "I talked to {npc} about {topic}." | 4--6 |

Importance (1--10) is determined automatically via an LLM call (Claude Haiku).

#### Reflection

Once per real day (at a configurable hour, e.g. 04:00 server time), each agent "reflects" on accumulated memories. The system gathers the 20 most important recent memories and asks the LLM (Claude Sonnet) for higher-level insights. The result is 3--5 reflections:

```
"CoolFarmer often visits me and brings produce. I consider them a good friend."
"Lately there haven't been many buyers at the market in the morning. Maybe I should open later."
"Lena seemed sad yesterday. I should stop by the park to see her."
```

Reflections enter the Memory Stream tagged as `reflection` with elevated importance (8). This allows reflections-on-reflections -- essentially, abstract thinking.

With the real-time system, reflections happen once per real day (not every 24 game-minutes as in compressed time). This dramatically reduces LLM costs while providing a natural daily cadence that matches real-world patterns.

#### Planning

Each morning (at 06:00 game time, which equals 06:00 real time at default multiplier), the agent generates a daily plan. The system feeds to the LLM (Haiku): Seed Persona + last 10 reflections + season/weather + list of town events. The LLM generates an hourly plan.

Plans can be interrupted: if a player initiates conversation, the agent defers the current action. If an important town event occurs, the agent revises the plan.

With real-time, plans are generated once per real day, not every 24 game-minutes. If the speed multiplier is > 1, plans are generated once per game-day (which is shorter than a real day).

#### Retrieval (Memory Extraction)

When an agent needs to react to a situation, the system extracts relevant memories using a weighted formula:

```
Score = alpha * Recency + beta * Importance + gamma * Relevance

Recency: exponential decay, half-life = 48 real hours (2 real days)
Importance: normalized 0-1 from the 1-10 scale
Relevance: cosine similarity between query embedding and memory embedding

Default weights: alpha=1.0, beta=1.0, gamma=1.0
Phase 0 (no embeddings): alpha=1.0, beta=1.0, gamma=0.0 (skip semantic search)
```

The top 10 retrieved memories are fed into the LLM context.

Note: The memory half-life of 48 real hours means that memories from two days ago are weighted at 50%. This is appropriate for real-time pacing, as players interact with the game daily.

### 7.4 NPC State Machine

```
                +----------+
     +----------|  SLEEPING |<-----------+
     |          +----------+             |
     | wake_up (schedule)        sleep (schedule)
     v                                  |
+----------+  arrive_at    +----------+ |
| WALKING  |-------------->| WORKING  |-+
|          |<--------------|          |
+----------+  next_task    +----------+
     |                          |
     | player_interact          | player_interact
     v                          v
+----------+
| TALKING  | (dialogue session active)
+----------+
     |
     | dialogue_end
     v
(return to previous state)
```

States:
- **SLEEPING:** NPC at home, invisible or in bed sprite. No movement or dialogue. (22:00--06:00 real time at default multiplier)
- **WALKING:** Moving along path to next schedule destination. Visible, can be "caught" within interaction radius.
- **WORKING:** At scheduled location performing activity (baking, shopping, eating). Activity icon shown. Available for conversation.
- **TALKING:** Locked in dialogue with a player. Speech bubble visible. Other players see "busy" indicator.
- **IDLE:** Transitional state between activities. Standing, looking around.

### 7.5 NPC Tier System

Determines how much CPU/LLM budget an NPC receives based on proximity to players:

| Tier | Condition | Movement | Dialogue | LLM Model | Memory |
|------|-----------|----------|----------|-----------|--------|
| **FULL** | In dialogue OR within 5 tiles of a player | Full A* | Available | Sonnet | Full retrieval |
| **NEARBY** | Within viewport (~15 tiles) | Simplified (waypoints) | Available | Haiku | Cached only |
| **BACKGROUND** | Beyond all players' viewports | Teleport to next waypoint | Unavailable | None | None |

Tiers are recalculated every 1 second (not every tick -- optimization).

### 7.6 Dialogue System

#### Dialogue Lifecycle

```
INACTIVE -> GREETING -> TALKING -> FAREWELL -> ENDED
                         ^          |
                         +----------+ (if turns remain)
```

1. Player is within 2 tiles of NPC + presses E / taps
2. Server checks: NPC is not in dialogue with another player
3. Server marks NPC as `inDialogue=true`
4. Client opens DialogueWindow component
5. Server requests initial greeting from AI engine
6. AI engine: `seed_persona + time + NPC_action -> Claude API`
7. Response: `{ text, emotion, quick_replies: string[3-4] }`
8. Client displays greeting + quick reply buttons + free input option
9. Player selects a quick reply OR types free text
10. Repeats for up to 10 turns (5 from player, 5 from NPC)
11. At limit: AI generates farewell message. Window closes.
12. Server clears `inDialogue=false`

#### Input Mode -- Hybrid (Recommended)

By default, quick replies are shown (3--4 context-generated options). A "Say something" button opens a free text input field. This balances convenience and depth. Free text goes through a moderation filter.

#### Prompt Construction

```
+------------------------------------------+
| SYSTEM PROMPT                            |
|                                          |
| 1. Seed Persona (name, traits, bio,     |
|    speech style, profession)             |
| 2. Current Context (time, location,     |
|    activity, weather)                    |
| 3. Retrieved Memories (top 10)          |
| 4. Recent Reflections (top 5)           |
| 5. Relationship Summary (with player)   |
| 6. Rules (stay in character, length     |
|    limit, JSON response format)          |
+------------------------------------------+
| CONVERSATION HISTORY                     |
| Player: message 1                        |
| NPC: response 1                          |
| ...                                      |
+------------------------------------------+
| RESPONSE FORMAT                          |
| { "text": "...",                        |
|   "emotion": "...",                     |
|   "quick_replies": ["...", "...", "..."] |
| }                                        |
+------------------------------------------+
```

**Token budget per request:**
- System prompt: ~800 tokens
- Memories (10): ~400 tokens
- Reflections (5): ~200 tokens
- Conversation history (up to 10 turns): ~600 tokens
- **Total input:** ~2000 tokens max
- **Output:** ~100 tokens (1--3 sentences + emotion + quick replies)

#### Dialogue Animations

NPC portrait uses three animations from Portrait Generator: Talk (on response), Nod (on agreement), Shake Head (on disagreement). The LLM response includes `emotion` metadata that determines the animation.

#### Moderation

Pre-filter for incoming player messages:
- Keyword blocklist (slurs, explicit content)
- Length limit (500 characters max)
- Rate limit (1 message per 2 seconds per player)

If the filter triggers, the NPC responds in-character: "{Name} looks uncomfortable and changes the subject."

### 7.7 NPC Movement Engine

#### Pathfinding (A*)

- Grid: 1 tile = 1 node (16x16 pixels per tile on a 64x64 map = 4096 nodes)
- Algorithm: A* with Manhattan distance heuristic
- Performance: < 1ms per search on a 64x64 grid
- Caching: paths cached per (start, end) pair, invalidated on grid changes

#### Speed and Animation

- NPC walk speed: 60 px/sec (slower than the player's 100 px/sec -- NPCs walk leisurely)
- Animation: 4-directional walk cycle, 4 frames each, 8 FPS animation rate
- Idle: facing the object of interest (e.g., towards the shop counter when working)

#### Collision Avoidance

- **NPC-NPC:** When paths cross, the NPC with lower priority (alphabetical ID) pauses for 1 second, then recalculates path
- **NPC-Player:** NPCs path around players. If blocked, NPC waits up to 3 seconds then recalculates
- **Stuck detection:** If NPC hasn't moved for 5 seconds while in WALKING state, teleport to destination

### 7.8 LLM Cost and Optimization

#### Cost Budget

| Metric | Target |
|--------|--------|
| Per dialogue turn | < $0.007 |
| Per full dialogue (10 turns) | < $0.07 |
| Per NPC per real day (plan + reflections) | < $0.01 |
| Per player per real hour | < $0.01 |
| Per server per real hour (50 NPCs, 20 active players) | < $0.50 |

Note: The real-time model significantly reduces server-side NPC overhead compared to compressed time. With 1:1 time, daily plans and reflections happen once per real day (not once every 24 minutes). At compressed time, 50 NPCs would generate ~60 plans and 60 reflections per real hour. At real-time, 50 NPCs generate 50 plans and 50 reflections per real day. This reduces background NPC LLM costs by ~95%.

#### Optimization Strategies

1. **Plan caching.** The daily plan is generated once and executed deterministically. The LLM is needed only when the plan is interrupted.
2. **Agent tiering.** Three detail levels (FULL/NEARBY/BACKGROUND) -- see section 7.5.
3. **Reflection batching.** All agent reflections are triggered sequentially with 500ms delays between calls, once per real day.
4. **Dialogue caching.** Common greetings are cached. TTL: 1 real hour.
5. **Model routing.** Haiku for routine tasks (plan, importance, reaction), Sonnet for dialogues and reflections.

### 7.9 Initial NPC Agents

The town launches with 25 core NPC agents. Key characters:

**Mayor Victor** (55, M) -- Town founder. Warm optimist. Stands at Town Hall in the morning, patrols the town during the day, dines at the cafe in the evening. Issues tasks, shares news about events. Hidden conflict: the town is growing and he is losing control.

**Anna, Librarian** (29, F) -- Introvert, bookworm. Library 9:00--18:00. Remembers which books she recommended to each player. Quest chain: bring a rare book from a distant region.

**Marko, Baker** (38, M) -- Extrovert, loud, generous. Bakery 7:30--18:00. Treats friends to free bread. Competes with Sara.

**Sara, Confectioner** (32, F) -- Perfectionist, quiet. Confectionery across from the bakery. Competition can escalate into collaboration or conflict.

**Oleg, Fisherman** (62, M) -- Quiet, wise. At the dock from dawn to noon, at the bar in the evening. Knows stories about the "Old Town." His friendship is hard to earn but unlocks lore.

**Lena, Gardener** (44, F) -- Observant, poetic. In the park all day. Notices details -- if a player planted flowers on their homestead, Lena will mention it. Produces the most beautiful reflections in the game.

**Grandpa Stepan, Agronomist** (71, M) -- Grumpy but kind. Lives outside town. Crop and soil expert. Teaches farming mechanics. Quests for growing advanced crops.

**Zoya, Mysterious** (34, F) -- Recently appeared. Quiet, with fragmented memory. Lives on the outskirts near the forest. Seed Persona contains hidden information -- the engine of the main storyline.

**Egor, Mechanic** (40, M) -- Workshop on Market Street. Transport upgrades. Loves technology.

**Ira, Cafe Owner** (36, F) -- Caring, sociable. The cafe is the center of town life, where all NPCs cross paths. Ira knows all the gossip.

**Additional NPCs:** Mailman, school teacher, hardware store clerk, medic, carpenter, artist, musician, elderly gardener couple, mischievous child, and 10--12 more residents.

### 7.10 Agent Behavior in the World

NPCs physically move across the map following their daily plan (A* pathfinding on the tile map).

**Current Action.** A small pixel icon above the head (bread = baking, book = reading, fishing rod = fishing).

**Emotion Bubbles.** Periodically, an emoji bubble appears (from Modern UI): heart (happy), cloud (sad), exclamation mark (surprised), question mark (pensive). Generated from the current emotion state.

**Spontaneous Interactions.** When two NPCs end up near each other, the system may initiate a conversation between them (Haiku). 3--5 lines are displayed as text bubbles. Both agents remember the conversation. Players can "overhear."

---

## 8. Game Systems

### 8.1 Farming

The core economic mechanic. Players cultivate land on their homestead and sell produce.

#### Crops (19 varieties from Modern Farm, by season)

| Season | Crops |
|--------|-------|
| Spring | Potatoes, carrots, radishes, peas, strawberries |
| Summer | Tomatoes, peppers, corn, sunflowers, watermelon |
| Autumn | Pumpkin, eggplant, beets, cabbage, grapes |
| Winter | Garlic, onions (winter varieties), special winter greens |
| All-season | Wheat |

Each crop passes through stages: seed, sprout, growth, maturity, harvest, rot (if not collected). Visually -- sprites from Modern Farm with a separate frame per stage.

#### Crop Growth Times (Real Time)

Since the game uses real-time, all crop growth is measured in real hours and days:

| Crop | Growth Time | Watering | Harvest Value |
|------|------------|----------|---------------|
| Radishes | 12 real hours | 1x daily | 15 coins |
| Potatoes | 2 real days | 1x daily | 25 coins |
| Carrots | 2 real days | 1x daily | 20 coins |
| Strawberries | 3 real days | 2x daily | 35 coins |
| Tomatoes | 4 real days | 2x daily | 30 coins |
| Corn | 5 real days | 1x daily | 40 coins |
| Pumpkin | 6 real days | 2x daily | 60 coins |
| Watermelon | 7 real days (full season) | 2x daily | 80 coins |

Rain provides a 25% growth speed bonus (reducing time by 25%). Sprinkler automation removes manual watering requirements. Crops planted out of season will not grow.

Players who cannot log in daily will see crops that have advanced when they return -- growth continues in real time regardless of player presence.

#### Farming Cycle

Prepare soil (hoe) -> plant seeds -> water (watering can or sprinkler) -> wait for growth (12 hours to 7 real days depending on crop) -> harvest -> repeat or let soil rest.

#### Animals

| Animal | Product | Frequency | Requirement |
|--------|---------|-----------|-------------|
| Chickens | Eggs | Every 24 real hours | Feed daily |
| Cows | Milk | Every 24 real hours | Feed daily |
| Pigs | Truffles | Once per season (7 real days) | Feed daily |
| Sheep | Wool | Every 3 real days | Feed daily |
| Dogs | None | N/A | Feed daily; boosts mood, guards farm |

Each animal requires feeding and care. Unfed animals become sick (sad sprite) and stop producing.

#### Processing

Raw products can be processed into higher-value goods:

| Raw Material | Product | Station |
|-------------|---------|---------|
| Milk | Cheese | Cheese Press |
| Eggs + Flour | Pastries | Kitchen |
| Fruits | Jam | Kitchen |
| Wool | Fabric | Loom |
| Vegetables | Pickles | Kitchen |

Recipes are unlocked through NPC quests (Grandpa Stepan -- farming recipes, Ira -- culinary recipes).

#### Tool Animations

All tool animations (hoe, watering can, axe, fishing rod, sickle, shears) from the Modern Farm asset, synchronized with Farmer Generator.

### 8.2 Economy

#### Currency

- **Coins** -- primary currency
- **Stars** -- premium/event currency, earned through festival participation and achievements

#### Living Market

The Farmers' Market in the town center uses **dynamic pricing:**

- **Supply coefficient:** If many players sold tomatoes in the last 3 real days, the price drops (up to -40%). If few -- it rises (up to +60%).
- **Season coefficient:** Seasonal goods are cheaper in their season, more expensive out of season.
- **Quality coefficient:** "Golden" (rare) product versions sell for x3.

The NPC merchant comments contextually: "Tomatoes? More of them? My warehouse is already full..." or "Oh, blue strawberries! Haven't seen those in ages, I'll give you a great price!"

#### Player-to-Player Trading

- Direct exchange (approach a player, propose trade)
- Market stalls (a player sets up a stall with goods for sale, even after leaving town)

#### NPC Shops

Each shop has rotating inventory depending on the season and the behavior of the NPC owner. If Marko's reflection leads him to experiment with a new recipe, a new bread type appears in his shop.

### 8.3 Crafting and Professions

Professions are soft specializations, not rigid class choices. Players gain experience through practice:

| Profession | Description | Related NPCs |
|-----------|------------|--------------|
| Farmer | Growing crops, tending animals | Grandpa Stepan |
| Cook | Cooking dishes from produce | Ira, Marko |
| Fisher | Fishing (mini-game at the dock) | Oleg |
| Carpenter | Building, repairs, homestead expansion | Egor |
| Florist | Decorative plants, bouquets (high value) | Lena |
| Explorer | Resource gathering in the forest, lore research | Zoya |

Each profession grants unique recipes and access to special quests. No restrictions -- all can be developed, but specialization grants efficiency bonuses.

### 8.4 Quest System

#### Structural Quests

Tied to the main storyline and content updates. Fixed structure and triggers, but dialogue is generated dynamically (NPCs describe tasks in their own words, in their own style, considering their relationship with the player).

#### Organic Quests

Arise spontaneously from agent state. If Marko's reflection produces the thought "my roof is leaking, I need help," he approaches a player friend and asks for repairs. The system detects a "problem" in reflections and transforms it into a quest: task + reward + deadline. If the player doesn't help, Marko asks another NPC or player.

#### Notice Board

In the central square -- daily tasks: "Bring 10 tomatoes to the market," "Talk to Lena," "Collect 5 crayfish at the beach." Simple tasks for daily activity and quick earnings. Tasks refresh every 24 real hours.

### 8.5 Town Events

#### Regular Events

- Daily Farmers' Market (8:00--18:00 real time)
- Weekly Saturday Festival (culinary, floral, musical, or sports theme) -- every 7 real days
- Seasonal Harvest Festival (end of each season -- every 7 real days)
- New Year Festival (end of winter season)

#### Emergent Events

Generated from the aggregate state of agents:

- Average NPC "happiness" > 8/10 -> spontaneous celebration in the park
- Multiple agents simultaneously "worried" -> town meeting at Town Hall
- Two NPCs in serious conflict -> the town "takes sides," players can intervene
- Players massively ignore the market -> NPCs complain about shortages, mayor calls a meeting

#### Meta Events

Global server events from developers: new story act launch, district opening, new NPC arrival, natural phenomena (hurricane, lunar eclipse).

---

## 9. Storyline

### 9.1 World Backstory

Twenty years ago, the world experienced the "Quiet Crisis" -- not a war, not a catastrophe, but a gradual collapse of global infrastructure. Digital systems became unreliable, megacities became unmanageable. People began returning to small communities. Mayor Victor, a former city architect, gathered like-minded people and founded Quiet Haven -- a town built on the principles of self-sufficiency and human connection.

The town thrives, but holds a secret: it was not founded by chance. Victor received coordinates and a blueprint from an anonymous source -- a project codenamed "Nookstead" (the technical code name stuck). What this project is, who is behind it, and why here -- all of this is revealed through the main storyline.

### 9.2 Act I -- "New Life" (Launch)

**Trigger:** Game start.

The player moves to Quiet Haven. Mayor Victor meets them at the dock, shows the town, and leads them to their plot. The first 3--5 real days serve as a tutorial: clearing the plot, repairing the house, planting the first crop, first trip to the market, meeting key NPCs.

Quest chain: "The Mayor asks new residents to introduce themselves to their neighbors" -- meeting 5--6 core NPCs. The agent knows it is meeting a newcomer and generates appropriate first lines.

First hook: in the forest, the player meets Zoya. "You're new? ...Me too... I think... recently." Her fragmented phrases launch the intrigue.

### 9.3 Act II -- "Echoes of the Past" (~3 months after launch)

**Trigger:** Reputation level 10.

During park expansion, workers find a time capsule: photographs of the location before the town was founded, an unknown explorer's journal, an electronic device.

The mayor is alarmed. Agents react differently: Oleg recognizes the old dock in the photos, Anna searches for information in books, Zoya goes into a trance at the sight of the device.

Quest chain: explore ruins in the forest, decipher the journal (cooperative quest), understand the device's purpose.

Climax: the device displays a hologram -- a map marked "Object N-7: social simulation."

### 9.4 Act III -- "The Architect" (~6 months after launch)

**Trigger:** Act II completion.

Quiet Haven is part of an experiment to create "ideal small communities." Project "Nookstead" studied the restoration of social bonds after the crisis. Zoya was a researcher whose memory was erased.

Finale: **server-wide vote.** Three options:

1. **"Destroy the data"** -- Residents never learn about the experiment. The town continues to live naturally. New district: underground park from the lab ruins.

2. **"Reveal the truth"** -- All NPCs find out. A week of "identity crisis": anger, philosophical musings. Eventually the town renews. New quest type: "research."

3. **"Use the data"** -- A "social predictor" shows likely NPC actions for the next day. A powerful tool with ethical questions. Some NPCs disapprove.

The result determines the server's development direction. Different servers get different content.

### 9.5 Future Development (Acts IV+)

Content updates every 3 months: new act + new region (via ferry) + new NPCs + new crops/recipes + new events + cosmetics.

---

## 10. Multiplayer and Social Systems

### 10.1 Server Structure

Each server hosts up to 100 concurrent players + 25--50 NPC agents. Servers are named (e.g., "Cedar Shore," "Dandelion Bay"), creating a sense of belonging to a specific community. Servers are independent -- each develops uniquely.

### 10.2 Social Mechanics

**Homestead Visits.** Invite a friend. Guests see the interior, garden, and farm. Likes. "Showcase of the Week" -- a carousel of the best homesteads on the loading screen.

**Guilds.** Up to 10 members. Shared plot -- cooperative farm. Guild quests (large deliveries, construction of public buildings).

**Chat.** Three channels: local (visible nearby), town-wide (everyone in town), guild. Auto-filter + reporting system.

**Emotes and Gestures.** Quick animations: wave, nod, applaud, show item, dance.

### 10.3 Network Architecture

```
Client (Phaser.js)              Colyseus Server
  |                                  |
  |-- JOIN room "town-1" ---------->|
  |<--- Room state (all entities) --|
  |                                  |
  |-- Input: move(direction) ------>|  (10x/sec max)
  |<--- State patch (positions) ----|  (10x/sec)
  |                                  |
  |-- LEAVE ----------------------->|
```

- Server maintains `WorldState` schema with all player and NPC positions
- Client sends movement input (direction + speed), NOT position
- Server validates movement against the collision map
- Colyseus patches state to all clients every 100ms (10/sec)
- Client-side interpolation smooths movement between patches

### 10.4 Player Interaction with the NPC Ecosystem

Players are full participants in the town's social fabric. NPCs remember interactions with players the same way they remember interactions with other NPCs:

- Regular customer -> NPC offers a discount or asks for help
- Many players help Lena -> reflection: "The new residents care about nature"
- Rudeness to an NPC -> the agent avoids contact and shares with others: "Be careful with that newcomer"

Reputation matters -- this is a real social space.

---

## 11. Progression Systems

### 11.1 Player Progression

#### Town Reputation

A single metric (1--30) that grows through: selling goods, completing quests, participating in events, helping NPCs.

| Level | Unlocks |
|-------|---------|
| 1--4 | Basic town access |
| 5 | Scooter |
| 10 | Act II story trigger |
| 15 | Pickup truck, plot expansion |
| 20 | Exclusive events |
| 25 | Special districts |
| 30 | Endgame transport, maximum privileges |

#### Individual NPC Relationships

Not a numeric scale but a textual reflection. For gameplay purposes, the system converts reflections into 5 tiers:

| Tier | Abilities |
|------|-----------|
| Stranger | Basic interaction |
| Acquaintance | NPC greets you |
| Casual Friend | Shares gossip |
| Friend | Discounts, home invitations, help quests |
| Close Friend | Personal secrets, unique gifts |

Relationships can deteriorate due to rudeness, neglect, or harm to those the NPC cares about.

### 11.2 Difficulty Progression

- Starter crops: fast growth, simple care
- Advanced crops: longer growth, require watering, fertilizer, correct season
- Processing: increasingly complex recipes with multiple ingredients
- Organic quests: complexity increases with relationship depth
- Story quests: cooperative tasks requiring player coordination

### 11.3 Content Progression

- **Phase 1 (launch):** 3 town districts, 5 NPCs, basic farming, Act I
- **Phase 2 (alpha):** Full town, 25 NPCs, all crops and animals, all professions
- **Phase 3 (beta):** 100 players, guilds, cosmetic shop
- **Post-launch:** New region every 3 months via ferry

---

## 12. User Interface

### 12.1 HUD (Persistent Elements)

Built on the Modern User Interface asset (sizes 16x16, 32x32, 48x48).

| Element | Position | Purpose |
|---------|----------|---------|
| Clock + Day/Season | Top left | Current real time + game season indicator. If speed multiplier > 1, shows accelerated game time with a small fast-forward icon |
| Coins + Stars | Top right | Currency balance |
| Quick Inventory (6 slots) | Bottom bar | Quick access to items |
| Menu Button | Bottom right | Opens main menu |

### 12.2 Interface Windows

**Inventory:** Full-screen window (Modern UI frame), item grid, filters (crops, products, tools, decor), information about the selected item.

**Dialogue Window:** NPC portrait on the left (Talk/Nod/Shake animation), text on the right, reply options or input field at the bottom. NPC name and emotion icon above the text. Typewriter effect (50ms/character). On mobile -- full-screen mode.

**Town Map:** All districts, known NPC positions (markers), friend-player positions. Click on a bus stop for quick travel.

**Shop/Market:** Item grid (Modern Farm icons), prices, descriptions. Buy/sell buttons. NPC merchant's commentary.

**Settings Menu:** Toggles (sound, music, notifications), sliders, buttons from Modern UI.

### 12.3 Mobile Adaptation

- Virtual joystick for movement
- Tap for interaction
- Full-screen dialogue windows
- Enlarged touch zones (minimum 44x44 CSS pixels)
- Adaptive HUD

---

## 13. Art Direction

### 13.1 Visual Style

Pixel art, 16x16 tiles, top-down perspective. Warm palette, clean pixels, modern (not fantasy) setting. All assets from the LimeZu Modern series for consistent style.

### 13.2 Rendering Parameters

- **Base resolution:** 480x270 pixels
- **Scale:** x3 (1440x810) or x4 (1920x1080)
- **Renderer:** WebGL with Canvas fallback (`Phaser.AUTO`)
- **Pixel Art Mode:** `pixelArt: true, roundPixels: true` for crisp rendering
- **Scaling:** `Phaser.Scale.FIT` to fill available space

### 13.3 Render Layers (bottom to top)

1. `ground` -- terrain, water, paths
2. `shadows` -- building shadows
3. `objects_lower` -- walls, furniture (lower level)
4. `characters` -- characters (players and NPCs)
5. `objects_upper` -- tree canopies, rooftops (above characters)
6. `collision` -- invisible collision layer for navigation
7. UI overlay

### 13.4 Tile Maps

- **Editor:** Tiled (mapeditor.org)
- **Export format:** JSON (Tiled JSON Map Format)
- **Assets:** LimeZu Modern series (16x16 tilesets)
- **Character sprite sheets:** 16x16 per frame, 4 directions, 4 frames = 256x64 per character
- **Optimization:** PNG with indexed color (8-bit), packed into 512x512 or 1024x1024 atlases

### 13.5 Color Palette

Warm, cozy palette from the LimeZu Modern series:
- Primary: warm earth tones, soft greens, warm browns
- Accent: bright florals, seasonal accents
- UI: neutral, readable, with warm undertones

### 13.6 Visual References

- Stardew Valley (pixel art quality benchmark)
- Eastward (atmosphere and detail)
- LimeZu Modern asset pack (stylistic foundation)

---

## 14. Sound Design

### 14.1 Music

Genre: Lo-fi / Indie Folk / Ambient. Different tracks for each context:

| Location/Context | Style |
|-----------------|-------|
| Homestead | Quiet, cozy |
| Town (daytime) | Lively, acoustic guitar |
| Town (evening) | Jazz, piano |
| Night | Ambient, crickets |
| Market | Upbeat, percussion accent |
| Festival | Celebratory, accordion |

**Format:** OGG Vorbis, 128kbps, streamed (not preloaded). Mobile: lower bitrate variants.

### 14.2 Sound Effects

Footsteps on grass/paths, door opening, water splash, hoe strike, watering, cow mooing, chicken clucking, coin jingle, quest notification, bus hum, bicycle bell. NPC "voice" -- mumbling/chirping per character (like Animal Crossing).

**Format:** OGG Vorbis, 64kbps, preloaded.

---

## 15. Technical Architecture

### 15.1 Three-Layer Architecture

```
Layer 1: CLIENT (Next.js 16 + Phaser.js 3)
  - Next.js: web shell, routing, auth, non-game UI
  - Phaser.js 3: game canvas rendering (tile maps, sprites, animations)
  - Communication with server: Colyseus.js WebSocket client

Layer 2: GAME SERVER (Node.js + Colyseus 0.15+)
  - Authoritative game state (positions, NPC schedules, game clock)
  - NPC Service (inside server process for Phase 0)
  - Room management (one room = one server/world)
  - 10 ticks/sec for position synchronization
  - Game clock derived from real time + speed multiplier

Layer 3: AI SERVICE (Node.js microservice)
  - All LLM calls (Claude API)
  - NPC dialogue, planning, reflection, reactions
  - Memory stream management and retrieval
  - Queue-based request processing (BullMQ / Redis)
```

### 15.2 Monorepo Structure (Nx)

```
apps/
  game/                  # Next.js 16 (client) -- EXISTS
    src/
      app/               # App Router
        page.tsx          # Landing/lobby
        play/page.tsx     # Game page (Phaser canvas)
      components/
        game/
          PhaserGame.tsx  # Dynamic import Phaser (no SSR)
          GameCanvas.tsx
        ui/
          DialogueWindow.tsx
          HUD.tsx
          Inventory.tsx
      lib/
        phaser/
          config.ts
          scenes/         # BootScene, TownScene, HomesteadScene
          entities/       # Player, NPC
          systems/        # TilemapLoader, CameraController, InputManager
        colyseus/
          client.ts
          room-handlers.ts
          state-sync.ts

  game-e2e/              # Playwright E2E tests -- EXISTS

  server/                # Colyseus game server -- TO CREATE in M0.2
    src/
      rooms/
        TownRoom.ts
        schemas/          # PlayerState, NPCState, WorldState
      npc-service/        # NPC Service (all modules)
        lifecycle/
        movement/
        dialogue/
        memory/
        ai/
        data/
        types/
      entities/
        GameClock.ts      # Real-time clock with configurable multiplier
      index.ts

  ai-service/            # NPC AI microservice -- TO CREATE in M0.3
    src/
      routes/             # dialogue, plan, reflect, react, conversation
      services/           # claude-client, memory-retrieval, prompt-builder
      models/             # agent, memory
      index.ts

libs/
  shared/                # Shared TypeScript types -- TO CREATE in M0.2
    src/
      types/              # player, npc, world, messages
      constants/          # game-config (tick rate, time multiplier, season length, etc.)
```

### 15.3 Phaser.js Integration with Next.js

Phaser.js must be dynamically imported to avoid SSR issues (Phaser requires `window` and `document`):

```typescript
// apps/game/src/components/game/PhaserGame.tsx
'use client';
import { useEffect, useRef } from 'react';

export default function PhaserGame() {
  const gameRef = useRef<Phaser.Game | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    import('phaser').then((Phaser) => {
      if (gameRef.current || !containerRef.current) return;
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: 480,
        height: 270,
        pixelArt: true,
        roundPixels: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: 'arcade',
          arcade: { debug: false },
        },
        scene: [],
      };
      gameRef.current = new Phaser.Game(config);
    });
    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />;
}
```

### 15.4 Colyseus State Schema

```typescript
class Position extends Schema {
  @type('number') x: number = 0;
  @type('number') y: number = 0;
}

class PlayerState extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type(Position) position = new Position();
  @type('string') animation: string = 'idle_down';
}

class NPCState extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type(Position) position = new Position();
  @type('string') animation: string = 'idle_down';
  @type('string') currentAction: string = '';  // Icon above head
  @type('string') emotion: string = 'neutral'; // Emotion bubble
  @type('boolean') inDialogue: boolean = false;
}

class GameClockState extends Schema {
  @type('number') hour: number = 6;         // 0-23 (derived from real time * multiplier)
  @type('number') minute: number = 0;       // 0-59
  @type('number') gameDay: number = 1;      // Days elapsed since server start
  @type('string') season: string = 'spring';
  @type('string') weather: string = 'sunny';
  @type('number') speedMultiplier: number = 1.0; // Server-configurable
  @type('number') seasonLengthDays: number = 7;  // Real days per season
}

export class WorldState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type({ map: NPCState }) npcs = new MapSchema<NPCState>();
  @type(GameClockState) clock = new GameClockState();
}
```

**GameClock Implementation:**

```typescript
// apps/server/src/entities/GameClock.ts
class GameClock {
  private serverStartTime: number;    // Unix timestamp (ms) when server world was created
  private speedMultiplier: number;    // Default 1.0
  private seasonLengthDays: number;   // Default 7 (real days per season)
  private timezone: string;           // Server timezone, e.g. 'UTC'

  getGameTime(): GameTime {
    const now = Date.now();
    const elapsed = (now - this.serverStartTime) * this.speedMultiplier;

    // Time of day: derive from real time adjusted by multiplier
    const realDate = new Date(this.serverStartTime + elapsed);
    const hour = realDate.getUTCHours();
    const minute = realDate.getUTCMinutes();

    // Days and seasons: count elapsed real days (adjusted by multiplier)
    const elapsedRealMs = now - this.serverStartTime;
    const elapsedGameMs = elapsedRealMs * this.speedMultiplier;
    const elapsedGameDays = Math.floor(elapsedGameMs / (24 * 60 * 60 * 1000));
    const gameDay = elapsedGameDays + 1;
    const seasonIndex = Math.floor(elapsedGameDays / this.seasonLengthDays) % 4;
    const seasons = ['spring', 'summer', 'autumn', 'winter'];

    return {
      hour, minute, gameDay,
      season: seasons[seasonIndex],
      year: Math.floor(elapsedGameDays / (this.seasonLengthDays * 4)) + 1,
    };
  }

  // Returns true if it's a new game-day since the last check
  isNewGameDay(lastCheckedDay: number): boolean {
    return this.getGameTime().gameDay > lastCheckedDay;
  }
}
```

At the default multiplier (1.0), the game clock simply mirrors real time. At 2x, a 12-hour real period covers a full 24-hour game day. The server broadcasts `GameClockState` to all clients, which use it for day/night rendering and UI display.

### 15.5 Database Schema (PostgreSQL)

```sql
-- Players
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username VARCHAR(32) UNIQUE NOT NULL,
  server_id VARCHAR(64) NOT NULL,
  reputation_level INTEGER DEFAULT 1,
  coins INTEGER DEFAULT 100,
  stars INTEGER DEFAULT 0,
  homestead_data JSONB DEFAULT '{}',
  inventory JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_login TIMESTAMPTZ DEFAULT NOW()
);

-- NPC Agents
CREATE TABLE npc_agents (
  id VARCHAR(64) PRIMARY KEY,
  server_id VARCHAR(64) NOT NULL,
  seed_persona JSONB NOT NULL,
  current_plan JSONB DEFAULT '[]',
  current_state JSONB DEFAULT '{}',
  relationships JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Memory Stream
CREATE TABLE memories (
  id BIGSERIAL PRIMARY KEY,
  agent_id VARCHAR(64) REFERENCES npc_agents(id),
  server_id VARCHAR(64) NOT NULL,
  game_timestamp TIMESTAMPTZ NOT NULL,  -- Real timestamp (with speed multiplier context)
  game_day INTEGER NOT NULL,            -- Game day number for easy querying
  description TEXT NOT NULL,
  importance SMALLINT CHECK (importance BETWEEN 1 AND 10),
  memory_type VARCHAR(16) NOT NULL,     -- 'observation', 'interaction', 'reflection'
  related_entities TEXT[] DEFAULT '{}',
  embedding VECTOR(1536),               -- pgvector for semantic search
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_memories_agent ON memories(agent_id);
CREATE INDEX idx_memories_agent_time ON memories(agent_id, created_at DESC);
CREATE INDEX idx_memories_importance ON memories(agent_id, importance DESC);
CREATE INDEX idx_memories_type ON memories(agent_id, memory_type);
CREATE INDEX idx_memories_embedding ON memories
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- LLM Cost Log
CREATE TABLE llm_cost_log (
  id BIGSERIAL PRIMARY KEY,
  npc_id VARCHAR(64),
  player_id UUID,
  task VARCHAR(32) NOT NULL,
  model VARCHAR(16) NOT NULL,
  tokens_in INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_usd NUMERIC(8, 6) NOT NULL,
  latency_ms INTEGER NOT NULL,
  cached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_cost_npc ON llm_cost_log(npc_id, created_at);
CREATE INDEX idx_cost_player ON llm_cost_log(player_id, created_at);

-- Telemetry Events
CREATE TABLE telemetry_events (
  id BIGSERIAL PRIMARY KEY,
  event_name VARCHAR(64) NOT NULL,
  player_id UUID REFERENCES players(id),
  server_id VARCHAR(64),
  parameters JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_telemetry_event ON telemetry_events(event_name, created_at);
CREATE INDEX idx_telemetry_player ON telemetry_events(player_id, created_at);
```

### 15.6 Redis Cache Structure

```
npc:{npcId}:plan             -> JSON daily plan (TTL: 24 real hours at 1x; 12h at 2x; scaled by multiplier)
npc:{npcId}:state            -> JSON current FSM state (no TTL, updated every tick)
npc:{npcId}:greeting:{hour}  -> Cached greeting for this hour (TTL: 1 real hour)
npc:{npcId}:dialogue_lock    -> Player ID with dialogue lock (TTL: 5 minutes safety)
npc:{npcId}:tier             -> Current tier assignment (TTL: 5 seconds)
npc:reflection_queue         -> List of NPC IDs pending reflection (consumed by ReflectionEngine)
server:speed_multiplier      -> Current speed multiplier value
server:season_length_days    -> Current season length in real days
```

### 15.7 Input Management

```typescript
// Desktop: WASD/Arrow keys for movement, E for interact, I for inventory
// Mobile: Virtual joystick (left thumb), tap for interact

interface InputConfig {
  desktop: {
    move_up: ['W', 'UP'];
    move_down: ['S', 'DOWN'];
    move_left: ['A', 'LEFT'];
    move_right: ['D', 'RIGHT'];
    interact: ['E', 'SPACE'];
    inventory: ['I'];
    menu: ['ESC'];
  };
  mobile: {
    joystick: true;
    tap_interact: true;
    swipe_menu: true;
  };
}
```

### 15.8 Infrastructure

- **Hosting:** AWS or Hetzner (cost optimization)
- **Containerization:** Docker, orchestration via Docker Compose (initial) or Kubernetes (at scale)
- **CDN:** CloudFlare for static assets (sprite sheets, maps, audio)
- **Scaling:** Each game server is a separate process. At 100 players/server and 10 servers = 1000 players. Horizontal scaling by adding server worlds.

### 15.9 Project Dependencies

**Client (apps/game):**
```json
{
  "dependencies": {
    "phaser": "^3.80.0",
    "colyseus.js": "^0.15.0",
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  }
}
```

**Server (apps/server):**
```json
{
  "dependencies": {
    "@colyseus/core": "^0.15.0",
    "@colyseus/schema": "^2.0.0",
    "@colyseus/ws-transport": "^0.15.0",
    "express": "^4.18.0",
    "ioredis": "^5.3.0",
    "pg": "^8.11.0",
    "bullmq": "^5.0.0"
  }
}
```

**AI Service (apps/ai-service):**
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.30.0",
    "express": "^4.18.0",
    "ioredis": "^5.3.0",
    "pg": "^8.11.0",
    "bullmq": "^5.0.0",
    "pgvector": "^0.2.0"
  }
}
```

### 15.10 Environment Variables

```env
# apps/game/.env.local
NEXT_PUBLIC_COLYSEUS_URL=ws://localhost:2567
NEXT_PUBLIC_API_URL=http://localhost:3001

# apps/server/.env
DATABASE_URL=postgresql://localhost:5432/nookstead
REDIS_URL=redis://localhost:6379
AI_SERVICE_URL=http://localhost:3001
COLYSEUS_PORT=2567
GAME_SPEED_MULTIPLIER=1.0
SEASON_LENGTH_DAYS=7

# apps/ai-service/.env
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=postgresql://localhost:5432/nookstead
REDIS_URL=redis://localhost:6379
AI_SERVICE_PORT=3001
```

### 15.11 Performance Targets

| Metric | Target |
|--------|--------|
| Desktop FPS | 60 FPS stable |
| Mobile FPS | 30 FPS stable |
| Client load (desktop) | < 3 seconds |
| Client load (mobile) | < 5 seconds |
| Ping (position updates) | < 150ms |
| NPC dialogue latency | < 3 seconds (p50), < 5 seconds (p95) |
| Memory (desktop) | < 512 MB |
| Memory (mobile) | < 256 MB |
| AI cost per player per real hour | < $0.01 |
| Tick processing (50 NPCs) | < 5ms |
| A* on 64x64 grid | < 1ms |
| Memory retrieval (1000 records) | < 200ms |
| Daily reflections (50 NPCs) | < 5 minutes total (once per real day) |
| Bandwidth per client | < 10 KB/sec |

---

## 16. Analytics Framework

*Designed by Data Scientist Agent*

### 16.1 Core Metrics

#### Engagement Metrics

| Metric | Target |
|--------|--------|
| Session length | 25--40 minutes |
| Retention D1 | 50% |
| Retention D7 | 25% |
| Retention D30 | 15% |
| DAU/MAU | 30% |

#### Key Actions to Track

- `npc_dialogue_started` -- dialogue initiated with NPC
- `crop_planted` -- crop planted
- `crop_harvested` -- crop harvested
- `item_sold_at_market` -- item sold at market
- `quest_completed` -- quest completed
- `homestead_item_placed` -- item placed on homestead
- `transport_used` -- transport used
- `player_trade_initiated` -- player-to-player trade initiated

### 16.2 Telemetry Events

| Event | Fields | Frequency |
|-------|--------|-----------|
| `session_start` | session_id, player_id, platform, server_name | On connect |
| `session_end` | session_id, duration_s, actions_performed | On disconnect |
| `performance_sample` | fps, memory_mb, draw_calls, ws_latency_ms, active_players | Every 30 seconds |
| `npc_service_health` | active_npcs, tiers_breakdown, tick_ms, memory_count | Every 60 seconds |
| `npc_dialogue_start` | npc_id, player_id, npc_state, real_time, game_time | On dialogue open |
| `npc_dialogue_turn` | npc_id, player_id, turn_number, input_type, llm_model, latency_ms, tokens, cost, memories_retrieved | Each turn |
| `npc_dialogue_end` | npc_id, player_id, total_turns, total_cost, duration_s, end_reason | On dialogue close |
| `npc_reflection_generated` | npc_id, game_day, reflection_count, memories_processed, cost | On reflection (once per real day) |
| `npc_plan_generated` | npc_id, game_day, entries_count, cost | On daily plan (once per real day) |
| `npc_stuck` | npc_id, position, target, duration_s | On stuck detection |
| `npc_cost_alert` | server_id, hourly_cost, threshold | On budget exceeded |
| `farming_action` | action_type, crop_type, tile_position, tool_used, season | On farming action |
| `market_transaction` | item_id, quantity, price, transaction_type, vendor_id | On transaction |
| `player_movement_sample` | position_x, position_y, zone_id, transport_type | Every 30 seconds |
| `asset_load_time` | asset_name, load_time_ms, success | On asset load |
| `client_error` | error_type, error_message, stack_trace | On error |
| `speed_multiplier_changed` | server_id, old_value, new_value, admin_id | On multiplier change |

#### Real-Time Cost Model

With real-time (1:1), the NPC overhead model differs significantly from compressed time:

| Cost Component | Compressed Time (old) | Real Time (1:1) | Savings |
|---------------|----------------------|-----------------|---------|
| Plans (50 NPCs) | ~2.5x/real hour (every 24 min) | 50x/real day (once/day) | ~95% |
| Reflections (50 NPCs) | ~2.5x/real hour | 50x/real day | ~95% |
| Dialogues | Same (player-driven) | Same (player-driven) | 0% |
| Importance scoring | Same (event-driven) | Same (event-driven) | 0% |

The real-time model makes the background NPC "maintenance cost" negligible. The dominant cost is player-initiated dialogues.

### 16.3 Key Dashboards

1. **NPC Health:** Tier distribution, stuck events, route completion rate
2. **Dialogue Quality:** Turns per session, free text vs. quick reply ratio, duration, repeat conversation rate
3. **LLM Costs:** Per-NPC, per-player, per-hour breakdowns. Model usage split. Cache hit rate. Real-time vs. background cost split
4. **Memory System:** Growth rate, retrieval relevance scores, reflection quality (manual sampling)
5. **Performance:** FPS, load times, WebSocket latency, draw calls

### 16.4 A/B Testing Framework

| Category | Example Tests |
|----------|---------------|
| NPC dialogue quality | Prompt variations, number of memories in context |
| UI/UX | Dialogue window layouts, input methods |
| Onboarding | Tutorial pacing, NPC introduction order |
| Economy balance | Crop prices, growth times |
| Memory parameters | Alpha/beta/gamma weights, reflection frequency |
| Time system | Speed multiplier impact on engagement (1x vs. 2x vs. 3x) |
| Season length | 7 vs. 14 real days per season |

Statistical significance: 95%. Minimum sample size: 500 users/variant (prototype), 1000 at scale.

---

## 17. Monetization

### 17.1 Model: Free-to-Play with Cosmetic Shop

The base game is free. All gameplay progression is accessible without payment. Monetization is exclusively through cosmetic items that do not affect gameplay.

### 17.2 Revenue Streams

**Cosmetic Shop:**
- Clothing skins and accessories
- Decorative furniture (themed sets: "Cyber Loft," "Japanese Garden," "Retro 80s")
- Transport skins
- Unique emote animations
- Portrait frames
- Seasonal bundles (summer, winter, Halloween, Christmas)

**Seasonal Pass (Battle Pass) -- ~$5/season:**
- Free track: basic rewards for daily activity
- Paid track: exclusive cosmetics, unique companion pet, special title
- Season lasts 1 real week (aligned with game seasons). A new pass each week creates frequent engagement touchpoints. Alternatively, if season length is configured longer (e.g., 14 days), the pass aligns accordingly.

**Quality of Life Expansions -- $3--8:**
- Additional inventory slots
- Extra land plot
- Guest cottage (second home)

### 17.3 Pricing Analysis

| Game | Price | Model | Performance |
|------|-------|-------|------------|
| Palia | Free | F2P + Cosmetics | 6M accounts, monetization struggled |
| Stardew Valley | $15 | Premium | 40M copies, ~$600M |
| Animal Crossing: NH | $60 | Premium + DLC | 43M copies, ~$2.6B |
| The Sims 4 | Free (base) | F2P + DLC | $5B+ franchise revenue |

### 17.4 Revenue Projections

| Scenario | Year 1 |
|----------|--------|
| Conservative | $1.2M (50K MAU, 3% conversion, $8 ARPPU) |
| Optimistic | $4.5M (150K MAU, 5% conversion, $10 ARPPU) |

### 17.5 Anti-Monetization (What is NEVER sold)

- Crop growth acceleration
- Items with gameplay advantage
- Better seeds or recipes
- Access to NPC content (dialogues, quests, storyline)
- Lootboxes or gacha mechanics

---

## 18. Success Metrics

### 18.1 Player Engagement

| Metric | Target |
|--------|--------|
| DAU/MAU | 30% (high for casual MMO, achievable through daily NPC events) |
| Average session length | 25--40 minutes |
| Retention D1 / D7 / D30 | 50% / 25% / 15% |
| NPS | 50+ |

### 18.2 Business Metrics

| Metric | Target |
|--------|--------|
| Paying conversion rate | 3--5% |
| ARPPU | $8--12/month |
| AI cost / revenue per payer | < 10% of paying player revenue |
| User acquisition cost | $1--3 (organic + paid) |

### 18.3 Phase Targets

| Phase | Players | Revenue |
|-------|---------|---------|
| Month 1 | 10,000 accounts | $15K |
| Month 3 | 30,000 MAU | $50K/month |
| Year 1 | 50,000--150,000 MAU | $1.2M--$4.5M total |

### 18.4 Technical Metrics

| Metric | Target |
|--------|--------|
| FPS | 60 desktop, 30 mobile |
| Crash rate | < 1% |
| Dialogue latency | < 3 seconds (p50) |
| AI cost per player per real hour | < $0.01 |
| LLM cost per server per real hour | < $0.50 |

---

## 19. Risks and Mitigations

### 19.1 Critical Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|-----------|-------|
| LLM costs at scale | High | High | Caching, agent tiering, Haiku for routine tasks, dialogue limits (10 turns), reflection batching, real-time cost monitoring. Real-time model reduces background NPC costs by ~95% vs. compressed time | Data Scientist |
| NPC response quality (hallucinations, breaking character) | Medium | High | Strict system prompt with Seed Persona, post-processing, input moderation, A/B prompt testing | Sr Game Designer |
| Toxic free-text input from players | High | Medium | Input message filter, reporting system, auto-ban, NPCs ignore toxic content | QA Agent |
| Major studio announces AI NPC game | Medium | High | First-mover advantage, fast launch, community building, open NPC framework | Market Analyst |

### 19.2 Technical Risks

| Risk | Probability | Impact | Mitigation | Owner |
|------|------------|--------|-----------|-------|
| WebSocket load at 100 players | Medium | Medium | Authoritative server, 10 ticks/sec, LOD, lazy zone loading, load testing | Mechanics Developer |
| Phaser.js + Next.js SSR conflict | Medium | Medium | Dynamic import (no SSR), early testing in M0.1 | Mechanics Developer |
| NPC monotony over time | Medium | Medium | Stimulus event injection, Seed Persona updates, adding new NPCs | Sr Game Designer |
| Real-time pacing feels too slow | Medium | Medium | Server speed multiplier allows admins to speed up time. A/B test optimal default multiplier. Design engaging short-session activities | Sr Game Designer |

### 19.3 Market Risks

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Browser gaming stigma limits audience | Medium | Medium | Focus on quality, plan Electron wrapper post-launch, target casual/cozy audience |
| AI regulation restricts generative NPCs | Low | High | Monitor legislation, ensure compliance, avoid storing personal data in LLM context |
| Content drought between updates | Medium | Medium | AI NPCs generate emergent content, weekly season cycle creates natural variety, community events |

---

## 20. Development Roadmap

### 20.1 Phase 0 -- Prototype (8 weeks: February 14 -- April 10, 2026)

**Goal:** Prove the core USP -- a player walks around a shared town and talks to an AI NPC that remembers the conversation.

| Milestone | Period | Content | Success Criteria |
|-----------|--------|---------|-----------------|
| **M0.1** Walking on Tiles | Feb 14--27 | Phaser.js in Next.js, tile map, player movement, collisions, camera | 60 FPS desktop, 30 FPS mobile, load < 3s |
| **M0.2** Multiplayer Sync | Feb 28 -- Mar 13 | Colyseus server, player sync, NPCs on map, A* navigation, real-time game clock | 2+ players see each other, latency < 150ms |
| **M0.3** NPC Talks | Mar 14--27 | Claude API integration, Seed Persona, dialogue window, quick replies | Response < 3s, NPC in character, cost < $0.005/turn |
| **M0.4** NPC Remembers | Mar 28 -- Apr 10 | PostgreSQL + pgvector, memory stream, retrieval, reflections | NPC references past conversations, cost < $0.01/player-hour |
| **Go/No-Go** | April 10 | Assessment: quality, cost, stability | Decision on proceeding to Phase 1 |

Note: The real-time clock simplifies M0.2 implementation -- the GameClock reads system time rather than advancing a compressed clock. The cost target in M0.4 is lower ($0.01 vs. the previous $0.03) because the real-time model eliminates frequent background NPC plan/reflection cycles.

#### Detailed Weekly Schedule

**Week 1 (Feb 14--20):** Install Phaser.js, BootScene, create test tile map in Tiled, TownScene.

**Week 2 (Feb 21--27):** Player entity, movement, collisions, camera, mobile joystick, FPS testing.

**Week 3 (Feb 28 -- Mar 6):** Generate apps/server, WorldState schema, TownRoom, client connection, real-time GameClock.

**Week 4 (Mar 7--13):** Remote player rendering, interpolation, NPCs in WorldState, A* pathfinding, multi-client testing.

**Week 5 (Mar 14--20):** Generate apps/ai-service, /agent/dialogue endpoint, Marko Seed Persona, prompt builder, end-to-end flow.

**Week 6 (Mar 21--27):** DialogueWindow UI, quick replies, free text, moderation, quality tuning, cost tracking.

**Week 7 (Mar 28 -- Apr 3):** PostgreSQL + pgvector, memory creation, importance scoring, embeddings, retrieval.

**Week 8 (Apr 4--10):** Memory integration into prompts, reflections, end-to-end testing, cost analysis, Go/No-Go.

#### Go/No-Go Criteria

**GO if ALL of the following:**
1. Conversation with a memory-equipped NPC feels qualitatively different from scripted dialogue
2. LLM cost per player per real hour < $0.02 (target: $0.01) with a clear optimization path
3. Prototype runs 30+ minutes without crashes; supports 5+ concurrent players
4. NPC latency p95 < 5 seconds; FPS meets targets

**NO-GO if ANY of the following:**
1. Dialogue is indistinguishable from a generic chatbot
2. LLM cost > $0.05/real hour with no optimization path
3. Memory retrieval is irrelevant > 20% of the time
4. Technical blockers prevent basic functionality

### 20.2 Phase 1 -- Vertical Slice (4 months)

- Full homestead (house + farm + 5 crops + 2 animals)
- Town with 3 districts (square, market, park)
- 5 NPC agents with full architecture (memory + reflection + planning)
- Transport (bicycle)
- Farming and trading
- Basic UI
- One quest chain

### 20.3 Phase 2 -- Alpha (4 months)

- Complete town (all districts)
- 25 NPC agents
- All crops and animals
- All transport types
- Crafting and professions
- Full UI
- Act I storyline
- Multiplayer up to 20 players

### 20.4 Phase 3 -- Beta (3 months)

- Server optimization (100 players + 50 NPCs)
- Economy balancing
- Mobile adaptation
- Sound and music
- Guilds
- Cosmetic shop (MVP)
- Seasonal pass (structure)

### 20.5 Phase 4 -- Launch (1 month)

- Polish, bug fixes, marketing
- Landing page at nookstead.land
- Trailer, press kit
- Launch of first season with Act I

**Total timeline: ~14 months from development start to launch.**

### 20.6 Post-Launch

Update every 3 months: new story act + new region + new NPCs + new mechanics + seasonal pass.

- **Year 1:** 4 updates, complete Acts I--III storyline
- **Year 2:** World expansion (inter-server travel, new biomes, maritime mechanics)

---

## 21. Agent Sign-offs

*All agents must approve their sections before proceeding to development*

- [ ] **Market Analyst:** Market analysis and competitive intelligence complete
- [ ] **Sr Game Designer:** Core design and systems architecture approved
- [ ] **Mid Game Designer:** Content and mechanics specifications detailed
- [ ] **Sr Game Artist:** Art direction and visual style established
- [ ] **Technical Artist:** Technical art pipeline and requirements defined
- [ ] **UI/UX Agent:** Interface design and user experience planned
- [ ] **Data Scientist:** Analytics framework and telemetry designed
- [ ] **Producer Agent:** Project scope, timeline, and resources validated
- [ ] **QA Agent:** Testing plans cover all critical systems

**Final Approval:** [ ] **Master Orchestrator** -- Ready for development phase

---

*Document prepared for the Nookstead project v3.0. This is the DEFINITIVE reference document for the entire development team. Subject to updates as iteration progresses.*
