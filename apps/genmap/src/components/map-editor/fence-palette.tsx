'use client';

import { useState, useEffect, useMemo, type Dispatch } from 'react';
import type { MapEditorState, MapEditorAction } from '@/hooks/map-editor-types';

/** Shape of a fence type record returned by GET /api/fence-types. */
interface FenceTypeRecord {
  id: string;
  name: string;
  key: string;
  category: string | null;
  sortOrder: number;
}

/** Format a fence type name for display (capitalize each word, replace underscores). */
function formatFenceName(name: string): string {
  return name
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/** Capitalize the first letter of a string. */
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Group fence types by their category.
 * Types without a category go into an 'Uncategorized' group.
 */
function groupByCategory(
  fenceTypes: FenceTypeRecord[]
): Array<{ name: string; types: FenceTypeRecord[] }> {
  const groupMap = new Map<string, FenceTypeRecord[]>();

  for (const ft of fenceTypes) {
    const groupName = ft.category || 'uncategorized';
    const existing = groupMap.get(groupName);
    if (existing) {
      existing.push(ft);
    } else {
      groupMap.set(groupName, [ft]);
    }
  }

  return Array.from(groupMap.entries()).map(([name, types]) => ({
    name,
    types,
  }));
}

interface FencePaletteProps {
  state: MapEditorState;
  dispatch: Dispatch<MapEditorAction>;
}

/**
 * Fence type palette sidebar panel.
 *
 * Fetches available fence types from GET /api/fence-types and displays
 * them as a selectable list grouped by category. Selecting a fence type
 * dispatches SET_FENCE_TYPE to set the active fence type key and
 * SET_TOOL to activate the fence tool.
 */
export function FencePalette({ state, dispatch }: FencePaletteProps) {
  const [fenceTypes, setFenceTypes] = useState<FenceTypeRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch fence types from API
  useEffect(() => {
    let cancelled = false;

    async function fetchFenceTypes() {
      setIsLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/fence-types');
        if (!res.ok) {
          throw new Error(`Failed to load fence types: ${res.status}`);
        }
        const data = (await res.json()) as FenceTypeRecord[];
        if (!cancelled) {
          setFenceTypes(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Failed to load fence types'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    fetchFenceTypes();
    return () => {
      cancelled = true;
    };
  }, []);

  const groups = useMemo(() => groupByCategory(fenceTypes), [fenceTypes]);

  // All groups open by default
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(groups.map((g) => g.name))
  );

  // Update open groups when groups change
  useEffect(() => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      for (const g of groups) {
        next.add(g.name);
      }
      return next;
    });
  }, [groups]);

  // Search/filter state
  const [searchQuery, setSearchQuery] = useState('');

  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return groups;
    const query = searchQuery.toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        types: group.types.filter(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.key.toLowerCase().includes(query)
        ),
      }))
      .filter((group) => group.types.length > 0);
  }, [groups, searchQuery]);

  function toggleGroup(groupName: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) {
        next.delete(groupName);
      } else {
        next.add(groupName);
      }
      return next;
    });
  }

  function handleSelectFenceType(fenceTypeKey: string) {
    dispatch({ type: 'SET_FENCE_TYPE', fenceTypeKey });
    // Also switch to fence tool when selecting a fence type
    if (state.activeTool !== 'fence' && state.activeTool !== 'fence-eraser') {
      dispatch({ type: 'SET_TOOL', tool: 'fence' });
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        Loading fence types...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (fenceTypes.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
        No fence types defined. Create fence types via the API first.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {/* Search input */}
      <div className="pb-1">
        <input
          type="text"
          placeholder="Filter fence types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-2 py-1 text-xs rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {filteredGroups.map((group) => {
        const isOpen = openGroups.has(group.name);
        return (
          <div key={group.name}>
            <button
              type="button"
              onClick={() => toggleGroup(group.name)}
              className="flex items-center justify-between w-full px-1 py-1 text-xs font-semibold hover:bg-accent rounded transition-colors"
            >
              <span>
                {capitalize(group.name)} ({group.types.length})
              </span>
              <span className="text-muted-foreground">
                {isOpen ? '\u25B4' : '\u25BE'}
              </span>
            </button>
            {isOpen && (
              <div className="space-y-0.5 ml-1">
                {group.types.map((ft) => (
                  <button
                    key={ft.key}
                    type="button"
                    onClick={() => handleSelectFenceType(ft.key)}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded text-left hover:bg-accent transition-colors ${
                      state.activeFenceTypeKey === ft.key
                        ? 'ring-2 ring-primary bg-accent'
                        : ''
                    }`}
                  >
                    {/* Placeholder swatch: colored square based on fence type */}
                    <div
                      className="w-6 h-6 rounded border border-border bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground"
                    >
                      F
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium truncate">
                        {formatFenceName(ft.name)}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">
                        {ft.key}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
