'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface BemFrameNameConstructorProps {
  value: string;
  onChange: (value: string) => void;
  /** Filenames from the currently open file (merged with server results) */
  localFilenames?: string[];
  className?: string;
}

interface BemParts {
  block: string;
  element: string;
  modifier: string;
}

function parseBemName(name: string): BemParts {
  // Parse "block_element--modifier" format
  const modSplit = name.split('--');
  const modifier = modSplit.length > 1 ? modSplit.slice(1).join('--') : '';
  const blockElement = modSplit[0] || '';
  const elemSplit = blockElement.split('_');
  const block = elemSplit[0] || '';
  const element = elemSplit.length > 1 ? elemSplit.slice(1).join('_') : '';
  return { block, element, modifier };
}

function buildBemName(parts: BemParts): string {
  let result = parts.block;
  if (parts.element) result += `_${parts.element}`;
  if (parts.modifier) result += `--${parts.modifier}`;
  return result;
}

const NEXT_FIELD: Record<string, 'block' | 'element' | 'modifier' | null> = {
  block: 'element',
  element: 'modifier',
  modifier: null,
};

export function BemFrameNameConstructor({
  value,
  onChange,
  localFilenames,
  className,
}: BemFrameNameConstructorProps) {
  const [mode, setMode] = useState<'manual' | 'constructor'>('manual');
  const [parts, setParts] = useState<BemParts>(() => parseBemName(value));
  const [serverFilenames, setServerFilenames] = useState<string[]>([]);
  const [focusedField, setFocusedField] = useState<'block' | 'element' | 'modifier' | null>(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  const elementInputRef = useRef<HTMLInputElement>(null);
  const modifierInputRef = useRef<HTMLInputElement>(null);

  // Fetch all frame filenames from server for suggestions
  useEffect(() => {
    fetch('/api/frames/search?q=')
      .then((r) => r.json())
      .then((data: string[]) => setServerFilenames(data))
      .catch(() => {});
  }, []);

  // Merge local + server filenames, deduplicated
  const allFilenames = useMemo(() => {
    const set = new Set<string>(localFilenames ?? []);
    for (const f of serverFilenames) set.add(f);
    return [...set];
  }, [localFilenames, serverFilenames]);

  // Sync parts to value when in constructor mode
  useEffect(() => {
    if (mode === 'constructor') {
      const name = buildBemName(parts);
      if (name !== value) onChange(name);
    }
  }, [parts, mode, onChange, value]);

  // When switching to constructor mode, parse current value
  useEffect(() => {
    if (mode === 'constructor') {
      setParts(parseBemName(value));
    }
  }, [mode, value]);

  const getSuggestions = useCallback(
    (field: 'block' | 'element' | 'modifier', input: string): string[] => {
      if (allFilenames.length === 0) return [];

      const parsed = allFilenames.map(parseBemName);
      let candidates: string[] = [];

      if (field === 'block') {
        candidates = [...new Set(parsed.map((p) => p.block).filter(Boolean))];
      } else if (field === 'element') {
        // Filter by current block
        candidates = [
          ...new Set(
            parsed
              .filter((p) => p.block === parts.block)
              .map((p) => p.element)
              .filter(Boolean)
          ),
        ];
      } else {
        // Filter by current block + element
        candidates = [
          ...new Set(
            parsed
              .filter((p) => p.block === parts.block && p.element === parts.element)
              .map((p) => p.modifier)
              .filter(Boolean)
          ),
        ];
      }

      if (!input) return candidates.slice(0, 8);
      const lower = input.toLowerCase();
      return candidates
        .filter((c) => c.toLowerCase().startsWith(lower))
        .slice(0, 8);
    },
    [allFilenames, parts.block, parts.element]
  );

  // Reset highlight when focused field or input changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [focusedField, parts.block, parts.element, parts.modifier]);

  const selectSuggestion = useCallback(
    (field: 'block' | 'element' | 'modifier', val: string) => {
      setParts((p) => ({ ...p, [field]: val }));
      const next = NEXT_FIELD[field];
      setFocusedField(next);
      // Focus the next input
      if (next === 'element') elementInputRef.current?.focus();
      else if (next === 'modifier') modifierInputRef.current?.focus();
    },
    []
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent, field: 'block' | 'element' | 'modifier') => {
      const items = getSuggestions(field, parts[field]);
      if (items.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev < items.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : items.length - 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < items.length) {
          selectSuggestion(field, items[highlightedIndex]);
        }
      } else if (e.key === 'Escape') {
        setFocusedField(null);
      }
    },
    [getSuggestions, parts, highlightedIndex, selectSuggestion]
  );

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setFocusedField(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (mode === 'manual') {
    return (
      <div className={className}>
        <div className="flex items-center gap-1 mb-1">
          <Label className="text-xs flex-1" title="Enter frame filename directly">Filename</Label>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 text-xs px-1"
            onClick={() => setMode('constructor')}
            title="Switch to BEM constructor — build filename from block, element, and modifier parts"
          >
            Constructor
          </Button>
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-7 text-xs"
          placeholder="e.g., barn_bottom--yellow"
        />
      </div>
    );
  }

  return (
    <div className={className} ref={suggestionsRef}>
      <div className="flex items-center gap-1 mb-1">
        <Label className="text-xs flex-1" title="Build filename using BEM notation: block_element--modifier">
          Filename (BEM)
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 text-xs px-1"
          onClick={() => setMode('manual')}
          title="Switch to manual input"
        >
          Manual
        </Button>
      </div>

      <div className="flex items-center gap-0.5 text-xs">
        {/* Block */}
        <div className="relative flex-1">
          <Input
            value={parts.block}
            onChange={(e) => setParts((p) => ({ ...p, block: e.target.value }))}
            onFocus={() => setFocusedField('block')}
            onKeyDown={(e) => handleKeyDown(e, 'block')}
            className="h-7 text-xs"
            placeholder="block"
            title="Block — the main object name (e.g., barn, bridge, tree)"
          />
          {focusedField === 'block' && (
            <SuggestionsList
              items={getSuggestions('block', parts.block)}
              highlightedIndex={highlightedIndex}
              onSelect={(val) => selectSuggestion('block', val)}
            />
          )}
        </div>

        <span className="text-muted-foreground font-mono">_</span>

        {/* Element */}
        <div className="relative flex-1">
          <Input
            ref={elementInputRef}
            value={parts.element}
            onChange={(e) => setParts((p) => ({ ...p, element: e.target.value }))}
            onFocus={() => setFocusedField('element')}
            onKeyDown={(e) => handleKeyDown(e, 'element')}
            className="h-7 text-xs"
            placeholder="element"
            title="Element — the part of the object (e.g., bottom, roof, door)"
          />
          {focusedField === 'element' && (
            <SuggestionsList
              items={getSuggestions('element', parts.element)}
              highlightedIndex={highlightedIndex}
              onSelect={(val) => selectSuggestion('element', val)}
            />
          )}
        </div>

        <span className="text-muted-foreground font-mono">--</span>

        {/* Modifier */}
        <div className="relative flex-1">
          <Input
            ref={modifierInputRef}
            value={parts.modifier}
            onChange={(e) => setParts((p) => ({ ...p, modifier: e.target.value }))}
            onFocus={() => setFocusedField('modifier')}
            onKeyDown={(e) => handleKeyDown(e, 'modifier')}
            className="h-7 text-xs"
            placeholder="mod"
            title="Modifier — the variant (e.g., yellow, dark, large)"
          />
          {focusedField === 'modifier' && (
            <SuggestionsList
              items={getSuggestions('modifier', parts.modifier)}
              highlightedIndex={highlightedIndex}
              onSelect={(val) => selectSuggestion('modifier', val)}
            />
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="mt-1 text-xs text-muted-foreground font-mono truncate" title="Resulting filename">
        {buildBemName(parts) || '(empty)'}
      </div>
    </div>
  );
}

function SuggestionsList({
  items,
  highlightedIndex,
  onSelect,
}: {
  items: string[];
  highlightedIndex: number;
  onSelect: (item: string) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex < 0 || !listRef.current) return;
    const el = listRef.current.children[highlightedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex]);

  if (items.length === 0) return null;

  return (
    <div ref={listRef} className="absolute z-50 top-full left-0 right-0 mt-0.5 bg-popover border rounded shadow-md max-h-32 overflow-y-auto">
      {items.map((item, i) => (
        <button
          key={item}
          className={`w-full text-left px-2 py-1 text-xs ${
            i === highlightedIndex ? 'bg-accent text-accent-foreground' : 'hover:bg-muted'
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(item);
          }}
        >
          {item}
        </button>
      ))}
    </div>
  );
}
