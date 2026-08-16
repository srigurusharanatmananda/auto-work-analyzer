'use client';

/**
 * The verse index for both chanting surfaces — the built-in Guru Gita
 * (`learn/chanting/page.tsx`) and a learner's own uploaded book
 * (`learn/chanting/books/page.tsx`).
 *
 * Exists because both pages had the same problem at real scale. The Guru
 * Gita is 182 verses and an uploaded book can be far longer; both pages
 * rendered every verse at once — one as a wrapping row of chips that
 * pushed the actual practice pane off-screen, the other as a bare
 * scrolling column — with no way to search, no sense of position, and the
 * selected verse liable to be somewhere off-screen after any scroll.
 *
 * What that costs is specifically a CHANTING workflow: you return to a
 * text daily and resume at a remembered verse number, so "get me to verse
 * 108" is the single most common navigation, and it was the one thing
 * neither list could do.
 *
 * So this is a searchable, position-aware rail rather than a prettier
 * list:
 *  - a filter box that matches on verse NUMBER as readily as on text,
 *    since a number is what a learner actually remembers;
 *  - the selected row scrolled into view automatically, including when
 *    selection changes from outside (the prev/next stepper), because a
 *    rail that silently loses its own highlight is worse than no rail;
 *  - `content-visibility: auto` on each row so a thousand-verse book
 *    doesn't pay layout for rows nobody has scrolled to — cheaper than a
 *    virtualiser and it keeps ordinary in-page find working.
 *
 * Deliberately NOT a generic list component: it knows about verse numbers
 * (`VersePickerItem.number`) because that is what earns the search box and
 * the stepper, and a shape that didn't would push both back into the two
 * callers that already duplicated them.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/lib/components/ui';

export interface VersePickerItem {
  /** Caller's own identity for this verse — an id, or a stringified number. */
  key: string;
  /** Displayed, and matched against numeric searches. */
  number: number;
  /** First line or so of the verse, for recognition at a glance. */
  preview: string;
}

export interface VersePickerProps {
  items: VersePickerItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  /** Heading above the list. Defaults to "Verses". */
  title?: string;
  /** Shown in place of the list when `items` is empty. */
  emptyMessage?: string;
  className?: string;
}

/** Collapses runs of whitespace so a PDF-extracted verse previews as one line. */
function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export interface VerseStepperProps {
  items: VersePickerItem[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

/**
 * "← Verse 11 · Verse 12 of 182 · Verse 13 →" above the practice pane.
 *
 * Chanting is sequential — you work through a text verse after verse — so
 * the common move is "next one", not "find it in a list". The rail alone
 * made that a search-and-click every time. Kept beside `VersePicker` rather
 * than in each page because both pages need it and both would otherwise
 * reimplement the index-arithmetic (and the off-by-one at either end).
 */
export function VerseStepper({ items, selectedKey, onSelect }: VerseStepperProps) {
  const index = items.findIndex((item) => item.key === selectedKey);
  if (index === -1 || items.length < 2) return null;

  const previous = index > 0 ? items[index - 1] : null;
  const next = index < items.length - 1 ? items[index + 1] : null;

  return (
    <div className="flex items-center justify-between gap-3">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => previous && onSelect(previous.key)}
        disabled={!previous}
      >
        ← Verse {previous?.number ?? items[0].number}
      </Button>
      <span className="text-xs font-medium tabular-nums text-foreground-tertiary">
        Verse {items[index].number} of {items.length}
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => next && onSelect(next.key)}
        disabled={!next}
      >
        Verse {next?.number ?? items[items.length - 1].number} →
      </Button>
    </div>
  );
}

export default function VersePicker({
  items,
  selectedKey,
  onSelect,
  title = 'Verses',
  emptyMessage = 'No verses yet.',
  className,
}: VersePickerProps) {
  const [query, setQuery] = useState('');
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return items;
    // A bare number means "verse 12", not "any verse whose text contains
    // 12" — matched as a prefix of the verse number so typing "1" while
    // heading for 108 still shows it, rather than only exact hits.
    const numeric = /^\d+$/.test(trimmed);
    return items.filter((item) =>
      numeric
        ? String(item.number).startsWith(trimmed)
        : oneLine(item.preview).toLowerCase().includes(trimmed)
    );
  }, [items, query]);

  // Keeps the highlighted row visible when selection changes from outside
  // this component — the prev/next stepper in the practice pane, or the
  // initial auto-selection of verse 1 on load. `block: 'nearest'` scrolls
  // only the rail, never the page around it.
  //
  // Depends on `selectedKey` ALONE, deliberately. Adding `filtered` (which
  // gets a new identity on every keystroke) made this re-fire mid-search
  // and scroll the list back to the selected row while the learner was
  // still typing — fighting the very search it was meant to support.
  useEffect(() => {
    if (!selectedKey) return;
    rowRefs.current.get(selectedKey)?.scrollIntoView({ block: 'nearest' });
  }, [selectedKey]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground-tertiary">
          {title}
        </h2>
        <span className="text-xs text-foreground-tertiary">
          {query.trim() && filtered.length !== items.length
            ? `${filtered.length} of ${items.length}`
            : items.length > 0
              ? `${items.length}`
              : ''}
        </span>
      </div>

      {items.length > 8 && (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Verse number or words…"
          aria-label="Search verses"
          className="h-9 w-full rounded-md border border-border bg-background-tertiary px-3 text-sm text-foreground placeholder:text-foreground-tertiary focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        />
      )}

      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-tertiary">{emptyMessage}</p>
      ) : filtered.length === 0 ? (
        <p className="py-6 text-center text-sm text-foreground-tertiary">
          No verse matches “{query.trim()}”.
        </p>
      ) : (
        <div
          ref={listRef}
          role="listbox"
          aria-label={title}
          className="-mr-1 flex max-h-[26rem] flex-col gap-0.5 overflow-y-auto pr-1 lg:max-h-[calc(100vh-19rem)]"
        >
          {filtered.map((item) => {
            const selected = item.key === selectedKey;
            return (
              <button
                key={item.key}
                ref={(node) => {
                  if (node) rowRefs.current.set(item.key, node);
                  else rowRefs.current.delete(item.key);
                }}
                role="option"
                aria-selected={selected}
                onClick={() => onSelect(item.key)}
                style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 2.75rem' }}
                className={cn(
                  'group flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition-colors',
                  selected
                    ? 'bg-primary/10 ring-1 ring-primary'
                    : 'hover:bg-background-secondary'
                )}
              >
                <span
                  className={cn(
                    'w-9 shrink-0 rounded text-center text-xs font-semibold tabular-nums leading-6',
                    selected
                      ? 'bg-primary text-white'
                      : 'bg-background-tertiary text-foreground-secondary'
                  )}
                >
                  {item.number}
                </span>
                <span
                  className={cn(
                    'truncate text-xs',
                    selected ? 'text-foreground' : 'text-foreground-secondary'
                  )}
                >
                  {oneLine(item.preview)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
