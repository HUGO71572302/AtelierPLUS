"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * One launcher entry: either a navigation action ("Aller à", "Outils"…)
 * or a real workshop record (client, commande, tissu, modèle).
 * Both share the same shape so a single list can rank them by relevance.
 */
export type LauncherItem = {
  id: string;
  group: string;
  label: string;
  hint?: string;
  meta?: string;
  icon?: ReactNode;
  ownerOnly?: boolean;
  run: () => void;
};

/** Alias kept for existing call sites that build navigation actions. */
export type LauncherAction = LauncherItem;

function Glyph({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const GROUP_ICONS: Record<string, ReactNode> = {
  "Aller à": <><path d="M3 12h18M13 6l6 6-6 6" /></>,
  "Créer": <><path d="M12 5v14M5 12h14" /></>,
  "Outils": <><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" /><circle cx="12" cy="12" r="3.2" /></>,
  "Atelier": <><path d="M3 9h18v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M3 9V7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2M9 13h6" /></>,
  "Clients": <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20v-1.2A5.3 5.3 0 0 1 8.8 13.5h.4a5.3 5.3 0 0 1 5.3 5.3V20z" /><path d="M15 4.8a3.2 3.2 0 0 1 0 6.2M16 14a4.8 4.8 0 0 1 4.5 4.8V20" /></>,
  "Commandes": <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z" /><path d="M4 5.5v13M8 7h8M8 11h8M8 15h5" /></>,
  "Stock": <><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 11l9 4 9-4" /><path d="M3 15l9 4 9-4" /></>,
  "Modèles": <><path d="m8 4 4 2 4-2 5 3-2 4-3-1v11H8V10l-3 1-2-4z" /><path d="M10 7v2M14 7v2" /></>,
};

const FALLBACK_ICON = <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.3 4.3" /></>;
const MAX_RESULTS = 14;

/**
 * Quick launcher (Ctrl / Cmd + K). It searches both navigation actions and the
 * workshop records already loaded in memory, so it keeps working offline.
 */
export function QuickLauncher({
  items,
  open,
  onClose,
}: {
  items: LauncherItem[];
  open: boolean;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    const available = items.filter((item) => !item.ownerOnly);
    if (!needle) return available.slice(0, MAX_RESULTS);
    return available
      .map((item) => {
        const haystack = `${item.label} ${item.hint ?? ""} ${item.meta ?? ""} ${item.group}`.toLocaleLowerCase("fr");
        const index = haystack.indexOf(needle);
        // A label that starts with the query outranks a match buried in the hint.
        const bonus = item.label.toLocaleLowerCase("fr").startsWith(needle) ? -50 : 0;
        return { item, score: index === -1 ? Number.POSITIVE_INFINITY : index + bonus };
      })
      .filter((entry) => Number.isFinite(entry.score))
      .sort((first, second) => first.score - second.score)
      .slice(0, MAX_RESULTS)
      .map((entry) => entry.item);
  }, [items, query]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    const active = listRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ block: "nearest" });
  }, [cursor, results]);

  // The component is unmounted on close, so query/cursor always start fresh.
  const safeCursor = results.length ? Math.min(cursor, results.length - 1) : 0;
  // Pre-computed before rendering: mutating a variable during render is not allowed.
  const groupFlags = results.map((item, index) => index === 0 || item.group !== results[index - 1].group);

  if (!open) return null;

  function choose(item: LauncherItem) {
    item.run();
    onClose();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((current) => (results.length ? (current + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((current) => (results.length ? (current - 1 + results.length) % results.length : 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = results[safeCursor];
      if (target) choose(target);
    } else if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  return (
    <div className="launcher-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="launcher" role="dialog" aria-modal="true" aria-label="Recherche rapide">
        <div className="launcher-input-row">
          <span className="launcher-search-icon"><Glyph>{FALLBACK_ICON}</Glyph></span>
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Client, commande, tissu, outil…"
            aria-label="Recherche rapide"
          />
          <kbd className="launcher-kbd">Échap</kbd>
        </div>

        <div className="launcher-list" ref={listRef} role="listbox" aria-label="Résultats">
          {results.length === 0 ? (
            <p className="launcher-empty">Aucun résultat pour « {query} ».</p>
          ) : (
            results.map((item, index) => (
              <div key={item.id}>
                {groupFlags[index] && <p className="launcher-group">{item.group}</p>}
                <button
                  type="button"
                  role="option"
                  aria-selected={index === safeCursor}
                  className={`launcher-item ${index === safeCursor ? "launcher-item-active" : ""}`}
                  data-active={index === safeCursor}
                  onMouseEnter={() => setCursor(index)}
                  onClick={() => choose(item)}
                >
                  <span className="launcher-item-icon">{item.icon ?? <Glyph>{GROUP_ICONS[item.group] ?? FALLBACK_ICON}</Glyph>}</span>
                  <span className="launcher-item-text">
                    <b>{item.label}</b>
                    {item.hint && <small>{item.hint}</small>}
                  </span>
                  {item.meta && <span className="launcher-item-meta">{item.meta}</span>}
                  <span className="launcher-item-go" aria-hidden="true">↵</span>
                </button>
              </div>
            ))
          )}
        </div>

        <footer className="launcher-footer">
          <span><kbd>↑</kbd><kbd>↓</kbd> naviguer</span>
          <span><kbd>↵</kbd> ouvrir</span>
          <span><kbd>Échap</kbd> fermer</span>
        </footer>
      </div>
    </div>
  );
}
