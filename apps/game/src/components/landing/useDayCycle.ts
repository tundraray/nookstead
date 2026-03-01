'use client';

import { useState, useEffect } from 'react';

const CYCLE_MS =
  Number(process.env.NEXT_PUBLIC_DAY_CYCLE_MS) || 3_600_000; // default 1 hour

// Sky gradient keyframes: [phase, topH,S,L, midH,S,L, botH,S,L]
// Phase 0.0 = midnight, wraps at 1.0
const SKY_KEYFRAMES: number[][] = [
  //  phase  topH  topS  topL   midH  midS  midL   botH  botS  botL
  [0.0, 230, 60, 8, 225, 50, 10, 220, 45, 14],
  [0.2, 230, 55, 10, 225, 45, 12, 220, 40, 16],
  [0.25, 240, 40, 20, 30, 50, 30, 25, 60, 40],
  [0.3, 210, 45, 40, 25, 70, 55, 15, 80, 60],
  [0.35, 210, 70, 55, 210, 60, 65, 40, 50, 70],
  [0.4, 210, 75, 60, 210, 65, 70, 200, 50, 75],
  [0.5, 210, 80, 65, 210, 70, 72, 200, 55, 78],
  [0.65, 210, 75, 58, 210, 60, 65, 20, 50, 60],
  [0.7, 20, 60, 45, 15, 70, 45, 10, 75, 40],
  [0.75, 260, 40, 30, 270, 35, 25, 280, 30, 20],
  [0.85, 240, 50, 15, 235, 45, 12, 230, 40, 14],
  [1.0, 230, 60, 8, 225, 50, 10, 220, 45, 14],
];

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Shortest-path hue interpolation (handles wrapping around 360) */
function lerpHue(a: number, b: number, t: number): number {
  let diff = b - a;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return ((a + diff * t) % 360 + 360) % 360;
}

function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

function interpolateSky(phase: number) {
  // Find the two keyframes surrounding the current phase
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (phase >= SKY_KEYFRAMES[i][0] && phase <= SKY_KEYFRAMES[i + 1][0]) {
      lo = i;
      hi = i + 1;
      break;
    }
  }

  const kLo = SKY_KEYFRAMES[lo];
  const kHi = SKY_KEYFRAMES[hi];
  const range = kHi[0] - kLo[0];
  const t = range === 0 ? 0 : (phase - kLo[0]) / range;

  return {
    skyTop: hsl(lerpHue(kLo[1], kHi[1], t), lerp(kLo[2], kHi[2], t), lerp(kLo[3], kHi[3], t)),
    skyMid: hsl(lerpHue(kLo[4], kHi[4], t), lerp(kLo[5], kHi[5], t), lerp(kLo[6], kHi[6], t)),
    skyBot: hsl(lerpHue(kLo[7], kHi[7], t), lerp(kLo[8], kHi[8], t), lerp(kLo[9], kHi[9], t)),
  };
}

/** Smooth fade: returns 0–1 within [fadeIn, fadeOut] range, 1 outside */
function computeStarOpacity(phase: number): number {
  // Stars visible: 0.00–0.20 (full), fade out 0.20–0.30, invisible 0.30–0.75, fade in 0.75–0.85, full 0.85–1.00
  if (phase <= 0.2 || phase >= 0.85) return 1;
  if (phase >= 0.3 && phase <= 0.75) return 0;
  if (phase > 0.2 && phase < 0.3) return 1 - (phase - 0.2) / 0.1;
  // 0.75 < phase < 0.85
  return (phase - 0.75) / 0.1;
}

function computeMoonOpacity(phase: number): number {
  // Moon visible slightly less than stars — disappears a bit earlier in dawn
  if (phase <= 0.18 || phase >= 0.87) return 1;
  if (phase >= 0.28 && phase <= 0.77) return 0;
  if (phase > 0.18 && phase < 0.28) return 1 - (phase - 0.18) / 0.1;
  // 0.77 < phase < 0.87
  return (phase - 0.77) / 0.1;
}

function computeSunGlow(phase: number): { opacity: number; color: string } {
  // Sunrise glow: 0.25–0.40, peak at 0.32
  // Sunset glow: 0.62–0.77, peak at 0.70
  let opacity = 0;
  let color = 'hsl(30, 80%, 60%)';

  if (phase >= 0.25 && phase <= 0.40) {
    const center = 0.32;
    const halfWidth = 0.08;
    const dist = Math.abs(phase - center);
    opacity = dist < halfWidth ? 1 - dist / halfWidth : 0;
    color = `hsl(${lerp(30, 45, (phase - 0.25) / 0.15)}, 80%, ${lerp(55, 65, (phase - 0.25) / 0.15)}%)`;
  } else if (phase >= 0.62 && phase <= 0.77) {
    const center = 0.70;
    const halfWidth = 0.08;
    const dist = Math.abs(phase - center);
    opacity = dist < halfWidth ? 1 - dist / halfWidth : 0;
    color = `hsl(${lerp(15, 0, (phase - 0.62) / 0.15)}, 85%, ${lerp(55, 45, (phase - 0.62) / 0.15)}%)`;
  }

  return { opacity: opacity * 0.6, color };
}

export interface DayCycleState {
  phase: number;
  skyTop: string;
  skyMid: string;
  skyBot: string;
  starOpacity: number;
  moonOpacity: number;
  sunGlowOpacity: number;
  sunGlowColor: string;
}

function computeState(phase: number): DayCycleState {
  const sky = interpolateSky(phase);
  const sunGlow = computeSunGlow(phase);
  return {
    phase,
    ...sky,
    starOpacity: computeStarOpacity(phase),
    moonOpacity: computeMoonOpacity(phase),
    sunGlowOpacity: sunGlow.opacity,
    sunGlowColor: sunGlow.color,
  };
}

/** Fixed initial state (midnight) used for SSR to avoid hydration mismatch */
const INITIAL_STATE = computeState(0);

export function useDayCycle(): DayCycleState {
  const [state, setState] = useState<DayCycleState>(INITIAL_STATE);

  useEffect(() => {
    // Immediately sync to real time on mount
    const tick = () => {
      const phase = (Date.now() % CYCLE_MS) / CYCLE_MS;
      setState(computeState(phase));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
