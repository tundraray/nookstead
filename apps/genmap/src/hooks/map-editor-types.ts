// Re-export shim: all types now come from @nookstead/map-lib
// This file is kept for backward compatibility. Prefer importing from @nookstead/map-lib directly.
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
} from '@nookstead/map-lib';
export { SIDEBAR_TABS } from '@nookstead/map-lib';
