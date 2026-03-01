import { auth } from '@/auth';
import Link from 'next/link';
import Image from 'next/image';
import { LoginButton } from '@/components/auth/LoginButton';
import { LandingContent } from '@/components/landing/LandingContent';
import { HeroDayCycle } from '@/components/landing/HeroDayCycle';

export default async function LandingPage() {
  const session = await auth();
  const isAuthenticated = !!session?.user;
  const displayName = session?.user?.name;
  const registrationOpen = process.env.REGISTRATION_OPEN === 'true';

  return (
    <main className="landing-page">
      {/* ── Hero (full-screen) ── */}
      <section className="landing-hero">
        {/* Day/night cycle sky overlay (client component) */}
        <HeroDayCycle />

        {/* Drifting clouds */}
        <div className="landing-hero__clouds" aria-hidden="true">
          {Array.from({ length: 10 }, (_, i) => {
            // Native widths per sprite so scaling respects original proportions
            const nativeWidths = [0, 51, 81, 31, 52, 72, 67, 55];
            const sprite = Math.floor(Math.random() * 7) + 1;
            const reverse = Math.random() > 0.5;
            const scale = 0.8 + Math.random() * 0.7; // 0.8x–1.5x native size
            const width = nativeWidths[sprite] * scale;
            const top = 5 + Math.random() * 80; // 5–85% of clouds container
            const duration = 40 + Math.random() * 30; // 40–70s
            const bobDuration = 4 + Math.random() * 4; // 4–8s
            const bobDelay = 0;
            const baseOffset = (i + 1) / 8 + (Math.random() - 0.5) * 0.1;
            const delay =
              i < 7
                ? -((reverse ? 1 - baseOffset : baseOffset) * duration)
                : 5 + Math.random() * 35;
            return (
              <div
                key={i}
                className="cloud"
                style={{
                  top: `${top}%`,
                  animation: `${reverse ? 'cloud-drift-reverse' : 'cloud-drift'} ${duration}s linear ${delay}s infinite backwards`,
                }}
              >
                <div style={{ animation: `cloud-bob ${bobDuration}s ease-in-out ${bobDelay}s infinite` }}>
                  <img
                    className="cloud__img"
                    style={{ width: `${width}px` }}
                    src={`/assets/clouds/Cloud${sprite}.png`}
                    alt=""
                  />
                </div>
              </div>
            );
          })}
        </div>

        <div className="landing-hero__content">
          {/* Pixel art logo */}
          <div className="landing-hero__logo-wrapper">
            <Image
              src="/logo.png"
              alt="Nookstead"
              width={400}
              height={98}
              priority
              className="landing-hero__logo-img"
            />
          </div>

          {/* Tagline */}
          <p className="landing-hero__tagline">
            Build your homestead in a living world
          </p>

          {/* Decorative pixel divider */}
          <div className="landing-hero__divider" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>

          {/* Auth-aware action area */}
          <div className="landing-hero__buttons">
            {isAuthenticated ? (
              <>
                <p className="landing-hero__welcome">
                  Welcome back{displayName ? `, ${displayName}` : ''}
                </p>
                <Link href="/game" className="landing-hero__enter-btn">
                  Enter
                </Link>
              </>
            ) : registrationOpen ? (
              <LoginButton provider="google" />
            ) : (
              <div className="coming-soon-badge">
                Coming soon
              </div>
            )}
          </div>

          {/* Footer hint */}
          <p className="landing-hero__hint">
            {isAuthenticated
              ? 'Ready to continue your adventure'
              : registrationOpen
                ? 'Sign in to start your adventure'
                : 'We\'re working hard to open the gates'}
          </p>
        </div>
      </section>

      {/* ── Ground (below hero) — marketing content on grass ── */}
      <section className="landing-ground">
        <LandingContent />
      </section>
    </main>
  );
}
