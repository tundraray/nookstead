'use client';

import { useState } from 'react';
import type { MapEditorState, MapEditorAction, InteractionLayer } from '@nookstead/map-lib';
import type { CellTrigger } from '@nookstead/shared';

const TRIGGER_TYPES: Array<{
  type: CellTrigger['type'];
  label: string;
  color: string;
}> = [
  { type: 'warp', label: 'Warp', color: '#AB47BC' },
  { type: 'interact', label: 'Interact', color: '#42A5F5' },
  { type: 'event', label: 'Event', color: '#FFA726' },
  { type: 'sound', label: 'Sound', color: '#66BB6A' },
  { type: 'damage', label: 'Damage', color: '#EF5350' },
];

/** Brief summary line for a trigger. */
function triggerSummary(t: CellTrigger): string {
  switch (t.type) {
    case 'warp':
      return `→ ${t.targetMap || '(no target)'} (${t.targetX},${t.targetY})`;
    case 'interact':
      return t.interactionType;
    case 'event':
      return t.eventName || '(no event)';
    case 'sound':
      return t.soundKey || '(no sound)';
    case 'damage':
      return `${t.amount} dmg / ${t.interval}ms`;
  }
}

interface InteractionsPanelProps {
  state: MapEditorState;
  dispatch: React.Dispatch<MapEditorAction>;
}

export function InteractionsPanel({ state, dispatch }: InteractionsPanelProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const interactionLayers = state.layers.filter(
    (l): l is InteractionLayer => l.type === 'interaction',
  );
  const activeLayer = state.layers[state.activeLayerIndex];
  const activeInteractionLayer: InteractionLayer | null =
    activeLayer?.type === 'interaction'
      ? activeLayer
      : interactionLayers[0] ?? null;

  const layerIndex = activeInteractionLayer
    ? state.layers.indexOf(activeInteractionLayer)
    : -1;

  const triggerCount = activeInteractionLayer
    ? [...activeInteractionLayer.triggers.values()].reduce(
        (sum, arr) => sum + arr.length,
        0,
      )
    : 0;

  const activeTriggerType = state.activeTriggerType;

  return (
    <div className="flex flex-col gap-3 p-3">
      <section>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Trigger Type
        </h3>
        <div className="flex flex-col gap-1">
          {TRIGGER_TYPES.map(({ type, label, color }) => (
            <button
              key={type}
              className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded transition-colors text-left ${
                activeTriggerType === type
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-muted'
              }`}
              style={{ borderLeft: `3px solid ${color}` }}
              onClick={() => {
                dispatch({ type: 'SET_TRIGGER_TYPE', triggerType: type });
                dispatch({ type: 'SET_TOOL', tool: 'interaction-place' });
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
          Interaction Layer
        </h3>
        {activeInteractionLayer ? (
          <p className="text-sm text-foreground">
            {activeInteractionLayer.name} ({triggerCount} triggers)
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No interaction layer yet.
          </p>
        )}
        <button
          className="mt-2 w-full px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
          onClick={() =>
            dispatch({
              type: 'ADD_INTERACTION_LAYER',
              name: 'Interactions',
            })
          }
        >
          Add Interaction Layer
        </button>
      </section>

      {activeInteractionLayer && triggerCount > 0 && (
        <section>
          <h3 className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wider">
            Placed Triggers
          </h3>
          <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
            {[...activeInteractionLayer.triggers.entries()].map(
              ([key, triggers]) => {
                const [xStr, yStr] = key.split(',');
                const x = parseInt(xStr, 10);
                const y = parseInt(yStr, 10);
                const isExpanded = expandedKey === key;
                return (
                  <div key={key} className="bg-muted rounded overflow-hidden">
                    <button
                      className="w-full text-xs px-2 py-1 flex items-center justify-between hover:bg-muted/80"
                      onClick={() =>
                        setExpandedKey(isExpanded ? null : key)
                      }
                    >
                      <span className="font-mono">({key})</span>
                      <span className="text-muted-foreground">
                        {triggers.map((t) => t.type).join(', ')}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="px-2 pb-2 flex flex-col gap-1">
                        {triggers.map((trigger, idx) => (
                          <div
                            key={idx}
                            className="text-xs bg-background rounded p-2 flex flex-col gap-1"
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="font-semibold"
                                style={{
                                  color:
                                    TRIGGER_TYPES.find(
                                      (t) => t.type === trigger.type,
                                    )?.color ?? '#888',
                                }}
                              >
                                {trigger.type}
                              </span>
                              <button
                                className="text-destructive hover:text-destructive/80 text-xs px-1"
                                onClick={() =>
                                  dispatch({
                                    type: 'REMOVE_TRIGGER',
                                    layerIndex,
                                    x,
                                    y,
                                    triggerIndex: idx,
                                  })
                                }
                              >
                                Delete
                              </button>
                            </div>
                            <span className="text-muted-foreground">
                              {triggerSummary(trigger)}
                            </span>
                            <pre className="text-[10px] text-muted-foreground bg-muted rounded p-1 overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(trigger, null, 2)}
                            </pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              },
            )}
          </div>
        </section>
      )}
    </div>
  );
}
