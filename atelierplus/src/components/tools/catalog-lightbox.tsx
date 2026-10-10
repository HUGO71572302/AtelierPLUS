"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef } from "react";
import type { CatalogModel } from "@/lib/inspiration-catalog";
import type { InspirationModel } from "@/lib/atelier-types";

export type LightboxEntry =
  | { kind: "catalog"; model: CatalogModel }
  | { kind: "personal"; model: InspirationModel };

type Props = {
  entry: LightboxEntry;
  onClose: () => void;
  onStep: (direction: 1 | -1) => void;
};

/**
 * Full-screen viewer for a catalogue visual.
 * Mounted as a top-level fixed layer (never inside the scrollable modal), so it
 * stays above the options dialog and keeps keyboard navigation working.
 */
export function CatalogLightbox({ entry, onClose, onStep }: Props) {
  const closeRef = useRef<HTMLButtonElement | null>(null);

  const handleKey = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
    if (event.key === "ArrowRight") { event.preventDefault(); onStep(1); return; }
    if (event.key === "ArrowLeft") { event.preventDefault(); onStep(-1); }
  }, [onClose, onStep]);

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", handleKey);
  }, [handleKey]);

  const title = entry.model.title;
  const subtitle = entry.kind === "catalog"
    ? `${entry.model.audience} · ${entry.model.occasion} · ${entry.model.level}`
    : `Votre atelier · ${entry.model.garment}`;
  const advice = entry.kind === "catalog" ? entry.model.advice : entry.model.advice;
  const notes = entry.kind === "catalog" ? entry.model.fabric : null;

  return (
    <div className="lightbox-backdrop" role="dialog" aria-modal="true" aria-label={`${title} — vue agrandie`} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="lightbox">
        <header className="lightbox-head">
          <div className="lightbox-titles">
            <p className="lightbox-kicker">{entry.kind === "catalog" ? "Sélection AtelierPLUS" : "Votre atelier"}</p>
            <h3 className="lightbox-title">{title}</h3>
            <p className="lightbox-subtitle">{subtitle}</p>
          </div>
          <div className="lightbox-head-actions">
            <button type="button" className="lightbox-nav" onClick={() => onStep(-1)} aria-label="Modèle précédent">‹</button>
            <button type="button" className="lightbox-nav" onClick={() => onStep(1)} aria-label="Modèle suivant">›</button>
            <button ref={closeRef} type="button" className="lightbox-close" onClick={onClose} aria-label="Fermer la vue agrandie">✕</button>
          </div>
        </header>

        <div className="lightbox-stage">
          {entry.kind === "catalog" ? (
            <Image
              key={entry.model.id}
              src={entry.model.image}
              alt={`${title} — ${entry.model.visual === "sketch" ? "croquis original de la coupe" : "illustration générée pour AtelierPLUS"}`}
              width={768}
              height={1152}
              sizes="92vw"
              priority
              className="lightbox-image"
            />
          ) : entry.model.imageData ? (
            // Uploaded data URLs must stay local: never routed through the optimizer.
            // eslint-disable-next-line @next/next/no-img-element
            <img key={entry.model.id} src={entry.model.imageData} alt={title} className="lightbox-image" />
          ) : (
            <div className="lightbox-empty" aria-hidden="true">✂</div>
          )}
        </div>

        <footer className="lightbox-foot">
          <div className="lightbox-facts">
            {notes && <div><b>Tissu conseillé</b><span>{notes}</span></div>}
            {entry.kind === "catalog" && <div><b>Niveau de confection</b><span>{entry.model.level}</span></div>}
            {(advice || entry.kind === "personal") && (
              <div><b>{entry.kind === "catalog" ? "Conseil d’atelier" : "Note du modèle"}</b><span>{advice || entry.model.description || "Aucune note pour cette fiche."}</span></div>
            )}
          </div>
          {entry.kind === "catalog" && entry.model.reference && (
            <a className="lightbox-source" href={entry.model.reference.url} target="_blank" rel="noopener noreferrer">
              <span className="catalog-source-mark" aria-hidden="true">P</span>
              {entry.model.reference.title}
            </a>
          )}
          <p className="lightbox-help">Flèches ← → pour changer de modèle · Échap pour fermer</p>
        </footer>
      </div>
    </div>
  );
}
