# Sr Game Designer Agent Memory

## Project: Nookstead
- 2D pixel art MMO / life sim / farming RPG with generative AI NPCs
- Tech: Next.js 16 + Phaser.js 3 + Colyseus + Claude API
- Asset pack: LimeZu Modern series (16x16 base, scaled to 48x48 in-game)
- GDD: `D:\git\github\nookstead\main\docs\nookstead-gdd-v3.md` (definitive reference)

## Key Design Docs
- GDD v3 is the canonical document (v1/v2 exist but are superseded)
- Feature specs: `docs/documentation/design/mechanics/feature-spec-m0{1-4}-*.md`
- System designs: `docs/documentation/design/systems/`
- HUD spec: `docs/documentation/design/systems/hud-behavior-and-feedback.md`

## GDD v3 Key Parameters
- Energy: 100 max, costs per action (hoe:4, water:3, chop:6, fish:5, harvest:2)
- Time: Real-time 1:1 default with configurable server speed multiplier
- Seasons: 7 real days each (Spring, Summer, Autumn, Winter)
- Day/Night: Dawn 5-7, Day 7-17, Dusk 17-19, Night 19-5
- Hotbar: GDD says 6 slots (Section 12.1), HUD spec expanded to 10 slots
- Resolution: base 480x270, scaled 3x-4x; game constants show 1024x768

## Current State (as of 2026-02-14)
- Phase 0 prototype, M0.1 in progress
- Existing code: island map generation, autotiling, basic game scene
- GameHUD.tsx is a skeleton (5 placeholder slots, "Nookstead" label)
- HUD asset: `apps/game/public/assets/ui/hud.png` (LimeZu Modern UI spritesheet)
- Constants: TILE_SIZE=48, FRAME_SIZE=48, MAP 64x64

## Design Decisions Made
- HUD is React overlay on Phaser canvas (not rendered in Phaser)
- Energy system: no passive regen, sleep=100, exhaustion=wake at 50
- 10 hotbar slots (expanded from GDD's 6 to match farming RPG conventions)
- Currency: comma-separated numbers, particle arcs for large transactions
- Context-sensitive HUD with 8 defined states
- Mobile: condensed display, tap-to-expand pattern, 44px min touch targets
