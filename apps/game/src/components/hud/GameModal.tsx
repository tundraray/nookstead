'use client';

import { Dialog } from 'radix-ui';
import type { ReactNode } from 'react';
import { NineSlicePanel } from './NineSlicePanel';
import { spriteNativeStyle, spriteStretchStyle } from './sprite';
import { PANEL_MODAL, SPRITES } from './sprites';
import type { NineSliceSet } from './types';

interface GameModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  slices?: NineSliceSet;
}

export function GameModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  slices = PANEL_MODAL,
}: GameModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="game-modal-overlay" />
        <Dialog.Content className={`game-modal-content ${className ?? ''}`}>
          <NineSlicePanel slices={slices} className="game-modal-panel">
            <Dialog.Close className="game-modal-close" aria-label="Close">
              <div
                style={spriteNativeStyle(...SPRITES.closeIcon)}
                aria-hidden="true"
              />
            </Dialog.Close>
            {title && (
              <div className="game-modal-header">
                <div
                  className="game-modal-header__left"
                  style={spriteNativeStyle(...SPRITES.headerLeft)}
                  aria-hidden="true"
                />
                <div className="game-modal-header__mid">
                  <div
                    className="game-modal-header__center"
                    style={spriteStretchStyle(...SPRITES.headerCenter)}
                    aria-hidden="true"
                  />
                  <Dialog.Title className="game-modal-title">
                    {title}
                  </Dialog.Title>
                </div>
                <div
                  className="game-modal-header__right"
                  style={spriteNativeStyle(...SPRITES.headerRight)}
                  aria-hidden="true"
                />
              </div>
            )}
            {description && (
              <Dialog.Description className="game-modal-description">
                {description}
              </Dialog.Description>
            )}
            {children}
          </NineSlicePanel>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
