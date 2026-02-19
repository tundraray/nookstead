import type { ComponentType } from 'react';
import type { ZoneData, ZoneType } from '@nookstead/map-lib';
import { CropFieldProperties } from './crop-field-properties';
import { PathProperties } from './path-properties';
import { WaterFeatureProperties } from './water-feature-properties';
import { SpawnPointProperties } from './spawn-point-properties';
import { TransitionProperties } from './transition-properties';
import { NpcLocationProperties } from './npc-location-properties';
import { GenericProperties } from './generic-properties';

export interface ZonePropertiesEditorProps {
  zone: ZoneData;
  onUpdate: (properties: Record<string, unknown>) => void;
}

export const zoneTypeToEditor: Record<
  ZoneType,
  ComponentType<ZonePropertiesEditorProps>
> = {
  crop_field: CropFieldProperties,
  path: PathProperties,
  water_feature: WaterFeatureProperties,
  spawn_point: SpawnPointProperties,
  transition: TransitionProperties,
  npc_location: NpcLocationProperties,
  decoration: GenericProperties,
  animal_pen: GenericProperties,
  building_footprint: GenericProperties,
  transport_point: GenericProperties,
  lighting: GenericProperties,
};

export { CropFieldProperties } from './crop-field-properties';
export { PathProperties } from './path-properties';
export { WaterFeatureProperties } from './water-feature-properties';
export { SpawnPointProperties } from './spawn-point-properties';
export { TransitionProperties } from './transition-properties';
export { NpcLocationProperties } from './npc-location-properties';
export { GenericProperties } from './generic-properties';
