import { NextRequest, NextResponse } from 'next/server';
import { getDb, createTileset, listTilesets, getTags } from '@nookstead/db';
import { uploadToS3, buildS3Url, deleteS3Object, MAX_FILE_SIZE } from '@nookstead/s3';
import { withSignedUrls } from '@/lib/signed-url';
import {
  splitTilesetImage,
  validateTilesetDimensions,
  validateFrameContent,
} from '@/lib/tileset-image';
import sharp from 'sharp';

const ALLOWED_TILESET_TYPES = ['image/png', 'image/webp'] as const;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    // Validate MIME type
    if (
      !(ALLOWED_TILESET_TYPES as readonly string[]).includes(file.type)
    ) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed: ${ALLOWED_TILESET_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: `File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`,
        },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Get image dimensions using sharp
    const metadata = await sharp(buffer).metadata();
    const width = metadata.width ?? 0;
    const height = metadata.height ?? 0;

    // Validate dimensions
    const dimValidation = validateTilesetDimensions(width, height);
    if (!dimValidation.valid) {
      return NextResponse.json(
        { error: dimValidation.error },
        { status: 400 }
      );
    }

    const tilesetCount = dimValidation.tilesetCount;

    // Split image if multi-tileset
    const splits = await splitTilesetImage(buffer, tilesetCount);

    // Validate frame content on the first split (optional info for response)
    let frameInfo: { valid: number[]; empty: number[] } | undefined;
    try {
      frameInfo = await validateFrameContent(splits[0].buffer);
    } catch {
      // Non-critical; skip frame validation if it fails
    }

    // Upload each split to S3 with rollback tracking
    const uploadedKeys: string[] = [];
    const s3Results: { s3Key: string; s3Url: string; fileSize: number }[] = [];

    for (let i = 0; i < splits.length; i++) {
      const s3Key = `tilesets/${crypto.randomUUID()}.png`;
      try {
        console.log(
          `[TilesetAPI] Uploading tileset ${i + 1}/${tilesetCount}`
        );
        await uploadToS3(s3Key, splits[i].buffer, 'image/png');
        uploadedKeys.push(s3Key);
        s3Results.push({
          s3Key,
          s3Url: buildS3Url(s3Key),
          fileSize: splits[i].fileSize,
        });
      } catch (err) {
        // Rollback: delete already-uploaded S3 objects
        console.error(
          `[TilesetAPI] S3 upload failed for split ${i + 1}, rolling back ${uploadedKeys.length} uploads`,
          err
        );
        for (const key of uploadedKeys) {
          try {
            await deleteS3Object(key);
          } catch (cleanupErr) {
            console.error(
              `[TilesetAPI] Failed to clean up S3 object: ${key}`,
              cleanupErr
            );
          }
        }
        return NextResponse.json(
          { error: 'Failed to upload tileset image to storage' },
          { status: 500 }
        );
      }
    }

    // Parse optional metadata from FormData
    const baseName =
      (formData.get('name') as string | null)?.trim() ||
      file.name.replace(/\.[^.]+$/, '');
    const fromMaterialId =
      (formData.get('fromMaterialId') as string | null) || undefined;
    const toMaterialId =
      (formData.get('toMaterialId') as string | null) || undefined;

    // Create DB records
    const db = getDb();
    const createdTilesets = [];

    for (let i = 0; i < s3Results.length; i++) {
      const name =
        tilesetCount > 1 ? `${baseName} (${i + 1})` : baseName;
      const key = name
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_()]/g, '');

      try {
        const tileset = await createTileset(db, {
          name,
          key,
          s3Key: s3Results[i].s3Key,
          s3Url: s3Results[i].s3Url,
          width: 192,
          height: 64,
          fileSize: s3Results[i].fileSize,
          mimeType: 'image/png',
          fromMaterialId: fromMaterialId ?? null,
          toMaterialId: toMaterialId ?? null,
          sortOrder: i,
        });
        createdTilesets.push(tileset);
      } catch (dbErr) {
        // Best-effort cleanup of S3 objects if DB insert fails
        console.error(
          `[TilesetAPI] DB insert failed for tileset ${i + 1}, cleaning up S3 objects`,
          dbErr
        );
        for (const key of uploadedKeys) {
          try {
            await deleteS3Object(key);
          } catch (cleanupErr) {
            console.error(
              `[TilesetAPI] Failed to clean up S3 object: ${key}`,
              cleanupErr
            );
          }
        }
        return NextResponse.json(
          { error: 'Failed to save tileset record' },
          { status: 500 }
        );
      }
    }

    console.log(
      `[TilesetAPI] Created ${createdTilesets.length} tileset(s) from upload`
    );

    return NextResponse.json(
      { tilesets: createdTilesets, frameInfo },
      { status: 201 }
    );
  } catch (err) {
    console.error('[TilesetAPI] Upload failed:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const params: {
      materialId?: string;
      tag?: string;
      search?: string;
      sort?: 'name' | 'createdAt';
      order?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    } = {};

    const materialId = searchParams.get('materialId');
    if (materialId) params.materialId = materialId;

    const tag = searchParams.get('tag');
    if (tag) params.tag = tag;

    const search = searchParams.get('search');
    if (search) params.search = search;

    const sort = searchParams.get('sort');
    if (sort === 'name' || sort === 'createdAt') params.sort = sort;

    const order = searchParams.get('order');
    if (order === 'asc' || order === 'desc') params.order = order;

    const limitParam = searchParams.get('limit');
    if (limitParam !== null) {
      const limit = parseInt(limitParam, 10);
      if (isNaN(limit) || limit < 1) {
        return NextResponse.json(
          { error: 'limit must be a positive integer' },
          { status: 400 }
        );
      }
      params.limit = limit;
    }

    const offsetParam = searchParams.get('offset');
    if (offsetParam !== null) {
      const offset = parseInt(offsetParam, 10);
      if (isNaN(offset) || offset < 0) {
        return NextResponse.json(
          { error: 'offset must be a non-negative integer' },
          { status: 400 }
        );
      }
      params.offset = offset;
    }

    const db = getDb();
    const tilesets = await listTilesets(
      db,
      Object.keys(params).length > 0 ? params : undefined
    );
    const signed = await withSignedUrls(tilesets);

    // Include tags for each tileset so clients can group by tag
    const withTags = await Promise.all(
      signed.map(async (t) => {
        const tags = await getTags(db, t.id);
        return { ...t, tags };
      })
    );

    return NextResponse.json(withTags);
  } catch (err) {
    console.error('[TilesetAPI] Failed to list tilesets:', err);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
