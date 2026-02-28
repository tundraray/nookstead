# Design Doc: Hero Day/Night Cycle

## Overview

Add a real-time day/night cycle to the landing page hero section. The sky gradient transitions smoothly through dawn, day, sunset, and night phases. Stars fade in at night, a sun glow appears at sunrise/sunset, and a pixel art moon rises at night.

**Cycle duration**: 1 game day = 1 real hour (default 3600000ms). Test mode: 5 minutes (300000ms). Controlled by `NEXT_PUBLIC_DAY_CYCLE_MS` env var.

**Clock sync**: Phase derived from real wall-clock time: `(Date.now() % cycleDuration) / cycleDuration`.

## Architecture

### Component Structure

```
page.tsx (Server Component)
└── <section class="landing-hero">
    ├── <HeroDayCycle />          ← NEW 'use client' component
    │   ├── sky gradient overlay  ← position:absolute, inset:0, z-index:0
    │   ├── stars (30 spans)      ← MOVED from page.tsx, opacity driven by phase
    │   ├── sun glow              ← radial gradient, visible at sunrise/sunset
    │   └── moon sprite           ← pixel art img, visible at night
    ├── clouds                    ← STAYS in page.tsx (z-index unaffected)
    └── content                   ← STAYS in page.tsx (z-index:1)
```

### Files

| File | Type | Description |
|------|------|-------------|
| `src/components/landing/HeroDayCycle.tsx` | New | Client component rendering sky overlay + stars + moon + sun glow |
| `src/components/landing/useDayCycle.ts` | New | Hook: computes phase (0–1) and interpolates sky colors |
| `src/app/page.tsx` | Modify | Import HeroDayCycle, remove stars block |
| `src/app/global.css` | Modify | Replace static gradient with CSS custom property fallbacks, add moon/glow styles |
| `public/assets/ui/moon.png` | New | 16×16 pixel art moon sprite |

## Phase Model

The day is divided into a normalized 0.0–1.0 cycle where 0.0 = midnight:

| Phase | Range | Description |
|-------|-------|-------------|
| Night (late) | 0.00–0.20 | Deep night sky, stars visible, moon visible |
| Dawn | 0.20–0.30 | Sky lightens, stars fade, warm horizon glow begins |
| Sunrise | 0.30–0.35 | Sun glow at horizon, warm oranges/pinks |
| Day | 0.35–0.65 | Bright blue sky, no stars, no moon |
| Sunset | 0.65–0.75 | Sun glow returns, warm oranges/reds at horizon |
| Dusk | 0.75–0.85 | Sky darkens, stars begin to appear |
| Night (early) | 0.85–1.00 | Full night, stars and moon visible |

## Color Palette (HSL)

Each phase defines 3 gradient stops (top, mid, bottom) in HSL for perceptually smooth interpolation:

```typescript
const SKY_PHASES = [
  // [phase, topH, topS, topL, midH, midS, midL, botH, botS, botL]
  [0.00, 230, 60, 8,   225, 50, 10,  220, 45, 14],   // midnight
  [0.20, 230, 55, 10,  225, 45, 12,  220, 40, 16],   // late night
  [0.25, 240, 40, 20,  30,  50, 30,  25,  60, 40],   // dawn start
  [0.30, 210, 45, 40,  25,  70, 55,  15,  80, 60],   // dawn peak
  [0.35, 210, 70, 55,  210, 60, 65,  40,  50, 70],   // sunrise end
  [0.40, 210, 75, 60,  210, 65, 70,  200, 50, 75],   // morning
  [0.50, 210, 80, 65,  210, 70, 72,  200, 55, 78],   // noon
  [0.65, 210, 75, 58,  210, 60, 65,  20,  50, 60],   // afternoon end
  [0.70, 20,  60, 45,  15,  70, 45,  10,  75, 40],   // sunset peak
  [0.75, 260, 40, 30,  270, 35, 25,  280, 30, 20],   // dusk
  [0.85, 240, 50, 15,  235, 45, 12,  230, 40, 14],   // dusk end
  [1.00, 230, 60, 8,   225, 50, 10,  220, 45, 14],   // midnight (wrap)
];
```

Colors are interpolated linearly in HSL space between adjacent keyframes.

