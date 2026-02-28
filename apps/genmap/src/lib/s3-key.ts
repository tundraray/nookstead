function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export function generateS3Key(fileName: string): string {
  const sanitized = sanitizeFileName(fileName);
  return `sprites/${crypto.randomUUID()}/${sanitized}`;
}
