'use client';

import { useState, useCallback } from 'react';
import type { FramePickerFrame } from '@/components/atlas-frame-picker';
import type { FrameLayer } from '@/components/object-grid-canvas';
import type { LayerPreviewData } from '@/components/object-preview';

export interface CollisionZone {
  id: string;
  label: string;
  type: 'collision' | 'walkable';
  shape: 'rectangle';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ObjectEditorState {
  layers: FrameLayer[];
  activeFrame: FramePickerFrame | null;
  selectedLayerIndex: number | null;
  name: string;
  description: string;
  category: string;
  objectType: string;
  tags: string[];
  newTag: string;
  collisionZones: CollisionZone[];
  selectedZoneIndex: number | null;
  isSaving: boolean;
  error: string | null;
}

export interface UseObjectEditorReturn extends ObjectEditorState {
  setActiveFrame: (frame: FramePickerFrame | null) => void;
  setSelectedLayerIndex: (index: number | null) => void;
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setCategory: (category: string) => void;
  setObjectType: (objectType: string) => void;
  setNewTag: (tag: string) => void;
  setError: (error: string | null) => void;
  handleLayerAdd: (frameData: Omit<FrameLayer, 'xOffset' | 'yOffset' | 'layerOrder'>) => void;
  handleLayerUpdate: (index: number, updates: Partial<Pick<FrameLayer, 'xOffset' | 'yOffset' | 'layerOrder'>>) => void;
  handleLayerDelete: (index: number) => void;
  handleMoveLayerUp: (index: number) => void;
  handleMoveLayerDown: (index: number) => void;
  addTag: () => void;
  removeTag: (tag: string) => void;
  handleTagKeyDown: (e: React.KeyboardEvent) => void;
  layersToPreview: () => LayerPreviewData[];
  addCollisionZone: (zone: Omit<CollisionZone, 'id'>) => void;
  updateCollisionZone: (index: number, updates: Partial<CollisionZone>) => void;
  deleteCollisionZone: (index: number) => void;
  setSelectedZoneIndex: (index: number | null) => void;
  setCollisionZones: (zones: CollisionZone[]) => void;
  setLayers: (layers: FrameLayer[]) => void;
  setTags: (tags: string[]) => void;
  setIsSaving: (saving: boolean) => void;
  getPayload: () => {
    name: string;
    description: string | null;
    category: string | null;
    objectType: string | null;
    layers: { frameId: string; spriteId: string; xOffset: number; yOffset: number; layerOrder: number }[];
    collisionZones: CollisionZone[];
    tags: string[] | null;
    metadata: null;
  };
}

export function useObjectEditor(): UseObjectEditorReturn {
  const [layers, setLayers] = useState<FrameLayer[]>([]);
  const [activeFrame, setActiveFrame] = useState<FramePickerFrame | null>(null);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [objectType, setObjectType] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [collisionZones, setCollisionZones] = useState<CollisionZone[]>([]);
  const [selectedZoneIndex, setSelectedZoneIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLayerAdd = useCallback(
    (frameData: Omit<FrameLayer, 'xOffset' | 'yOffset' | 'layerOrder'>) => {
      setLayers((prev) => {
        const newLayer: FrameLayer = {
          ...frameData,
          xOffset: 0,
          yOffset: 0,
          layerOrder: prev.length,
        };
        return [...prev, newLayer];
      });
      setSelectedLayerIndex(layers.length);
    },
    [layers.length]
  );

  const handleLayerUpdate = useCallback(
    (index: number, updates: Partial<Pick<FrameLayer, 'xOffset' | 'yOffset' | 'layerOrder'>>) => {
      setLayers((prev) => {
        const newLayers = [...prev];
        newLayers[index] = { ...newLayers[index], ...updates };
        return newLayers;
      });
    },
    []
  );

  const handleLayerDelete = useCallback((index: number) => {
    setLayers((prev) => {
      const newLayers = prev.filter((_, i) => i !== index);
      return newLayers.map((l, i) => ({ ...l, layerOrder: i }));
    });
    setSelectedLayerIndex(null);
  }, []);

  const handleMoveLayerUp = useCallback((index: number) => {
    if (index === 0) return;
    setLayers((prev) => {
      const newLayers = [...prev];
      const temp = newLayers[index].layerOrder;
      newLayers[index] = { ...newLayers[index], layerOrder: newLayers[index - 1].layerOrder };
      newLayers[index - 1] = { ...newLayers[index - 1], layerOrder: temp };
      [newLayers[index], newLayers[index - 1]] = [newLayers[index - 1], newLayers[index]];
      return newLayers;
    });
    setSelectedLayerIndex(index - 1);
  }, []);

  const handleMoveLayerDown = useCallback((index: number) => {
    setLayers((prev) => {
      if (index >= prev.length - 1) return prev;
      const newLayers = [...prev];
      const temp = newLayers[index].layerOrder;
      newLayers[index] = { ...newLayers[index], layerOrder: newLayers[index + 1].layerOrder };
      newLayers[index + 1] = { ...newLayers[index + 1], layerOrder: temp };
      [newLayers[index], newLayers[index + 1]] = [newLayers[index + 1], newLayers[index]];
      return newLayers;
    });
    setSelectedLayerIndex(index + 1);
  }, []);

  const addTag = useCallback(() => {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setNewTag('');
  }, [newTag, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags((prev) => prev.filter((t) => t !== tag));
  }, []);

  const handleTagKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag();
      }
    },
    [addTag]
  );

  const layersToPreview = useCallback((): LayerPreviewData[] => {
    return layers.map((l) => ({
      frameId: l.frameId,
      spriteId: l.spriteId,
      spriteUrl: l.spriteUrl,
      frameX: l.frameX,
      frameY: l.frameY,
      frameW: l.frameW,
      frameH: l.frameH,
      xOffset: l.xOffset,
      yOffset: l.yOffset,
      layerOrder: l.layerOrder,
    }));
  }, [layers]);

  const addCollisionZone = useCallback((zone: Omit<CollisionZone, 'id'>) => {
    const newZone: CollisionZone = {
      ...zone,
      id: crypto.randomUUID(),
    };
    setCollisionZones((prev) => [...prev, newZone]);
    setSelectedZoneIndex(collisionZones.length);
  }, [collisionZones.length]);

  const updateCollisionZone = useCallback((index: number, updates: Partial<CollisionZone>) => {
    setCollisionZones((prev) => {
      const newZones = [...prev];
      newZones[index] = { ...newZones[index], ...updates };
      return newZones;
    });
  }, []);

  const deleteCollisionZone = useCallback((index: number) => {
    setCollisionZones((prev) => prev.filter((_, i) => i !== index));
    setSelectedZoneIndex(null);
  }, []);

  const getPayload = useCallback(() => ({
    name: name.trim(),
    description: description.trim() || null,
    category: category.trim() || null,
    objectType: objectType.trim() || null,
    layers: layers.map((l) => ({
      frameId: l.frameId,
      spriteId: l.spriteId,
      xOffset: l.xOffset,
      yOffset: l.yOffset,
      layerOrder: l.layerOrder,
    })),
    collisionZones,
    tags: tags.length > 0 ? tags : null,
    metadata: null,
  }), [name, description, category, objectType, layers, collisionZones, tags]);

  return {
    layers,
    activeFrame,
    selectedLayerIndex,
    name,
    description,
    category,
    objectType,
    tags,
    newTag,
    collisionZones,
    selectedZoneIndex,
    isSaving,
    error,
    setActiveFrame,
    setSelectedLayerIndex,
    setName,
    setDescription,
    setCategory,
    setObjectType,
    setNewTag,
    setError,
    handleLayerAdd,
    handleLayerUpdate,
    handleLayerDelete,
    handleMoveLayerUp,
    handleMoveLayerDown,
    addTag,
    removeTag,
    handleTagKeyDown,
    layersToPreview,
    addCollisionZone,
    updateCollisionZone,
    deleteCollisionZone,
    setSelectedZoneIndex,
    setCollisionZones,
    setLayers,
    setTags,
    setIsSaving,
    getPayload,
  };
}
