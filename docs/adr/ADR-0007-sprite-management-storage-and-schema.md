# ADR-0007: Sprite Management Storage and Schema

## Status

Accepted

## Context

Nookstead is adding a Sprite Management and Object Assembly tool (`apps/genmap/`) -- an internal, browser-based application for uploading sprite sheets, extracting tile selections, organizing tiles into named maps and groups, and assembling multi-tile game objects. This tool is a Next.js 16 app within the Nx monorepo, using shadcn/ui for the interface and PostgreSQL via Drizzle ORM (`packages/db/`) for persistence.

The tool introduces three new architectural concerns that require explicit decisions:

1. **File storage**: Sprite sheet image files (PNG/WebP/JPEG, up to 10MB each) need to be stored externally. The genmap app currently has no file storage capability. The game server and game client have never required file uploads.

2. **Database schema expansion**: The tool requires four new database tables (`sprites`, `tile_maps`, `tile_map_groups`, `game_objects`) in the shared `packages/db/` package. These tables must coexist with the existing game tables (`users`, `accounts`, `player_positions`, `maps`) without cross-references or conflicts.

3. **Database adapter reuse**: The genmap app needs database access. The `packages/db/` package already provides two singleton adapters -- `getDb` for Next.js apps and `getGameDb` for the Colyseus game server -- and the genmap app must choose which to use (or whether to create a new one).

This ADR covers three interconnected decisions:

1. Sprite file storage strategy
2. Database schema for the sprite asset pipeline
3. Database adapter pattern for the genmap app

---

## Decision 1: S3-Compatible Object Storage for Sprite Files

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Use S3-compatible object storage with presigned URLs for direct client-to-S3 uploads, configurable via endpoint URL to support AWS S3, Cloudflare R2, and MinIO |
| **Why now** | The sprite management tool is the first feature requiring file uploads. A storage pattern must be established before implementation begins. |
| **Why this** | Presigned URLs eliminate server memory pressure from file uploads (files never pass through the API server). S3-compatible storage is the industry standard for asset management, and a configurable endpoint URL provides vendor flexibility without code changes. |
| **Known unknowns** | Whether MinIO's presigned URL implementation is fully compatible with `@aws-sdk/s3-request-presigner` (known issues exist with `SignatureDoesNotMatch` errors on some MinIO versions). Cloudflare R2 has confirmed compatibility. |
| **Kill criteria** | If presigned URL generation proves unreliable across providers (>5% failure rate in testing), fall back to server-side upload proxy (Option 2) for the MVP. |

### Options Considered

1. **S3-Compatible Object Storage with Presigned URLs (Selected)**
   - Overview: Client requests a presigned PUT URL from the API, uploads directly to S3, then registers metadata in the database.
   - Pros: Zero server memory pressure (files bypass the API), industry-standard pattern with extensive documentation, supports any S3-compatible provider via configurable endpoint URL, built-in content-type and content-length enforcement via presigned URL conditions, time-limited URLs (5-minute expiry) prevent credential exposure
   - Cons: Two-step upload flow (presign + register) adds client-side complexity, potential for orphan files in S3 if registration fails after upload, CORS configuration required on the S3 bucket, MinIO has reported compatibility issues with AWS SDK v3 presigner
   - Effort: 2 days

2. **Server-Side Upload Proxy (file passes through Next.js API route)**
   - Overview: Client uploads file to a Next.js API route, which streams it to S3.
   - Pros: Simple single-step upload (one POST request), server validates file before storing, no CORS configuration needed, no orphan file risk (DB write and S3 write can be coordinated)
   - Cons: Server must buffer or stream up to 10MB per upload (memory pressure), doubles bandwidth usage (client-to-server + server-to-S3), Next.js API routes have default body size limits that must be configured, server becomes a bottleneck for concurrent uploads
   - Effort: 2 days

