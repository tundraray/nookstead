'use client';

import { useMemo } from 'react';
import { useDayCycle } from './useDayCycle';

/** Pre-generate star positions so they don't change between renders */
function generateStars(count: number) {
  const stars: { left: string; top: string; delay: string; duration: string }[] = [];
  for (let i = 0; i < count; i++) {
    stars.push({
      left: `${(Math.random() * 100).toFixed(2)}%`,
      top: `${(Math.random() * 100).toFixed(2)}%`,
      delay: `${(Math.random() * 4).toFixed(2)}s`,
      duration: `${(2 + Math.random() * 3).toFixed(2)}s`,
    });
  }
  return stars;
}

export function HeroDayCycle() {
  const cycle = useDayCycle();
  const stars = useMemo(() => generateStars(30), []);

  return (
    <div
      className="hero-sky"
      style={{
        background: `linear-gradient(180deg, ${cycle.skyTop} 0%, ${cycle.skyMid} 68%, ${cycle.skyBot} 100%)`,
      }}
    >
      {/* Stars */}
      <div
        className="hero-sky__stars"
        aria-hidden="true"
        style={{ opacity: cycle.starOpacity }}
      >
        {stars.map((star, i) => (
          <span
            key={i}
            className="landing-hero__star"
            style={{
              left: star.left,
              top: star.top,
              animationDelay: star.delay,
              animationDuration: star.duration,
            }}
          />
        ))}
      </div>

      {/* Sun glow at horizon */}
      {cycle.sunGlowOpacity > 0.01 && (
        <div
          className="hero-sky__sun-glow"
          aria-hidden="true"
          style={{
            opacity: cycle.sunGlowOpacity,
            background: `radial-gradient(ellipse 80% 40% at 50% 100%, ${cycle.sunGlowColor} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* Moon */}
      {cycle.moonOpacity > 0.01 && (
        <div
          className="hero-sky__moon"
          aria-hidden="true"
          style={{ opacity: cycle.moonOpacity }}
        >
          {/* CSS pixel art crescent moon */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ imageRendering: 'pixelated' }}
          >
            {/* Crescent moon shape using pixel blocks */}
            <rect x="6" y="1" width="1" height="1" fill="#e8e0c8" />
            <rect x="7" y="1" width="1" height="1" fill="#e8e0c8" />
            <rect x="8" y="1" width="1" height="1" fill="#e8e0c8" />
            <rect x="5" y="2" width="1" height="1" fill="#e8e0c8" />
            <rect x="6" y="2" width="1" height="1" fill="#f5ecd5" />
            <rect x="7" y="2" width="1" height="1" fill="#f5ecd5" />
            <rect x="8" y="2" width="1" height="1" fill="#e8e0c8" />
            <rect x="9" y="2" width="1" height="1" fill="#d4cbb0" />
            <rect x="4" y="3" width="1" height="1" fill="#e8e0c8" />
            <rect x="5" y="3" width="1" height="1" fill="#f5ecd5" />
            <rect x="6" y="3" width="1" height="1" fill="#fdf6e3" />
            <rect x="7" y="3" width="1" height="1" fill="#fdf6e3" />
            <rect x="8" y="3" width="1" height="1" fill="#d4cbb0" />
            <rect x="4" y="4" width="1" height="1" fill="#e8e0c8" />
            <rect x="5" y="4" width="1" height="1" fill="#f5ecd5" />
            <rect x="6" y="4" width="1" height="1" fill="#fdf6e3" />
            <rect x="7" y="4" width="1" height="1" fill="#d4cbb0" />
            <rect x="3" y="5" width="1" height="1" fill="#e8e0c8" />
            <rect x="4" y="5" width="1" height="1" fill="#f5ecd5" />
            <rect x="5" y="5" width="1" height="1" fill="#fdf6e3" />
            <rect x="6" y="5" width="1" height="1" fill="#d4cbb0" />
            <rect x="3" y="6" width="1" height="1" fill="#e8e0c8" />
            <rect x="4" y="6" width="1" height="1" fill="#f5ecd5" />
            <rect x="5" y="6" width="1" height="1" fill="#fdf6e3" />
            <rect x="6" y="6" width="1" height="1" fill="#d4cbb0" />
            <rect x="3" y="7" width="1" height="1" fill="#e8e0c8" />
            <rect x="4" y="7" width="1" height="1" fill="#f5ecd5" />
            <rect x="5" y="7" width="1" height="1" fill="#fdf6e3" />
            <rect x="6" y="7" width="1" height="1" fill="#d4cbb0" />
            <rect x="3" y="8" width="1" height="1" fill="#e8e0c8" />
            <rect x="4" y="8" width="1" height="1" fill="#f5ecd5" />
            <rect x="5" y="8" width="1" height="1" fill="#fdf6e3" />
            <rect x="6" y="8" width="1" height="1" fill="#d4cbb0" />
            <rect x="3" y="9" width="1" height="1" fill="#e8e0c8" />
            <rect x="4" y="9" width="1" height="1" fill="#f5ecd5" />
            <rect x="5" y="9" width="1" height="1" fill="#fdf6e3" />
            <rect x="6" y="9" width="1" height="1" fill="#d4cbb0" />
            <rect x="3" y="10" width="1" height="1" fill="#e8e0c8" />
            <rect x="4" y="10" width="1" height="1" fill="#f5ecd5" />
            <rect x="5" y="10" width="1" height="1" fill="#d4cbb0" />
            <rect x="4" y="11" width="1" height="1" fill="#e8e0c8" />
            <rect x="5" y="11" width="1" height="1" fill="#f5ecd5" />
            <rect x="6" y="11" width="1" height="1" fill="#d4cbb0" />
            <rect x="5" y="12" width="1" height="1" fill="#e8e0c8" />
            <rect x="6" y="12" width="1" height="1" fill="#e8e0c8" />
            <rect x="7" y="12" width="1" height="1" fill="#d4cbb0" />
            <rect x="6" y="13" width="1" height="1" fill="#e8e0c8" />
            <rect x="7" y="13" width="1" height="1" fill="#e8e0c8" />
            <rect x="8" y="13" width="1" height="1" fill="#d4cbb0" />
            <rect x="7" y="14" width="1" height="1" fill="#d4cbb0" />
            <rect x="8" y="14" width="1" height="1" fill="#d4cbb0" />
            {/* Subtle glow around moon */}
          </svg>
        </div>
      )}
    </div>
  );
}
