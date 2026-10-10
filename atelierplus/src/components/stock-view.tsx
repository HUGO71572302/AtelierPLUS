"use client";

import { useMemo, useState } from "react";
import { cmToMetres, FABRIC_MOVEMENT_REASONS } from "@/lib/atelier-types";
import type { AtelierOrder, Fabric, FabricMovement } from "@/lib/atelier-types";

function money(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;
}

function fullDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(
    new Date(value),
  );
}

function reasonLabel(reason: string): string {
  return FABRIC_MOVEMENT_REASONS.find((item) => item.value === reason)?.label ?? reason;
}

/**
 * Fabric stock in metres. Owners manage it; members see quantities read-only.
 * All quantities are stored in centimetres and displayed in metres.
 */
export function StockView({
  fabrics,
  movements,
  orders,
  teamNamesById,
  isOwner,
  onCreate,
  onAdjust,
}: {
  fabrics: Fabric[];
  movements: FabricMovement[];
  orders: AtelierOrder[];
  teamNamesById: Map<string, string>;
  isOwner: boolean;
  onCreate: () => void;
  onAdjust: (fabric: Fabric, direction: "in" | "out") => void;
}) {
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("fr");
    const list = needle
      ? fabrics.filter((fabric) => `${fabric.name} ${fabric.color ?? ""}`.toLocaleLowerCase("fr").includes(needle))
      : fabrics;
    return [...list].sort((a, b) => {
      const aLow = a.quantityCm <= a.minThresholdCm ? 0 : 1;
      const bLow = b.quantityCm <= b.minThresholdCm ? 0 : 1;
      return aLow - bLow || a.name.localeCompare(b.name, "fr");
    });
  }, [fabrics, query]);

  const totals = useMemo(() => {
    const metres = fabrics.reduce((sum, fabric) => sum + fabric.quantityCm, 0) / 100;
    const value = fabrics.reduce((sum, fabric) => sum + ((fabric.quantityCm / 100) * (fabric.unitPrice ?? 0)), 0);
    const low = fabrics.filter((fabric) => fabric.quantityCm <= fabric.minThresholdCm).length;
    return { metres, value, low };
  }, [fabrics]);

  const selected = selectedId ? fabrics.find((fabric) => fabric.id === selectedId) : undefined;
  const selectedMovements = useMemo(() => {
    if (!selectedId) return [];
    return movements
      .filter((movement) => movement.fabricId === selectedId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 20);
  }, [movements, selectedId]);

  return (
    <div className="stock-view">
      <div className="stat-kpis">
        <div className="stat-kpi">
          <small>ROULEAUX SUIVIS</small>
          <strong>{fabrics.length}</strong>
          <span>Références au stock</span>
        </div>
        <div className="stat-kpi">
          <small>MÈTRES EN STOCK</small>
          <strong>{totals.metres.toFixed(1).replace(".", ",")} m</strong>
          <span>Tous tissus confondus</span>
        </div>
        <div className="stat-kpi">
          <small>ALERTES BASSE</small>
          <strong>{totals.low}</strong>
          <span>Sous le seuil fixé</span>
        </div>
        {isOwner && (
          <div className="stat-kpi stat-kpi-accent">
            <small>VALEUR DU STOCK</small>
            <strong>{money(Math.round(totals.value))}</strong>
            <span>D’après les prix d’achat</span>
          </div>
        )}
      </div>

      <div className="list-toolbar">
        <label className="search-box" style={{ width: "min(40vw, 360px)" }}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Chercher un tissu…"
            aria-label="Chercher un tissu"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Effacer">
              ✕
            </button>
          )}
        </label>
        {isOwner && (
          <button type="button" className="button button-primary" onClick={onCreate}>
            + Nouveau tissu
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="panel client-empty-panel">
          <div className="empty-state">
            <div className="empty-icon">🧵</div>
            <h3>{query ? "Aucun tissu trouvé" : "Le stock est vide"}</h3>
            <p>
              {query
                ? "Essayez un autre nom ou une autre couleur."
                : "Ajoutez vos rouleaux pour suivre les mètres disponibles et être alerté avant la rupture."}
            </p>
            {!query && isOwner && (
              <button type="button" className="button button-primary" onClick={onCreate}>
                Ajouter le premier tissu
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="stock-grid">
          {filtered.map((fabric) => {
            const low = fabric.quantityCm <= fabric.minThresholdCm;
            const capacity = Math.max(fabric.minThresholdCm * 3, fabric.quantityCm, 1);
            const ratio = Math.min(100, Math.round((fabric.quantityCm / capacity) * 100));
            return (
              <article key={fabric.id} className={`stock-card ${low ? "stock-card-low" : ""} ${selectedId === fabric.id ? "stock-card-open" : ""}`}>
                <button type="button" className="stock-card-main" onClick={() => setSelectedId(selectedId === fabric.id ? null : fabric.id)}>
                  <div className="stock-card-top">
                    <b>{fabric.name}</b>
                    {low && <span className="stock-alert">Stock bas</span>}
                  </div>
                  {fabric.color && <small className="stock-color">{fabric.color}</small>}
                  <strong className="stock-quantity">{cmToMetres(fabric.quantityCm)}</strong>
                  <div className="stat-bar-track" aria-hidden="true">
                    <div className="stat-bar-fill" style={{ width: `${ratio}%`, background: low ? "#cf6f45" : undefined }} />
                  </div>
                  <small className="stock-meta">
                    {fabric.widthCm ? `Laize ${fabric.widthCm} cm` : "Laize non renseignée"} · Seuil {cmToMetres(fabric.minThresholdCm)}
                  </small>
                  {isOwner && fabric.unitPrice !== null && fabric.unitPrice !== undefined && (
                    <small className="stock-meta">
                      {money(fabric.unitPrice)}/m · Valeur {money(Math.round((fabric.quantityCm / 100) * fabric.unitPrice))}
                    </small>
                  )}
                </button>
                {isOwner && (
                  <div className="stock-card-actions">
                    <button type="button" className="button button-light button-sm" onClick={() => onAdjust(fabric, "in")}>
                      + Entrée
                    </button>
                    <button type="button" className="button button-light button-sm" onClick={() => onAdjust(fabric, "out")}>
                      − Sortie
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      {selected && (
        <section className="panel stock-history">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">HISTORIQUE</p>
              <h2>{selected.name}</h2>
            </div>
            <button type="button" className="text-link" onClick={() => setSelectedId(null)}>
              Fermer
            </button>
          </div>
          {selectedMovements.length === 0 ? (
            <p className="stat-note" style={{ margin: "0 19px 19px" }}>
              Aucun mouvement enregistré pour ce tissu. Les entrées et sorties apparaîtront ici.
            </p>
          ) : (
            <div className="stock-history-list">
              {selectedMovements.map((movement) => {
                const order = movement.orderId ? ordersById.get(movement.orderId) : undefined;
                const who = movement.createdBy ? teamNamesById.get(movement.createdBy) : null;
                return (
                  <div key={movement.id} className="stock-history-row">
                    <span className={`stock-delta ${movement.deltaCm > 0 ? "stock-delta-in" : "stock-delta-out"}`}>
                      {movement.deltaCm > 0 ? "+" : "−"}{cmToMetres(Math.abs(movement.deltaCm))}
                    </span>
                    <div>
                      <b>{reasonLabel(movement.reason)}</b>
                      <small>
                        {fullDate(movement.createdAt)}
                        {order ? ` · ${order.orderNumber}` : ""}
                        {who ? ` · par ${who}` : ""}
                        {movement.note ? ` · ${movement.note}` : ""}
                      </small>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
