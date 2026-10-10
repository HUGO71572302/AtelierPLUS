"use client";

import { useMemo, useState } from "react";
import { APPOINTMENT_KINDS, APPOINTMENT_STATUSES } from "@/lib/atelier-types";
import type { Appointment, AppointmentStatus, AtelierOrder, Client } from "@/lib/atelier-types";

type AgendaFilter = "all" | "today" | "week" | "fitting" | "delivery" | "done";

function localToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const date = new Date(`${dateStr}T12:00:00`);
  date.setDate(date.getDate() + days);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function dayLabel(dateStr: string, today: string): string {
  if (dateStr === today) return "Aujourd’hui";
  if (dateStr === addDays(today, 1)) return "Demain";
  if (dateStr === addDays(today, -1)) return "Hier";
  const date = new Date(`${dateStr}T12:00:00`);
  const formatted = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function shortDay(dateStr: string): string {
  const date = new Date(`${dateStr}T12:00:00`);
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

function kindLabel(kind: string): string {
  return APPOINTMENT_KINDS.find((item) => item.value === kind)?.label ?? kind;
}

function statusLabel(status: AppointmentStatus): string {
  return APPOINTMENT_STATUSES.find((item) => item.value === status)?.label ?? status;
}

const KIND_ICONS: Record<string, string> = { fitting: "✂", delivery: "📦", other: "📌" };

/**
 * Day-by-day schedule of fittings and deliveries.
 * Members and owners share the same view; everything works from cached data.
 */
export function AgendaView({
  appointments,
  clients,
  orders,
  teamNamesById,
  activeCount,
  onCreate,
  onStatus,
  onRemind,
  onOpenClient,
  onOpenOrder,
}: {
  appointments: Appointment[];
  clients: Client[];
  orders: AtelierOrder[];
  teamNamesById: Map<string, string>;
  activeCount: number;
  onCreate: () => void;
  onStatus: (appointment: Appointment, status: AppointmentStatus) => void;
  onRemind: (appointment: Appointment) => void;
  onOpenClient: (clientId: string) => void;
  onOpenOrder: (order: AtelierOrder) => void;
}) {
  const [filter, setFilter] = useState<AgendaFilter>("all");
  const today = localToday();
  const weekEnd = addDays(today, 7);

  const clientsById = useMemo(() => new Map(clients.map((client) => [client.id, client])), [clients]);
  const ordersById = useMemo(() => new Map(orders.map((order) => [order.id, order])), [orders]);

  const overdue = useMemo(
    () =>
      appointments
        .filter((item) => item.status === "scheduled" && item.date < today)
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")),
    [appointments, today],
  );

  const visible = useMemo(() => {
    return appointments
      .filter((item) => {
        if (filter === "today") return item.date === today && item.status === "scheduled";
        if (filter === "week") return item.date >= today && item.date <= weekEnd && item.status === "scheduled";
        if (filter === "fitting") return item.kind === "fitting" && item.status === "scheduled";
        if (filter === "delivery") return item.kind === "delivery" && item.status === "scheduled";
        if (filter === "done") return item.status !== "scheduled";
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
  }, [appointments, filter, today, weekEnd]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Appointment[]>();
    for (const item of visible) {
      const list = groups.get(item.date) ?? [];
      list.push(item);
      groups.set(item.date, list);
    }
    return [...groups.entries()];
  }, [visible]);

  const counts = useMemo(
    () => ({
      today: appointments.filter((item) => item.date === today && item.status === "scheduled").length,
      week: appointments.filter((item) => item.date >= today && item.date <= weekEnd && item.status === "scheduled").length,
      fitting: appointments.filter((item) => item.kind === "fitting" && item.status === "scheduled").length,
      delivery: appointments.filter((item) => item.kind === "delivery" && item.status === "scheduled").length,
    }),
    [appointments, today, weekEnd],
  );

  function renderRow(item: Appointment) {
    const client = clientsById.get(item.clientId);
    const order = item.orderId ? ordersById.get(item.orderId) : undefined;
    const creator = item.createdBy ? teamNamesById.get(item.createdBy) : null;
    const isPast = item.date < today && item.status === "scheduled";
    return (
      <div key={item.id} className={`agenda-row ${item.status !== "scheduled" ? "agenda-row-done" : ""} ${isPast ? "agenda-row-overdue" : ""}`}>
        <div className="agenda-time">
          <b>{item.time ?? "—"}</b>
          <span className="agenda-kind">{KIND_ICONS[item.kind] ?? "📌"} {kindLabel(item.kind)}</span>
        </div>
        <div className="agenda-main">
          <button type="button" className="agenda-client" onClick={() => onOpenClient(item.clientId)} title="Ouvrir la fiche client">
            {client?.name ?? "Client"}
          </button>
          <span className="agenda-title">{item.title}</span>
          {order && (
            <button type="button" className="agenda-order-link" onClick={() => onOpenOrder(order)} title="Ouvrir la commande">
              {order.orderNumber.startsWith("LOCAL-") ? "Commande en cours d’envoi" : `#${order.orderNumber}`}
            </button>
          )}
          {item.notes && <small className="agenda-notes">{item.notes}</small>}
          {creator && <small className="agenda-creator">Noté par {creator}</small>}
        </div>
        <div className="agenda-side">
          <span className={`agenda-status agenda-status-${item.status}`}>{statusLabel(item.status)}</span>
          <div className="agenda-actions">
            {item.status === "scheduled" && (
              <>
                <button type="button" className="button button-light button-sm" onClick={() => onRemind(item)} title="Rappeler sur WhatsApp">
                  Rappeler
                </button>
                <button type="button" className="button button-light button-sm" onClick={() => onStatus(item, "done")}>
                  Terminé
                </button>
                <button type="button" className="button button-quiet button-sm" onClick={() => onStatus(item, "cancelled")}>
                  Annuler
                </button>
              </>
            )}
            {item.status !== "scheduled" && (
              <button type="button" className="button button-light button-sm" onClick={() => onStatus(item, "scheduled")}>
                Rouvrir
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="agenda-view">
      <div className="list-toolbar">
        <div>
          <div className="result-count">
            <b>{activeCount}</b> rendez-vous à venir
          </div>
          <small>Essayages, livraisons et rappels clients.</small>
        </div>
        <div className="filter-tabs" role="group" aria-label="Filtrer l’agenda">
          <button type="button" className={filter === "all" ? "filter-active" : ""} onClick={() => setFilter("all")}>
            Tous
          </button>
          <button type="button" className={filter === "today" ? "filter-active" : ""} onClick={() => setFilter("today")}>
            Aujourd’hui <span>{counts.today}</span>
          </button>
          <button type="button" className={filter === "week" ? "filter-active" : ""} onClick={() => setFilter("week")}>
            7 jours <span>{counts.week}</span>
          </button>
          <button type="button" className={filter === "fitting" ? "filter-active" : ""} onClick={() => setFilter("fitting")}>
            ✂ Essayages <span>{counts.fitting}</span>
          </button>
          <button type="button" className={filter === "delivery" ? "filter-active" : ""} onClick={() => setFilter("delivery")}>
            📦 Livraisons <span>{counts.delivery}</span>
          </button>
          <button type="button" className={filter === "done" ? "filter-active" : ""} onClick={() => setFilter("done")}>
            Terminés
          </button>
        </div>
      </div>

      {overdue.length > 0 && filter !== "done" && (
        <div className="agenda-overdue">
          <b>
            ⚠ {overdue.length} rendez-vous dépassé{overdue.length === 1 ? "" : "s"} : reprogrammez ou marquez terminé.
          </b>
          {overdue.slice(0, 3).map((item) => (
            <div key={item.id} className="agenda-overdue-row">
              <span>
                {clientsById.get(item.clientId)?.name ?? "Client"} · {shortDay(item.date)}
                {item.time ? ` à ${item.time}` : ""}
              </span>
              <button type="button" className="text-link" onClick={() => onStatus(item, "done")}>
                Marquer terminé
              </button>
            </div>
          ))}
        </div>
      )}

      {grouped.length === 0 ? (
        <div className="panel client-empty-panel">
          <div className="empty-state">
            <div className="empty-icon">📅</div>
            <h3>Aucun rendez-vous ici</h3>
            <p>
              {filter === "all"
                ? "Planifiez un essayage ou une livraison pour ne plus rien oublier."
                : "Changez de filtre pour voir le reste de l’agenda."}
            </p>
            {filter === "all" && (
              <button type="button" className="button button-primary" onClick={onCreate}>
                Planifier un rendez-vous
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="agenda-groups">
          {grouped.map(([date, items]) => (
            <section key={date} className="panel agenda-day">
              <header className="agenda-day-header">
                <h3>{dayLabel(date, today)}</h3>
                <span>
                  {items.length} rendez-vous{items.length === 1 ? "" : "x"}
                </span>
              </header>
              <div className="agenda-day-rows">{items.map(renderRow)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