3. **Local Filesystem Storage**
   - Overview: Files stored on the server's local disk, served via a static file route.
   - Pros: Simplest implementation (no external dependencies), no S3 configuration or SDK required, zero-latency file access from the same server
   - Cons: Does not scale beyond a single server instance, no redundancy (disk failure = data loss), requires persistent storage provisioning in containerized/cloud deployments, violates the PRD requirement for S3-compatible storage, not portable across deployment environments
   - Effort: 1 day

4. **Database BLOB Storage**
   - Overview: Files stored as binary large objects in PostgreSQL.
   - Pros: Single system for data and files (no external dependency), transactional consistency (file + metadata in one operation), no separate backup strategy needed
   - Cons: PostgreSQL performance degrades with large BLOBs (10MB sprite sheets), database backup size grows rapidly, database connection pool saturated during file transfers, violates separation of concerns (database is for structured data, not file storage), does not scale -- 1,000 sprites at 5MB average = 5GB of database storage
   - Effort: 1 day

### Comparison

| Criterion | S3 + Presigned URLs | Server Proxy | Local Filesystem | Database BLOB |
|-----------|---------------------|--------------|------------------|---------------|
| Server memory during upload | Zero (direct to S3) | Up to 10MB per upload | Up to 10MB per upload | Up to 10MB per upload |
| Vendor flexibility | High (configurable endpoint) | High (configurable endpoint) | None (single server) | None (PostgreSQL only) |
| Scalability | Excellent (S3 scales independently) | Limited by server bandwidth | None (single disk) | Poor (DB bloat) |
| Implementation complexity | Medium (two-step flow) | Low (single endpoint) | Low | Low |
| Orphan file risk | Medium (mitigated by cleanup) | None | None | None |
| PRD alignment | Full | Partial (adds server load) | Violates requirement | Violates requirement |
| Concurrent upload support | Excellent (direct to S3) | Limited by server resources | Limited by disk I/O | Poor (DB connections) |

### Decision

**S3-compatible object storage with presigned URLs selected.** The PRD explicitly specifies S3-compatible storage with configurable endpoint URL. Presigned URLs are the standard pattern for browser-to-S3 uploads, eliminating server memory pressure and enabling concurrent uploads without server bottleneck. The two-step flow (presign, upload, register) adds client complexity but is a well-established pattern with extensive AWS SDK documentation and battle-tested implementations.

The server-side proxy (Option 2) is the strongest alternative and serves as the fallback if presigned URL compatibility issues arise with specific S3-compatible providers. Local filesystem and database BLOB options are disqualified by the PRD requirement for S3-compatible storage and by scalability constraints.

**Upload Flow**:
1. Client calls `POST /api/sprites/presign` with `{fileName, mimeType, fileSize}`
2. API validates inputs (MIME type whitelist, 10MB size cap) and generates a presigned PUT URL using `@aws-sdk/s3-request-presigner`
3. Client uploads file directly to S3 via `fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': mimeType } })`
4. Client calls `POST /api/sprites` to register metadata (name, s3Key, s3Url, dimensions, fileSize, mimeType) in the database

**Environment Variables**:
```
S3_ENDPOINT=https://account-id.r2.cloudflarestorage.com  # or MinIO/S3 URL
S3_BUCKET=nookstead-sprites
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_REGION=auto  # or us-east-1, etc.
```

---

## Decision 2: Database Schema for Sprite Asset Pipeline

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Add four new tables (`sprites`, `tile_maps`, `tile_map_groups`, `game_objects`) to `packages/db/` using Drizzle ORM schema definitions, with tile coordinates stored as metadata-only JSONB and no foreign keys to existing game tables |
| **Why now** | The sprite management tool requires persistent storage for sprite metadata, tile map selections, group categorization, and assembled game objects. These tables must be defined before any CRUD implementation can begin. |
| **Why this** | JSONB for tile coordinates avoids creating thousands of individual tile records (a tile map with 64 selected tiles is one JSONB array, not 64 rows). The four tables are isolated from existing game tables, ensuring additive-only migrations with zero risk to the running game server. |
| **Known unknowns** | Whether JSONB query performance will degrade with very large game objects (e.g., 100x100 tile grids = 10,000 entries in the tiles array). At expected scale (<100 tiles per object), this is unlikely. |
| **Kill criteria** | If JSONB query or indexing performance becomes a bottleneck when tile_maps.selected_tiles or game_objects.tiles exceeds 1,000 entries, consider normalizing tile references into a separate join table. |

