'use client';

import type { PortraitPiece } from './types';
import type { PieceGroup } from './portrait-registry';
import styles from './PortraitGenerator.module.css';

// ---------------------------------------------------------------------------
// Flat selector (skins, eyes)
// ---------------------------------------------------------------------------

interface FlatSelectorProps {
  label: string;
  pieces: PortraitPiece[];
  selected: PortraitPiece;
  onSelect: (piece: PortraitPiece) => void;
}

export function FlatSelector({
  label,
  pieces,
  selected,
  onSelect,
}: FlatSelectorProps) {
  return (
    <div className={styles.selectorBlock}>
      <label className={styles.selectorLabel}>{label}</label>
      <select
        className={styles.selectorDropdown}
        value={selected.id}
        onChange={(e) => {
          const piece = pieces.find((p) => p.id === e.target.value);
          if (piece) onSelect(piece);
        }}
      >
        {pieces.map((p) => (
          <option key={p.id} value={p.id}>
            {p.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Grouped selector (hairstyles, accessories)
// ---------------------------------------------------------------------------

interface GroupedSelectorProps {
  label: string;
  groups: PieceGroup[];
  selected: PortraitPiece | null;
  onSelect: (piece: PortraitPiece | null) => void;
  allowNone?: boolean;
}

export function GroupedSelector({
  label,
  groups,
  selected,
  onSelect,
  allowNone = false,
}: GroupedSelectorProps) {
  const allPieces = groups.flatMap((g) => g.pieces);

  return (
    <div className={styles.selectorBlock}>
      <label className={styles.selectorLabel}>{label}</label>
      <select
        className={styles.selectorDropdown}
        value={selected?.id ?? '__none__'}
        onChange={(e) => {
          if (e.target.value === '__none__') {
            onSelect(null);
            return;
          }
          const piece = allPieces.find((p) => p.id === e.target.value);
          if (piece) onSelect(piece);
        }}
      >
        {allowNone && <option value="__none__">None</option>}
        {groups.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.pieces.map((p) => (
              <option key={p.id} value={p.id}>
                {p.variant ?? p.displayName}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
