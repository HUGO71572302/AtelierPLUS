"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { MeasurementGuideView } from "@/components/measurement-guide-modal";
import { StatisticsView } from "@/components/tools/statistics-view";
import { FabricCalculator } from "@/components/tools/fabric-calculator";
import { PhotoMeasure } from "@/components/tools/photo-measure";
import { InspirationView } from "@/components/tools/inspiration-view";
import { PlanSettingsView } from "@/components/tools/plan-settings-view";
import { AboutPanel } from "@/components/tools/about-panel";
import { RemindersView } from "@/components/tools/reminders-view";
import { StockView } from "@/components/stock-view";
import { SectionErrorBoundary } from "@/components/section-error-boundary";
import type { AtelierData, AtelierOrder, Fabric, InspirationModel, InspirationModelDraft } from "@/lib/atelier-types";
import type { ModelOrderDetails } from "@/lib/inspiration-catalog";

export type ToolView =
  | "home"
  | "statistics"
  | "guide"
  | "fabric"
  | "photo"
  | "reminders"
  | "stock"
  | "inspiration"
  | "plan"
  | "settings"
  | "about";

type ToastFn = (message: string, kind?: "success" | "error" | "info") => void;

const RECENT_KEY = "atelierplus-recent-tools";
const MAX_RECENT = 3;

