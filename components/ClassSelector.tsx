'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { UntisClass } from '@/src/types';

const LISTBOX_ID = 'class-selector-listbox';
const LABEL_ID = 'class-selector-label';
const optionId = (id: number): string => `class-option-${id}`;

interface ClassSelectorProps {
  classes: UntisClass[];
  selectedId: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
}

export default function ClassSelector({
  classes,
  selectedId,
  onChange,
  loading = false,
}: ClassSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedClass = classes.find((c) => c.id === selectedId) ?? null;

  const filtered = query.trim()
    ? classes.filter((c) =>
        c.name.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : classes;

  const openDropdown = useCallback(() => {
    setOpen(true);
    setQuery('');
    setActiveIndex(-1);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const closeDropdown = useCallback(() => {
    setOpen(false);
    setQuery('');
    setActiveIndex(-1);
  }, []);

  const selectItem = useCallback(
    (id: number) => {
      onChange(id);
      closeDropdown();
    },
    [onChange, closeDropdown],
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex < 0 || !listRef.current) return;
    const item = listRef.current.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) closeDropdown();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, closeDropdown]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
        e.preventDefault();
        openDropdown();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIndex >= 0 && filtered[activeIndex]) {
          selectItem(filtered[activeIndex].id);
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  const displayLabel = selectedClass
    ? selectedClass.name +
      (selectedClass.companionNames?.length
        ? ` (+${selectedClass.companionNames.join(', ')})`
        : '')
    : loading
      ? 'Lade Klassen …'
      : '— Klasse wählen —';

  const disabled = loading || classes.length === 0;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
      <label id={LABEL_ID} className="text-sm font-medium text-slate-700 shrink-0">
        Klasse auswählen
      </label>

      <div ref={containerRef} className="relative w-full sm:w-80">
        {/* Trigger button */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? closeDropdown() : openDropdown())}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="w-full flex items-center justify-between rounded-xl border border-slate-200 bg-white
                     px-4 py-2.5 text-sm text-slate-900 shadow-sm text-left
                     focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200
                     disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
        >
          <span className={selectedClass ? 'text-slate-900' : 'text-slate-400'}>
            {displayLabel}
          </span>
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2 ${open ? 'rotate-180' : ''}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
              clipRule="evenodd"
            />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg">
            {/* Filter input */}
            <div className="p-2 border-b border-slate-100">
              <input
                ref={inputRef}
                type="text"
                role="combobox"
                aria-labelledby={LABEL_ID}
                aria-expanded={open}
                aria-controls={LISTBOX_ID}
                aria-autocomplete="list"
                aria-activedescendant={
                  activeIndex >= 0 && filtered[activeIndex]
                    ? optionId(filtered[activeIndex].id)
                    : undefined
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(-1);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Filtern …"
                className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm
                           focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            {/* List */}
            <ul
              ref={listRef}
              id={LISTBOX_ID}
              role="listbox"
              aria-labelledby={LABEL_ID}
              className="max-h-64 overflow-y-auto py-1"
            >
              {filtered.length === 0 ? (
                <li className="px-4 py-2 text-sm text-slate-400">Keine Treffer</li>
              ) : (
                filtered.map((c, i) => {
                  const companions = c.companionNames?.length
                    ? ` (+${c.companionNames.join(', ')})`
                    : '';
                  const isActive = i === activeIndex;
                  const isSelected = c.id === selectedId;
                  return (
                    <li
                      key={c.id}
                      id={optionId(c.id)}
                      role="option"
                      aria-selected={isSelected}
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => selectItem(c.id)}
                      className={`px-4 py-2 text-sm cursor-pointer select-none transition-colors
                        ${isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-900'}
                        ${isSelected && !isActive ? 'font-medium' : ''}
                      `}
                    >
                      {c.name}
                      {companions && (
                        <span className="text-slate-400 ml-1">{companions}</span>
                      )}
                    </li>
                  );
                })
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
