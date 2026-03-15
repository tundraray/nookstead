---
name: Colyseus v4 Schema Internals
description: Colyseus Schema v4 API differences from older versions - field metadata access, decorator behavior, lint considerations
type: project
---

Colyseus Schema v4 (`@colyseus/schema ^4.0.12`) has different internals from earlier versions:
- `Schema._definition` is NOT available (returns undefined)
- Field metadata is stored on the instance's ChangeTree: `instance['~changes'].metadata`
- Each metadata entry has shape `{ type: string, index: number, name: string }`
- `@type()` decorators with default values should omit explicit type annotations to satisfy `@typescript-eslint/no-inferrable-types` lint rule (e.g., `@type('string') itemType = '';` not `@type('string') itemType: string = '';`)
- Existing `ChunkRoomState.ts` uses `!` definite assignment (no defaults) while `InventorySlotSchema` uses default values

**Why:** Discovered during Task 07 implementation when `_definition.schema` test failed at runtime.
**How to apply:** When writing tests that verify schema field count/names, use the ChangeTree metadata path. When writing new Schema classes with default values, omit type annotations to pass lint.
