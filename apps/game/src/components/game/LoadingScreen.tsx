'use client';

import { useMemo } from 'react';

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  const stars = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        animationDelay: `${Math.random() * 4}s`,
        animationDuration: `${2 + Math.random() * 3}s`,
      })),
    [],
  );

  const clouds = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const nativeWidths = [0, 51, 81, 31, 52, 72, 67, 55];
        const duration = 40 + Math.random() * 30;
        const sprite = Math.floor(Math.random() * 7) + 1;
        const reverse = Math.random() > 0.5;
        const scale = 0.8 + Math.random() * 0.7;
        const baseOffset = (i + 1) / 6 + (Math.random() - 0.5) * 0.1;
        return {
          id: i,
          sprite,
          reverse,
          width: nativeWidths[sprite] * scale,
          top: 5 + Math.random() * 80,
          duration,
          delay:
            i < 5
              ? -((reverse ? 1 - baseOffset : baseOffset) * duration)
              : 5 + Math.random() * 35,
          bobDuration: 4 + Math.random() * 4,
          bobDelay: 0,
        };
      }),
    [],
  );

  if (!visible) return null;

  return (
    <div className="loading-screen">
      {/* Drifting clouds */}
      <div className="loading-screen__clouds" aria-hidden="true">
        {clouds.map((c) => (
          <div
            key={c.id}
            className="cloud"
            style={{
              top: `${c.top}%`,
              animation: `${c.reverse ? 'cloud-drift-reverse' : 'cloud-drift'} ${c.duration}s linear ${c.delay}s infinite backwards`,
            }}
          >
            <div
              style={{
                animation: `cloud-bob ${c.bobDuration}s ease-in-out ${c.bobDelay}s infinite`,
              }}
            >
              <img
                className="cloud__img"
                style={{ width: `${c.width}px` }}
                src={`/assets/clouds/Cloud${c.sprite}.png`}
                alt=""
              />
            </div>
          </div>
        ))}
      </div>

      {/* Twinkling stars background */}
      <div className="loading-screen__stars" aria-hidden="true">
        {stars.map((star) => (
          <span
            key={star.id}
            className="loading-screen__star"
            style={{
              left: star.left,
              top: star.top,
              animationDelay: star.animationDelay,
              animationDuration: star.animationDuration,
            }}
          />
        ))}
      </div>

      <div className="loading-screen__content">
        {/* Floating logo with shadow */}
        <div className="loading-screen__logo-wrapper">
          <h1 className="loading-screen__logo">NOOKSTEAD</h1>
          <div className="loading-screen__logo-shadow" aria-hidden="true">
            NOOKSTEAD
          </div>
        </div>

        {/* Pixel divider */}
        <div className="loading-screen__divider" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {/* Progress bar */}
        <div className="loading-screen__bar-outer">
          <div className="loading-screen__bar-inner" />
        </div>

        <p className="loading-screen__text">Loading...</p>
      </div>
    </div>
  );
}
