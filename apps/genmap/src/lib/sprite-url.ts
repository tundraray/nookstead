import { generatePresignedGetUrl } from './s3';

interface SpriteRecord {
  s3Key: string;
  s3Url: string;
  [key: string]: unknown;
}

export async function withSignedUrl<T extends SpriteRecord>(
  sprite: T
): Promise<T> {
  const signedUrl = await generatePresignedGetUrl(sprite.s3Key);
  return { ...sprite, s3Url: signedUrl };
}

export async function withSignedUrls<T extends SpriteRecord>(
  sprites: T[]
): Promise<T[]> {
  return Promise.all(sprites.map(withSignedUrl));
}