### Options Considered

1. **JSONB Metadata-Only with Flat Arrays (Selected)**
   - Overview: Tile coordinates stored as JSONB arrays in the parent table. `tile_maps.selected_tiles` stores `[{col, row}, ...]`. `game_objects.tiles` stores `[{x, y, spriteId, col, row, tileWidth, tileHeight}, ...]`. No individual tile rows.
   - Pros: Single-row reads for complete tile data (no joins), natural fit for client consumption (JSON-native), flexible schema evolution (add fields to tile objects without migrations), compact storage for small-to-medium tile sets, aligns with existing `maps.grid` and `maps.layers` patterns in the codebase
   - Cons: No foreign key enforcement on sprite references within `game_objects.tiles` JSONB (stale references possible), no database-level validation of JSONB structure, querying individual tiles within JSONB requires specialized operators, large JSONB payloads (>10,000 entries) may degrade performance
   - Effort: 2 days

2. **Normalized Tile Tables (separate rows per tile)**
   - Overview: A `tile_selections` join table with one row per selected tile (tile_map_id, col, row) and a `object_tiles` join table with one row per placed tile (object_id, x, y, sprite_id, col, row).
   - Pros: Full referential integrity (sprite_id FK on each tile reference), standard relational queries for individual tiles, database-level constraints on tile uniqueness, easy to query "which objects use this sprite"
   - Cons: A tile map with 64 tiles creates 64 rows (vs. 1 JSONB column), fetching a complete tile map requires a join, more complex CRUD operations (batch inserts/updates for tiles), N+1 query risk when listing tile maps with their tiles, migration complexity (two additional tables)
   - Effort: 4 days

3. **Hybrid (relational core + JSONB metadata)**
   - Overview: Core fields (sprite_id, position) as relational columns with a JSONB `metadata` column for extensible properties.
   - Pros: Foreign key integrity where it matters most (sprite references), flexible metadata extension, standard indexing on relational columns
   - Cons: Worst of both worlds in complexity -- must manage both relational and JSONB patterns, more tables than Option 1, more joins than Option 1, still has JSONB management overhead like Option 1
   - Effort: 3 days

### Comparison

| Criterion | JSONB Flat Arrays | Normalized Tables | Hybrid |
|-----------|-------------------|-------------------|--------|
| Read performance (full entity) | Excellent (single row) | Poor (requires join) | Medium |
| Write performance (save tile map) | Excellent (single upsert) | Poor (batch insert) | Medium |
| Referential integrity | Partial (FK on tile_maps.sprite_id, none in game_objects.tiles JSONB) | Full | Partial |
| Schema flexibility | High (add JSONB fields freely) | Low (requires migration) | Medium |
| Query individual tiles | Requires JSONB operators | Standard SQL | Mixed |
| Existing pattern alignment | Matches maps.grid/layers JSONB pattern | New pattern | New pattern |
| Implementation effort | 2 days | 4 days | 3 days |
| Storage efficiency | High (1 row per tile map) | Low (N rows per tile map) | Medium |

### Decision

**JSONB metadata-only with flat arrays selected.** This approach is consistent with the existing JSONB pattern in `maps.grid` and `maps.layers` (established in the current codebase). The entire tile selection for a tile map is a single JSONB column, making reads and writes efficient single-row operations. The expected data volumes (tile maps with 10-100 selected tiles, game objects with 4-100 placed tiles) are well within PostgreSQL JSONB performance characteristics.

The key trade-off is the lack of foreign key enforcement on sprite references within `game_objects.tiles` JSONB. This is an intentional decision:

