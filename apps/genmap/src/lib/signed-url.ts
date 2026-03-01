import { generatePresignedGetUrl } from '@nookstead/s3';

interface S3Record {
  s3Key: string;
  s3Url: string;
  [key: string]: unknown;
}

export async function withSignedUrl<T extends S3Record>(
  record: T
): Promise<T> {
  const signedUrl = await generatePresignedGetUrl(record.s3Key);
  return { ...record, s3Url: signedUrl };
}

export async function withSignedUrls<T extends S3Record>(
  records: T[]
): Promise<T[]> {
  return Promise.all(records.map(withSignedUrl));
}
