'use client';

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface CommandPaletteCtx {
  open: boolean;
  query: string;
  openPalette: (q?: string) => void;
  closePalette: () => void;
  setQuery: (q: string) => void;
}

const Ctx = createContext<CommandPaletteCtx | null>(null);

export function CommandPaletteProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const openPalette = useCallback((q?: string) => {
    setQuery(q ?? '');
    setOpen(true);
  }, []);
  const closePalette = useCallback(() => setOpen(false), []);

  return (
    <Ctx.Provider value={{ open, query, openPalette, closePalette, setQuery }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCommandPalette(): CommandPaletteCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useCommandPalette must be used within CommandPaletteProvider');
  return ctx;
}
