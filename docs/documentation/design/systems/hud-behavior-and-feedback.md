# 4. HUD Behavior & Feedback

*Gameplay Designer Specification*
*Version: 1.0 | Date: February 14, 2026*
*Depends on: GDD v3 Sections 5 (Gameplay), 6.5 (Time/Weather), 8 (Game Systems), 12 (User Interface)*
*Asset Reference: LimeZu Modern User Interface (48x48, 32x32, 16x16 frames from `hud.png`)*

---

## Overview

This document defines the complete HUD feedback layer for Nookstead: every bar, badge, animation, tint, and transition that communicates game state to the player. The HUD is a React overlay rendered on top of the Phaser canvas (absolute-positioned), not rendered inside Phaser itself. This separation allows smooth CSS animations and accessibility features without competing for Phaser draw calls.

**Design Principles:**
- Information at a glance -- no reading required for core status.
- Feedback through motion -- small animations confirm every player action.
- Context-sensitive -- the HUD adapts to what the player is doing.
- Pixel-art-native -- all elements use LimeZu Modern UI frames; no flat or vector graphics.

**Screen Regions (1024x768 reference, scaled to fit):**

```
+----------------------------------+
| [Clock/Season]      [Coins/Stars]|  <- Top bar (48px tall)
|                                  |
|                                  |
|        (Phaser canvas)           |
|                                  |
|                                  |
| [Energy]  [--- Hotbar (10) ---] [Menu] | <- Bottom bar (56px tall)
+----------------------------------+
```

---

## 4.1 Energy System

### 4.1.1 Core Parameters

| Parameter | Value | Notes |
|-----------|-------|-------|
| Maximum energy | 100 | Flat cap; does not increase with progression |
| Display format | Vertical bar, left side of bottom bar | 8px wide, 48px tall |
| Numeric readout | Hidden by default; shown on hover/tap | e.g., "73/100" |
| Recovery (sleep) | Restore to 100 | Character must be in bed at home |
| Recovery (food) | Variable per item | See food table below |
| Recovery (passive) | 0 | No passive regeneration |
| Penalty (exhaustion) | Wake next morning at 50 energy | Forced rest; lose remainder of the day |

### 4.1.2 Energy Costs Per Action

| Action | Cost | Tool | Animation Duration |
|--------|------|------|--------------------|
| Hoe (till soil) | 4 | Hoe | 400ms |
| Water (per tile) | 3 | Watering Can | 350ms |
| Chop (per swing) | 6 | Axe | 500ms |
| Fish (cast) | 5 | Fishing Rod | 300ms (cast); mini-game drains 1/5sec while reeling |
| Harvest (pick crop) | 2 | Hand | 250ms |
| Sickle (cut grass/weeds) | 3 | Sickle | 350ms |
| Shear (animal) | 3 | Shears | 400ms |
| Plant seed | 1 | Hand | 200ms |
| Pet animal | 0 | Hand | 300ms (free action) |
| Walk / Run | 0 | -- | -- (movement is free) |

### 4.1.3 Food Recovery Values

