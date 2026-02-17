'use client';

import Image from 'next/image';
import { useCharacterState } from './useCharacterState';
import { CharacterPreview } from './CharacterPreview';
import { LayerPanel } from './LayerPanel';
import styles from './CharacterGenerator.module.css';

export function CharacterGenerator() {
  const {
    state,
    setLayer,
    randomize,
    save,
    layers,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    savedSuccessfully,
  } = useCharacterState();

  const handleSave = async () => {
    try {
      await save();
    } catch {
      // Error already logged by hook
    }
  };

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
        <h1 className={styles.title}>Character Generator</h1>
        <p className={styles.subtitle}>
          Customize your character and save to use in-game
        </p>
      </header>

      <div className={styles.content}>
        <CharacterPreview layers={layers} isLoading={isLoading} />

        <div className={styles.controls}>
          <LayerPanel
            category="body"
            selected={state.body}
            onSelect={(opt) => {
              if (opt) setLayer('body', opt);
            }}
            label="Body"
          />
          <LayerPanel
            category="eyes"
            selected={state.eyes}
            onSelect={(opt) => setLayer('eyes', opt)}
            allowNone
            label="Eyes"
          />
          <LayerPanel
            category="outfit"
            selected={state.outfit}
            onSelect={(opt) => setLayer('outfit', opt)}
            allowNone
            label="Outfit"
          />
          <LayerPanel
            category="hairstyle"
            selected={state.hairstyle}
            onSelect={(opt) => setLayer('hairstyle', opt)}
            allowNone
            label="Hairstyle"
          />
          <LayerPanel
            category="accessory"
            selected={state.accessory}
            onSelect={(opt) => setLayer('accessory', opt)}
            allowNone
            label="Accessory"
          />

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
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              type="button"
            >
              {isSaving ? 'Saving...' : savedSuccessfully ? 'Saved!' : 'Save Character'}
            </button>
          </div>
        </div>
      </div>

      <footer className={styles.footer}>
        <p>Nookstead Character Generator</p>
      </footer>
    </div>
  );
}
