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

  if (!visible) return null;

  return (
    <div className="loading-screen">
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