| Food Item | Energy Restored | Acquisition |
|-----------|----------------|-------------|
| Bread (Marko's bakery) | 15 | Buy for 10 coins |
| Apple | 8 | Forage (autumn) |
| Cooked meal (basic) | 25 | Craft at kitchen |
| Cooked meal (advanced) | 40 | Craft at kitchen (recipe required) |
| Pie / Cake | 50 | Craft at kitchen (recipe from Ira) |
| Coffee (Ira's cafe) | 10 energy + 20% speed boost for 5 min | Buy for 15 coins |
| Energy Tonic | 60 | Rare drop / festival reward |

### 4.1.4 Visual Feedback States

The energy bar is rendered as a vertical fill inside a pixel-art frame (LimeZu panel border, 2px inset).

**Full (100-71 energy)**
- Bar color: `#4CAF50` (green)
- Fill behavior: Steady, no animation
- Icon: Small green leaf above bar (optional, toggled in settings)
- Sound: None

**Medium (70-31 energy)**
- Bar color: `#FFC107` (amber/yellow)
- Fill behavior: Steady, no animation
- Transition: Color shifts smoothly over 300ms when crossing the 70 threshold
- Sound: Single quiet chime when crossing into this range (first time per session)

**Low (30-11 energy)**
- Bar color: `#FF9800` (orange)
- Fill behavior: Subtle pulse animation -- bar brightens by 15% and dims back over a 2-second cycle (ease-in-out)
- Character effect: Small sweat drop particle above character head, plays every 10 seconds
- Transition: Color shifts over 300ms; pulse begins immediately
- Sound: Two-note descending chime when crossing into this range

**Critical (10-1 energy)**
- Bar color: `#F44336` (red)
- Fill behavior: Rapid shake animation -- bar jitters +/- 1px horizontally on a 200ms cycle
- Character effect: Character movement speed reduced to 50% of base (50 px/sec instead of 100 px/sec). Walk animation plays at half framerate. Sweat drop particle every 5 seconds.
- HUD effect: Thin red vignette border around screen edges (8px, 20% opacity)
- Transition: Shake begins immediately. Vignette fades in over 500ms.
- Sound: Low heartbeat-like thud, plays every 1.5 seconds

**Exhausted (0 energy)**
- Trigger: Player attempts an action that would reduce energy below 0, or energy reaches 0
- Sequence:
  1. **0ms**: Action is blocked. Tool does not swing. Text floater: "Too tired..." (white, 14px, fades over 1.5s)
  2. **500ms**: If energy is exactly 0 and player attempts another action: collapse sequence begins
  3. **Collapse**: Character plays stumble animation (2 frames, 400ms), falls to ground (sprite changes to "collapsed" frame)
  4. **1000ms**: Screen begins fading to black over 2000ms. Soft descending music sting plays.
  5. **3000ms**: Screen fully black. Text appears: "You passed out from exhaustion..." (typewriter, 40ms/char)
  6. **5000ms**: Fade back in. Character wakes in bed at home. Time is 06:00 next morning. Energy is 50.
  7. **Penalty**: 50% energy cap until the player eats food. Sleeping again restores to 100.

### 4.1.5 Energy Cost Preview

When the player hovers over a tile with a tool equipped (desktop) or long-presses a target tile (mobile), a small floating badge appears near the cursor showing the energy cost:

- Format: Small pixel-art bubble with "-4" (red text) for the energy cost
- Position: 8px above the cursor/finger position
- Duration: Appears after 200ms hover delay; disappears immediately on move
- If the action would reduce energy to critical or exhausted: the number flashes red

---

## 4.2 Clock & Time Display

### 4.2.1 Layout

Position: Top-left corner, 8px margin from edges.

```
+------------------------------------------+
| [Season Icon] Day 3 | 14:32  [Weather]   |
+------------------------------------------+
```

- **Panel**: LimeZu panel frame, approximately 192x32px
- **Font**: Pixel font, 16px (game resolution, scaled with canvas)
- **Season Icon**: 16x16 sprite, left-aligned inside panel
- **Day Counter**: "Day X" where X = current game day number (1-7 within a season, resets each season)
- **Pipe separator**: "|" character, 4px padding on each side
- **Time**: "HH:MM" in 24-hour format, updated every game-minute
- **Weather Icon**: 16x16 sprite, right-aligned inside panel

### 4.2.2 Time-of-Day Visual Feedback

The clock panel background tint shifts to reflect the current time period. These tints are CSS background-color transitions (duration: 2000ms, ease-in-out) applied to the panel container.

**Dawn (05:00-06:59)**
- Panel background: Warm orange tint (`rgba(255, 183, 77, 0.25)`)
- Sun icon: 16x16 sunrise sprite (half-sun at horizon line)
- Game world: Phaser applies warm orange-pink tint overlay fading in from night

**Day (07:00-16:59)**
- Panel background: Neutral (no tint, default panel color)
- Sun icon: 16x16 full sun sprite
- Game world: No overlay tint, full brightness

**Dusk (17:00-18:59)**
- Panel background: Purple/amber tint (`rgba(171, 71, 188, 0.2)` blended with `rgba(255, 152, 0, 0.15)`)
- Sun icon: 16x16 sunset sprite (half-sun, warm colors)
- Game world: Phaser applies purple-amber gradient overlay

**Night (19:00-04:59)**
- Panel background: Dark blue tint (`rgba(21, 47, 80, 0.4)`)
- Icon: 16x16 moon sprite replaces sun. Moon phase changes daily (8 phases across 28-day year cycle).
- Game world: Phaser applies dark blue overlay. Building windows glow (yellow point lights). Street lamps emit light circles.

### 4.2.3 Season Indicator

A 16x16 icon to the left of the day counter, with a 1px colored border matching the season:

| Season | Icon | Border Color | Tooltip |
|--------|------|-------------|---------|
| Spring | Green leaf / blossom | `#81C784` (soft green) | "Spring -- Day X of 7" |
| Summer | Yellow sun / sunflower | `#FFD54F` (warm yellow) | "Summer -- Day X of 7" |
| Autumn | Orange maple leaf | `#FF8A65` (burnt orange) | "Autumn -- Day X of 7" |
| Winter | White snowflake | `#B3E5FC` (ice blue) | "Winter -- Day X of 7" |

**Season Transition Animation:** On the first tick of a new season, the icon performs a 500ms flip animation (old icon flips out, new icon flips in). A toast notification also fires (see section 4.6).

### 4.2.4 Weather Icon

A 16x16 icon at the right edge of the clock panel:

| Weather | Icon | Additional Effect |
|---------|------|-------------------|
| Sunny | Yellow sun (static) | None |
| Cloudy | Gray cloud (gentle bob, 3s cycle) | None |
| Rain | Blue cloud with rain lines (rain lines animate, 4 frames, 200ms each) | HUD raindrop particles (see 4.5.7) |
| Thunderstorm | Dark cloud with lightning bolt (bolt flashes every 4-8 seconds, randomized) | Screen briefly flashes white (50ms, 5% opacity) on bolt |
| Snow | White cloud with snowflakes (snowflakes drift down, 3 frames, 300ms each) | HUD snowflake particles (see 4.5.7) |

### 4.2.5 Speed Multiplier Badge

Visible only when the server speed multiplier is greater than 1.0.

- Position: Immediately right of the time display, 4px gap
- Format: Small badge with ">>" icon + multiplier value (e.g., ">>2x")
- Style: Bright cyan text (`#00BCD4`) on a dark pill-shaped background
- Animation: ">>" arrows pulse (opacity 60%-100%) on a 1-second cycle to indicate accelerated time
- Tooltip (hover): "Game time is running at {X}x speed"

---

## 4.3 Hotbar Behavior

### 4.3.1 Layout

Position: Bottom-center of the screen, 8px margin from bottom edge.

```
+---+---+---+---+---+---+---+---+---+---+
| 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 0 |
+---+---+---+---+---+---+---+---+---+---+
```

- **Slot count**: 10
- **Slot size**: 48x48px each (matching LimeZu UI frame size)
- **Spacing**: 2px gap between slots
- **Total width**: 10 * 48 + 9 * 2 = 498px
- **Background**: LimeZu inventory slot frame (slightly recessed, warm brown border)
- **Key binding label**: Small "1"-"0" text in top-left corner of each slot (10px, 50% opacity)
- **Key bindings**: Number keys 1-9 and 0 (mapped to slots 1-10). Scroll wheel cycles active slot.

### 4.3.2 Active Slot

The currently selected slot has a distinct visual treatment:

- **Border**: Golden highlight border (`#FFD700`), 2px thick, replacing the default brown border
- **Scale**: Slot and its contents scale to 52x52px (2px boost on each side), using CSS `transform: scale(1.083)` with 150ms ease-out transition
- **Glow**: Faint golden glow effect (CSS `box-shadow: 0 0 6px rgba(255, 215, 0, 0.4)`)
- **Bounce on select**: When switching to this slot, a quick 100ms bounce (scale to 1.15 then settle to 1.083)

### 4.3.3 Empty Slot

- **Opacity**: 50% (dimmed)
- **Interior**: Dark fill, no icon
- **Interaction**: Clicking an empty slot still selects it (deselects current tool)

### 4.3.4 Item Display

- **Item icon**: Centered 32x32 sprite inside the 48x48 slot (8px padding)
- **Stack quantity**: For stackable items, a white number badge (12px bold, black 1px outline) in the bottom-right corner. Max stack: 99. If quantity > 99, display "99+".
- **Quality indicator**: Items with "Golden" quality have a small star icon (8x8) in the top-right corner of the slot.

### 4.3.5 Tool Durability Bar

Tools with durability display a thin horizontal bar (40x4px) below the tool icon, inside the slot frame:

| Durability % | Color | Animation |
|-------------|-------|-----------|
| 100-60% | `#4CAF50` (green) | None |
| 59-30% | `#FFC107` (yellow) | None |
| 29-10% | `#FF9800` (orange) | None |
| Below 10% | `#F44336` (red) | Pulses (opacity 60%-100%, 1s cycle) |
| Broken (0%) | Gray, empty bar | Tool icon gets a crack overlay; slot shakes briefly on use attempt |

When a tool loses durability from use, the bar decreases smoothly over 200ms (not instant).

### 4.3.6 Cooldown Overlay

After using a tool or consumable item, a cooldown indicator prevents spam:

- **Visual**: Semi-transparent gray overlay (`rgba(0, 0, 0, 0.5)`) sweeps clockwise from 12 o'clock, like a radial wipe
- **Duration**: Matches the tool's animation duration (200ms-500ms depending on tool; see section 4.1.2)
- **Interaction**: Slot is non-interactive during cooldown. Pressing the key again does nothing.
- **Completion**: Overlay disappears. A subtle 50ms white flash on the slot signals readiness.

### 4.3.7 Item Use Bounce Animation

When the player activates the item in the active slot:

- **Timing**: 150ms total
- **Motion**: Slot icon scales from 1.0 to 0.85 (50ms, ease-in) then back to 1.0 (100ms, ease-out-bounce)
- **Applies to**: Tools (on swing), food (on eat), seeds (on plant)
- **Does not apply to**: Selecting the slot (that has its own bounce, see 4.3.2)

### 4.3.8 Drag and Drop

Players can rearrange hotbar items via drag and drop:

- **Initiate**: Click and hold for 200ms (desktop), or long-press for 400ms (mobile)
- **Dragging**: Item icon follows cursor at 75% opacity. Original slot shows a dashed border placeholder.
- **Drop target highlight**: When dragging over another hotbar slot, that slot's border turns blue (`#42A5F5`).
- **Swap**: Dropping on an occupied slot swaps the two items. Dropping on an empty slot moves the item.
- **Cancel**: Dropping outside the hotbar returns the item to its original slot.
- **Animation**: On drop, the placed item does a small settle animation (scale 1.1 to 1.0, 100ms).

---

## 4.4 Currency Display

### 4.4.1 Layout

Position: Top-right corner, 8px margin from edges. Vertically stacked.

```
+-------------------+
| [Coin Icon] 1,250 |
| [Star Icon]    15 |
+-------------------+
```

- **Panel**: LimeZu panel frame, approximately 128x56px
- **Coin icon**: 16x16 golden coin sprite (from hud.png)
- **Star icon**: 16x16 blue/purple star sprite (from hud.png)
- **Amount text**: Right-aligned, pixel font, 16px. Numbers use comma separators for thousands (e.g., "1,250").
- **Spacing**: 4px vertical gap between coin row and star row

### 4.4.2 Earning Feedback (Gaining Currency)

When the player gains coins or stars:

1. **Number color**: Text turns `#4CAF50` (green) for 800ms, then fades back to default white over 200ms
2. **Bounce**: The number does a vertical bounce -- moves up 4px over 150ms (ease-out), settles back over 250ms (ease-in-out)
3. **Floater**: A "+{amount}" text floater appears 8px above the currency row, in green, drifts upward 16px over 1200ms while fading from 100% to 0% opacity. Font: 12px bold pixel font.
4. **Coin icon animation** (for amounts >= 50 coins): The coin icon does a single 360-degree spin over 400ms (ease-in-out)
5. **Sound**: Coin jingle sound effect (pitch varies slightly with amount: +0% for <10, +10% for 10-49, +20% for 50+)

### 4.4.3 Spending Feedback (Losing Currency)

When the player spends coins or stars:

1. **Number color**: Text turns `#F44336` (red) for 800ms, then fades back over 200ms
2. **Shake**: The number shakes horizontally +/- 2px over 300ms (3 oscillations)
3. **Floater**: A "-{amount}" text floater appears, in red, drifts downward 12px over 1000ms while fading out
4. **Sound**: Soft descending two-note chime

### 4.4.4 Large Transaction Animation

For transactions of 100+ coins:

- All standard earning/spending animations play
- Additionally: A cascade of 3-5 small coin particle sprites (8x8) arc from the transaction source (shop UI, market stall, crop sell) toward the coin counter in the HUD. Arc trajectory uses a quadratic bezier curve. Duration: 600ms staggered (100ms between each coin particle). Each particle fades and scales down to 0 on arrival.
- The coin icon does a double spin (720 degrees) instead of a single spin.

### 4.4.5 Insufficient Funds

When the player attempts a purchase without enough currency:

1. The currency amount text flashes red 3 times over 600ms (200ms per flash)
2. The amount text shakes horizontally (+/- 3px, 3 oscillations, 400ms)
3. A tooltip appears below the panel: "Not enough coins!" (red text, 12px, auto-dismiss after 2 seconds)
4. Sound: Error buzzer (short, low-pitched)

---

## 4.5 Contextual HUD Changes

The HUD adapts to the player's current activity. Transitions between contexts use 300ms fade animations unless otherwise specified.

### 4.5.1 Farming Context

**Trigger**: Player is on their homestead and has a farming tool equipped (Hoe, Watering Can, Sickle, Shears) or is standing adjacent to a crop/animal.

- **Hotbar**: Farming-related tools receive a subtle green border tint (`rgba(76, 175, 80, 0.3)`) to distinguish them from non-farming items
- **Energy cost preview**: Active (see section 4.1.5). When the player hovers over an actionable tile (e.g., dirt to hoe, crop to water), a small badge shows the energy cost
- **Crop info tooltip**: Hovering over a planted crop for 500ms shows a small popup: crop name, growth stage ("Sprout -- Day 2/5"), water status ("Needs water" / "Watered today"), season icon
- **Soil state indicator**: Tilled but empty soil tiles have a faint sparkle particle (one per 3 seconds) to indicate they are ready for planting

### 4.5.2 Town / Shopping Context

**Trigger**: Player enters a shop zone (Marko's Bakery, hardware store, market stall, etc.).

- **Currency display**: The coin counter panel gains a subtle golden pulse (border brightens by 20% and dims, 2-second cycle) to draw attention to the player's balance
- **Hotbar**: Normal display. However, "quick-use" is disabled for consumables while in a shop UI -- pressing a number key selects the slot but does not consume the item (prevents accidental eating while browsing)
- **Shop price comparison**: If the player has a matching item in inventory, the shop UI shows a small "Yours: {quantity}" label next to the shop listing

### 4.5.3 Dialogue Context (NPC Conversation)

**Trigger**: Player initiates dialogue with an NPC (presses E within 2 tiles).

- **HUD fade**: All HUD elements (hotbar, energy, clock, currency) fade to 30% opacity over 300ms
- **Exception**: The Menu button (bottom-right) remains at 100% opacity and is fully interactive, allowing the player to exit dialogue or access settings
- **Exception**: If the NPC is a shopkeeper and the dialogue transitions to a shop interface, the currency display fades back to 100%
- **Dialogue Window**: Appears center-bottom, overlaying the hotbar area. See GDD Section 12.2 for dialogue window spec.
- **Restoration**: On dialogue end, all HUD elements fade back to 100% over 300ms
- **Background**: A subtle dark overlay (10% opacity black) covers the game world behind the dialogue window to improve text readability

### 4.5.4 Fishing Mini-Game Context

**Trigger**: Player casts the fishing rod at a valid water tile.

- **Hotbar**: Slides downward off-screen over 200ms (CSS `transform: translateY(100%)`)
- **Fishing UI**: A custom fishing interface slides up from the bottom over 200ms:
  - Tension bar (horizontal, 200px wide, centered bottom)
  - Catch zone indicator (moving target)
  - Fish silhouette and ripple animation
  - "Reel!" prompt with button/key indicator
- **Energy bar**: Remains visible. Energy drains at 1 per 5 seconds while actively reeling.
- **Clock**: Remains visible (fishing consumes real time)
- **Exit**: On catch or line break, fishing UI slides down, hotbar slides back up (200ms each, 100ms overlap)

### 4.5.5 Inventory Open Context

**Trigger**: Player presses I or taps the inventory icon.

- **Hotbar expansion**: The 10-slot hotbar visually "grows" upward. The transition animation (300ms, ease-out) shows the hotbar stretching into a full inventory grid:
  - Full inventory: 10 columns x 4 rows = 40 slots
  - The hotbar slots become the bottom row of the inventory grid
  - Rows above the hotbar fade in during the expansion
- **Background**: Semi-transparent dark overlay (40% opacity black) covers the game world. Player character continues idle animation but cannot move.
- **Sorting/filters**: Tab buttons above the grid: All | Tools | Crops | Products | Materials | Decor
- **Item info**: Clicking an item shows a detail panel to the right: name, description, sell value, quantity
- **Close**: Press I again, ESC, or click outside the inventory. Grid contracts back to hotbar (300ms, ease-in).

### 4.5.6 Night Time Context

**Trigger**: Game clock passes 19:00 (night begins).

- **HUD overlay**: All HUD elements receive a subtle dark blue tint overlay (`rgba(21, 47, 80, 0.15)`), matching the world's night tint. This is a CSS filter applied to the HUD container.
- **Clock panel**: Transitions to night style (see section 4.2.2)
- **Hotbar slot borders**: Shift from warm brown to a cooler dark brown
- **Energy bar**: If below 30%, the pulse animation is more noticeable at night (brightness boost increased from 15% to 25%)
- **Transition**: All night tint changes apply over 2000ms (matching the world's dusk-to-night transition)
- **Dawn reversal**: At 05:00, the night tint fades out over 2000ms back to neutral

### 4.5.7 Weather Effects on HUD

**Rain**
- **Particles**: 8-12 small raindrop sprites (4x8px, semi-transparent blue-white) drift downward across the HUD layer at 200px/sec, randomized x-positions. These are cosmetic only and do not interact with HUD elements.
- **Panel surfaces**: A very subtle "wet" sheen effect on panel backgrounds (slight increase in specular highlight, achieved via a 5% white overlay that shifts position slowly)
- **Duration**: Active for the entire rain weather state

**Thunderstorm**
- All rain effects, plus:
- **Lightning flash**: On lightning bolt events (random, every 4-8 seconds), the entire HUD briefly flashes brighter (CSS filter: `brightness(1.3)` for 80ms, then back to normal over 120ms)
- **Rumble**: HUD elements shift down 1px then back up over 400ms on thunder (200ms after the flash)

**Snow**
- **Particles**: 6-10 small snowflake sprites (4x4px, white, 70% opacity) drift downward at 60px/sec with gentle horizontal sway (sinusoidal, amplitude 20px, period 3s). Slower and more sparse than rain.
- **Frost**: A very subtle frost border (2px, semi-transparent white) appears around HUD panel edges during snow. Applied via CSS `border-image` or box-shadow.

### 4.5.8 Festival / Event Context

**Trigger**: A town event or festival is active (weekly festival, seasonal harvest, etc.).

- **Golden border**: A decorative golden border (LimeZu ornate frame, 4px thick) appears around the entire HUD perimeter. Animated with a slow shimmer (traveling highlight moving clockwise, 8-second loop).
- **Event badge**: A small banner (64x24px) appears below the clock panel: event name in decorative text (e.g., "Spring Festival"). Text color matches the season palette.
- **Hotbar**: Normal behavior, but slot borders shift to match the event's accent color
- **Special icon**: The festival/event icon replaces the weather icon in the clock panel for the duration of the event
- **Duration**: Active for the entire event period. Fades in over 500ms on event start, fades out over 500ms on event end.

---

## 4.6 Notification System

### 4.6.1 Toast Notifications

Position: Top-right, below the currency panel, 8px gap. Notifications slide in from the right edge.

```
                     +---------------------------+
[Currency Panel]     | [Icon] Notification text  |
                     |         5s auto-dismiss    |
                     +---------------------------+
                     +---------------------------+
                     | [Icon] Second notification|
                     +---------------------------+
```

### 4.6.2 Notification Types

| Type | Icon | Border Color | Sound | Priority |
|------|------|-------------|-------|----------|
| Achievement | Gold trophy (16x16) | `#FFD700` (gold) | Triumphant fanfare (500ms) | High |
| Quest Update | Scroll (16x16) | `#42A5F5` (blue) | Bright chime (300ms) | High |
| NPC Message | Speech bubble (16x16) | `#AB47BC` (purple) | Soft ping (200ms) | Medium |
| Season Change | Season icon (16x16) | Season color (see 4.2.3) | Musical phrase (800ms) | High |
| Weather Change | Weather icon (16x16) | `#78909C` (blue-gray) | Ambient sound cue (rain starts, wind picks up, etc.) | Low |
| System | Gear icon (16x16) | `#9E9E9E` (gray) | None | Low |
| Level Up | Star/arrow (16x16) | `#FFD700` (gold) | Ascending three-note chime (600ms) | High |

### 4.6.3 Behavior

- **Slide-in**: Notification enters from the right edge over 300ms (CSS `transform: translateX` with ease-out)
- **Auto-dismiss**: Fades out after 5 seconds (1000ms fade-out animation)
- **Max visible**: 3 notifications stacked vertically. If a 4th arrives, the oldest is immediately dismissed (fast fade, 200ms) to make room.
- **Click/tap to dismiss**: Clicking a notification dismisses it immediately (200ms fade)
- **Click/tap to expand**: For notifications with additional detail (quest updates, NPC messages), clicking opens a small detail popup (256x128px) with full text. The popup auto-dismisses after 10 seconds or on click-away.
- **Queue**: If more than 3 notifications arrive simultaneously, they queue and display sequentially with 300ms stagger between each.

### 4.6.4 Special Notifications

**Season Change Notification:**
- Full-width banner (instead of standard toast) appears at the top of the screen
- Text: "-- Spring has arrived --" (centered, decorative font, 20px)
- Background: Gradient matching the new season's color palette
- Duration: 4 seconds, fades in/out over 800ms each
- Season icon flanks both sides of the text
- Particles: Appropriate particles (cherry blossoms for spring, falling leaves for autumn, snowflakes for winter, fireflies for summer) drift across the banner

**Achievement Notification:**
- Standard toast position, but with an additional golden particle burst on appearance (8 small sparkle sprites radiate outward from the icon, 400ms)
- Achievement name in bold, description below in smaller text (10px)
- Remains for 8 seconds instead of the standard 5

---

## 4.7 Mobile-Specific Behavior

### 4.7.1 Hotbar (Mobile)

- **Slot selection**: Swipe left/right on the hotbar area to cycle the active slot. Swipe velocity determines whether it moves 1 slot or multiple.
- **Tap to use**: Tapping the active slot uses the item (equivalent to clicking in the game world with the tool)
- **Long-press context menu**: Long-pressing (400ms) any hotbar slot opens a radial context menu with options:
  - "Use" (if applicable)
  - "Drop" (discards 1 unit; hold for continuous drop)
  - "Info" (shows item detail popup)
  - "Move to inventory" (sends to first empty inventory slot)
- **Slot size**: Scaled to 44x44 CSS pixels minimum (accessibility touch target guideline). On screens smaller than 375px wide, slots reduce to 40x40 with 1px gaps.

### 4.7.2 Energy Bar (Mobile)

- **Default**: Shows bar only (no number) to save screen space
- **Tap to reveal**: Tapping the energy bar shows a tooltip with exact value ("73 / 100") for 3 seconds, then hides
- **Position**: Left edge of bottom bar, same as desktop but slightly larger touch target (minimum 44px wide tap zone)

### 4.7.3 Clock Panel (Mobile)

- **Default**: Condensed display -- shows only "14:32" and the season icon. Day counter and weather icon are hidden to save space.
- **Tap to expand**: Tapping the clock panel opens a dropdown info panel (192x96px):
  - Full date: "Day 3 of Spring, Year 1"
  - Weather: "Rainy" with icon
  - Speed multiplier (if applicable)
  - Next season change: "Summer in 4 days"
- **Auto-collapse**: Panel closes after 5 seconds or on tap-away

### 4.7.4 Currency Display (Mobile)

- **Default**: Shows coin amount only (stars hidden behind a "+" badge if star count > 0)
- **Tap to expand**: Shows both coin and star amounts in an expanded panel for 3 seconds
- **Earning/spending animations**: Same as desktop but scaled down (floater text is 10px instead of 12px)

### 4.7.5 Notifications (Mobile)

- **Position**: Top-center (instead of top-right) to avoid overlap with the notch/status bar on modern phones
- **Width**: 90% of screen width (instead of fixed pixel width)
- **Swipe to dismiss**: Swipe right on a notification to dismiss it (instead of requiring a tap)
- **Max visible**: 2 (instead of 3) due to smaller screen real estate

### 4.7.6 Virtual Joystick Integration

- **Position**: Bottom-left quadrant, 64px from edges. Semi-transparent (40% opacity when idle, 70% when active).
- **Size**: 96px diameter outer ring, 32px diameter inner nub
- **Conflict avoidance**: The joystick zone and the hotbar zone do not overlap. The hotbar is offset to the right on mobile to accommodate.
- **Hide during dialogue**: Joystick fades out (300ms) when dialogue or any overlay UI is active

### 4.7.7 Landscape vs. Portrait

- **Landscape (recommended)**: Full HUD layout as described. Minimum supported width: 667px (iPhone SE landscape).
- **Portrait**: Not officially supported, but gracefully handled:
  - Hotbar moves to the bottom edge, reduced to 6 visible slots with scroll arrows
  - Clock and currency panels stack vertically in the top-left
  - A "Rotate your device" suggestion overlay appears once per session

---

## Appendix A: Animation Timing Summary

All CSS transition and animation durations for implementation reference.

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Energy bar color change | Background transition | 300ms | ease-in-out |
| Energy bar low pulse | Opacity cycle | 2000ms (loop) | ease-in-out |
| Energy bar critical shake | Horizontal jitter | 200ms (loop) | linear |
| Exhaustion screen fade | Opacity to black | 2000ms | ease-in |
| Hotbar slot select bounce | Scale 1.0 -> 1.15 -> 1.083 | 100ms -> 150ms | ease-out |
| Hotbar item use bounce | Scale 1.0 -> 0.85 -> 1.0 | 50ms -> 100ms | ease-in / ease-out-bounce |
| Hotbar cooldown sweep | Radial wipe | 200-500ms (matches tool) | linear |
| Currency earn bounce | translateY -4px -> 0 | 150ms -> 250ms | ease-out / ease-in-out |
| Currency earn floater | translateY -16px, opacity 1 -> 0 | 1200ms | ease-out |
| Currency spend shake | translateX +/- 2px | 300ms (3 oscillations) | ease-in-out |
| Coin particle arc | Bezier path to counter | 600ms (staggered 100ms) | ease-in |
| Clock tint transition | Background-color | 2000ms | ease-in-out |
| Season icon flip | rotateY 0 -> 180 -> 360 | 500ms | ease-in-out |
| Context HUD fade (dialogue) | Opacity 100% -> 30% | 300ms | ease-out |
| Hotbar slide (fishing) | translateY 0 -> 100% | 200ms | ease-in |
| Inventory expand | Height grow + row fade-in | 300ms | ease-out |
| Night tint apply/remove | Filter overlay | 2000ms | ease-in-out |
| Weather HUD particles | Continuous drift | -- (loop) | linear |
| Festival border shimmer | Traveling highlight | 8000ms (loop) | linear |
| Notification slide-in | translateX 100% -> 0 | 300ms | ease-out |
| Notification fade-out | Opacity 1 -> 0 | 1000ms | ease-out |
| Season change banner | Fade in/out | 800ms each | ease-in-out |

## Appendix B: Keyboard Shortcut Reference

| Key | Action | Context |
|-----|--------|---------|
| 1-9, 0 | Select hotbar slot 1-10 | Always (except dialogue) |
| Scroll wheel | Cycle active hotbar slot | Always (except dialogue, inventory, fishing) |
| I | Open/close inventory | Always (except dialogue, fishing) |
| E / Space | Use active tool / Interact | Always |
| ESC | Open menu / Close current panel | Always |
| Tab | Toggle HUD visibility | Always (debug/screenshots) |
| Q | Quick-drop 1 unit of active item | When holding an item |

## Appendix C: Accessibility Notes

- **Color-blind support**: All state-dependent colors (energy bar, durability bar, currency feedback) have secondary indicators (animation patterns, icons) so color is never the sole communicator of state. A future settings toggle will enable high-contrast mode with pattern fills instead of color fills.
- **Reduced motion**: A settings toggle disables all pulse, shake, bounce, and particle animations. State changes use instant transitions instead. Cooldown overlay uses a simple border-progress indicator instead of a radial sweep.
- **Screen reader**: HUD elements use ARIA labels. Energy: "Energy: 73 out of 100, medium." Clock: "Day 3 of Spring, 2:32 PM, rainy." Currency: "1,250 coins, 15 stars." Notifications are announced via ARIA live regions.
- **Font scaling**: All pixel font sizes respect a user-configurable scale factor (0.8x to 1.5x) in settings.

---

*End of Section 4: HUD Behavior & Feedback*
