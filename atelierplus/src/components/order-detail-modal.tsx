"use client";

import { useMemo, useState } from "react";
import { usePrint } from "@/components/print/print-document";
import { GARMENT_TEMPLATES, MEASUREMENT_CATALOG, ORDER_STATUSES } from "@/lib/atelier-types";
import type { AtelierOrder, Client, Payment, OrderStatus } from "@/lib/atelier-types";

function money(amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(amount)} F CFA`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "À définir";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "À définir" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function fullDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" }).format(date);
}

function garmentName(value: string) {
  return GARMENT_TEMPLATES.find((item) => item.value === value)?.label ?? value;
}

export function OrderDetailView({
  order,
  client,
  latestMeasurements,
  payments,
  isOwner,
  online,
  onStatusChange,
  onAddPayment,
  onShare,
  onOpenClient,
  onPlanDelivery,
  nameOf,
}: {
  order: AtelierOrder;
  client?: Client;
  latestMeasurements: Record<string, number>;
  payments: Payment[];
  isOwner: boolean;
  online: boolean;
  onStatusChange: (order: AtelierOrder, nextStatus: OrderStatus) => Promise<void>;
  onAddPayment: (order: AtelierOrder) => void;
  onShare: (order: AtelierOrder, kind: "receipt" | "balance" | "ready") => void;
  onOpenClient: (clientId: string) => void;
  /** Opens the agenda form prefilled with this order's delivery. */
  onPlanDelivery?: (order: AtelierOrder) => void;
  /** Resolves a user id to a display name for the "who did what" trace. */
  nameOf?: (userId: string | null) => string | null;
}) {
  const [updating, setUpdating] = useState(false);
  const { print: printDocument } = usePrint();

  const selectedTemplate = useMemo(() => {
    return GARMENT_TEMPLATES.find((t) => t.value === order.garment) ?? GARMENT_TEMPLATES[0];
  }, [order.garment]);

  const relevantCodes = useMemo(() => {
    return [...selectedTemplate.required, ...selectedTemplate.optional];
  }, [selectedTemplate]);

  const paidAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + p.amount, 0);
  }, [payments]);

  const total = order.totalAmount ?? 0;
  const balance = Math.max(0, total - paidAmount);
  const percentPaid = total > 0 ? Math.min(100, Math.round((paidAmount / total) * 100)) : 100;

  async function handleStepClick(status: OrderStatus) {
    if (status === order.status || updating) return;
    setUpdating(true);
    try {
      await onStatusChange(order, status);
    } finally {
      setUpdating(false);
    }
  }

  const orderNumLabel = order.orderNumber.startsWith("LOCAL-") ? "En cours de synchronisation" : `#${order.orderNumber}`;

  return (
    <div className="order-sheet-layout">
      {/* Top Banner & Stepper */}
      <div className="order-sheet-header">
        <div className="order-sheet-top-row">
          <div>
            <span className="order-sheet-code">{orderNumLabel}</span>
            <h3 className="order-sheet-title">{garmentName(order.garment)}</h3>
            <p className="order-sheet-meta">
              Créée{` le ${fullDate(order.createdAt)}`}
              {nameOf?.(order.createdBy) ? ` par ${nameOf(order.createdBy)}` : ""}
              {` · ${order.fabricSource === "atelier" ? "Tissu fourni par l’atelier" : "Tissu fourni par le client"}`}
            </p>
            {nameOf?.(order.updatedBy) && (
              <p className="order-sheet-trace">
                Dernière modification par {nameOf(order.updatedBy)} le {fullDate(order.updatedAt)}
              </p>
            )}
          </div>
          {client && (
            <button
              type="button"
              className="order-client-chip"
              onClick={() => onOpenClient(client.id)}
              title="Voir la fiche client"
            >
              <div className="avatar avatar-small">{client.name.charAt(0)}</div>
              <div>
                <strong>{client.name}</strong>
                <small>{client.phone || "Pas de numéro"}</small>
              </div>
            </button>
          )}
        </div>

        {/* 4-Step Interactive Status Timeline */}
        <div className="status-stepper" role="group" aria-label="Étapes de la commande">
          {ORDER_STATUSES.map((statusItem, idx) => {
            const currentIdx = ORDER_STATUSES.findIndex((s) => s.value === order.status);
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            return (
              <button
                type="button"
                key={statusItem.value}
                className={`step-btn ${isCurrent ? "step-current" : isCompleted ? "step-completed" : "step-pending"}`}
                onClick={() => void handleStepClick(statusItem.value)}
                disabled={updating}
                title={`Changer d'étape vers : ${statusItem.label}`}
              >
                <span className="step-circle">
                  {isCompleted ? "✔" : idx + 1}
                </span>
                <span className="step-label">{statusItem.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Financial & Due Date Strip (Patron sees finances, Member sees dates) */}
      <div className="order-sheet-strip">
        <div className="sheet-strip-item">
          <small>LIVRAISON PRÉVUE</small>
          <strong>{shortDate(order.dueDate)}</strong>
          <span>{order.dueDate ? fullDate(order.dueDate) : "Non renseignée"}</span>
        </div>
        {isOwner && (
          <>
            <div className="sheet-strip-item">
              <small>PRIX CONVENU</small>
              <strong className="text-dark">{money(order.totalAmount)}</strong>
              <span>Payé à {percentPaid}%</span>
            </div>
            <div className="sheet-strip-item">
              <small>ENCAISSÉ</small>
              <strong className="text-green">{money(paidAmount)}</strong>
              <span>{payments.length} paiement{payments.length === 1 ? "" : "s"}</span>
            </div>
            <div className="sheet-strip-item">
              <small>RESTE À PAYER</small>
              <strong className={balance > 0 ? "text-due" : "text-settled"}>
                {balance > 0 ? money(balance) : "✔ Soldée"}
              </strong>
              <span>{balance > 0 ? "À solder au retrait" : "Tout est réglé"}</span>
            </div>
          </>
        )}
      </div>

      {/* Progress Bar for Payments */}
      {isOwner && total > 0 && (
        <div className="payment-progress-wrap">
          <div className="payment-progress-bar">
            <div className="payment-progress-fill" style={{ width: `${percentPaid}%` }} />
          </div>
        </div>
      )}

      {/* Confection & Cutting Table (Base Measurements + Adjustments = Final Cut) */}
      <div className="confection-section">
        <div className="section-head">
          <div>
            <h4>Fiche de coupe & Mensurations</h4>
            <p>Calcul automatique : Mesure de base + Ajustement de la commande = <b>Cote finale</b></p>
          </div>
        </div>

        {relevantCodes.length > 0 ? (
          <div className="confection-table-wrap">
            <table className="confection-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Désignation</th>
                  <th>Mesure de base</th>
                  <th>Ajustement commande</th>
                  <th className="text-right">Cote finale de coupe</th>
                </tr>
              </thead>
              <tbody>
                {relevantCodes.map((code) => {
                  const definition = MEASUREMENT_CATALOG.find((m) => m.code === code);
                  const baseVal = latestMeasurements[code];
                  const adjustment = order.adjustments[code] ?? 0;
                  const finalVal = baseVal !== undefined ? Math.round((baseVal + adjustment) * 10) / 10 : undefined;
                  const isRequired = selectedTemplate.required.includes(code as never);

                  return (
                    <tr key={code} className={isRequired ? "row-required" : ""}>
                      <td>
                        <span className="code-badge">{code}</span>
                      </td>
                      <td>
                        <strong>{definition?.name || code}</strong>
                        {isRequired && <span className="required-tag">Requis</span>}
                      </td>
                      <td>{baseVal !== undefined ? `${baseVal} cm` : <em className="text-muted">Non relevée</em>}</td>
                      <td>
                        {adjustment !== 0 ? (
                          <span className={adjustment > 0 ? "adj-plus" : "adj-minus"}>
                            {adjustment > 0 ? `+${adjustment}` : adjustment} cm
                          </span>
                        ) : (
                          <span className="text-muted">0 cm</span>
                        )}
                      </td>
                      <td className="text-right">
                        {finalVal !== undefined ? (
                          <strong className="final-cut-val">{finalVal} cm</strong>
                        ) : (
                          <em className="text-muted">—</em>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="no-data-notice">Aucune mesure spécifique pour ce vêtement.</p>
        )}
      </div>

      {/* Model & Notes */}
      {(order.model || order.notes) && (
        <div className="order-notes-box">
          {order.model && (
            <p>
              <b>Modèle / Détails demandés :</b> {order.model}
            </p>
          )}
          {order.notes && (
            <p>
              <b>Consignes pour l’atelier :</b> {order.notes}
            </p>
          )}
        </div>
      )}

      {/* Payment Ledger (Visible by Owner) */}
      {isOwner && (
        <div className="payment-history-section">
          <div className="section-head">
            <h4>Historique des paiements ({payments.length})</h4>
            <button
              type="button"
              className="button button-light button-sm"
              onClick={() => onAddPayment(order)}
            >
              + Ajouter un acompte
            </button>
          </div>
          {payments.length > 0 ? (
            <div className="payment-ledger-list">
              {payments.map((p) => (
                <div key={p.id} className="payment-ledger-row">
                  <span className="ledger-icon">💳</span>
                  <div className="ledger-details">
                    <strong>{money(p.amount)}</strong>
                    <small>
                      {p.note || "Acompte"} · {fullDate(p.paidAt)}
                      {nameOf?.(p.createdBy) ? ` · par ${nameOf(p.createdBy)}` : ""}
                    </small>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-data-notice">Aucun acompte n’a encore été enregistré sur cette commande.</p>
          )}
        </div>
      )}

      {/* Action Bar */}
      <div className="order-sheet-actions">
        {isOwner && (
          <button
            type="button"
            className="button button-primary"
            onClick={() => onShare(order, "receipt")}
          >
            📋 Reçu de commande
          </button>
        )}
        {isOwner && balance > 0 && (
          <button
            type="button"
            className="button button-light"
            onClick={() => onShare(order, "balance")}
          >
            🔔 Rappel WhatsApp
          </button>
        )}
        <button
          type="button"
          className="button button-light"
          onClick={() => onShare(order, "ready")}
        >
          ✂ Commande prête
        </button>
        {onPlanDelivery && (
          <button
            type="button"
            className="button button-light"
            onClick={() => onPlanDelivery(order)}
          >
            📅 Planifier la livraison
          </button>
        )}
        <button
          type="button"
          className="button button-light"
          onClick={() =>
            printDocument({
              title: `Fiche de coupe · Commande ${order.orderNumber.startsWith("LOCAL-") ? "" : "#"}${order.orderNumber}`,
              subtitle: `${garmentName(order.garment)}${client ? ` · ${client.name}` : ""}`,
              meta: `Créée${nameOf?.(order.createdBy) ? ` par ${nameOf(order.createdBy)}` : ""} le ${fullDate(order.createdAt)}`,
              body: (
                <>
                  {relevantCodes.filter((code) => latestMeasurements[code] !== undefined).length > 0 && (
                    <table className="print-table">
                      <thead>
                        <tr><th>Mesure</th><th>Base</th><th>Ajustement</th><th>Cote finale</th></tr>
                      </thead>
                      <tbody>
                        {relevantCodes
                          .filter((code) => latestMeasurements[code] !== undefined)
                          .map((code) => {
                            const definition = MEASUREMENT_CATALOG.find((item) => item.code === code);
                            const base = latestMeasurements[code];
                            const adjustment = order.adjustments[code] ?? 0;
                            return (
                              <tr key={code}>
                                <td>{code} — {definition?.name ?? code}</td>
                                <td>{base} cm</td>
                                <td>{adjustment !== 0 ? `${adjustment > 0 ? "+" : "−"}${Math.abs(adjustment)} cm` : "—"}</td>
                                <td className="print-strong">{(base + adjustment).toFixed(1).replace(".", ",")} cm</td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  )}
                  {order.model && <p className="print-line"><b>Modèle :</b> {order.model}</p>}
                  {order.notes && <p className="print-line"><b>Consignes :</b> {order.notes}</p>}
                </>
              ),
            })
          }
        >
          🖨 Imprimer la fiche
        </button>
      </div>
    </div>
  );
}
