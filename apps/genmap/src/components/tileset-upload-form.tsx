'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TagEditor } from '@/components/tag-editor';
import { useTilesets } from '@/hooks/use-tilesets';
import { useMaterials } from '@/hooks/use-materials';
import type { Tileset } from '@nookstead/db';

const TILESET_WIDTH = 192;
const TILESET_HEIGHT = 64;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface SubForm {
  name: string;
  fromMaterialId: string;
  toMaterialId: string;
}

interface TilesetUploadFormProps {
  onSuccess: (tilesets: Tileset[]) => void;
  onClose: () => void;
  preselectedFromMaterial?: string;
  preselectedToMaterial?: string;
}

export function TilesetUploadForm({
  onSuccess,
  onClose,
  preselectedFromMaterial,
  preselectedToMaterial,
}: TilesetUploadFormProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [tilesetCount, setTilesetCount] = useState(0);
  const [subForms, setSubForms] = useState<SubForm[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { uploadTileset } = useTilesets();
  const { materials } = useMaterials();

  // Clean up preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Reset state
    setValidationError(null);
    setUploadError(null);
    setDimensions(null);
    setTilesetCount(0);
    setSubForms([]);

    // Validate MIME type
    if (!['image/png', 'image/webp'].includes(selected.type)) {
      setValidationError('Only PNG and WebP files are accepted.');
      return;
    }

    // Validate file size
    if (selected.size > MAX_FILE_SIZE) {
      setValidationError(
        `File too large. Maximum size: ${MAX_FILE_SIZE / (1024 * 1024)}MB.`
      );
      return;
    }

    // Revoke old preview URL
    if (previewUrl) URL.revokeObjectURL(previewUrl);

    const url = URL.createObjectURL(selected);
    setPreviewUrl(url);
    setFile(selected);

    // Validate dimensions via Image
    const img = new Image();
    img.onload = () => {
      const w = img.width;
      const h = img.height;
      setDimensions({ width: w, height: h });

      if (w !== TILESET_WIDTH) {
        setValidationError(
          `Width must be exactly ${TILESET_WIDTH}px. Got ${w}px.`
        );
        return;
      }

      if (h % TILESET_HEIGHT !== 0) {
        setValidationError(
          `Height must be a multiple of ${TILESET_HEIGHT}px. Got ${h}px.`
        );
        return;
      }

      const count = h / TILESET_HEIGHT;
      setTilesetCount(count);

      // Create sub-forms
      const baseName = selected.name.replace(/\.[^/.]+$/, '');
      const forms: SubForm[] = Array.from({ length: count }, (_, i) => ({
        name: count > 1 ? `${baseName} (${i + 1})` : baseName,
        fromMaterialId: preselectedFromMaterial ?? '',
        toMaterialId: preselectedToMaterial ?? '',
      }));
      setSubForms(forms);

      // Draw preview with grid lines
      drawPreview(img, count);
    };
    img.onerror = () => {
      setValidationError('Failed to load image. The file may be corrupted.');
    };
    img.src = url;
  }

  function drawPreview(img: HTMLImageElement, count: number) {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);

    // Draw horizontal grid lines at each 64px boundary
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.6)';
    ctx.lineWidth = 1;
    for (let i = 1; i < count; i++) {
      const y = i * TILESET_HEIGHT;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(img.width, y);
      ctx.stroke();
    }
  }

  function updateSubForm(index: number, field: keyof SubForm, value: string) {
    setSubForms((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file || !isValid) return;

    setIsUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // For single tileset, use the single name
      // For multi, the API generates names from baseName
      if (tilesetCount === 1) {
        formData.append('name', subForms[0].name);
        if (subForms[0].fromMaterialId) {
          formData.append('fromMaterialId', subForms[0].fromMaterialId);
        }
        if (subForms[0].toMaterialId) {
          formData.append('toMaterialId', subForms[0].toMaterialId);
        }
      } else {
        // For multi-tileset uploads, use the base name
        // The API auto-suffixes with (1), (2), etc.
        formData.append('name', subForms[0].name.replace(/\s*\(\d+\)$/, ''));
        // Use first sub-form's materials for all splits
        if (subForms[0].fromMaterialId) {
          formData.append('fromMaterialId', subForms[0].fromMaterialId);
        }
        if (subForms[0].toMaterialId) {
          formData.append('toMaterialId', subForms[0].toMaterialId);
        }
      }

      if (tags.length > 0) {
        formData.append('tags', JSON.stringify(tags));
      }

      const createdTilesets = await uploadTileset(formData);
      onSuccess(createdTilesets);
      onClose();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  }

  const isValid =
    file !== null && validationError === null && tilesetCount > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto">
      {/* File input */}
      <div>
        <Label htmlFor="tileset-file">
          Tileset Image (PNG or WebP, max 10MB)
        </Label>
        <Input
          id="tileset-file"
          type="file"
          accept="image/png,image/webp"
          onChange={handleFileChange}
        />
      </div>

      {/* Validation error */}
      {validationError && (
        <p className="text-destructive text-sm">{validationError}</p>
      )}

      {/* Dimension info */}
      {dimensions && !validationError && (
        <p className="text-sm text-muted-foreground">
          {dimensions.width} x {dimensions.height}px
          {tilesetCount > 0 &&
            ` — ${tilesetCount} tileset${tilesetCount > 1 ? 's' : ''} detected`}
        </p>
      )}

      {/* Image preview with grid lines */}
      {previewUrl && !validationError && (
        <div className="border rounded-md p-2 bg-muted">
          <canvas
            ref={canvasRef}
            className="pixelated w-full max-w-[384px] mx-auto"
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      )}

      {/* Sub-forms for each tileset */}
      {tilesetCount === 1 && subForms.length === 1 && (
        <div className="space-y-3">
          <div>
            <Label htmlFor="tileset-name">Name</Label>
            <Input
              id="tileset-name"
              value={subForms[0].name}
              onChange={(e) => updateSubForm(0, 'name', e.target.value)}
              placeholder="Tileset name"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From Material</Label>
              <Select
                value={subForms[0].fromMaterialId || undefined}
                onValueChange={(v) => updateSubForm(0, 'fromMaterialId', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full border"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Material</Label>
              <Select
                value={subForms[0].toMaterialId || undefined}
                onValueChange={(v) => updateSubForm(0, 'toMaterialId', v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select material" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block size-3 rounded-full border"
                          style={{ backgroundColor: m.color }}
                        />
                        {m.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>Tags</Label>
            <TagEditor tags={tags} onChange={setTags} />
          </div>
        </div>
      )}

      {/* Multi-tileset sub-forms */}
      {tilesetCount > 1 && subForms.length > 1 && (
        <div className="space-y-4">
          {/* Shared tags for all splits */}
          <div>
            <Label>Tags (shared across all tilesets)</Label>
            <TagEditor tags={tags} onChange={setTags} />
          </div>

          <div className="space-y-3">
            {subForms.map((sf, i) => (
              <div
                key={i}
                className="border rounded-md p-3 space-y-2"
              >
                <p className="text-sm font-medium">Tileset {i + 1}</p>
                <div>
                  <Label htmlFor={`tileset-name-${i}`}>Name</Label>
                  <Input
                    id={`tileset-name-${i}`}
                    value={sf.name}
                    onChange={(e) => updateSubForm(i, 'name', e.target.value)}
                    placeholder="Tileset name"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>From Material</Label>
                    <Select
                      value={sf.fromMaterialId || undefined}
                      onValueChange={(v) =>
                        updateSubForm(i, 'fromMaterialId', v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block size-3 rounded-full border"
                                style={{ backgroundColor: m.color }}
                              />
                              {m.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>To Material</Label>
                    <Select
                      value={sf.toMaterialId || undefined}
                      onValueChange={(v) =>
                        updateSubForm(i, 'toMaterialId', v)
                      }
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select material" />
                      </SelectTrigger>
                      <SelectContent>
                        {materials.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            <span className="flex items-center gap-2">
                              <span
                                className="inline-block size-3 rounded-full border"
                                style={{ backgroundColor: m.color }}
                              />
                              {m.name}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Upload error */}
      {uploadError && <p className="text-destructive text-sm">{uploadError}</p>}

      {/* Upload progress */}
      {isUploading && (
        <p className="text-sm text-muted-foreground">Uploading...</p>
      )}

      {/* Submit button */}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={!isValid || isUploading}>
          {isUploading
            ? 'Uploading...'
            : `Upload ${tilesetCount > 1 ? `${tilesetCount} Tilesets` : 'Tileset'}`}
        </Button>
      </div>
    </form>
  );
}