- `tile_maps.sprite_id` **does** have a proper UUID foreign key to `sprites.id` with cascade delete, because tile maps have a 1:1 relationship with a sprite
- `game_objects.tiles` references sprites only within JSONB entries, because a single object can reference tiles from **multiple different sprites** -- enforcing FKs would require a normalized join table (Option 2) at significant complexity cost
- Stale sprite references in game objects are handled at the application level: sprite deletion warns about affected objects, and the object preview renders placeholders for missing sprites

**Schema Overview**:

```
sprites (id, name, s3_key, s3_url, width, height, file_size, mime_type, created_at, updated_at)
tile_map_groups (id, name, description, created_at, updated_at)
tile_maps (id, sprite_id FK->sprites CASCADE, group_id FK->tile_map_groups SET NULL, name, tile_width, tile_height, selected_tiles JSONB, created_at, updated_at)
game_objects (id, name, description, width_tiles, height_tiles, tiles JSONB, tags JSONB, metadata JSONB, created_at, updated_at)
```

**JSONB Formats**:

`tile_maps.selected_tiles`:
```json
[
  {"col": 0, "row": 0},
  {"col": 1, "row": 0},
  {"col": 2, "row": 3}
]
```

`game_objects.tiles`:
```json
[
  {"x": 0, "y": 0, "spriteId": "uuid-1", "col": 3, "row": 2, "tileWidth": 16, "tileHeight": 16},
  {"x": 1, "y": 0, "spriteId": "uuid-2", "col": 0, "row": 1, "tileWidth": 16, "tileHeight": 16}
]
```

**Cascade Behavior**:
- Sprite deletion cascades to all `tile_maps` referencing that sprite (FK with `ON DELETE CASCADE`)
- Group deletion sets `tile_maps.group_id` to null (FK with `ON DELETE SET NULL`)
- Sprite deletion does **not** cascade to `game_objects` (no FK exists); stale references are handled at application level with warnings and placeholder rendering

**No User Ownership**:
- None of the four tables have a `user_id` foreign key
- This is an internal tool with no authentication (per PRD-006)
- All assets are shared and accessible to all tool users

---

## Decision 3: Next.js Adapter Pattern for genmap App

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Reuse the existing `getDb` adapter from `packages/db/adapters/next.ts` for the genmap app's database access, since genmap is a Next.js app using the same `DATABASE_URL` |
| **Why now** | The genmap app needs database access for sprite, tile map, and game object CRUD operations. The adapter must be chosen before implementing any API routes. |
| **Why this** | `getDb` is a singleton adapter specifically designed for Next.js apps. The genmap app is a Next.js 16 app, uses the same PostgreSQL database, and has the same connection lifecycle requirements. Creating a new adapter would be unnecessary duplication. |
| **Known unknowns** | Whether running both the game app (`apps/game`) and genmap app (`apps/genmap`) simultaneously against the same database with separate `getDb` singletons (one per process) causes connection pool exhaustion. At default pool sizes (10 connections per singleton), this is unlikely with a standard PostgreSQL configuration (default 100 max connections). |
| **Kill criteria** | If connection pool contention becomes an issue (connection timeout errors), either reduce pool sizes per adapter or create a shared connection pool manager. |

### Options Considered

1. **Reuse `getDb` from `packages/db/adapters/next.ts` (Selected)**
   - Overview: Import `getDb` in genmap API routes exactly as the game app does. Both apps get a process-local singleton with default pool settings.
   - Pros: Zero new code (adapter already exists and is tested), consistent pattern across Next.js apps, singleton lifecycle matches Next.js server lifecycle (one pool per process, reused across requests), genmap uses the same `DATABASE_URL` environment variable
   - Cons: Default pool size (10 connections) may be more than genmap needs for a single-user internal tool, no genmap-specific connection tuning (idle timeout, max connections)
   - Effort: 0 days (already implemented)

2. **Create a new `getGenMapDb` adapter with custom pool settings**
   - Overview: A new adapter file in `packages/db/adapters/genmap.ts` with a smaller connection pool (e.g., max: 5, idle_timeout: 60).
   - Pros: Tuned for the genmap workload (fewer connections, longer idle timeout), clear separation between game and tool database access, could add genmap-specific logging or error handling
   - Cons: Code duplication (genmap adapter would be nearly identical to next.ts), introduces a third adapter pattern to maintain, unnecessary complexity for a single-user tool, the existing `getDb` adapter already accepts an optional URL parameter for flexibility
   - Effort: 1 day

