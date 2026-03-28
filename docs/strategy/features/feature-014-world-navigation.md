# Feature: World Navigation & Transport

**ID**: F-014
**Date**: 2026-03-22
**Priority**: Later
**Kano Category**: Performance
**WSJF Score**: CoD 15 / Duration 2 = 7.5
**Appetite**: M (2-3 weeks)

## Cross-References

| Source | Reference | What It Provides |
|--------|-----------|-----------------|
| Job | jobs-graph.md -> Job 2: "Learn the world's rhythms" | Navigation teaches world layout |
| Segment | segments.md -> Segment 5: "MMO Returnee" | Exploration nostalgia from early MMO days |
| Problem | No direct high-severity problem | QoL enhancement for larger world navigation |
| Risk | No direct RAT risk | Low risk feature |
| Strategy | strategy-canvas.md -> Platform Availability: Maintain at 3-4 | World needs to be traversable efficiently |
| Initiative | No direct initiative | Emerged from GDD transport system design |
| Opportunity | No direct opportunity-map entry | QoL feature supporting world exploration |

## Problem

**Job context**: "When the world expands beyond a single town area, players need efficient ways to move between their homestead, the town center, and other locations. Without transport, traversal becomes tedious, especially for players with limited session time (30-60 minutes)."

**Current workaround**: Walk everywhere. Acceptable for a single town but painful at scale.
**Cost of inaction**: Players spend valuable session time walking instead of interacting. Minor irritation, not a deal-breaker.

## Appetite

**Size**: M (2-3 weeks)
**Duration**: 2 weeks
**Rationale**: Low priority. At launch with a single town, walking is fine. Transport matters only when the world expands.

## Solution

**Key elements**:

1. **Fast Travel Points**: Discovered locations become fast-travel destinations. Click minimap marker to travel. 3-second transition animation.
2. **NPC-Run Transport**: Bus stop or cart system run by an NPC. The transport NPC has personality and may chat during the ride.
3. **Minimap**: Corner minimap showing nearby landmarks, NPC locations, and player homestead. Toggle with M key.

## Rabbit Holes

1. **Minimap rendering performance** -- Real-time minimap with 100 entities may impact frame rate. Mitigation: Update minimap every 2 seconds, not every frame.

## No-Gos

- **Mount/vehicle system**: No horses, bikes, or vehicles. Why: Exceeds scope. Fast travel is sufficient.
- **Flying/teleportation**: Why: Breaks cozy world immersion.

## Success Metrics

| Metric | Current | Target | Measurement Method |
|--------|---------|--------|-------------------|
| Average traversal time between key locations | N/A | <30 seconds with fast travel | Movement analytics |

## Acceptance Criteria

| # | Criterion |
|---|----------|
| 1 | Given a player has discovered the town center, When they click its minimap marker from their homestead, Then they are transported within 3 seconds |
| 2 | Given the minimap is visible, When NPCs move through the world, Then their positions update on the minimap within 2 seconds |

## WSJF Scoring Detail

| Dimension | Score (1-20) | Rationale |
|-----------|-------------|-----------|
| User/Business Value | 8 | QoL improvement. Reduces friction but does not drive acquisition or retention. |
| Time Criticality | 4 | Not needed until world expands beyond single town. |
| Risk Reduction | 3 | Does not address any identified risks. |
| **Cost of Delay** | **15** | |
| Job Duration | 2 | M appetite: 2-3 weeks for fast travel, NPC transport, and minimap. |
| **WSJF** | **7.5** | |
