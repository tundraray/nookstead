'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { EventBus } from '@/game/EventBus';
import { isTextInputFocused } from '@/game/input/InputController';
import { getRoom } from '@/services/colyseus';
import {
  ClientMessage,
  type RelationshipData,
  type DialogueActionType,
} from '@nookstead/shared';
import { ColyseusTransport } from '@/services/ColyseusTransport';
import { Hotbar } from './Hotbar';
import { GameModal } from './GameModal';
import { ChatModal } from './ChatModal';
import { MenuButton } from './MenuButton';
import type { HUDState } from './types';

interface HUDProps {
  uiScale: number;
}

const DEFAULT_HUD_STATE: Omit<HUDState, 'day' | 'time' | 'season' | 'gold'> = {
  hotbarItems: Array(10).fill(null),
  selectedSlot: 0,
};

export function HUD({ uiScale }: HUDProps) {
  const [hotbarItems] = useState(DEFAULT_HUD_STATE.hotbarItems);
  const [selectedSlot, setSelectedSlot] = useState(DEFAULT_HUD_STATE.selectedSlot);
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    </div>
  );
}
