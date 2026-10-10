"use client";

import { useMemo } from "react";
import { GARMENT_TEMPLATES } from "@/lib/atelier-types";
import type { AtelierData, OrderStatus } from "@/lib/atelier-types";

function money(value: number) {
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value)} F CFA`;
}

function monthLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(date).replace(".", "");
}

function garmentName(value: string) {
  return GARMENT_TEMPLATES.find((item) => item.value === value)?.label ?? value;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "En attente",
  in_progress: "En cours",
  ready: "Prêtes",
  delivered: "Livrées",
};

/** Owner-only analytics computed from the workshop's own data. No external service. */
export function StatisticsView({ data }: { data: AtelierData }) {
  // Captured once per render so the memo below stays pure for React.
  const now = useMemo(() => new Date(), []);
  const nowTs = now.getTime();

  const stats = useMemo(() => {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const paidByOrder = new Map<string, number>();
    for (const payment of data.payments) {
      paidByOrder.set(payment.orderId, (paidByOrder.get(payment.orderId) ?? 0) + payment.amount);
    }

    const monthOrders = data.orders.filter((order) => new Date(order.createdAt) >= startOfMonth);
    const monthPayments = data.payments.filter((payment) => new Date(payment.paidAt) >= startOfMonth);
    const monthExpenses = data.expenses.filter((expense) => new Date(`${expense.date}T12:00:00`) >= startOfMonth);

    const revenue = monthOrders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
    const collected = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
    const spent = monthExpenses.reduce((sum, expense) => sum + expense.amount, 0);
    const outstanding = data.orders.reduce(
      (sum, order) => sum + Math.max(0, (order.totalAmount ?? 0) - (paidByOrder.get(order.id) ?? 0)),
      0,
    );

    // Six months of revenue and collections.
    const months: { label: string; revenue: number; collected: number }[] = [];
    for (let offset = 5; offset >= 0; offset -= 1) {
      const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const next = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
      const inMonth = data.orders.filter((order) => {
        const created = new Date(order.createdAt);
        return created >= cursor && created < next;
      });
      const paid = data.payments.filter((payment) => {
        const at = new Date(payment.paidAt);
        return at >= cursor && at < next;
      });
      months.push({
        label: monthLabel(cursor),
        revenue: inMonth.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0),
        collected: paid.reduce((sum, payment) => sum + payment.amount, 0),
      });
    }

    // Top clients by invoiced amount.
    const byClient = new Map<string, { name: string; orders: number; revenue: number; due: number }>();
    for (const order of data.orders) {
      const entry = byClient.get(order.clientId) ?? {
        name: data.clients.find((client) => client.id === order.clientId)?.name ?? "Client",
        orders: 0,
        revenue: 0,
        due: 0,
      };
      entry.orders += 1;
      entry.revenue += order.totalAmount ?? 0;
      entry.due += Math.max(0, (order.totalAmount ?? 0) - (paidByOrder.get(order.id) ?? 0));
      byClient.set(order.clientId, entry);
    }
    const topClients = [...byClient.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    // Garments most often ordered.
    const byGarment = new Map<string, { count: number; revenue: number }>();
    for (const order of data.orders) {
      const entry = byGarment.get(order.garment) ?? { count: 0, revenue: 0 };
      entry.count += 1;
      entry.revenue += order.totalAmount ?? 0;
      byGarment.set(order.garment, entry);
    }
    const garments = [...byGarment.entries()]
      .map(([key, entry]) => ({ label: garmentName(key), ...entry }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Expenses of the month by category.
    const byCategory = new Map<string, number>();
    for (const expense of monthExpenses) {
      byCategory.set(expense.category, (byCategory.get(expense.category) ?? 0) + expense.amount);
    }
    const categories = [...byCategory.entries()]
      .map(([label, amount]) => ({ label, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    const delivered = data.orders.filter((order) => order.status === "delivered").length;
    const late = data.orders.filter(
      (order) => order.dueDate && order.status !== "delivered" && new Date(`${order.dueDate}T23:59:59`).getTime() < nowTs,
    ).length;
    const averageOrder = monthOrders.length ? Math.round(revenue / monthOrders.length) : 0;

    return {
      monthCount: monthOrders.length,
      revenue,
      collected,
      spent,
      outstanding,
      months,
      topClients,
      garments,
      categories,
      delivered,
      late,
      averageOrder,
      statusCounts: (["pending", "in_progress", "ready", "delivered"] as OrderStatus[]).map((status) => ({
        status,
        count: data.orders.filter((order) => order.status === status).length,
      })),
    };
  }, [data, nowTs, now]);

  const maxMonth = Math.max(1, ...stats.months.map((month) => Math.max(month.revenue, month.collected)));
  const chartWidth = 620;
  const chartHeight = 210;
  const slot = chartWidth / stats.months.length;
  const barWidth = Math.min(30, slot * 0.3);

  return (
    <div className="tools-view">
      <p className="tool-lead">
        Les chiffres de votre atelier, calculés directement depuis vos commandes et vos paiements.
      </p>

      <div className="stat-kpis">
        <div className="stat-kpi stat-kpi-accent">
          <small>CHIFFRE D’AFFAIRES DU MOIS</small>
          <strong>{money(stats.revenue)}</strong>
          <span>{stats.monthCount} commande{stats.monthCount === 1 ? "" : "s"} enregistrée{stats.monthCount === 1 ? "" : "s"}</span>
        </div>
        <div className="stat-kpi">
          <small>ENCAISSÉ CE MOIS</small>
          <strong>{money(stats.collected)}</strong>
          <span>Depuis le début du mois</span>
        </div>
        <div className="stat-kpi">
          <small>RESTE À ENCAISSER</small>
          <strong>{money(stats.outstanding)}</strong>
          <span>Toutes commandes confondues</span>
        </div>
        <div className="stat-kpi">
          <small>PANIER MOYEN</small>
          <strong>{money(stats.averageOrder)}</strong>
          <span>Par commande ce mois-ci</span>
        </div>
      </div>

      <section className="stat-block">
        <h3>Activité des 6 derniers mois</h3>
        <p>Commandes facturées et montants réellement encaissés, mois par mois.</p>
        <svg className="stat-chart" viewBox={`0 0 ${chartWidth} ${chartHeight}`} role="img" aria-label="Histogramme du chiffre d’affaires">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
            <line key={ratio} x1={0} x2={chartWidth} y1={chartHeight - 30 - ratio * (chartHeight - 50)} y2={chartHeight - 30 - ratio * (chartHeight - 50)} stroke="#eee2d4" strokeWidth={1} />
          ))}
          {stats.months.map((month, index) => {
            const baseY = chartHeight - 30;
            const x = index * slot + slot / 2;
            const revenueHeight = (month.revenue / maxMonth) * (chartHeight - 60);
            const collectedHeight = (month.collected / maxMonth) * (chartHeight - 60);
            return (
              <g key={month.label}>
                <rect x={x - barWidth - 2} y={baseY - revenueHeight} width={barWidth} height={Math.max(2, revenueHeight)} rx={6} fill="#c9784c" />
                <rect x={x + 2} y={baseY - collectedHeight} width={barWidth} height={Math.max(2, collectedHeight)} rx={6} fill="#2f4438" />
                <text x={x} y={baseY + 20} textAnchor="middle" fontSize={15} fontWeight={800} fill="#7c6450">{month.label}</text>
              </g>
            );
          })}
        </svg>
        <div className="stat-legend">
          <span><i style={{ background: "#c9784c" }} />Commandes facturées</span>
          <span><i style={{ background: "#2f4438" }} />Encaissé</span>
        </div>
      </section>

      <div className="stat-block">
        <h3>Meilleurs clients</h3>
        <p>Classement par montant commandé depuis le début.</p>
        <div className="stat-rank">
          {stats.topClients.length === 0 && <p className="stat-note">Aucune commande enregistrée pour le moment.</p>}
          {stats.topClients.map((client, index) => (
            <div className="stat-rank-row" key={client.name}>
              <span className="stat-rank-pos">{index + 1}</span>
              <div>
                <b>{client.name}</b>
                <small>{client.orders} commande{client.orders === 1 ? "" : "s"}{client.due > 0 ? ` · reste ${money(client.due)}` : " · tout soldé"}</small>
              </div>
              <span className="stat-rank-value">{money(client.revenue)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-block">
        <h3>Vêtements les plus demandés</h3>
        <p>Les pièces qui font vivre votre atelier.</p>
        <div className="stat-bars">
          {stats.garments.length === 0 && <p className="stat-note">Créez une première commande pour voir apparaître vos spécialités.</p>}
          {stats.garments.map((garment) => (
            <div className="stat-bar-row" key={garment.label}>
              <span>{garment.label}</span>
              <div className="stat-bar-track">
                <div className="stat-bar-fill" style={{ width: `${(garment.count / (stats.garments[0]?.count || 1)) * 100}%` }} />
              </div>
              <span className="stat-bar-value">{garment.count} ×</span>
            </div>
          ))}
        </div>
      </div>

      <div className="stat-block">
        <h3>Répartition des commandes</h3>
        <p>Où en est votre production, à l’instant T.</p>
        <div className="stat-bars">
          {stats.statusCounts.map((entry) => (
            <div className="stat-bar-row" key={entry.status}>
              <span>{STATUS_LABELS[entry.status]}</span>
              <div className="stat-bar-track">
                <div
                  className="stat-bar-fill"
                  style={{
                    width: `${data.orders.length ? (entry.count / data.orders.length) * 100 : 0}%`,
                    background: entry.status === "delivered" ? "#2f4438" : undefined,
                  }}
                />
              </div>
              <span className="stat-bar-value">{entry.count}</span>
            </div>
          ))}
        </div>
        <p className="stat-note">
          <b>{stats.delivered}</b> commande{stats.delivered === 1 ? "" : "s"} livrée{stats.delivered === 1 ? "" : "s"} depuis le début.
          {stats.late > 0
            ? <> <b>{stats.late}</b> commande{stats.late === 1 ? "" : "s"} dépassent la date de livraison : à traiter en priorité.</>
            : <> Aucune livraison en retard. 🎉</>}
        </p>
      </div>

      {stats.categories.length > 0 && (
        <div className="stat-block">
          <h3>Dépenses du mois par catégorie</h3>
          <p>Pour comprendre où part l’argent de l’atelier.</p>
          <div className="stat-bars">
            {stats.categories.map((category) => (
              <div className="stat-bar-row" key={category.label}>
                <span>{category.label}</span>
                <div className="stat-bar-track">
                  <div
                    className="stat-bar-fill"
                    style={{
                      width: `${(category.amount / (stats.categories[0]?.amount || 1)) * 100}%`,
                      background: "linear-gradient(90deg, #a6876a, #7c5c3e)",
                    }}
                  />
                </div>
                <span className="stat-bar-value">{money(category.amount)}</span>
              </div>
            ))}
          </div>
          <p className="stat-note">
            Dépenses du mois : <b>{money(stats.spent)}</b> · Marge brute du mois :
            <b> {money(stats.collected - stats.spent)}</b> (encaissé moins dépenses).
          </p>
        </div>
      )}
    </div>
  );
}
