'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Callbacks } from '@colyseus/sdk';
import { EventBus } from '@/game/EventBus';
import { isTextInputFocused } from '@/game/input/InputController';
import { getRoom } from '@/services/colyseus';
import {
  ClientMessage,
  HOTBAR_SLOT_COUNT,
  type RelationshipData,
  type DialogueActionType,
} from '@nookstead/shared';
import { ColyseusTransport } from '@/services/ColyseusTransport';
import { Hotbar } from './Hotbar';
import { GameModal } from './GameModal';
import { ChatModal } from './ChatModal';
import { InventoryPanel } from './InventoryPanel';
import { MenuButton } from './MenuButton';
import type { HotbarItem, SpriteRect } from './types';

interface HUDProps {
  uiScale: number;
}

const EMPTY_HOTBAR: (HotbarItem | null)[] = Array(HOTBAR_SLOT_COUNT).fill(null);

/**
 * Convert a Colyseus InventorySlotSchema to a HotbarItem or null.
 * Empty slots (itemType === '') map to null.
 */
function schemaToHotbarItem(slot: {
  itemType: string;
  quantity: number;
  spriteX: number;
  spriteY: number;
  spriteW: number;
  spriteH: number;
}): HotbarItem | null {
  if (!slot.itemType || slot.itemType === '') return null;
  return {
    id: slot.itemType,
    spriteRect: [slot.spriteX, slot.spriteY, slot.spriteW, slot.spriteH] as SpriteRect,
    quantity: slot.quantity,
  };
}

