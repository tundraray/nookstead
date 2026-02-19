import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from './s3';

export function validateMimeType(mimeType: string): boolean {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType);
}

export function validateFileSize(fileSize: number): boolean {
  return fileSize > 0 && fileSize <= MAX_FILE_SIZE;
}

export function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function generateS3Key(fileName: string): string {
  const sanitized = sanitizeFileName(fileName);
  return `sprites/${crypto.randomUUID()}/${sanitized}`;
}
