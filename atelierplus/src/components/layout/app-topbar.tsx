"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

function Glyph({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS = {
  search: <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.3 4.3" /></>,
  close: <><path d="m6 6 12 12M18 6 6 18" /></>,
  ruler: <><path d="m3 16 13-13 5 5L8 21z" /><path d="m13 6 5 5M10 9l2 2M7 12l2 2M4 15l2 2" /></>,
  team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.3A5.2 5.2 0 0 1 8.7 13.5h.6a5.2 5.2 0 0 1 5.2 5.2V20z" /><path d="M16 5.2a3 3 0 0 1 0 5.6M16.2 14a4.6 4.6 0 0 1 4.3 4.6V20" /></>,
  dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
  cloud: <><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.1 8.4 4.8 4.8 0 0 0 7 18Z" /></>,
  sync: <><path d="M20 11A8 8 0 0 0 6.3 6.3L4 8.5" /><path d="M4 4v4.5h4.5" /><path d="M4 13a8 8 0 0 0 13.7 4.7L20 15.5" /><path d="M20 20v-4.5h-4.5" /></>,
};

/**
 * Three-zone header: identity | search | actions.
 * On phones the actions collapse into one menu button, so nothing overlaps.
 */
export function AppTopbar({
  workshopName,
  roleLabel,
  search,
  onSearchChange,
  online,
  syncing,
  pendingCount,
  onSync,
  onOpenLauncher,
  onOpenGuide,
  onOpenTeam,
  onOpenOptions,
  onLogout,
  children,
}: {
  workshopName: string;
  roleLabel: string;
  search: string;
  onSearchChange: (value: string) => void;
  online: boolean;
  syncing: boolean;
  pendingCount: number;
  onSync: () => void;
  onOpenLauncher: () => void;
  onOpenGuide: () => void;
  onOpenTeam: () => void;
  onOpenOptions: () => void;
  onLogout: () => void;
  children?: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocumentClick(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    }
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, [menuOpen]);

  const syncLabel = syncing ? "Synchronisation…" : !online ? "Hors-ligne" : pendingCount ? `${pendingCount} en attente` : "À jour";

  return (
    <header className="topbar">
      {/* Zone 1 — identity */}
      <div className="topbar-identity">
        <button type="button" className="topbar-search-trigger" onClick={onOpenLauncher} title="Recherche rapide (Ctrl + K)">
          <Glyph>{ICONS.search}</Glyph>
          <span>Rechercher…</span>
          <kbd>Ctrl K</kbd>
        </button>
        <div className="topbar-context">
          <b>{workshopName}</b>
          <small>{roleLabel}</small>
        </div>
      </div>

      {/* Zone 2 — search field (desktop / tablette) */}
      <label className="search-box topbar-search" aria-label="Rechercher">
        <Glyph>{ICONS.search}</Glyph>
        <input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Chercher une cliente, une commande…"
        />
        {search && (
          <button type="button" onClick={() => onSearchChange("")} aria-label="Effacer la recherche">
            <Glyph size={14}>{ICONS.close}</Glyph>
          </button>
        )}
      </label>

      {/* Zone 3 — actions */}
      <div className="topbar-actions" ref={menuRef}>
        <button
          type="button"
          className={`sync-chip ${online ? "sync-online" : "sync-offline"} ${syncing ? "sync-busy" : ""}`}
          onClick={onSync}
          title={online ? "Synchroniser maintenant" : "Mode hors-ligne"}
        >
          <span className="connection-dot" />
          <span className="sync-chip-label">{syncLabel}</span>
        </button>

        <button type="button" className="topbar-icon-btn" onClick={onOpenGuide} title="Guide illustré des 19 mesures">
          <Glyph>{ICONS.ruler}</Glyph>
          <span className="topbar-icon-label">Guide</span>
        </button>

        <button type="button" className="topbar-icon-btn" onClick={onOpenTeam} title="Mon équipe & invitations">
          <Glyph>{ICONS.team}</Glyph>
          <span className="topbar-icon-label">Équipe</span>
        </button>

        <button type="button" className="topbar-icon-btn topbar-options-btn" onClick={onOpenOptions} title="Plus d’options">
          <Glyph>{ICONS.dots}</Glyph>
          <span className="topbar-icon-label">Plus d’options</span>
        </button>

        <button type="button" className="topbar-menu-btn" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-label="Menu de l’atelier">
          <Glyph>{ICONS.dots}</Glyph>
        </button>

        {menuOpen && (
          <div className="topbar-menu" role="menu">
            <p className="topbar-menu-title">{workshopName}</p>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenLauncher(); }}>
              <Glyph>{ICONS.search}</Glyph> Recherche rapide
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenGuide(); }}>
              <Glyph>{ICONS.ruler}</Glyph> Guide des mesures
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenTeam(); }}>
              <Glyph>{ICONS.team}</Glyph> Mon équipe
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onOpenOptions(); }}>
              <Glyph>{ICONS.dots}</Glyph> Plus d’options
            </button>
            <button type="button" role="menuitem" onClick={() => { setMenuOpen(false); onSync(); }}>
              <Glyph>{ICONS.sync}</Glyph> {online ? "Synchroniser" : "Hors-ligne — réessayer"}
            </button>
            <button type="button" role="menuitem" className="topbar-menu-danger" onClick={() => { setMenuOpen(false); onLogout(); }}>
              <Glyph><path d="M10 17l5-5-5-5M15 12H3" /></Glyph> Se déconnecter
            </button>
          </div>
        )}

        {children}
      </div>
    </header>
  );
}
