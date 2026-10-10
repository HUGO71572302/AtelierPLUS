"use client";

import { useMemo, useState } from "react";
import type { Appointment, AtelierData, AtelierOrder } from "@/lib/atelier-types";
import { whatsappDigits } from "@/lib/countries";

type ToastFn = (message: string, kind?: "success" | "error" | "info") => void;

function money(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;
}

function localToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short" }).format(date);
}

/** Builds a wa.me link; falls back to contact-picker mode when the number is not international. */
function whatsappUrl(phone: string | null | undefined, text: string): string {
  return `https://wa.me/${whatsappDigits(phone) ?? ""}?text=${encodeURIComponent(text)}`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

type ReminderItem = {
  key: string;
  clientName: string;
  phone: string | null;
  detail: string;
  message: string;
};

/**
 * Bulk WhatsApp reminders prepared from live data: ready orders, unpaid balances
 * (owner only) and tomorrow's fittings. Copy works offline; sending needs network.
 */
export function RemindersView({
  data,
  online,
  onToast,
  onShareOrder,
}: {
  data: AtelierData;
  online: boolean;
  onToast: ToastFn;
  onShareOrder: (order: AtelierOrder, kind: "receipt" | "balance" | "ready") => void;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const isOwner = data.user.role === "owner";
  const workshop = data.user.atelierName || "notre atelier";

  const { ready, debtors, fittings } = useMemo(() => {
    const clientsById = new Map(data.clients.map((client) => [client.id, client]));
    const paidByOrder = new Map<string, number>();
    for (const payment of data.payments) {
      paidByOrder.set(payment.orderId, (paidByOrder.get(payment.orderId) ?? 0) + payment.amount);
    }

    const readyItems: (ReminderItem & { order: AtelierOrder })[] = data.orders
      .filter((order) => order.status === "ready")
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
      .map((order) => {
        const client = clientsById.get(order.clientId);
        const due = Math.max(0, (order.totalAmount ?? 0) - (paidByOrder.get(order.id) ?? 0));
        return {
          key: `ready-${order.id}`,
          clientName: client?.name ?? "Client",
          phone: client?.phone ?? null,
          detail: `#${order.orderNumber} · ${due > 0 && isOwner ? `reste ${money(due)}` : "prête à retirer"}`,
          message: `Bonjour ${client?.name ?? ""} ! 👋\n\nBonne nouvelle : votre commande #${order.orderNumber} est prête chez ${workshop}. 🎉\n${due > 0 && isOwner ? `Reste à régler au retrait : ${money(due)}.\n` : ""}\nÀ très vite ! ✂`,
          order,
        };
      });

    const debtorItems: (ReminderItem & { order: AtelierOrder })[] = [];
    if (isOwner) {
      const byClient = new Map<string, AtelierOrder[]>();
      for (const order of data.orders) {
        const due = (order.totalAmount ?? 0) - (paidByOrder.get(order.id) ?? 0);
        if (due > 0) {
          const list = byClient.get(order.clientId) ?? [];
          list.push(order);
          byClient.set(order.clientId, list);
        }
      }
      for (const [clientId, list] of byClient) {
        const client = clientsById.get(clientId);
        const oldest = [...list].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0];
        const total = list.reduce((sum, order) => sum + Math.max(0, (order.totalAmount ?? 0) - (paidByOrder.get(order.id) ?? 0)), 0);
        debtorItems.push({
          key: `due-${clientId}`,
          clientName: client?.name ?? "Client",
          phone: client?.phone ?? null,
          detail: `${list.length} commande${list.length === 1 ? "" : "s"} · total ${money(total)}`,
          message: `Bonjour ${client?.name ?? ""} ! 👋\n\nPetit rappel amical de ${workshop} : il reste ${money(total)} à régler sur votre commande ${oldest.orderNumber}.\n\nMerci beaucoup ! 🙏`,
          order: oldest,
        });
      }
      debtorItems.sort((a, b) => a.clientName.localeCompare(b.clientName, "fr"));
    }

    const today = localToday();
    const tomorrowDate = new Date(`${today}T12:00:00`);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = `${tomorrowDate.getFullYear()}-${String(tomorrowDate.getMonth() + 1).padStart(2, "0")}-${String(tomorrowDate.getDate()).padStart(2, "0")}`;
    const fittingItems: (ReminderItem & { appointment: Appointment })[] = (data.appointments ?? [])
      .filter((item) => item.status === "scheduled" && (item.date === today || item.date === tomorrow))
      .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""))
      .map((item) => {
        const client = clientsById.get(item.clientId);
        const when = item.date === today ? "aujourd’hui" : "demain";
        return {
          key: `appt-${item.id}`,
          clientName: client?.name ?? "Client",
          phone: client?.phone ?? null,
          detail: `${item.kind === "fitting" ? "Essayage" : item.kind === "delivery" ? "Livraison" : "Rendez-vous"} ${when}${item.time ? ` à ${item.time}` : ""}`,
          message: `Bonjour ${client?.name ?? ""} ! 👋\n\nRappel de ${workshop} : ${item.kind === "fitting" ? "votre essayage" : item.kind === "delivery" ? "la livraison de votre commande" : "votre rendez-vous"} est prévu ${when}${item.time ? ` à ${item.time}` : ""} (${shortDate(item.date)}).\n\nÀ très vite ! ✂`,
          appointment: item,
        };
      });

    return { ready: readyItems, debtors: debtorItems, fittings: fittingItems };
  }, [data, isOwner, workshop]);

  async function copyItem(item: ReminderItem) {
    const ok = await copyText(item.message);
    if (ok) {
      setCopiedKey(item.key);
      window.setTimeout(() => setCopiedKey((current) => (current === item.key ? null : current)), 2500);
      onToast("Message copié : collez-le dans WhatsApp.", "success");
    } else {
      onToast("Copie impossible sur cet appareil.", "error");
    }
  }

  async function copyAll(items: ReminderItem[], label: string) {
    if (items.length === 0) return;
    const combined = items
      .map((item, index) => `--- ${index + 1}/${items.length} · ${item.clientName} ---\n${item.message}`)
      .join("\n\n");
    const ok = await copyText(combined);
    onToast(
      ok ? `${items.length} message${items.length === 1 ? "" : "s"} ${label} copiés.` : "Copie impossible sur cet appareil.",
      ok ? "success" : "error",
    );
  }

  function renderSection(
    title: string,
    hint: string,
    items: ReminderItem[],
    emptyText: string,
    withDetailButton?: (item: ReminderItem & { order: AtelierOrder }) => void,
    isOrderSection?: boolean,
  ) {
    return (
      <section className="stat-block">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
          <div>
            <h3>
              {title} <span className="role-badge role-owner" style={{ marginLeft: 8 }}>{items.length}</span>
            </h3>
            <p>{hint}</p>
          </div>
          {items.length > 1 && (
            <button type="button" className="button button-light button-sm" onClick={() => void copyAll(items, title.toLowerCase())}>
              Tout copier ({items.length})
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="stat-note">{emptyText}</p>
        ) : (
          <div className="stat-rank">
            {items.map((item) => (
              <div className="stat-rank-row" key={item.key}>
                <span className="stat-rank-pos" aria-hidden="true">
                  {(item.clientName.charAt(0) || "?").toUpperCase()}
                </span>
                <div style={{ minWidth: 0 }}>
                  <b>{item.clientName}</b>
                  <small>{item.detail}</small>
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <button type="button" className="button button-light button-sm" onClick={() => void copyItem(item)}>
                    {copiedKey === item.key ? "Copié ✔" : "Copier"}
                  </button>
                  {online ? (
                    <a
                      className="button button-primary button-sm"
                      style={{ textDecoration: "none" }}
                      href={whatsappUrl(item.phone, item.message)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      WhatsApp
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="button button-light button-sm"
                      onClick={() => onToast("WhatsApp nécessite une connexion. Le message est copié en attendant.", "info")}
                    >
                      Hors-ligne
                    </button>
                  )}
                  {isOrderSection && withDetailButton && "order" in item && (
                    <button
                      type="button"
                      className="button button-quiet button-sm"
                      onClick={() => (withDetailButton as (value: ReminderItem & { order: AtelierOrder }) => void)(item as ReminderItem & { order: AtelierOrder })}
                      title="Ouvrir le reçu détaillé"
                    >
                      Reçu
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="tools-view">
      <p className="tool-lead">
        Préparez tous vos messages du jour en un seul endroit, puis envoyez-les sur WhatsApp un par un.
        La copie fonctionne même hors-ligne.
      </p>
      {!online && (
        <div className="photo-hint">
          <b>Mode hors-ligne.</b> Préparez et copiez vos messages maintenant ; l’envoi WhatsApp attendra le retour du réseau.
        </div>
      )}
      {renderSection(
        "Commandes prêtes",
        "Prévenez les clients que leur pièce les attend.",
        ready,
        "Aucune commande prête à annoncer. 🎉",
        (item) => onShareOrder(item.order, "ready"),
        true,
      )}
      {isOwner &&
        renderSection(
          "Soldes à relancer",
          "Un message par client, avec le total restant dû.",
          debtors,
          "Aucun solde en retard : tout est réglé. 🎉",
          (item) => onShareOrder(item.order, "balance"),
          true,
        )}
      {renderSection(
        "Rendez-vous d’aujourd’hui et demain",
        "Évitez les oublis : rappelez chaque essayage et livraison.",
        fittings,
        "Aucun rendez-vous aujourd’hui ni demain.",
      )}
    </div>
  );
}
