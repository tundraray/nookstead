'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { LayerCategory, LayerOption, SkinRecipe, StoredSkin } from './types';
import { LAYER_ORDER, SKIN_RECIPE_KEY, SKIN_SHEET_KEY } from './types';
import { getDefaultOptions, getLayerOptions, getLayerOptionById } from './character-registry';
import {
  loadImage,
  buildLayerConfig,
  prebakeToDataUrl,
  type LayerConfig,
} from './spritesheet-compositor';

export interface CharacterState {
  body: LayerOption;
  eyes: LayerOption | null;
  hairstyle: LayerOption | null;
  outfit: LayerOption | null;
  accessory: LayerOption | null;
  smartphone: LayerOption | null;
  book: LayerOption | null;
}

export interface UseCharacterStateReturn {
  state: CharacterState;
  setLayer: (category: LayerCategory, option: LayerOption | null) => void;
  randomize: () => void;
  save: () => Promise<void>;
  layers: LayerConfig[];
  isLoading: boolean;
  isSaving: boolean;
  hasUnsavedChanges: boolean;
  savedSuccessfully: boolean;
}

function loadSavedRecipe(): CharacterState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SKIN_RECIPE_KEY);
    if (!raw) return null;
    const stored: StoredSkin = JSON.parse(raw);
    if (stored.type !== 'custom') return null;

    const recipe = stored as SkinRecipe;
    const body = recipe.body
      ? getLayerOptionById('body', recipe.body)
      : undefined;
    if (!body) return null;

    return {
      body,
      eyes: recipe.eyes ? getLayerOptionById('eyes', recipe.eyes) ?? null : null,
      hairstyle: recipe.hairstyle
        ? getLayerOptionById('hairstyle', recipe.hairstyle) ?? null
        : null,
      outfit: recipe.outfit
        ? getLayerOptionById('outfit', recipe.outfit) ?? null
        : null,
      accessory: recipe.accessory
        ? getLayerOptionById('accessory', recipe.accessory) ?? null
        : null,
      smartphone: recipe.smartphone
        ? getLayerOptionById('smartphone', recipe.smartphone) ?? null
        : null,
      book: recipe.book
        ? getLayerOptionById('book', recipe.book) ?? null
        : null,
    };
  } catch {
    return null;
  }
}

function stateToRecipe(state: CharacterState): SkinRecipe {
  return {
    type: 'custom',
    body: state.body.id,
    eyes: state.eyes?.id ?? null,
    hairstyle: state.hairstyle?.id ?? null,
    outfit: state.outfit?.id ?? null,
    accessory: state.accessory?.id ?? null,
    smartphone: state.smartphone?.id ?? null,
    book: state.book?.id ?? null,
    isKid: false,
  };
}

export function useCharacterState(): UseCharacterStateReturn {
  const [state, setState] = useState<CharacterState>(() => {
    const saved = loadSavedRecipe();
    if (saved) return saved;
    const defaults = getDefaultOptions();
    return {
      body: defaults.body!,
      eyes: defaults.eyes,
      hairstyle: defaults.hairstyle,
      outfit: defaults.outfit,
      accessory: defaults.accessory,
      smartphone: defaults.smartphone,
      book: defaults.book,
    };
  });

  const [layers, setLayers] = useState<LayerConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
  const loadIdRef = useRef(0);
  const restoredRef = useRef(false);

  // Restore saved recipe from localStorage after mount (SSR can't access localStorage)
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const saved = loadSavedRecipe();
    if (saved) setState(saved);
  }, []);

  // Load images whenever state changes
  useEffect(() => {
    const loadId = ++loadIdRef.current;
    setIsLoading(true);

    const activeLayers: LayerOption[] = [];
    for (const cat of LAYER_ORDER) {
      const option = state[cat];
      if (option) activeLayers.push(option);
    }
    // Add smartphone and book if selected
    if (state.smartphone) activeLayers.push(state.smartphone);
    if (state.book) activeLayers.push(state.book);

    Promise.all(activeLayers.map((opt) => loadImage(opt.path)))
      .then((images) => {
        if (loadId !== loadIdRef.current) return;
        const configs = images.map((img, i) =>
          buildLayerConfig(
            img,
            activeLayers[i].columns,
            activeLayers[i].sheetWidth,
            activeLayers[i].sheetHeight
          )
        );
        setLayers(configs);
        setIsLoading(false);
      })
      .catch((err) => {
        if (loadId !== loadIdRef.current) return;
        console.error('Failed to load character layers:', err);
        setIsLoading(false);
      });
  }, [state]);

  const setLayer = useCallback(
    (category: LayerCategory, option: LayerOption | null) => {
      setState((prev) => ({ ...prev, [category]: option }));
      setHasUnsavedChanges(true);
      setSavedSuccessfully(false);
    },
    []
  );

  const randomize = useCallback(() => {
    const randomFrom = <T>(arr: T[]): T =>
      arr[Math.floor(Math.random() * arr.length)];

    setState({
      body: randomFrom(getLayerOptions('body')),
      eyes: randomFrom(getLayerOptions('eyes')),
      hairstyle: randomFrom(getLayerOptions('hairstyle')),
      outfit: randomFrom(getLayerOptions('outfit')),
      accessory:
        Math.random() < 0.6
          ? randomFrom(getLayerOptions('accessory'))
          : null,
      smartphone: null,
      book: null,
    });
    setHasUnsavedChanges(true);
    setSavedSuccessfully(false);
  }, []);

  const save = useCallback(async () => {
    if (layers.length === 0) return;

    setIsSaving(true);
    try {
      // Pre-bake the spritesheet
      const dataUrl = prebakeToDataUrl(layers);

      // Store recipe and pre-baked sheet
      const recipe = stateToRecipe(state);
      localStorage.setItem(SKIN_RECIPE_KEY, JSON.stringify(recipe));
      localStorage.setItem(SKIN_SHEET_KEY, dataUrl);

      setHasUnsavedChanges(false);
      setSavedSuccessfully(true);
      console.info('Character saved to localStorage');
    } catch (error) {
      console.error('Failed to save character:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [layers, state]);

  return {
    state,
    setLayer,
    randomize,
    save,
    layers,
    isLoading,
    isSaving,
    hasUnsavedChanges,
    savedSuccessfully,
  };
}
