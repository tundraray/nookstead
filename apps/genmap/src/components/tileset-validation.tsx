'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { CheckCircle, AlertTriangle, XCircle, Loader2 } from 'lucide-react';

interface FrameValidation {
  valid: number[];
  empty: number[];
}

interface TilesetValidationProps {
  tilesetId: string;
  hasInverse: boolean;
  frameValidation?: FrameValidation;
}

/**
 * Displays validation results for a tileset: frame completeness,
 * frame 0 presence, and inverse link status.
 */
export function TilesetValidation({
  tilesetId,
  hasInverse,
  frameValidation: initialValidation,
}: TilesetValidationProps) {
  const [frameValidation, setFrameValidation] = useState<FrameValidation | undefined>(
    initialValidation
  );
  const [isValidating, setIsValidating] = useState(false);

  const runValidation = useCallback(async () => {
    setIsValidating(true);
    try {
      // Fetch the tileset image and validate frames client-side
      const res = await fetch(`/api/tilesets/${tilesetId}`);
      if (!res.ok) throw new Error('Failed to fetch tileset');
      const data = await res.json();
      const imageUrl = data.s3Url;

      // Load the image and check each frame
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageUrl;
      });

      // Create a temporary canvas to read pixel data
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(img, 0, 0);

      const valid: number[] = [];
      const empty: number[] = [];
      const tileSize = 16;
      const cols = 12;

      for (let frame = 0; frame < 48; frame++) {
        const col = frame % cols;
        const row = Math.floor(frame / cols);
        const imageData = ctx.getImageData(
          col * tileSize,
          row * tileSize,
          tileSize,
          tileSize
        );

        // Check if any pixel has non-zero alpha
        let hasContent = false;
        for (let i = 3; i < imageData.data.length; i += 4) {
          if (imageData.data[i] > 0) {
            hasContent = true;
            break;
          }
        }

        if (hasContent) {
          valid.push(frame);
        } else {
          empty.push(frame);
        }
      }

      setFrameValidation({ valid, empty });
    } catch {
      // Validation failed silently
    } finally {
      setIsValidating(false);
    }
  }, [tilesetId]);

  const allFramesValid = frameValidation && frameValidation.valid.length === 48;
  const frame0Present = frameValidation
    ? frameValidation.valid.includes(0)
    : undefined;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium">Validation</h3>

      {!frameValidation ? (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={runValidation}
            disabled={isValidating}
          >
            {isValidating ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Validating...
              </>
            ) : (
              'Run Validation'
            )}
          </Button>
        </div>
      ) : (
        <ul className="space-y-2 text-sm">
          {/* Frame completeness */}
          <li className="flex items-start gap-2">
            {allFramesValid ? (
              <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <XCircle className="size-4 text-red-500 mt-0.5 shrink-0" />
            )}
            <div>
              <span>
                {frameValidation.valid.length} / 48 frames have content
              </span>
              {frameValidation.empty.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Empty frames:{' '}
                  {frameValidation.empty.slice(0, 5).join(', ')}
                  {frameValidation.empty.length > 5 &&
                    ` (+${frameValidation.empty.length - 5} more)`}
                </p>
              )}
            </div>
          </li>

          {/* Frame 0 check */}
          <li className="flex items-start gap-2">
            {frame0Present ? (
              <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
            )}
            <span>
              Frame 0 {frame0Present ? 'is present' : 'is empty (isolated tile)'}
            </span>
          </li>

          {/* Inverse link */}
          <li className="flex items-start gap-2">
            {hasInverse ? (
              <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="size-4 text-amber-500 mt-0.5 shrink-0" />
            )}
            <span>
              Inverse tileset {hasInverse ? 'linked' : 'not linked'}
            </span>
          </li>
        </ul>
      )}
    </div>
  );
}
