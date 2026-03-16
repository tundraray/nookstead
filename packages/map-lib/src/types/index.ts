export type {
  MapType,
  MapDimensionConstraints,
  ZoneType,
  ZoneShape,
  ZoneBounds,
  ZoneVertex,
  ZoneData,
  DimensionValidationResult,
  WarpZoneProperties,
  SpawnRuleConfig,
  NpcScheduleConfig,
  OperatingHoursConfig,
} from './map-types';

export {
  MAP_TYPE_CONSTRAINTS,
  ZONE_COLORS,
  ZONE_OVERLAP_ALLOWED,
  validateMapDimensions,
  isWarpZone,
} from './map-types';

export type {
  TemplateParameter,
  TemplateConstraintType,
  TemplateConstraint,
  MapTemplate,
} from './template-types';

export type { TilesetInfo, MaterialInfo } from './material-types';

export type {
  EditorTool,
  SidebarTab,
  BaseLayer,
  TileLayer,
  PlacedObject,
  ObjectLayer,
  EditorLayer,
  CellDelta,
  EditorCommand,
  MapEditorState,
  MapEditorAction,
  LoadMapPayload,
} from './editor-types';
export { SIDEBAR_TABS } from './editor-types';
