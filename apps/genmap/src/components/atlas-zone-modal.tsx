'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Trash2, ChevronDown, ChevronRight, Plus, GripHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BemFrameNameConstructor } from '@/components/bem-frame-name-constructor';

export interface AtlasFrameData {
  filename: string;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSizeX: number;
  spriteSourceSizeY: number;
  spriteSourceSizeW: number;
  spriteSourceSizeH: number;
  sourceSizeW: number;
  sourceSizeH: number;
  pivotX: number;
  pivotY: number;
  customData: Record<string, unknown> | null;
}

interface AtlasZoneModalProps {
  frame: AtlasFrameData;
  onUpdate: (frame: AtlasFrameData) => void;
  onDelete: () => void;
  onClose: () => void;
  position: { x: number; y: number };
  /** Filenames from the currently open file for BEM suggestions */
  localFilenames?: string[];
}

const MODAL_WIDTH = 320;
const MODAL_MAX_HEIGHT_VH = 0.8;
const VIEWPORT_PADDING = 12;

function clampPosition(
  x: number,
  y: number,
  width: number,
  maxHeightEstimate: number
): { left: number; top: number } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  let left = x;
  let top = y;

  if (left + width + VIEWPORT_PADDING > vw) {
    left = Math.max(VIEWPORT_PADDING, vw - width - VIEWPORT_PADDING);
  }
  if (left < VIEWPORT_PADDING) {
    left = VIEWPORT_PADDING;
  }

  if (top + maxHeightEstimate + VIEWPORT_PADDING > vh) {
    top = Math.max(VIEWPORT_PADDING, vh - maxHeightEstimate - VIEWPORT_PADDING);
  }
  if (top < VIEWPORT_PADDING) {
    top = VIEWPORT_PADDING;
  }

  return { left, top };
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border-t border-border pt-2">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground w-full text-left"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="mt-2 space-y-2">{children}</div>}
    </div>
  );
}

function CheckboxField({
  id,
  label,
  checked,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border text-primary focus:ring-ring disabled:opacity-50"
      />
      <Label htmlFor={id} className="text-xs cursor-pointer">
        {label}
      </Label>
    </div>
  );
}

function NumberInputGroup({
  labels,
  values,
  onChange,
  onBlur,
  disabled,
  step,
  min,
  max,
}: {
  labels: string[];
  values: number[];
  onChange: (index: number, value: number) => void;
  onBlur?: () => void;
  disabled?: boolean;
  step?: number;
  min?: number;
  max?: number;
}) {
  const gridClass =
    labels.length === 2
      ? 'grid grid-cols-2 gap-1'
      : 'grid grid-cols-4 gap-1';

  return (
    <div className={gridClass}>
      {labels.map((label, i) => (
        <div key={label}>
          <span className="text-[10px] text-muted-foreground uppercase">
            {label}
          </span>
          <Input
            type="number"
            value={values[i]}
            onChange={(e) => onChange(i, parseFloat(e.target.value) || 0)}
            onBlur={onBlur}
            disabled={disabled}
            step={step}
            min={min}
            max={max}
            className="h-7 text-xs px-1.5"
          />
        </div>
      ))}
    </div>
  );
}

