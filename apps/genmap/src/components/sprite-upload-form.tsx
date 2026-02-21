'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE } from '@/lib/s3';

interface SpriteUploadFormProps {
  onSuccess?: () => void;
}

export function SpriteUploadForm({ onSuccess }: SpriteUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(selected.type)) {
      setError('Invalid file type. Allowed: PNG, WebP, JPEG');
      return;
    }
    if (selected.size > MAX_FILE_SIZE) {
      setError(
        `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
      );
      return;
    }

    setError(null);
    setFile(selected);
    if (!name) setName(selected.name.replace(/\.[^/.]+$/, ''));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !name) return;

    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name);

      const res = await fetch('/api/sprites', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="sprite-file">
          Sprite Sheet (PNG, WebP, or JPEG, max 10MB)
        </Label>
        <Input
          id="sprite-file"
          type="file"
          accept="image/png,image/webp,image/jpeg"
          onChange={handleFileChange}
        />
      </div>
      <div>
        <Label htmlFor="sprite-name">Name</Label>
        <Input
          id="sprite-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Sprite name"
          required
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      {isUploading && <p className="text-sm text-muted-foreground">Uploading...</p>}
      <Button type="submit" disabled={!file || !name || isUploading}>
        {isUploading ? 'Uploading...' : 'Upload Sprite'}
      </Button>
    </form>
  );
}
