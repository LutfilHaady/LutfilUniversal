'use client';

import { useRef, useEffect, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { IconSearch, IconQR } from '@/components/icons';
import { runSearch, KIND_LABEL, KIND_TAG, type ResultKind, type SearchResult } from '@/lib/global-search';
import { useCommandPalette } from '@/lib/command-palette-context';
import { QrScannerModal } from '@/components/qr-scanner-modal';

export function CommandPalette() {
  const router = useRouter();
  const { open, query, openPalette, closePalette, setQuery } = useCommandPalette();
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [scannerOpen, setScannerOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const reqId = useRef(0);

  // ⌘K / Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        open ? closePalette() : openPalette();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openPalette, closePalette]);

  // Reset state whenever the palette closes; focus the input when it opens.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 0);
      return () => clearTimeout(t);
    }
    setQuery('');
    setResults([]);
    setActiveIndex(0);
    setLoading(false);
  }, [open, setQuery]);

  // Debounced live search.
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (!term) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const handle = setTimeout(async () => {
      try {
        const r = await runSearch(term);
        if (id === reqId.current) {
          setResults(r);
          setActiveIndex(0);
        }
      } catch {
        if (id === reqId.current) setResults([]);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [query, open]);

  const select = useCallback(
    (r: SearchResult | undefined) => {
      if (!r) return;
      closePalette();
      router.push(r.href);
    },
    [router, closePalette],
  );

  function onInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => Math.min(i + 1, Math.max(results.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      select(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  }

  // Group results by kind, preserving the canonical order.
  const order: ResultKind[] = ['batch', 'lot', 'recipe', 'machine'];
  let flatIndex = -1;

  return (
    <>
      {/* Trigger — mirrors the original static search box */}
      <button
        type="button"
        onClick={() => openPalette()}
        aria-label="Search"
        className="flex items-center gap-2 h-9 px-3 rounded-md border border-[#2a2a2a] bg-[#161616] text-[12px] text-[#888888] w-[260px] hover:border-[#3a3a3a] transition-colors group"
      >
        <IconSearch size={15} />
        <span className="flex-1 text-left">Search batches, lots, recipes…</span>
        <div 
          onClick={e => { e.stopPropagation(); setScannerOpen(true); }}
          className="text-[#5a5a5a] group-hover:text-[#f5f5f5] transition-colors p-0.5 hover:bg-[#2a2a2a] rounded cursor-pointer"
        >
          <IconQR size={15} />
        </div>
        <kbd className="font-mono text-[10px] text-[#5a5a5a] border border-[#363636] rounded px-1.5 py-0.5">⌘K</kbd>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4 bg-black/60"
          onClick={() => closePalette()}
        >
          <div
            role="dialog"
            aria-label="Global search"
            className="w-full max-w-[560px] rounded-xl bg-[#161616] border border-[#2a2a2a] shadow-[0_16px_48px_rgba(0,0,0,0.7)] overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Input row */}
            <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[#2a2a2a]">
              <IconSearch size={16} className="text-[#5a5a5a] shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={onInputKeyDown}
                placeholder="Search batches, lots, recipes, machines…"
                className="flex-1 bg-transparent text-[14px] text-[#f5f5f5] placeholder-[#5a5a5a] outline-none"
              />
              <button 
                type="button" 
                onClick={() => setScannerOpen(true)}
                className="text-[#5a5a5a] hover:text-[#f5f5f5] p-1 hover:bg-[#2a2a2a] rounded transition-colors shrink-0"
              >
                <IconQR size={16} />
              </button>
              <kbd className="font-mono text-[10px] text-[#5a5a5a] border border-[#363636] rounded px-1.5 py-0.5">ESC</kbd>
            </div>

            {/* Results */}
            <div className="max-h-[380px] overflow-y-auto py-2">
              {!query.trim() ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-[#5a5a5a]">
                  Type to search batch numbers, lot numbers, recipes and machines.
                </div>
              ) : loading ? (
                <div className="px-4 py-8 flex items-center justify-center gap-2 text-[12.5px] text-[#888888]">
                  <span className="w-4 h-4 rounded-full border-2 border-[#22c55e] border-t-transparent animate-spin" />
                  Searching…
                </div>
              ) : results.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12.5px] text-[#888888]">
                  No matches for <span className="font-mono text-[#f5f5f5]">{query.trim()}</span>
                </div>
              ) : (
                order.map(kind => {
                  const group = results.filter(r => r.kind === kind);
                  if (group.length === 0) return null;
                  return (
                    <div key={kind} className="mb-1">
                      <div className="px-4 py-1.5 text-[10px] font-mono uppercase tracking-wider text-[#5a5a5a]">
                        {KIND_LABEL[kind]}
                      </div>
                      {group.map(r => {
                        flatIndex += 1;
                        const idx = flatIndex;
                        const active = idx === activeIndex;
                        return (
                          <button
                            key={`${r.kind}-${r.id}`}
                            type="button"
                            onMouseEnter={() => setActiveIndex(idx)}
                            onClick={() => select(r)}
                            className={
                              'w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ' +
                              (active ? 'bg-[#1f1f1f]' : 'hover:bg-[#1c1c1c]')
                            }
                          >
                            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border border-[#363636] text-[#888888] shrink-0 w-[58px] text-center">
                              {KIND_TAG[r.kind]}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[13px] text-[#f5f5f5] font-medium truncate">{r.title}</span>
                              {r.subtitle && (
                                <span className="block text-[11px] text-[#888888] truncate">{r.subtitle}</span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {scannerOpen && (
        <QrScannerModal 
          onClose={() => { setScannerOpen(false); inputRef.current?.focus(); }}
        />
      )}
    </>
  );
}
