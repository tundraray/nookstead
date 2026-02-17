'use client';

import type { LayerCategory, LayerOption } from './types';
import { getLayerOptions, getGroups } from './character-registry';
import styles from './CharacterGenerator.module.css';

interface Props {
  category: LayerCategory;
  selected: LayerOption | null;
  onSelect: (option: LayerOption | null) => void;
  allowNone?: boolean;
  label: string;
}

export function LayerPanel({
  category,
  selected,
  onSelect,
  allowNone = false,
  label,
}: Props) {
  const options = getLayerOptions(category);
  const groups = getGroups(category);
  const hasGroups = groups.length > 0;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (value === '__none__') {
      onSelect(null);
      return;
    }
    const option = options.find((o) => o.id === value);
    if (option) onSelect(option);
  };

  if (hasGroups) {
    // Group options by their group field
    const grouped = new Map<string, LayerOption[]>();
    for (const opt of options) {
      const group = opt.group || 'Other';
      const arr = grouped.get(group) ?? [];
      arr.push(opt);
      grouped.set(group, arr);
    }

    return (
      <div className={styles.layerPanel}>
        <label className={styles.layerLabel}>{label}</label>
        <select
          className={styles.selectorDropdown}
          value={selected?.id ?? '__none__'}
          onChange={handleChange}
        >
          {allowNone && <option value="__none__">None</option>}
          {[...grouped.entries()].map(([group, opts]) => (
            <optgroup key={group} label={group}>
              {opts.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.variant ?? opt.displayName}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className={styles.layerPanel}>
      <label className={styles.layerLabel}>{label}</label>
      <select
        className={styles.selectorDropdown}
        value={selected?.id ?? '__none__'}
        onChange={handleChange}
      >
        {allowNone && <option value="__none__">None</option>}
        {options.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.displayName}
          </option>
        ))}
      </select>
    </div>
  );
}
