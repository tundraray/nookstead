import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { LoginButton } from '@/components/auth/LoginButton';
import styles from './page.module.css';

export default async function LandingPage() {
  const session = await auth();

  if (session?.user) {
    redirect('/game');
  }

  return (
    <main className={styles.page}>
      {/* Animated stars background */}
      <div className={styles.stars} aria-hidden="true">
        {Array.from({ length: 30 }, (_, i) => (
          <span
            key={i}
            className={styles.star}
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 4}s`,
              animationDuration: `${2 + Math.random() * 3}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.content}>
        {/* Pixel art logo */}
        <div className={styles.logoWrapper}>
          <h1 className={styles.logo}>NOOKSTEAD</h1>
          <div className={styles.logoShadow} aria-hidden="true">
            NOOKSTEAD
          </div>
        </div>

        {/* Tagline */}
        <p className={styles.tagline}>
          Build your homestead in a living world
        </p>

        {/* Decorative pixel divider */}
        <div className={styles.divider} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {/* Login buttons */}
        <div className={styles.buttons}>
          <LoginButton provider="google" />
          {/* <LoginButton provider="discord" /> */}
        </div>

        {/* Footer hint */}
        <p className={styles.hint}>
          Sign in to start your adventure
        </p>
      </div>
    </main>
  );
}