function CustomDataEditor({
  customData,
  onUpdate,
}: {
  customData: Record<string, unknown>;
  onUpdate: (data: Record<string, unknown>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const reservedKeys = ['passable', 'collisionRect'];
  const editableEntries = Object.entries(customData).filter(
    ([key]) => !reservedKeys.includes(key)
  );

  function addEntry() {
    const key = newKey.trim();
    if (!key || reservedKeys.includes(key)) return;

    let parsedValue: unknown = newValue;
    if (newValue === 'true') parsedValue = true;
    else if (newValue === 'false') parsedValue = false;
    else if (newValue !== '' && !isNaN(Number(newValue)))
      parsedValue = Number(newValue);

    onUpdate({ ...customData, [key]: parsedValue });
    setNewKey('');
    setNewValue('');
  }

  function removeEntry(key: string) {
    const updated = { ...customData };
    delete updated[key];
    onUpdate(updated);
  }

  function updateEntryValue(key: string, rawValue: string) {
    let parsedValue: unknown = rawValue;
    if (rawValue === 'true') parsedValue = true;
    else if (rawValue === 'false') parsedValue = false;
    else if (rawValue !== '' && !isNaN(Number(rawValue)))
      parsedValue = Number(rawValue);

    onUpdate({ ...customData, [key]: parsedValue });
  }

  return (
    <div className="space-y-1.5">
      {editableEntries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground w-16 truncate shrink-0">
            {key}
          </span>
          <Input
            value={String(value ?? '')}
            onChange={(e) => updateEntryValue(key, e.target.value)}
            className="h-7 text-xs px-1.5 flex-1"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={() => removeEntry(key)}
            aria-label={`Remove ${key}`}
          >
            <X size={10} />
          </Button>
        </div>
      ))}
      <div className="flex items-end gap-1">
        <div className="flex-1">
          <Input
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            placeholder="key"
            className="h-7 text-xs px-1.5"
          />
        </div>
        <div className="flex-1">
          <Input
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder="value"
            className="h-7 text-xs px-1.5"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addEntry();
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          onClick={addEntry}
          disabled={!newKey.trim()}
          aria-label="Add custom data entry"
        >
          <Plus size={10} />
        </Button>
      </div>
    </div>
  );
}