export function HUD({ uiScale }: HUDProps) {
  const [hotbarItems, setHotbarItems] = useState<(HotbarItem | null)[]>(EMPTY_HOTBAR);
  const [selectedSlot, setSelectedSlot] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [inventoryOpen, setInventoryOpen] = useState(false);

  // Subscribe to Colyseus hotbar state
  useEffect(() => {
    const detachCallbacks: (() => void)[] = [];

    /**
     * Read the current hotbar from the player schema and convert
     * each InventorySlotSchema to HotbarItem | null.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function readHotbar(player: any): (HotbarItem | null)[] {
      if (!player?.hotbar) return EMPTY_HOTBAR;
      return Array.from({ length: HOTBAR_SLOT_COUNT }, (_, i) => {
        const slot = player.hotbar[i];
        if (!slot) return null;
        return schemaToHotbarItem(slot);
      });
    }

    /**
     * Subscribe to onChange on each slot within the player's hotbar
     * ArraySchema so that individual slot mutations trigger re-renders.
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function subscribeToHotbar(room: any, player: any) {
      if (!player?.hotbar) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const $ = Callbacks.get(room as any);

      // Listen for changes on the hotbar ArraySchema itself
      const detachHotbar = $.onChange(player.hotbar, () => {
        setHotbarItems(readHotbar(player));
      });
      detachCallbacks.push(detachHotbar);

      // Also listen for changes on individual slot schemas
      for (let i = 0; i < HOTBAR_SLOT_COUNT; i++) {
        const slot = player.hotbar[i];
        if (slot) {
          const detachSlot = $.onChange(slot, () => {
            setHotbarItems(readHotbar(player));
          });
          detachCallbacks.push(detachSlot);
        }
      }
    }

    function attach() {
      const room = getRoom();
      if (!room) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const state = room.state as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const $ = Callbacks.get(room as any);

      // Listen for this player being added (handles initial state + reconnects)
      const detachAdd = $.onAdd(
        'players' as never,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (player: any, sessionId: any) => {
          if (sessionId === room.sessionId) {
            setHotbarItems(readHotbar(player));
            subscribeToHotbar(room, player);
          }
        },
        true // immediate -- fire for players already in state
      );
      detachCallbacks.push(detachAdd);

      // Also check if player is already available (race condition guard)
      const localPlayer = state.players?.get(room.sessionId);
      if (localPlayer) {
        setHotbarItems(readHotbar(localPlayer));
        subscribeToHotbar(room, localPlayer);
      }
    }

    // Try attaching immediately in case room is already connected
    attach();

    // Also listen for the multiplayer:connected event in case room connects later
    function onConnected() {
      // Clean up any previous subscriptions before re-attaching
      for (const detach of detachCallbacks) {
        detach();
      }
      detachCallbacks.length = 0;
      attach();
    }
    EventBus.on('multiplayer:connected', onConnected);

    return () => {
      EventBus.off('multiplayer:connected', onConnected);
      for (const detach of detachCallbacks) {
        detach();
      }
      detachCallbacks.length = 0;
    };
  }, []);

  // Dialogue chat state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatBotId, setChatBotId] = useState('');
  const [chatBotName, setChatBotName] = useState('');
  const [chatTransport, setChatTransport] = useState<ColyseusTransport | null>(
    null
  );
  const [chatRelationship, setChatRelationship] =
    useState<RelationshipData | null>(null);
  const [chatAvailableActions, setChatAvailableActions] = useState<
    DialogueActionType[]
  >([]);
  const transportRef = useRef<ColyseusTransport | null>(null);

  // Keyboard: hotbar slot selection (1-0)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTextInputFocused()) return;

      const match = e.code.match(/^Digit(\d)$/);
      if (match) {
        const digit = parseInt(match[1], 10);
        const slot = digit === 0 ? 9 : digit - 1;
        setSelectedSlot(slot);
        EventBus.emit('hud:select-slot', slot);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Keyboard: toggle inventory panel (E/I to open/close, Esc to close)
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (isTextInputFocused()) return;
      if (chatOpen) return; // Don't toggle inventory while chatting

      if (e.key === 'e' || e.key === 'E' || e.key === 'i' || e.key === 'I') {
        setInventoryOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && inventoryOpen) {
        setInventoryOpen(false);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [inventoryOpen, chatOpen]);

  // Movement lock/unlock when inventory panel opens/closes
  useEffect(() => {
    if (inventoryOpen) {
      EventBus.emit('dialogue:lock-movement');
    } else {
      EventBus.emit('dialogue:unlock-movement');
    }
  }, [inventoryOpen]);

  // Listen for dialogue:start EventBus event from PlayerManager
  useEffect(() => {
    function onDialogueStart(data: {
      botId: string;
      botName: string;
      relationship?: RelationshipData;
      availableActions?: DialogueActionType[];
    }) {
      const room = getRoom();
      const transport = new ColyseusTransport(room);
      transportRef.current = transport;

      setChatBotId(data.botId);
      setChatBotName(data.botName);
      setChatTransport(transport);
      setChatRelationship(data.relationship ?? null);
      setChatAvailableActions(data.availableActions ?? []);
      setChatOpen(true);

      EventBus.emit('dialogue:lock-movement');
    }

    EventBus.on('dialogue:start', onDialogueStart);
    return () => {
      EventBus.off('dialogue:start', onDialogueStart);
    };
  }, []);

  // Handle chat modal close: clean up transport and unlock movement
  const handleChatClose = useCallback((nextOpen: boolean) => {
    if (!nextOpen) {
      // Send DIALOGUE_END to server to end the dialogue session
      const room = getRoom();
      if (room) {
        room.send(ClientMessage.DIALOGUE_END, {});
      }

      // Dispose transport (cancels active stream, removes listeners)
      if (transportRef.current) {
        transportRef.current.dispose();
        transportRef.current = null;
      }

      setChatOpen(false);
      setChatTransport(null);
      setChatBotId('');
      setChatBotName('');
      setChatRelationship(null);
      setChatAvailableActions([]);

      EventBus.emit('dialogue:unlock-movement');
    }
  }, []);

  // Listen for server-initiated dialogue end (NPC ended conversation, fatigue, etc.)
  useEffect(() => {
    function onSessionEnded() {
      handleChatClose(false);
    }
    EventBus.on('dialogue:session-ended', onSessionEnded);
    return () => {
      EventBus.off('dialogue:session-ended', onSessionEnded);
    };
  }, [handleChatClose]);

  return (
    <div
      className="hud"
      style={{ '--ui-scale': uiScale } as React.CSSProperties}
      role="region"
      aria-label="Game heads-up display"
    >
      <MenuButton onClick={() => setSettingsOpen(true)} />
      <Hotbar
        items={hotbarItems}
        selectedSlot={selectedSlot}
        onSlotClick={(i) => {
          setSelectedSlot(i);
          EventBus.emit('hud:select-slot', i);
        }}
      />
      <GameModal
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        title="Settings"
      >
        <p>Settings content goes here</p>
      </GameModal>
      {chatTransport && (
        <ChatModal
          key={chatBotId}
          open={chatOpen}
          onOpenChange={handleChatClose}
          botId={chatBotId}
          botName={chatBotName}
          transport={chatTransport}
          initialRelationship={chatRelationship}
          initialAvailableActions={chatAvailableActions}
        />
      )}
      {inventoryOpen && (
        <InventoryPanel
          room={getRoom()}
          hotbarItems={hotbarItems}
          onClose={() => setInventoryOpen(false)}
        />
      )}
    </div>
  );
}
