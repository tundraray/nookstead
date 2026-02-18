import { useState, useCallback, useEffect, useRef } from 'react';
import type { PortraitPiece, PortraitState, AnimationType } from './types';
import {
  SKINS,
  EYES,
  HAIRSTYLES,
  ACCESSORIES,
} from './portrait-registry';
import { loadImage } from './portrait-canvas';

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export interface UsePortraitStateReturn {
  state: PortraitState;
  setSkin: (piece: PortraitPiece) => void;
  setEyes: (piece: PortraitPiece) => void;
  setHairstyle: (piece: PortraitPiece) => void;
  setAccessory: (piece: PortraitPiece | null) => void;
  setAnimationType: (type: AnimationType) => void;
  randomize: () => void;
  images: HTMLImageElement[];
  isLoading: boolean;
}

function getDefaultState(): PortraitState {
  return {
    skin: SKINS[0],
    eyes: EYES[0],
    hairstyle: HAIRSTYLES[0],
    accessory: null,
    animationType: 'idle',
  };
}

export function usePortraitState(): UsePortraitStateReturn {
  const [state, setState] = useState<PortraitState>(getDefaultState);
  const [images, setImages] = useState<HTMLImageElement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loadIdRef = useRef(0);

  // Load images whenever selected pieces change
  useEffect(() => {
    const id = ++loadIdRef.current;
    setIsLoading(true);

    const paths = [state.skin.path, state.eyes.path, state.hairstyle.path];
    if (state.accessory) {
      paths.push(state.accessory.path);
    }

    Promise.all(paths.map(loadImage))
      .then((loaded) => {
        if (id === loadIdRef.current) {
          setImages(loaded);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load portrait images:', err);
        if (id === loadIdRef.current) {
          setIsLoading(false);
        }
      });
  }, [state.skin, state.eyes, state.hairstyle, state.accessory]);

  const setSkin = useCallback(
    (piece: PortraitPiece) => setState((s) => ({ ...s, skin: piece })),
    []
  );

  const setEyes = useCallback(
    (piece: PortraitPiece) => setState((s) => ({ ...s, eyes: piece })),
    []
  );

  const setHairstyle = useCallback(
    (piece: PortraitPiece) => setState((s) => ({ ...s, hairstyle: piece })),
    []
  );

  const setAccessory = useCallback(
    (piece: PortraitPiece | null) =>
      setState((s) => ({ ...s, accessory: piece })),
    []
  );

  const setAnimationType = useCallback(
    (type: AnimationType) => setState((s) => ({ ...s, animationType: type })),
    []
  );

  const randomize = useCallback(() => {
    const hasAccessory = Math.random() > 0.3;
    setState((s) => ({
      skin: randomItem(SKINS),
      eyes: randomItem(EYES),
      hairstyle: randomItem(HAIRSTYLES),
      accessory: hasAccessory ? randomItem(ACCESSORIES) : null,
      animationType: s.animationType,
    }));
  }, []);

  return {
    state,
    setSkin,
    setEyes,
    setHairstyle,
    setAccessory,
    setAnimationType,
    randomize,
    images,
    isLoading,
  };
}
