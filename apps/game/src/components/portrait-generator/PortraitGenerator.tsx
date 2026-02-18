'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';
import { usePortraitState } from './usePortraitState';
import { PortraitCanvas } from './PortraitCanvas';
import { FlatSelector, GroupedSelector } from './LayerSelector';
import {
  SKINS,
  EYES,
  HAIRSTYLE_GROUPS,
  ACCESSORY_GROUPS,
} from './portrait-registry';
import { exportGif } from './gif-export';
import type { AnimationType } from './types';
import styles from './PortraitGenerator.module.css';

const ANIMATION_TYPES: AnimationType[] = ['idle', 'talk', 'nod', 'shake'];
const GIF_SCALE = 4; // 128x128 GIF

export function PortraitGenerator() {
  const {
    state,
    setSkin,
    setEyes,
    setHairstyle,
    setAccessory,
    setAnimationType,
    randomize,
    images,
    isLoading,
  } = usePortraitState();

  const [isExporting, setIsExporting] = useState(false);

  const handleDownloadGif = useCallback(async () => {
    if (images.length === 0 || isExporting) return;
    setIsExporting(true);

    try {
      const url = await exportGif(images, state.animationType, GIF_SCALE);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nookstead-portrait-${state.animationType}.gif`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      // Revoke after a short delay to ensure download starts
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error('GIF export failed:', err);
    } finally {
      setIsExporting(false);
    }
  }, [images, state.animationType, isExporting]);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Image
          src="/logo.png"
          alt="Nookstead"
          width={280}
          height={68}
          priority
          className={styles.logo}
        />
        <h1 className={styles.title}>Portrait Generator</h1>
        <p className={styles.subtitle}>Create your Nookstead character</p>
      </header>

      <main className={styles.main}>
        {/* Preview */}
        <section className={styles.previewSection}>
          <div className={styles.previewFrame}>
            <PortraitCanvas
              images={images}
              animationType={state.animationType}
              scale={8}
              isLoading={isLoading}
            />
          </div>

          {/* Animation type toggle */}
          <div className={styles.animToggle}>
            {ANIMATION_TYPES.map((type) => (
              <button
                key={type}
                className={`${styles.animButton} ${
                  state.animationType === type ? styles.animButtonActive : ''
                }`}
                onClick={() => setAnimationType(type)}
              >
                {type}
              </button>
            ))}
          </div>
        </section>

        {/* Controls */}
        <section className={styles.controlsSection}>
          <div className={styles.controlsPanel}>
            <FlatSelector
              label="Skin"
              pieces={SKINS}
              selected={state.skin}
              onSelect={setSkin}
            />

            <FlatSelector
              label="Eyes"
              pieces={EYES}
              selected={state.eyes}
              onSelect={setEyes}
            />

            <GroupedSelector
              label="Hairstyle"
              groups={HAIRSTYLE_GROUPS}
              selected={state.hairstyle}
              onSelect={(p) => {
                if (p) setHairstyle(p);
              }}
            />

            <GroupedSelector
              label="Accessory"
              groups={ACCESSORY_GROUPS}
              selected={state.accessory}
              onSelect={setAccessory}
              allowNone
            />
          </div>

          <div className={styles.actions}>
            <button
              className={styles.actionButton}
              onClick={randomize}
              type="button"
            >
              Randomize
            </button>
            <button
              className={`${styles.actionButton} ${styles.actionButtonAccent}`}
              onClick={handleDownloadGif}
              disabled={isExporting || images.length === 0}
              type="button"
            >
              {isExporting ? 'Exporting...' : 'Download GIF'}
            </button>
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerDivider}>
          <span />
          <span />
          <span />
        </div>
        <p className={styles.footerText}>Nookstead Portrait Generator</p>
      </footer>
    </div>
  );
}
