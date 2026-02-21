'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Copy, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export interface EditorHeaderProps {
  mapName: string;
  isDirty: boolean;
  onNameChange: (name: string) => void;
  onExport: () => void;
  onSaveAsTemplate: () => void;
  onSettings?: () => void;
}

/**
 * Manages the transient state for inline text editing.
 * Returns the current editing state plus handlers to start, commit, cancel,
 * and handle keystrokes.
 */
function useInlineEdit(
  currentValue: string,
  onCommit: (value: string) => void
) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus and select the input whenever editing mode is activated
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = useCallback(() => {
    const trimmed = editValue.trim();
    onCommit(trimmed || currentValue);
    setIsEditing(false);
  }, [editValue, currentValue, onCommit]);

  const cancel = useCallback(() => {
    setIsEditing(false);
  }, []);

  const start = useCallback(() => {
    setEditValue(currentValue);
    setIsEditing(true);
  }, [currentValue]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        commit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        cancel();
      }
    },
    [commit, cancel]
  );

  return {
    isEditing,
    editValue,
    setEditValue,
    inputRef,
    start,
    commit,
    cancel,
    handleKeyDown,
  };
}

/**
 * Compact 36px editor header with back navigation, inline-editable map name,
 * dirty indicator, and action buttons (Export, Template, Settings).
 *
 * All state (name, dirty flag) is owned by the parent -- this component is
 * purely presentational aside from the transient inline-editing state.
 */
export function EditorHeader({
  mapName,
  isDirty,
  onNameChange,
  onExport,
  onSaveAsTemplate,
  onSettings,
}: EditorHeaderProps) {
  const nameEdit = useInlineEdit(mapName, onNameChange);

  return (
    <TooltipProvider>
      <div className="flex items-center h-9 px-2 gap-2 border-b bg-card">
        {/* Back navigation */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              asChild
              aria-label="Back to maps list"
            >
              <Link href="/maps">
                <ArrowLeft size={16} />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Back to maps list</TooltipContent>
        </Tooltip>

        {/* Inline-editable map name */}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          {nameEdit.isEditing ? (
            <Input
              ref={nameEdit.inputRef}
              value={nameEdit.editValue}
              onChange={(e) => nameEdit.setEditValue(e.target.value)}
              onKeyDown={nameEdit.handleKeyDown}
              onBlur={nameEdit.commit}
              className="h-6 text-xs font-semibold px-1.5 py-0 border-primary/50"
            />
          ) : (
            <span
              className="text-xs font-semibold truncate cursor-pointer hover:text-foreground/80"
              onClick={nameEdit.start}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  nameEdit.start();
                }
              }}
            >
              {mapName}
            </span>
          )}

          {/* Dirty indicator */}
          {isDirty && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"
              title="Unsaved changes"
            />
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-7 px-2"
                onClick={onExport}
                aria-label="Export map"
              >
                <Upload size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Export map</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-7 px-2"
                onClick={onSaveAsTemplate}
                aria-label="Save as template"
              >
                <Copy size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Save as template</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                className="h-7 px-2"
                onClick={onSettings}
                aria-label="Settings"
              >
                <Settings size={14} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Settings</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}
