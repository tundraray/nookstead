'use client';

import styles from './GameHUD.module.css';

export function GameHUD() {
  return (
    <div className={styles.hud}>
      <div className={styles.topBar}>
        <span className={styles.label}>Nookstead</span>
      </div>
      <div className={styles.bottomBar}>
        <div className={styles.slot} />
        <div className={styles.slot} />
        <div className={styles.slot} />
        <div className={styles.slot} />
        <div className={styles.slot} />
      </div>
    </div>
  );
}
