"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { GARMENT_TEMPLATES } from "@/lib/atelier-types";
import type { InspirationModel, InspirationModelDraft } from "@/lib/atelier-types";
import {
  CATALOG_FAMILIES,
  INSPIRATION_CATALOG,
  catalogOrderDetails,
  catalogSearchText,
  filterCatalog,
} from "@/lib/inspiration-catalog";
import type { CatalogFamily, CatalogModel, CatalogOccasion, ModelOrderDetails } from "@/lib/inspiration-catalog";
import { InspirationModelForm } from "@/components/tools/inspiration-model-form";
import { CatalogLightbox, type LightboxEntry } from "@/components/tools/catalog-lightbox";

function ExternalMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 17 17 7M7 7h10v10" />
    </svg>
  );
}

function garmentLabel(value: string) {
  return GARMENT_TEMPLATES.find((item) => item.value === value)?.label ?? value;
}

function personalEntry(model: InspirationModel): LightboxEntry {
  return { kind: "personal", model };
}

function CatalogCard({
  item,
  index,
  onZoom,
  onSelect,
}: {
  item: CatalogModel;
  index: number;
  onZoom: (entry: LightboxEntry) => void;
  onSelect?: (garment: string, details?: ModelOrderDetails) => void;
}) {
  return (
    <article className="inspiration-card catalog-card" aria-labelledby={`catalog-title-${item.id}`} data-catalog-id={item.id}>
      <button
        type="button"
        className="catalog-cover catalog-cover-button"
        onClick={() => onZoom({ kind: "catalog", model: item })}
        aria-label={`Agrandir ${item.title}`}
        title="Voir en grand"
      >
        <Image
          src={item.image}
          alt={`${item.title} — ${item.visual === "sketch" ? "croquis original de la coupe" : "illustration générée pour AtelierPLUS"}`}
          width={768}
          height={1152}
          sizes="(max-width: 560px) 90vw, 340px"
          loading={index < 2 ? "eager" : "lazy"}
          priority={index === 0}
        />
        <span className="catalog-zoom" aria-hidden="true">⤢</span>
        {item.isNew && <span className="catalog-new">Nouveau</span>}
        <span className="catalog-visual-kind">{item.visual === "sketch" ? "Croquis d’atelier" : "Illustration IA"}</span>
      </button>

      <div className="inspiration-body catalog-body">
        <div className="catalog-meta">
          <span>{item.audience}</span><i aria-hidden="true" /><span>{item.occasion}</span>
        </div>
        <div className="catalog-title-row">
          <h3 id={`catalog-title-${item.id}`}>{item.title}</h3>
          <button
            type="button"
            className="catalog-title-zoom"
            onClick={() => onZoom({ kind: "catalog", model: item })}
            aria-label={`Agrandir ${item.title}`}
          >⤢</button>
        </div>
        <p className="catalog-description">{item.description}</p>
        <dl className="catalog-facts">
          <div><dt>Tissu conseillé</dt><dd>{item.fabric}</dd></div>
          <div><dt>Confection</dt><dd>{item.level}</dd></div>
        </dl>
        <details className="catalog-details">
          <summary>Mesures &amp; conseils <span aria-hidden="true">+</span></summary>
          <div className="catalog-details-content">
            <div className="inspiration-tags" aria-label="Codes de mensuration">{item.codes.map((code) => <span key={code}>{code}</span>)}</div>
            <p>{item.advice}</p>
          </div>
        </details>
        {item.reference && (
          <a className="catalog-source" href={item.reference.url} target="_blank" rel="noopener noreferrer" title={`${item.reference.title} — nouvel onglet`}>
            <span className="catalog-source-mark" aria-hidden="true">P</span>
            <span>Explorer sur Pinterest</span>
            <ExternalMark />
          </a>
        )}
        {onSelect && (
          <button type="button" className="button button-primary catalog-order-button" onClick={() => onSelect(item.garment, catalogOrderDetails(item))}>
            Créer cette commande <ExternalMark />
          </button>
        )}
      </div>
    </article>
  );
}

