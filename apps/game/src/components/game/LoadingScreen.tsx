'use client';

import Image from 'next/image';
import { HeroDayCycle } from '@/components/landing/HeroDayCycle';

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  if (!visible) return null;

  return (
    <div className="loading-screen">
      {/* Animated day/night sky (reused from landing page) */}
      <HeroDayCycle />

      {/* Content overlay */}
      <div className="loading-screen__content">
        <div className="loading-screen__logo-wrapper">
          <Image
            src="/logo.png"
            alt="Nookstead"
            width={400}
            height={98}
            priority
            className="loading-screen__logo-img"
          />
        </div>

        <p className="loading-screen__tagline">
          Build your homestead in a living world
        </p>

        <div className="loading-screen__divider" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="loading-screen__bar-outer">
          <div className="loading-screen__bar-inner" />
        </div>

        <p className="loading-screen__text">Loading...</p>
      </div>
    </div>
  );
}
