import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LoginButton } from '@/components/auth/LoginButton';

export default async function LandingPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/game');
  }

  return (
    <main className="landing-page">
      {/* Animated stars background */}
      <div className="landing-page__stars" aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => (
          <span
            key={i}
            className="landing-page__star"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className="landing-page__content">
        {/* Pixel art logo */}
        <div className="landing-page__logo-wrapper">
          <h1 className="landing-page__logo">NOOKSTEAD</h1>
          <div className="landing-page__logo-shadow" aria-hidden="true">
            NOOKSTEAD
          </div>
        </div>

        {/* Tagline */}
        <p className="landing-page__tagline">
          Build your homestead in a living world
        </p>

        {/* Decorative pixel divider */}
        <div className="landing-page__divider" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {/* Login buttons */}
        <div className="landing-page__buttons">
          <LoginButton provider="google" />
          {/* <LoginButton provider="discord" /> */}
        </div>

        {/* Footer hint */}
        <p className="landing-page__hint">
          Sign in to start your adventure
        </p>
      </div>
    </main>
  );
}