3. **Use `getGameDb` from `packages/db/adapters/colyseus.ts`**
   - Overview: Reuse the Colyseus adapter, which has a larger connection pool (max: 20).
   - Pros: No new code, existing adapter
   - Cons: Semantically incorrect (genmap is not a Colyseus game server), oversized connection pool for a single-user tool, Colyseus-specific defaults (shorter idle timeout) are inappropriate for a CRUD app with bursty access patterns
   - Effort: 0 days

### Comparison

| Criterion | Reuse `getDb` | New `getGenMapDb` | Reuse `getGameDb` |
|-----------|---------------|-------------------|-------------------|
| Code duplication | None | New file, near-identical | None |
| Semantic correctness | Correct (Next.js app) | Correct (explicit) | Incorrect (not Colyseus) |
| Connection pool sizing | Adequate (10) | Optimized (5) | Oversized (20) |
| Maintenance burden | None | Low but unnecessary | None |
| Implementation effort | 0 days | 1 day | 0 days |

### Decision

**Reuse `getDb` selected.** The genmap app is a Next.js application -- exactly the use case that the existing `getDb` adapter was designed for. The adapter provides a process-local singleton with sensible defaults (pool size 10, idle timeout 20s). For an internal tool used by one person at a time, these defaults are more than adequate. Creating a genmap-specific adapter would violate DRY and add maintenance burden for negligible benefit.

**Usage Pattern**:
```typescript
// In any genmap API route (e.g., apps/genmap/src/app/api/sprites/route.ts)
import { getDb } from '@nookstead/db';

export async function GET() {
  const db = getDb();
  // ... query sprites table
}
```

---

## Consequences

### Positive Consequences

- **No server memory pressure from uploads**: Presigned URLs route file data directly from the browser to S3, keeping the API server lightweight. A 10MB upload consumes zero server memory.
- **Vendor flexibility**: The configurable S3 endpoint URL supports AWS S3, Cloudflare R2, MinIO, and other S3-compatible providers without code changes. Switching providers requires only updating environment variables.
- **Isolated schema evolution**: The four new tables have no foreign keys to existing game tables (`users`, `accounts`, `player_positions`, `maps`). Migrations are additive-only and cannot break the game server.
- **Consistent JSONB pattern**: Using JSONB for tile coordinates matches the existing `maps.grid` and `maps.layers` pattern, maintaining codebase consistency.
- **Single-row efficiency**: Tile maps and game objects are fetched in a single database read (no joins), which simplifies API implementation and ensures consistent response times.
- **No new adapter code**: Reusing `getDb` means zero new database infrastructure code for the genmap app.

### Negative Consequences

- **Orphan S3 files**: If the browser uploads to S3 but the metadata registration request fails, an orphan file remains in S3 with no database record. Accepted for MVP; a reconciliation script or S3 lifecycle policy can clean these up later.
- **No FK enforcement on game object tile references**: Deleting a sprite does not automatically clean up stale references in `game_objects.tiles` JSONB. The application must handle stale references gracefully (warnings on delete, placeholder rendering in preview).
- **CORS configuration required**: S3 buckets used for presigned URL uploads must be configured with appropriate CORS rules to allow PUT requests from the genmap app's origin. This is a one-time setup per environment but is a deployment prerequisite that could block initial setup.
- **AWS SDK dependency**: The `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` packages add new dependencies to the monorepo. These are well-maintained but increase the dependency tree.

### Neutral Consequences

- **Database shared across apps**: The genmap app and game server share the same PostgreSQL database and `packages/db/` package. This was already the case (game app uses `packages/db/`), and the new tables do not interact with existing tables.
- **No authentication on new tables**: The four new tables have no `user_id` columns or access control. This aligns with the PRD decision that the genmap tool requires no authentication.
- **JSONB structure not database-enforced**: The structure of `selected_tiles`, `tiles`, `tags`, and `metadata` JSONB columns is enforced by application-level validation, not database CHECK constraints. This is consistent with the existing `maps.grid` and `maps.layers` approach.

