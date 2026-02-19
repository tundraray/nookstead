import type { Grid, LayerData } from '@nookstead/shared';
import type { MapType, ZoneData } from './map-types';

/** A configurable parameter for a map template. */
export interface TemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean';
  default: string | number | boolean;
  description: string;
}

/** Constraint type for template validation. */
export type TemplateConstraintType =
  | 'zone_required'
  | 'min_zone_count'
  | 'min_zone_area'
  | 'max_zone_overlap'
  | 'dimension_match';

/** A constraint that must be satisfied by a map using this template. */
export interface TemplateConstraint {
  type: TemplateConstraintType;
  target: string;
  value: number | string;
  message: string;
}

/** Complete map template definition. */
export interface MapTemplate {
  id: string;
  name: string;
  description: string;
  mapType: MapType;
  baseWidth: number;
  baseHeight: number;
  parameters: TemplateParameter[];
  constraints: TemplateConstraint[];
  grid: Grid;
  layers: LayerData[];
  zones: ZoneData[];
  version: number;
  isPublished: boolean;
}
