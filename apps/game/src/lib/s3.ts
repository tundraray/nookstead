import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

function getS3Config() {
  const endpoint = process.env['S3_ENDPOINT'];
  const region = process.env['S3_REGION'];
  const bucket = process.env['S3_BUCKET'];
  const accessKeyId = process.env['S3_ACCESS_KEY_ID'];
  const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY'];

  if (!endpoint || !region || !bucket || !accessKeyId || !secretAccessKey) {
    throw new Error(
      'Missing S3 environment variables. Required: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY'
    );
  }

  return { endpoint, region, bucket, accessKeyId, secretAccessKey };
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
      forcePathStyle: true,
    });
  }
  return s3Client;
}

function getBucket(): string {
  if (!s3Bucket) {
    s3Bucket = getS3Config().bucket;
  }
  return s3Bucket;
}

const PRESIGNED_GET_EXPIRY = 3600;

export async function generatePresignedGetUrl(key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  });
  return getSignedUrl(getS3Client(), command, {
    expiresIn: PRESIGNED_GET_EXPIRY,
  });
}