## useDayCycle Hook

```typescript
interface DayCycleState {
  phase: number;            // 0.0–1.0 normalized time
  skyTop: string;           // hsl() color for gradient top
  skyMid: string;           // hsl() color for gradient middle
  skyBot: string;           // hsl() color for gradient bottom
  starOpacity: number;      // 0–1
  moonOpacity: number;      // 0–1
  sunGlowOpacity: number;   // 0–1
  sunGlowColor: string;     // hsl() warm color
}
```

**Update frequency**: `setInterval` at 1000ms (1 second). Sky transitions are slow enough that per-second updates are visually smooth while being efficient.

**Star/Moon/Sun opacity derivation from phase**:
- `starOpacity`: 1.0 during night (0.00–0.20, 0.85–1.00), fade out 0.20–0.30, fade in 0.75–0.85
- `moonOpacity`: same as starOpacity but delayed slightly (0.00–0.18 = 1.0, fade out 0.18–0.28)
- `sunGlowOpacity`: peak 1.0 at sunrise (0.30–0.35) and sunset (0.65–0.75), 0 otherwise

## HeroDayCycle Component

```tsx
'use client';

export function HeroDayCycle() {
  const cycle = useDayCycle();

  return (
    <div className="hero-sky" style={{
      background: `linear-gradient(180deg, ${cycle.skyTop} 0%, ${cycle.skyMid} 68%, ${cycle.skyBot} 100%)`,
    }}>
      {/* Stars */}
      <div className="hero-sky__stars" style={{ opacity: cycle.starOpacity }}>
        {stars.map(...)}
      </div>

      {/* Sun glow */}
      <div className="hero-sky__sun-glow" style={{
        opacity: cycle.sunGlowOpacity,
        background: `radial-gradient(ellipse at 50% 100%, ${cycle.sunGlowColor} 0%, transparent 70%)`,
      }} />

      {/* Moon */}
      <img
        className="hero-sky__moon"
        src="/assets/ui/moon.png"
        style={{ opacity: cycle.moonOpacity }}
      />
    </div>
  );
}
```

## CSS Changes

### global.css modifications

Replace static gradient on `.landing-hero`:
```css
.landing-hero {
  /* Remove: background: linear-gradient(180deg, #0a0a1a 0%, #0d1117 68%, #101828 100%); */
  background: #0a0a1a; /* fallback for no-JS */
}
```

Add new classes:
```css
.hero-sky {
  position: absolute;
  inset: 0;
  z-index: 0;
  transition: background 0.5s ease;
}

.hero-sky__stars { position: absolute; inset: 0; pointer-events: none; transition: opacity 2s ease; }
.hero-sky__sun-glow { position: absolute; inset: 0; pointer-events: none; transition: opacity 3s ease; }
.hero-sky__moon {
  position: absolute;
  top: 15%;
  right: 20%;
  width: 32px;
  height: 32px;
  image-rendering: pixelated;
  transition: opacity 3s ease;
  pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
  .hero-sky { background: linear-gradient(180deg, #0a0a1a 0%, #0d1117 68%, #101828 100%) !important; }
  .hero-sky__stars { opacity: 0.5 !important; }
  .hero-sky__sun-glow { display: none; }
}
```

## Environment Variable

```env
# .env.local (development / testing)
NEXT_PUBLIC_DAY_CYCLE_MS=300000

# .env.production (default)
NEXT_PUBLIC_DAY_CYCLE_MS=3600000
```

The hook reads this at initialization:
```typescript
const CYCLE_MS = Number(process.env.NEXT_PUBLIC_DAY_CYCLE_MS) || 3600000;
```

## Hydration Strategy

- Server renders `.landing-hero` with `background: #0a0a1a` (dark fallback)
- `HeroDayCycle` is a `'use client'` component — it hydrates on the client and immediately computes the correct phase from `Date.now()`
- No hydration mismatch because the sky overlay is a separate div that only exists on the client render
- Stars are moved from server-rendered spans to the client component (they were randomized per-request anyway)

## Moon Sprite

A 16×16 pixel art crescent moon in the Nookstead art style. Will be placed at `public/assets/ui/moon.png`. Can be created as a simple CSS-drawn shape if pixel art asset is not available initially.
