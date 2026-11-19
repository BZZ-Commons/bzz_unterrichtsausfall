'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import type { UntisClass } from '@/src/types';
import { normalize } from '@/src/lib/classGroups';

const LISTBOX_ID = 'class-selector-listbox';
const LABEL_ID = 'class-selector-label';
const VALUE_ID = 'class-selector-value';
const optionId = (id: number): string => `class-option-${id}`;

/** Shared styling for the prev/next arrow buttons flanking the dropdown trigger. */
const ARROW_CLASS = 'bzz-btn w-12 px-0';

interface ClassSelectorProps {
  classes: UntisClass[];
  selectedId: number | null;
  onChange: (id: number) => void;
  loading?: boolean;
  /** Extra classes on the root container — e.g. `sm:ml-auto` to right-align. */
  className?: string;
}

/**
 * Class picker combining a prev/next stepper with a filterable dropdown:
 * `‹ [current class ▾] ›`. The arrows step through the class list (same order as
 * the dropdown, wrapping at both ends); clicking the centre text opens the filter
 * list. With nothing selected, ‹ jumps to the last class and › to the first.
 */
export default function ClassSelector({
  classes,
  selectedId,
  onChange,
  loading = false,
  className = '',
}: ClassSelectorProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const currentIndex = classes.findIndex((c) => c.id === selectedId);
  const selectedClass = currentIndex >= 0 ? classes[currentIndex] : null;

  // Whitespace-insensitive match: typing "im24b" finds the class named "IM24 b".
  const filtered = query.trim()
    ? classes.filter((c) => normalize(c.name).includes(normalize(query)))
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

  // Step through the class list with wraparound. With nothing selected,
  // delta>0 jumps to the first class and delta<0 to the last.
  const step = (delta: number) => {
    const n = classes.length;
    if (n === 0) return;
    const next = currentIndex < 0 ? (delta > 0 ? 0 : n - 1) : (currentIndex + delta + n) % n;
    onChange(classes[next].id);
  };

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
      case 'Enter': {
        e.preventDefault();
        // Select the highlighted option, or — when nothing is highlighted —
        // the top match for the typed query, so Enter picks the filtered class.
        const pick = activeIndex >= 0 ? filtered[activeIndex] : filtered[0];
        if (pick) selectItem(pick.id);
        break;
      }
      case 'Escape':
        e.preventDefault();
        closeDropdown();
        break;
    }
  };

  const displayLabel = selectedClass
    ? selectedClass.name +
      (selectedClass.companionNames?.length ? ` (+${selectedClass.companionNames.join(', ')})` : '')
    : loading
      ? 'Lade Klassen …'
      : 'Bitte wählen';

  const disabled = loading || classes.length === 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <span id={LABEL_ID} className="bzz-field-label">
        Klasse
      </span>

      {/* Button group: ‹ prev · trigger (filter dropdown) · next › */}
      <div className="bzz-segment flex-nowrap">
        <button
          type="button"
          disabled={disabled}
          onClick={() => step(-1)}
          aria-label="Vorherige Klasse"
          className={ARROW_CLASS}
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => (open ? closeDropdown() : openDropdown())}
          onKeyDown={handleKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={`${LABEL_ID} ${VALUE_ID}`}
          className="bzz-btn min-w-44 justify-between px-4"
        >
          <span
            id={VALUE_ID}
            className={`max-w-[14rem] truncate ${selectedClass ? '' : 'font-normal text-bzz-muted'}`}
          >
            {displayLabel}
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <button
          type="button"
          disabled={disabled}
          onClick={() => step(1)}
          aria-label="Nächste Klasse"
          className={ARROW_CLASS}
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      {/* Dropdown — anchored below the button group. Bordered like a field so it
          stays distinct when it overlaps the white calendar card. */}
      {open && (
        <div className="absolute left-0 z-50 mt-1 w-80 max-w-[calc(100vw-2rem)] rounded-bzz border-[1.5px] border-bzz-line-stark bg-bzz-weiss">
          {/* Filter input */}
          <div className="p-2">
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
              className="bzz-field"
            />
          </div>

          {/* List */}
          <ul
            ref={listRef}
            id={LISTBOX_ID}
            role="listbox"
            aria-labelledby={LABEL_ID}
            className="m-0 max-h-72 list-none space-y-1 overflow-y-auto p-2 pt-0"
          >
            {filtered.length === 0 ? (
              <li className="bzz-muted px-4 py-2">Keine Treffer</li>
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
                    className={`cursor-pointer rounded-bzz px-4 py-2 text-[15px] select-none transition-colors ${
                      isActive ? 'bg-bzz-softblau text-bzz-blau-text' : 'bg-bzz-grau'
                    } ${isSelected ? 'font-bold' : ''}`}
                  >
                    {c.name}
                    {companions && <span className="ml-1 text-bzz-muted">{companions}</span>}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
