'use client';

import { useState, useEffect, useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface TagEditorProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function TagEditor({
  tags,
  onChange,
  placeholder = 'Add tag...',
  disabled = false,
}: TagEditorProps) {
  const [inputValue, setInputValue] = useState('');
  const [allTags, setAllTags] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch existing tags once on mount for autocomplete
  useEffect(() => {
    async function fetchTags() {
      try {
        const res = await fetch('/api/tilesets/tags');
        if (res.ok) {
          const data: string[] = await res.json();
          setAllTags(data);
        }
      } catch {
        // Non-critical: autocomplete just won't work
      }
    }
    fetchTags();
  }, []);

  // Filter suggestions based on input
  const suggestions = inputValue.trim()
    ? allTags.filter(
        (t) =>
          t.toLowerCase().startsWith(inputValue.toLowerCase()) &&
          !tags.includes(t)
      )
    : [];

  function addTag(tag: string) {
    const trimmed = tag.trim().toLowerCase();
    if (!trimmed) return;
    if (tags.includes(trimmed)) return;
    onChange([...tags, trimmed]);
    setInputValue('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  }

  function removeTag(tagToRemove: string) {
    onChange(tags.filter((t) => t !== tagToRemove));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
        addTag(suggestions[highlightedIndex]);
      } else if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < suggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  }

  // Close suggestions on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
        setHighlightedIndex(-1);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm min-h-9 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 pr-1">
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="ml-0.5 rounded-full hover:bg-muted-foreground/20 p-0.5"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="size-3" />
              </button>
            )}
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-sm placeholder:text-muted-foreground"
        />
      </div>

      {/* Autocomplete dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover text-popover-foreground shadow-md max-h-40 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              className={`w-full text-left px-3 py-1.5 text-sm cursor-pointer ${
                index === highlightedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              onMouseDown={(e) => {
                e.preventDefault();
                addTag(suggestion);
              }}
              onMouseEnter={() => setHighlightedIndex(index)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