/** Public editorial suggestions plus the atelier's own database-backed models. */
export function InspirationView({
  customModels,
  currentUserId,
  isOwner,
  onSelectGarment,
  onSaveCustomModel,
  onDeleteCustomModel,
}: {
  customModels: InspirationModel[];
  currentUserId: string;
  isOwner: boolean;
  onSelectGarment?: (garment: string, details?: ModelOrderDetails) => void;
  onSaveCustomModel: (draft: InspirationModelDraft) => Promise<void>;
  onDeleteCustomModel: (model: InspirationModel) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState<"all" | CatalogFamily>("all");
  const [occasion, setOccasion] = useState<"all" | CatalogOccasion>("all");
  const [zoom, setZoom] = useState<LightboxEntry | null>(null);

  const visibleSuggestions = useMemo(() => filterCatalog({ query, family, occasion }), [query, family, occasion]);
  const newCount = INSPIRATION_CATALOG.filter((item) => item.isNew).length;
  const sketchCount = INSPIRATION_CATALOG.filter((item) => item.visual === "sketch").length;
  const hasFilters = Boolean(query.trim() || family !== "all" || occasion !== "all");

  const personalEntries = useMemo<LightboxEntry[]>(
    () => customModels.filter((model) => model.imageData).map(personalEntry),
    [customModels],
  );

  const orderedEntries = useMemo<LightboxEntry[]>(() => [
    ...visibleSuggestions.map((model) => ({ kind: "catalog" as const, model })),
    ...personalEntries,
  ], [visibleSuggestions, personalEntries]);

  function step(direction: 1 | -1) {
    setZoom((current) => {
      if (!current || orderedEntries.length <= 1) return current;
      const key = (entry: LightboxEntry) => entry.model.id;
      const index = orderedEntries.findIndex((entry) => key(entry) === key(current));
      if (index === -1) return current;
      const next = (index + direction + orderedEntries.length) % orderedEntries.length;
      return orderedEntries[next];
    });
  }

  function resetFilters() {
    setQuery("");
    setFamily("all");
    setOccasion("all");
  }

  const visiblePersonalModels = useMemo(() => {
    const needle = catalogSearchText(query).trim();
    return customModels.filter((item) => {
      if (needle && !catalogSearchText(`${item.title} ${item.description ?? ""} ${garmentLabel(item.garment)}`).includes(needle)) return false;
      if (family !== "all" && !INSPIRATION_CATALOG.some((reference) => reference.garment === item.garment && reference.family === family)) return false;
      return true;
    });
  }, [customModels, query, family]);

  return (
    <div className="tools-view inspiration-catalog">
      <header className="catalog-intro">
        <div>
          <p className="catalog-eyebrow">LE CARNET D’INSPIRATION</p>
          <h2>{INSPIRATION_CATALOG.length} idées à coudre<span aria-hidden="true">.</span></h2>
          <p>Du wax de cérémonie au lin du quotidien. Touchez une image pour l’agrandir, puis lancez la commande.</p>
          <div className="catalog-intro-badges">
            <span>{newCount} nouveaux modèles</span>
            <span>{sketchCount} croquis d’atelier</span>
            <span>7 types de vêtements</span>
          </div>
        </div>
        <button type="button" className="button button-light" onClick={() => setAdding((current) => !current)} aria-expanded={adding}>
          {adding ? "Fermer le formulaire" : "+ Ajouter mon modèle"}
        </button>
      </header>

      {adding && (
        <section className="stat-block inspiration-custom-form">
          <h3>Ajouter un modèle de votre atelier</h3>
          <p>Ajoutez votre photo et vos consignes : la fiche sera partagée avec votre équipe.</p>
          <InspirationModelForm
            onSave={async (draft) => { await onSaveCustomModel(draft); setAdding(false); }}
            onCancel={() => setAdding(false)}
          />
        </section>
      )}

      <section className="catalog-controls" aria-label="Filtres du catalogue">
        <label className="catalog-search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
          <input aria-label="Rechercher un modèle" placeholder="Sirène, wax, homme, lin…" type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="catalog-occasion">Pour quelle occasion ?
          <select aria-label="Occasion du modèle" value={occasion} onChange={(event) => setOccasion(event.target.value as typeof occasion)}>
            <option value="all">Toutes les occasions</option>
            <option value="Quotidien">Quotidien</option>
            <option value="Travail">Travail</option>
            <option value="Cérémonie">Cérémonie</option>
          </select>
        </label>
        <div className="catalog-filter-chips" role="group" aria-label="Type de vêtement">
          {CATALOG_FAMILIES.map((item) => (
            <button key={item.value} type="button" className={`catalog-filter ${family === item.value ? "is-active" : ""}`} aria-pressed={family === item.value} onClick={() => setFamily(item.value)}>
              {item.label}<span>{item.value === "all" ? INSPIRATION_CATALOG.length : INSPIRATION_CATALOG.filter((entry) => entry.family === item.value).length}</span>
            </button>
          ))}
        </div>
      </section>

      {customModels.length > 0 && (
        <section className="custom-model-section">
          <div className="catalog-section-heading">
            <div><h3>Votre atelier</h3><p>Les créations et photos ajoutées par votre équipe.</p></div>
            <span>{visiblePersonalModels.length} modèle{visiblePersonalModels.length === 1 ? "" : "s"}</span>
          </div>
          {visiblePersonalModels.length === 0 ? (
            <p className="catalog-empty-personal">Aucune fiche personnelle ne correspond à ce nom ou ce type de vêtement.</p>
          ) : (
            <div className="inspiration-grid catalog-grid">
              {visiblePersonalModels.map((item) => (
                <article className="inspiration-card inspiration-custom-card" key={item.id}>
                  <button
                    type="button"
                    className="catalog-cover catalog-cover-button"
                    onClick={() => setZoom(personalEntry(item))}
                    aria-label={`Agrandir ${item.title}`}
                    disabled={!item.imageData}
                  >
                    {item.imageData ? (
                      // Uploaded data URLs must remain local; no optimizer request.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="catalog-personal-photo" src={item.imageData} alt={item.title} loading="lazy" />
                    ) : <div className="inspiration-placeholder">✂<span>Sans photo</span></div>}
                    {item.imageData && <span className="catalog-zoom" aria-hidden="true">⤢</span>}
                  </button>
                  <div className="inspiration-body catalog-body">
                    <span className="inspiration-origin">VOTRE ATELIER</span>
                    <div className="catalog-title-row">
                      <h3>{item.title}</h3>
                      {item.imageData && (
                        <button type="button" className="catalog-title-zoom" onClick={() => setZoom(personalEntry(item))} aria-label={`Agrandir ${item.title}`}>⤢</button>
                      )}
                    </div>
                    <p>{item.description || garmentLabel(item.garment)}</p>
                    {(item.measureCodes ?? []).length > 0 && <div className="inspiration-tags">{item.measureCodes.map((code) => <span key={code}>{code}</span>)}</div>}
                    {item.advice && <p className="inspiration-advice"><b>Conseil :</b> {item.advice}</p>}
                    <div className="inspiration-actions">
                      {onSelectGarment && (
                        <button
                          type="button"
                          className="button button-light"
                          onClick={() => onSelectGarment(item.garment, { model: item.title, notes: [item.description, item.advice].filter(Boolean).join("\n") })}
                        >Créer la commande</button>
                      )}
                      {(isOwner || item.createdBy === currentUserId) && (
                        <button type="button" className="button button-quiet" onClick={() => onDeleteCustomModel(item)}>Supprimer</button>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="custom-model-section" aria-label="Sélection AtelierPLUS">
        <div className="catalog-section-heading">
          <div><h3>La sélection AtelierPLUS</h3><p>Des coupes à adapter, pas des patrons prêts à découper.</p></div>
          <span role="status" aria-live="polite">{visibleSuggestions.length} / {INSPIRATION_CATALOG.length} modèles</span>
        </div>
        <div className="catalog-provenance">
          <span className="catalog-source-mark" aria-hidden="true">P</span>
          <p><b>Pistes consultées sur Pinterest.</b> Les liens ouvrent les références dans un nouvel onglet. Nos visuels sont des <b>illustrations IA ou des croquis originaux</b>, pas des photos importées de Pinterest. Les liens externes nécessitent internet.</p>
        </div>
        {visibleSuggestions.length > 0 ? (
          <div className="inspiration-grid catalog-grid">
            {visibleSuggestions.map((item, index) => (
              <CatalogCard key={item.id} item={item} index={index} onZoom={setZoom} onSelect={onSelectGarment} />
            ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <h4>Aucun modèle avec ces filtres</h4>
            <p>Essayez un autre tissu, un vêtement ou une occasion.</p>
            <button type="button" className="button button-light" onClick={resetFilters}>Réinitialiser les filtres</button>
          </div>
        )}
        {hasFilters && visibleSuggestions.length > 0 && (
          <button type="button" className="catalog-reset" onClick={resetFilters}>Voir les {INSPIRATION_CATALOG.length} modèles</button>
        )}
      </section>

      <footer className="catalog-note">
        <b>Votre savoir-faire fait la différence.</b>
        <p>Confirmez le tissu, les mensurations, l’aisance et la longueur avec le client. Les conseils sont indicatifs : un essayage reste indispensable avant la coupe définitive.</p>
      </footer>

      {zoom && <CatalogLightbox entry={zoom} onClose={() => setZoom(null)} onStep={step} />}
    </div>
  );
}