## Implementation Guidance

- Use `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` for S3 operations; initialize the S3Client with configurable endpoint, region, and credentials from environment variables
- Generate presigned PUT URLs with a 5-minute expiry and content-type/content-length conditions
- Define Drizzle ORM schema files in `packages/db/src/schema/` following the existing pattern (one file per table or logical group, re-export from `schema/index.ts`)
- Use UUIDv4 auto-generated primary keys consistent with the existing `users`, `accounts`, and `maps` tables
- Use timezone-aware timestamps with default-now for all audit columns (`created_at`, `updated_at`), matching existing table conventions
- Use JSONB column type for `selected_tiles`, `tiles`, `tags`, and `metadata` fields
- Define cascade delete on `tile_maps.sprite_id` FK and set-null on `tile_maps.group_id` FK using Drizzle's `references()` with appropriate `onDelete` options
- Validate S3 configuration (endpoint, bucket, credentials) on application startup; fail fast with a descriptive error if required environment variables are missing
- Configure CORS on the S3 bucket to allow PUT requests with Content-Type header from the genmap app origin; for development, allow localhost origins
- Import `getDb` from `@nookstead/db` in genmap API routes; do not create a new adapter
- Handle stale sprite references in `game_objects.tiles` at the application level: query for affected objects before sprite deletion, display warnings, render placeholders for missing sprites in object preview

## Related Information

- [PRD-006: Sprite Management and Object Assembly](../prd/prd-006-sprite-management.md) -- Source requirements for this ADR
- [ADR-0006: Chunk-Based Room Architecture](ADR-0006-chunk-based-room-architecture.md) -- Established the current database schema patterns (`player_positions`, `maps` tables with JSONB columns)
- Existing schema files: `packages/db/src/schema/maps.ts` (JSONB pattern reference), `packages/db/src/schema/users.ts` (UUID PK pattern reference)
- Existing adapters: `packages/db/src/adapters/next.ts` (`getDb`), `packages/db/src/adapters/colyseus.ts` (`getGameDb`)

## References

- [AWS S3 Presigned URL Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/PresignedUrlUploadObject.html) -- Official guide for presigned URL upload pattern
- [AWS Prescriptive Guidance: Presigned URL Best Practices](https://docs.aws.amazon.com/pdfs/prescriptive-guidance/latest/presigned-url-best-practices/presigned-url-best-practices.pdf) -- Security and expiration best practices for presigned URLs
- [Cloudflare R2 AWS SDK v3 Examples](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) -- R2 compatibility with `@aws-sdk/client-s3` and configurable endpoint
- [Cloudflare R2 Presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) -- R2-specific presigned URL documentation and limitations
- [Cloudflare R2 S3 API Compatibility](https://developers.cloudflare.com/r2/api/s3/api/) -- S3 API operations supported by R2
- [MinIO Presigned URL Issue #19067](https://github.com/minio/minio/issues/19067) -- Known `SignatureDoesNotMatch` issue with `@aws-sdk/s3-request-presigner` on some MinIO versions
- [PostgreSQL JSONB Documentation](https://www.postgresql.org/docs/current/datatype-json.html) -- Official JSONB type documentation and operators
- [PostgreSQL as a JSON Database: Advanced Patterns (AWS)](https://aws.amazon.com/blogs/database/postgresql-as-a-json-database-advanced-patterns-and-best-practices/) -- Best practices for JSONB schema design including hybrid column + JSONB approach
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview) -- ORM used for schema definitions and migrations
- [The Illustrated Guide to S3 Pre-signed URLs (fourTheorem)](https://fourtheorem.com/the-illustrated-guide-to-s3-pre-signed-urls/) -- Visual explanation of presigned URL upload flow and security model

## Date

2026-02-17
