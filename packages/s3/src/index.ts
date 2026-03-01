import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

export const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/webp',
  'image/jpeg',
] as const;
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function getRequiredEnvVar(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Required: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY`
    );
  }
  return value;
}

function getS3Config() {
  return {
    endpoint: getRequiredEnvVar('S3_ENDPOINT'),
    region: getRequiredEnvVar('S3_REGION'),
    bucket: getRequiredEnvVar('S3_BUCKET'),
    accessKeyId: getRequiredEnvVar('S3_ACCESS_KEY_ID'),
    secretAccessKey: getRequiredEnvVar('S3_SECRET_ACCESS_KEY'),
  };
}

let s3Client: S3Client | null = null;
let s3Bucket: string | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    const config = getS3Config();
    s3Bucket = config.bucket;
    s3Client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: false,
    });
  }
  return s3Client;
}

function getBucket(): string {
  if (!s3Bucket) {
    const config = getS3Config();
    s3Bucket = config.bucket;
  }
  return s3Bucket;
}

export async function uploadToS3(
  s3Key: string,
  body: Buffer | Uint8Array,
  contentType: string
): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: getBucket(),
    Key: s3Key,
    Body: body,
    ContentType: contentType,
    ContentLength: body.length,
  });
  await getS3Client().send(command);
}

const PRESIGNED_GET_EXPIRY = 3600; // 1 hour

export async function generatePresignedGetUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGNED_GET_EXPIRY,
  });
}

export async function deleteS3Object(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  await getS3Client().send(command);
}

export function buildS3Url(key: string): string {
  const endpoint = getRequiredEnvVar('S3_ENDPOINT');
  // Virtual-hosted style: https://bucket.endpoint/key
  const url = new URL(endpoint);
  url.hostname = `${getBucket()}.${url.hostname}`;
  url.pathname = `/${key}`;
  return url.toString();
}
