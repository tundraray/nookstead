'use client';

import styles from './LoadingScreen.module.css';

interface LoadingScreenProps {
  visible: boolean;
}

export function LoadingScreen({ visible }: LoadingScreenProps) {
  if (!visible) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.container}>
        <h1 className={styles.title}>Nookstead</h1>
        <div className={styles.barOuter}>
          <div className={styles.barInner} />
        </div>
        <p className={styles.text}>Loading...</p>
      </div>
    </div>
  );
}