function Glyph({ children, size = 26 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const ICONS: Record<string, ReactNode> = {
  statistics: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  guide: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H20v3H6.5A2.5 2.5 0 0 1 4 20.5z" /></>,
  fabric: <><path d="M3 8h18v8H3z" /><path d="M7 8v3M11 8v5M15 8v3M19 8v5" /></>,
  photo: <><path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.7l1.3-2h7l1.3 2h1.7A2.5 2.5 0 0 1 21 8.5v8A2.5 2.5 0 0 1 18.5 19h-13A2.5 2.5 0 0 1 3 16.5z" /><circle cx="12" cy="12.5" r="3.2" /></>,
  reminders: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
  stock: <><path d="M3 7l9-4 9 4-9 4z" /><path d="M3 11l9 4 9-4" /><path d="M3 15l9 4 9-4" /></>,
  inspiration: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.3A5.2 5.2 0 0 1 8.7 13.5h.6a5.2 5.2 0 0 1 5.2 5.2V20z" /><path d="M16 5.2a3 3 0 0 1 0 5.6M16.2 14a4.6 4.6 0 0 1 4.3 4.6V20" /></>,
  plan: <><rect x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path d="M2.5 10h19M6 14.5h3" /></>,
  about: <><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></>,
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4L9.6 5a7.6 7.6 0 0 0-2.6 1.5l-2.4-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z" /></>,
  logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
  back: <><path d="M19 12H5M11 6l-6 6 6 6" /></>,
  search: <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.3 4.3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
};

type ToolCategory = "Piloter" | "Confection" | "Atelier";

type Tile = {
  key: ToolView | "team";
  icon: string;
  title: string;
  subtitle: string;
  category: ToolCategory;
  featured?: boolean;
  badge?: string;
  ownerOnly?: boolean;
};

/** Tools grouped by intent: what to look at, what to build with, what to configure. */
const TILES: Tile[] = [
  { key: "statistics", icon: "statistics", title: "Statistiques", subtitle: "CA, clients, tendances", category: "Piloter", featured: true, badge: "PATRON", ownerOnly: true },
  { key: "reminders", icon: "reminders", title: "Rappels", subtitle: "Relances WhatsApp groupées", category: "Piloter", badge: "NOUVEAU" },
  { key: "team", icon: "team", title: "Mon équipe", subtitle: "Comptes et invitations", category: "Piloter" },
  { key: "guide", icon: "guide", title: "Guide des mesures", subtitle: "19 points illustrés", category: "Confection" },
  { key: "fabric", icon: "fabric", title: "Calcul de tissu", subtitle: "Estimer le métrage", category: "Confection" },
  { key: "photo", icon: "photo", title: "Mesure par photo", subtitle: "Estimation sur le téléphone", category: "Confection" },
  { key: "stock", icon: "stock", title: "Stock tissu", subtitle: "Rouleaux et mètres", category: "Confection", badge: "NOUVEAU", ownerOnly: true },
  { key: "inspiration", icon: "inspiration", title: "Inspiration", subtitle: "Modèles et idées", category: "Confection" },
  { key: "settings", icon: "settings", title: "Réglages", subtitle: "Identité et exports", category: "Atelier", ownerOnly: true },
  { key: "plan", icon: "plan", title: "Abonnement", subtitle: "Plan de l’atelier", category: "Atelier", ownerOnly: true },
  { key: "about", icon: "about", title: "À propos", subtitle: "Auteur & assistance", category: "Atelier" },
];

const CATEGORY_ORDER: ToolCategory[] = ["Piloter", "Confection", "Atelier"];

const CATEGORY_HINTS: Record<ToolCategory, string> = {
  Piloter: "Voir où en est l’atelier et faire avancer les clients.",
  Confection: "Les outils du quotidien pour coudre juste.",
  Atelier: "Configurer votre espace et récupérer vos données.",
};

const TITLES: Record<ToolView, { title: string; lead: string }> = {
  home: { title: "Plus d’options", lead: "Choisissez un outil de l’atelier" },
  statistics: { title: "Statistiques", lead: "" },
  guide: { title: "Guide des mesures", lead: "19 points de mesure expliqués pour la prise de mesure et l’apprentissage." },
  fabric: { title: "Calcul de tissu", lead: "Estimez le métrage à acheter selon la pièce, la taille et la laize du tissu." },
  photo: { title: "Mesure par photo", lead: "" },
  reminders: { title: "Rappels", lead: "Préparez tous vos messages du jour, puis envoyez-les sur WhatsApp." },
  stock: { title: "Stock tissu", lead: "Suivez vos rouleaux au mètre près, alertes de rupture incluses." },
  inspiration: { title: "Inspiration", lead: "Des idées de modèles, avec les mesures à réunir et les conseils de confection." },
  plan: { title: "Abonnement", lead: "" },
  settings: { title: "Réglages", lead: "Identité de l’atelier, exports et sauvegardes." },
  about: { title: "À propos", lead: "Qui a conçu AtelierPLUS et comment obtenir de l’aide." },
};

function readRecent(): ToolView[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ToolView => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function OptionsPanel({
  data,
  online,
  initialView = "home",
  onToast,
  onOpenTeam,
  onLogout,
  onUpdatedAtelier,
  onSelectGarment,
  onSaveInspirationModel,
  onDeleteInspirationModel,
  onShareOrder,
  onCreateFabric,
  onAdjustFabric,
}: {
  data: AtelierData;
  online: boolean;
  initialView?: ToolView;
  onToast: ToastFn;
  onOpenTeam: () => void;
  onLogout: () => void;
  onUpdatedAtelier: (atelier: { name: string; city: string | null }) => void;
  onSelectGarment?: (garmentValue: string, details?: ModelOrderDetails) => void;
  onSaveInspirationModel: (draft: InspirationModelDraft) => Promise<void>;
  onDeleteInspirationModel: (model: InspirationModel) => void;
  onShareOrder: (order: AtelierOrder, kind: "receipt" | "balance" | "ready") => void;
  onCreateFabric: () => void;
  onAdjustFabric: (fabric: Fabric, direction: "in" | "out") => void;
}) {
  const [view, setView] = useState<ToolView>(initialView);
  const [query, setQuery] = useState("");
  // Read once, lazily: localStorage is unavailable during server rendering.
  const [recent, setRecent] = useState<ToolView[]>(() =>
    typeof window === "undefined" ? [] : readRecent(),
  );
  const isOwner = data.user.role === "owner";
  const heading = TITLES[view];

  function open(next: ToolView) {
    setView(next);
    setQuery("");
    if (next === "home") return;
    setRecent((current) => {
      const updated = [next, ...current.filter((item) => item !== next)].slice(0, MAX_RECENT);
      try {
        window.localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
      } catch {
        // Storage blocked: recents stay in memory for this session.
      }
      return updated;
    });
  }

  const availableTiles = useMemo(() => TILES.filter((tile) => !tile.ownerOnly || isOwner), [isOwner]);
  const recentTiles = useMemo(
    () => recent.map((key) => availableTiles.find((tile) => tile.key === key)).filter((tile): tile is Tile => Boolean(tile)),
    [recent, availableTiles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    if (!needle) return availableTiles;
    return availableTiles.filter((tile) =>
      `${tile.title} ${tile.subtitle} ${tile.category}`.toLocaleLowerCase("fr").includes(needle),
    );
  }, [availableTiles, query]);

  if (view === "home") {
    return (
      <div className="tools-view">
        {recentTiles.length > 0 && (
          <section className="options-recent">
            <p className="options-section-label">
              <Glyph size={15}>{ICONS.clock}</Glyph> Reprendre où vous en étiez
            </p>
            <div className="options-recent-row">
              {recentTiles.map((tile) => (
                <button
                  type="button"
                  key={tile.key}
                  className="options-recent-chip"
                  onClick={() => (tile.key === "team" ? onOpenTeam() : open(tile.key))}
                >
                  <Glyph size={16}>{ICONS[tile.icon]}</Glyph>
                  {tile.title}
                </button>
              ))}
            </div>
          </section>
        )}

        <label className="options-search">
          <Glyph size={18}>{ICONS.search}</Glyph>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrer les outils (ex. tissu, reçu, stock…)"
            aria-label="Filtrer les outils"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Effacer">
              ✕
            </button>
          )}
        </label>

        {query && filtered.length === 0 && (
          <p className="options-empty">Aucun outil ne correspond à « {query} ».</p>
        )}

        {CATEGORY_ORDER.map((category) => {
          const tiles = filtered.filter((tile) => tile.category === category);
          if (tiles.length === 0) return null;
          return (
            <section key={category} className="options-category">
              <div className="options-category-head">
                <h3>{category}</h3>
                <p>{CATEGORY_HINTS[category]}</p>
              </div>
              <div className="tools-grid">
                {tiles.map((tile) => (
                  <button
                    type="button"
                    key={tile.key}
                    className={`tool-tile ${tile.featured ? "tool-tile-featured" : ""}`}
                    onClick={() => (tile.key === "team" ? onOpenTeam() : open(tile.key))}
                  >
                    <span className="tool-tile-icon">
                      <Glyph>{ICONS[tile.icon]}</Glyph>
                    </span>
                    <span className="tool-tile-text">
                      <strong>
                        {tile.title}
                        {tile.badge && <span className="tool-badge">{tile.badge}</span>}
                      </strong>
                      <small>{tile.subtitle}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>
          );
        })}

        <button type="button" className="tools-logout" onClick={onLogout}>
          <Glyph size={22}>{ICONS.logout}</Glyph>
          Se déconnecter
        </button>
      </div>
    );
  }

  return (
    <div className="tools-view">
      <button type="button" className="tool-back" onClick={() => open("home")}>
        <Glyph size={18}>{ICONS.back}</Glyph>
        Toutes les options
      </button>

      <div>
        <h3 className="tool-title">{heading.title}</h3>
        {heading.lead && <p className="tool-lead">{heading.lead}</p>}
      </div>

      {view === "statistics" && isOwner && <SectionErrorBoundary title="Statistiques"><StatisticsView data={data} /></SectionErrorBoundary>}
      {view === "guide" && <SectionErrorBoundary title="Guide des mesures"><MeasurementGuideView /></SectionErrorBoundary>}
      {view === "fabric" && <SectionErrorBoundary title="Calcul de tissu"><FabricCalculator /></SectionErrorBoundary>}
      {view === "photo" && <SectionErrorBoundary title="Mesure par photo"><PhotoMeasure /></SectionErrorBoundary>}
      {view === "reminders" && <SectionErrorBoundary title="Rappels"><RemindersView data={data} online={online} onToast={onToast} onShareOrder={onShareOrder} /></SectionErrorBoundary>}
      {view === "stock" && isOwner && (
        <SectionErrorBoundary title="Stock tissu">
          <StockView
            fabrics={data.fabrics ?? []}
            movements={data.fabricMovements ?? []}
            orders={data.orders}
            teamNamesById={new Map((data.teamNames ?? []).map((member) => [member.id, member.fullName]))}
            isOwner={isOwner}
            onCreate={onCreateFabric}
            onAdjust={onAdjustFabric}
          />
        </SectionErrorBoundary>
      )}
      {view === "inspiration" && (
        <SectionErrorBoundary title="Inspiration">
          <InspirationView
            customModels={data.inspirationModels ?? []}
            currentUserId={data.user.id}
            isOwner={isOwner}
            onSelectGarment={onSelectGarment}
            onSaveCustomModel={onSaveInspirationModel}
            onDeleteCustomModel={onDeleteInspirationModel}
          />
        </SectionErrorBoundary>
      )}
      {view === "about" && <AboutPanel userRole={data.user.role} />}
      {(view === "plan" || view === "settings") && isOwner && (
        <SectionErrorBoundary title={view === "plan" ? "Abonnement" : "Réglages"}>
          <PlanSettingsView data={data} online={online} onToast={onToast} onUpdated={onUpdatedAtelier} />
        </SectionErrorBoundary>
      )}

      {(view === "plan" || view === "settings" || view === "statistics" || view === "stock") && !isOwner && (
        <p className="photo-hint">Cet outil est réservé au compte patron de l’atelier.</p>
      )}
    </div>
  );
}