export function AtlasZoneModal({
  frame,
  onUpdate,
  onDelete,
  onClose,
  position,
  localFilenames,
}: AtlasZoneModalProps) {
  const [mounted, setMounted] = useState(false);
  const [localFrame, setLocalFrame] = useState<AtlasFrameData>(frame);
  const modalRef = useRef<HTMLDivElement>(null);

  // Drag state for repositioning the modal
  const [draggedPosition, setDraggedPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const isDraggingModalRef = useRef(false);
  const dragOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setLocalFrame(frame);
  }, [frame]);

  // Reset dragged position when the modal opens for a new frame (position prop changes)
  useEffect(() => {
    setDraggedPosition(null);
  }, [position]);

  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      // Don't close if we just finished dragging
      if (isDraggingModalRef.current) return;
      if (
        modalRef.current &&
        !modalRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // Drag handlers for the title bar
  const handleTitleBarPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      // Only drag on primary button
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();

      const modalEl = modalRef.current;
      if (!modalEl) return;

      const rect = modalEl.getBoundingClientRect();
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
      isDraggingModalRef.current = true;

      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    []
  );

  const handleTitleBarPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingModalRef.current) return;
      e.preventDefault();

      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let newX = e.clientX - dragOffsetRef.current.x;
      let newY = e.clientY - dragOffsetRef.current.y;

      // Clamp to viewport bounds
      newX = Math.max(
        VIEWPORT_PADDING,
        Math.min(newX, vw - MODAL_WIDTH - VIEWPORT_PADDING)
      );
      newY = Math.max(VIEWPORT_PADDING, Math.min(newY, vh - 60));

      setDraggedPosition({ x: newX, y: newY });
    },
    []
  );

  const handleTitleBarPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDraggingModalRef.current) return;
      isDraggingModalRef.current = false;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    },
    []
  );

  const updateAndPropagate = useCallback(
    (updated: AtlasFrameData) => {
      setLocalFrame(updated);
      onUpdate(updated);
    },
    [onUpdate]
  );

  const handleTextBlur = useCallback(() => {
    onUpdate(localFrame);
  }, [localFrame, onUpdate]);

  const handleCheckboxChange = useCallback(
    (field: keyof AtlasFrameData, checked: boolean) => {
      const updated = { ...localFrame, [field]: checked };
      updateAndPropagate(updated);
    },
    [localFrame, updateAndPropagate]
  );

  const customData = localFrame.customData ?? {};
  const passable = !!(customData.passable);
  const collisionRect = (customData.collisionRect as {
    x: number;
    y: number;
    w: number;
    h: number;
  }) ?? { x: 0, y: 0, w: 0, h: 0 };

  const handlePassableChange = useCallback(
    (checked: boolean) => {
      const updated = {
        ...localFrame,
        customData: { ...customData, passable: checked },
      };
      updateAndPropagate(updated);
    },
    [localFrame, customData, updateAndPropagate]
  );

  const handleCollisionRectChange = useCallback(
    (index: number, value: number) => {
      const keys = ['x', 'y', 'w', 'h'] as const;
      const newRect = { ...collisionRect, [keys[index]]: value };
      const updated = {
        ...localFrame,
        customData: { ...customData, collisionRect: newRect },
      };
      setLocalFrame(updated);
    },
    [localFrame, customData, collisionRect]
  );

  const handleCollisionRectBlur = useCallback(() => {
    onUpdate(localFrame);
  }, [localFrame, onUpdate]);

  const handleCustomDataUpdate = useCallback(
    (newCustomData: Record<string, unknown>) => {
      const updated = {
        ...localFrame,
        customData: newCustomData,
      };
      updateAndPropagate(updated);
    },
    [localFrame, updateAndPropagate]
  );

  if (!mounted || typeof document === 'undefined') return null;

  const maxHeight = window.innerHeight * MODAL_MAX_HEIGHT_VH;

  // Use dragged position if user has moved the modal, otherwise clamp the initial position
  const effectivePosition = draggedPosition
    ? { left: draggedPosition.x, top: draggedPosition.y }
    : clampPosition(position.x, position.y, MODAL_WIDTH, maxHeight);

  const modal = (
    <div
      ref={modalRef}
      role="dialog"
      aria-label="Frame Properties"
      className="fixed"
      style={{
        left: effectivePosition.left,
        top: effectivePosition.top,
        width: MODAL_WIDTH,
        zIndex: 1000,
      }}
    >
      <div className="bg-background border rounded-lg shadow-xl overflow-hidden">
        {/* Draggable Header / Title Bar */}
        <div
          className="flex items-center justify-between px-3 py-2 bg-muted/50 select-none"
          style={{ cursor: 'grab', touchAction: 'none' }}
          onPointerDown={handleTitleBarPointerDown}
          onPointerMove={handleTitleBarPointerMove}
          onPointerUp={handleTitleBarPointerUp}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <GripHorizontal
              size={14}
              className="text-muted-foreground shrink-0"
            />
            <span className="text-sm font-medium truncate">
              Frame Properties
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded shrink-0"
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div
          className="p-3 space-y-3 overflow-y-auto"
          style={{ maxHeight: maxHeight - 80 }}
        >
          {/* Filename — with BEM constructor support */}
          <BemFrameNameConstructor
            value={localFrame.filename}
            onChange={(filename) =>
              updateAndPropagate({ ...localFrame, filename })
            }
            localFilenames={localFilenames}
          />

          {/* Frame rect (read-only) */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">
              Frame Rectangle
            </Label>
            <div className="grid grid-cols-4 gap-1">
              {[
                { label: 'X', value: localFrame.frameX },
                { label: 'Y', value: localFrame.frameY },
                { label: 'W', value: localFrame.frameW },
                { label: 'H', value: localFrame.frameH },
              ].map(({ label, value }) => (
                <div key={label}>
                  <span className="text-[10px] text-muted-foreground uppercase">
                    {label}
                  </span>
                  <div className="h-7 flex items-center px-1.5 text-xs bg-muted/50 rounded-md border border-border text-muted-foreground">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rotated / Trimmed checkboxes */}
          <div className="flex gap-4">
            <CheckboxField
              id="frame-rotated"
              label="Rotated"
              checked={localFrame.rotated}
              onChange={(checked) => handleCheckboxChange('rotated', checked)}
            />
            <CheckboxField
              id="frame-trimmed"
              label="Trimmed"
              checked={localFrame.trimmed}
              onChange={(checked) => handleCheckboxChange('trimmed', checked)}
            />
          </div>

          {/* Pivot */}
          <div className="space-y-1">
            <Label className="text-xs">Pivot</Label>
            <NumberInputGroup
              labels={['X', 'Y']}
              values={[localFrame.pivotX, localFrame.pivotY]}
              onChange={(index, value) => {
                const clamped = Math.min(1, Math.max(0, value));
                const updated =
                  index === 0
                    ? { ...localFrame, pivotX: clamped }
                    : { ...localFrame, pivotY: clamped };
                setLocalFrame(updated);
              }}
              onBlur={handleTextBlur}
              step={0.1}
              min={0}
              max={1}
            />
            <p className="text-[10px] text-muted-foreground">
              Range 0.0 to 1.0. Saved on blur.
            </p>
          </div>

          {/* Passable */}
          <CheckboxField
            id="frame-passable"
            label="Passable"
            checked={passable}
            onChange={handlePassableChange}
          />

          {/* Collision Rect */}
          <div className="space-y-1">
            <Label className="text-xs">Collision Rect</Label>
            <NumberInputGroup
              labels={['X', 'Y', 'W', 'H']}
              values={[
                collisionRect.x,
                collisionRect.y,
                collisionRect.w,
                collisionRect.h,
              ]}
              onChange={handleCollisionRectChange}
              onBlur={handleCollisionRectBlur}
              min={0}
            />
            <p className="text-[10px] text-muted-foreground">
              Relative to frame origin. Saved on blur.
            </p>
          </div>

          {/* Collapsible: Sprite Source Size */}
          <CollapsibleSection title="Sprite Source Size">
            <NumberInputGroup
              labels={['X', 'Y', 'W', 'H']}
              values={[
                localFrame.spriteSourceSizeX,
                localFrame.spriteSourceSizeY,
                localFrame.spriteSourceSizeW,
                localFrame.spriteSourceSizeH,
              ]}
              onChange={(index, value) => {
                const fields = [
                  'spriteSourceSizeX',
                  'spriteSourceSizeY',
                  'spriteSourceSizeW',
                  'spriteSourceSizeH',
                ] as const;
                setLocalFrame({ ...localFrame, [fields[index]]: value });
              }}
              onBlur={handleTextBlur}
              disabled={!localFrame.trimmed}
            />
            {!localFrame.trimmed && (
              <p className="text-[10px] text-muted-foreground">
                Enable &quot;Trimmed&quot; to edit sprite source size.
              </p>
            )}
          </CollapsibleSection>

          {/* Collapsible: Source Size */}
          <CollapsibleSection title="Source Size">
            <NumberInputGroup
              labels={['W', 'H']}
              values={[localFrame.sourceSizeW, localFrame.sourceSizeH]}
              onChange={(index, value) => {
                const fields = ['sourceSizeW', 'sourceSizeH'] as const;
                setLocalFrame({ ...localFrame, [fields[index]]: value });
              }}
              onBlur={handleTextBlur}
              disabled={!localFrame.trimmed}
            />
            {!localFrame.trimmed && (
              <p className="text-[10px] text-muted-foreground">
                Enable &quot;Trimmed&quot; to edit source size.
              </p>
            )}
          </CollapsibleSection>

          {/* Collapsible: Custom Data */}
          <CollapsibleSection title="Custom Data">
            <CustomDataEditor
              customData={customData}
              onUpdate={handleCustomDataUpdate}
            />
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-3 py-2 border-t border-border">
          <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            className="gap-1"
          >
            <Trash2 size={12} />
            Delete Zone
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
