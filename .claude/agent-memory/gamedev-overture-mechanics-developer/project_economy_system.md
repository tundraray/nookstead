---
name: Economy system implementation plan
description: Plan created for coins/economy system - first gameplay system with no prior economy code. Plan at docs/documentation/plans/plan-economy.md
type: project
---

Economy system plan created on 2026-03-14. Covers: player_economy DB table, market_transactions log, EconomyService (stateless functions), Colyseus integration via client.send (not schema field), HUD CoinCounter React component. Estimated 2-3 days.

**Why:** First core gameplay system needed before farming/trading can work. 100 starting coins, atomic SQL operations for spend/earn.

**How to apply:** When implementing economy features, reference plan-economy.md. Key decisions: coins sent via ServerMessage.COINS_UPDATE (not Colyseus schema field) for privacy; spendCoins uses SQL WHERE coins >= amount for atomicity; EconomyService is stateless functions not a class.
