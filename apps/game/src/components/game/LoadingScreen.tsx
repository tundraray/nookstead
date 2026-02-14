'use client';

import { useMemo } from 'react';
import styles from './LoadingScreen.module.css';

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
    <div className={styles.overlay}>
      {/* Twinkling stars background */}
      <div className={styles.stars} aria-hidden="true">
        {stars.map((star) => (
          <span
            key={star.id}
            className={styles.star}
            style={{
              left: star.left,
              top: star.top,
              animationDelay: star.animationDelay,
              animationDuration: star.animationDuration,
            }}
          />
        ))}
      </div>

      <div className={styles.content}>
        {/* Floating logo with shadow */}
        <div className={styles.logoWrapper}>
          <h1 className={styles.logo}>NOOKSTEAD</h1>
          <div className={styles.logoShadow} aria-hidden="true">
            NOOKSTEAD
          </div>
        </div>

        {/* Pixel divider */}
        <div className={styles.divider} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {/* Progress bar */}
        <div className={styles.barOuter}>
          <div className={styles.barInner} />
        </div>

        <p className={styles.text}>Loading...</p>
      </div>
    </div>
  );
}
