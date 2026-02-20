import { generatePresignedGetUrl } from './s3';

interface TilesetRecord {
  s3Key: string;
  s3Url: string;
  [key: string]: unknown;
}

export async function withTilesetSignedUrl<T extends TilesetRecord>(
  tileset: T
): Promise<T> {
  const signedUrl = await generatePresignedGetUrl(tileset.s3Key);
  return { ...tileset, s3Url: signedUrl };
}

export async function withTilesetSignedUrls<T extends TilesetRecord>(
  tilesets: T[]
): Promise<T[]> {
  return Promise.all(tilesets.map(withTilesetSignedUrl));
}
