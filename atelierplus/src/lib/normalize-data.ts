import type { AtelierData } from "@/lib/atelier-types";

/**
 * The PWA can reopen a snapshot written by an older version of AtelierPLUS.
 * New V1 sections (agenda, stock, catalogue) did not exist in those snapshots.
 * Normalizing at this one boundary prevents a missing array from crashing a
 * section after an upgrade or while the app is offline.
 */
export function normalizeAtelierData(data: AtelierData): AtelierData {
  return {
    ...data,
    clients: Array.isArray(data.clients) ? data.clients : [],
    measurements: Array.isArray(data.measurements) ? data.measurements : [],
    orders: Array.isArray(data.orders) ? data.orders : [],
    payments: Array.isArray(data.payments) ? data.payments : [],
    expenses: Array.isArray(data.expenses) ? data.expenses : [],
    team: Array.isArray(data.team) ? data.team : [],
    teamNames: Array.isArray(data.teamNames) ? data.teamNames : [],
    appointments: Array.isArray(data.appointments) ? data.appointments : [],
    fabrics: Array.isArray(data.fabrics) ? data.fabrics : [],
    fabricMovements: Array.isArray(data.fabricMovements) ? data.fabricMovements : [],
    inspirationModels: Array.isArray(data.inspirationModels) ? data.inspirationModels : [],
  };
}
