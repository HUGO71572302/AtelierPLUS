"use client";

import { useState } from "react";
import type { AtelierData } from "@/lib/atelier-types";
import { apiFetch } from "@/lib/api-client";
import { usePrint } from "@/components/print/print-document";

type ToastFn = (message: string, kind?: "success" | "error" | "info") => void;

function download(content: string, fileName: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvEscape(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[";\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[], headers: string[]) {
  return [headers.join(";"), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(";"))].join("\n");
}

function today() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

/**
 * Patron tools: workshop identity, plan overview and data exports (JSON + CSV).
 * All exports are built in the browser from data already loaded in memory.
 */
export function PlanSettingsView({
  data,
  online,
  onToast,
  onUpdated,
}: {
  data: AtelierData;
  online: boolean;
  onToast: ToastFn;
  onUpdated: (atelier: { name: string; city: string | null }) => void;
}) {
  const [name, setName] = useState(data.user.atelierName ?? "");
  const [city, setCity] = useState(data.user.atelierCity ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { print: printDocument } = usePrint();

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length < 2) return;
    setSaving(true);
    setError("");
    try {
      const response = await apiFetch("/api/atelier", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), city: city.trim() || null }),
      });
      const result = (await response.json()) as {
        atelier?: { name: string; city: string | null };
        error?: string;
      };
      if (!response.ok || !result.atelier) {
        setError(result.error ?? "Modification impossible.");
        return;
      }
      onUpdated({ name: result.atelier.name, city: result.atelier.city });
      onToast("Profil de l’atelier mis à jour.", "success");
    } catch {
      setError("Connexion impossible pour le moment.");
    } finally {
      setSaving(false);
    }
  }

  function exportJson() {
    const backup = {
      application: "AtelierPLUS",
      format: "atelierplus-backup-v2",
      exportedAt: new Date().toISOString(),
      atelier: { name: data.user.atelierName, city: data.user.atelierCity },
      user: data.user,
      clients: data.clients,
      measurements: data.measurements,
      orders: data.orders,
      payments: data.payments,
      expenses: data.expenses,
      team: data.team,
      appointments: data.appointments ?? [],
      fabrics: data.fabrics ?? [],
      fabricMovements: data.fabricMovements ?? [],
      inspirationModels: data.inspirationModels ?? [],
    };
    download(JSON.stringify(backup, null, 2), `atelierplus-sauvegarde-${today()}.json`, "application/json;charset=utf-8");
    onToast("Sauvegarde JSON téléchargée.", "success");
  }

  function exportClientsCsv() {
    const rows = data.clients.map((client) => ({
      nom: client.name,
      telephone: client.phone ?? "",
      genre: client.gender ?? "",
      notes: client.notes ?? "",
      cree_le: client.createdAt,
    }));
    download(`\uFEFF${toCsv(rows, ["nom", "telephone", "genre", "notes", "cree_le"])}`, `clients-${today()}.csv`, "text/csv;charset=utf-8");
    onToast("Liste des clients exportée (CSV).", "success");
  }

  function exportOrdersCsv() {
    const paidByOrder = new Map<string, number>();
    for (const payment of data.payments) {
      paidByOrder.set(payment.orderId, (paidByOrder.get(payment.orderId) ?? 0) + payment.amount);
    }
    const rows = data.orders.map((order) => ({
      numero: order.orderNumber,
      client: data.clients.find((client) => client.id === order.clientId)?.name ?? "",
      vetement: order.garment,
      statut: order.status,
      prix: order.totalAmount ?? 0,
      recu: paidByOrder.get(order.id) ?? 0,
      reste: Math.max(0, (order.totalAmount ?? 0) - (paidByOrder.get(order.id) ?? 0)),
      livraison: order.dueDate ?? "",
      cree_le: order.createdAt,
    }));
    download(
      `\uFEFF${toCsv(rows, ["numero", "client", "vetement", "statut", "prix", "recu", "reste", "livraison", "cree_le"])}`,
      `commandes-${today()}.csv`,
      "text/csv;charset=utf-8",
    );
    onToast("Carnet de commandes exporté (CSV).", "success");
  }

  function exportAgendaCsv() {
    const rows = (data.appointments ?? []).map((item) => ({
      date: item.date,
      heure: item.time ?? "",
      type: item.kind,
      client: data.clients.find((client) => client.id === item.clientId)?.name ?? "",
      titre: item.title,
      statut: item.status,
      notes: item.notes ?? "",
    }));
    download(
      `\uFEFF${toCsv(rows, ["date", "heure", "type", "client", "titre", "statut", "notes"])}`,
      `agenda-${today()}.csv`,
      "text/csv;charset=utf-8",
    );
    onToast("Agenda exporté (CSV).", "success");
  }

  function exportStockCsv() {
    const rows = (data.fabrics ?? []).map((fabric) => ({
      tissu: fabric.name,
      couleur: fabric.color ?? "",
      laize_cm: fabric.widthCm ?? "",
      stock_m: ((fabric.quantityCm ?? 0) / 100).toFixed(2),
      seuil_m: ((fabric.minThresholdCm ?? 0) / 100).toFixed(2),
      prix_m: fabric.unitPrice ?? "",
      notes: fabric.notes ?? "",
    }));
    download(
      `\uFEFF${toCsv(rows, ["tissu", "couleur", "laize_cm", "stock_m", "seuil_m", "prix_m", "notes"])}`,
      `stock-tissu-${today()}.csv`,
      "text/csv;charset=utf-8",
    );
    onToast("Stock tissu exporté (CSV).", "success");
  }

  /** Multi-sheet Excel workbook without any dependency: Excel opens HTML tables natively. */
  function exportWorkbook() {
    const esc = (value: unknown) =>
      String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const paidByOrder = new Map<string, number>();
    for (const payment of data.payments) {
      paidByOrder.set(payment.orderId, (paidByOrder.get(payment.orderId) ?? 0) + payment.amount);
    }
    const sheet = (name: string, headers: string[], rows: string[][]) => `
      <h2>${esc(name)}</h2>
      <table border="1" cellspacing="0" cellpadding="4">
        <tr>${headers.map((header) => `<th style="background:#2f4438;color:#ffffff">${esc(header)}</th>`).join("")}</tr>
        ${rows.map((row) => `<tr>${row.map((cell) => `<td>${esc(cell)}</td>`).join("")}</tr>`).join("")}
      </table><br/>`;
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"/></head><body>
      <h1>${esc(data.user.atelierName ?? "AtelierPLUS")} — ${today()}</h1>
      ${sheet("Clients", ["Nom", "Téléphone", "Genre"], data.clients.map((client) => [client.name, client.phone ?? "", client.gender ?? ""]))}
      ${sheet(
        "Commandes",
        ["N°", "Client", "Vêtement", "Statut", "Prix", "Reçu", "Reste", "Livraison"],
        data.orders.map((order) => {
          const paid = paidByOrder.get(order.id) ?? 0;
          return [
            order.orderNumber,
            data.clients.find((client) => client.id === order.clientId)?.name ?? "",
            order.garment,
            order.status,
            String(order.totalAmount ?? 0),
            String(paid),
            String(Math.max(0, (order.totalAmount ?? 0) - paid)),
            order.dueDate ?? "",
          ];
        }),
      )}
      ${sheet(
        "Agenda",
        ["Date", "Heure", "Type", "Client", "Titre", "Statut"],
        (data.appointments ?? []).map((item) => [
          item.date,
          item.time ?? "",
          item.kind,
          data.clients.find((client) => client.id === item.clientId)?.name ?? "",
          item.title,
          item.status,
        ]),
      )}
      ${sheet(
        "Stock tissu",
        ["Tissu", "Couleur", "Stock (m)", "Seuil (m)", "Prix/m"],
        (data.fabrics ?? []).map((fabric) => [
          fabric.name,
          fabric.color ?? "",
          ((fabric.quantityCm ?? 0) / 100).toFixed(2),
          ((fabric.minThresholdCm ?? 0) / 100).toFixed(2),
          fabric.unitPrice !== null && fabric.unitPrice !== undefined ? String(fabric.unitPrice) : "",
        ]),
      )}
    </body></html>`;
    download(html, `atelier-${today()}.xls`, "application/vnd.ms-excel;charset=utf-8");
    onToast("Classeur Excel téléchargé.", "success");
  }

  /** Printable day sheet: today's appointments and low stock, via the print portal. */
  function printDaySheet() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const todayValue = new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
    const dayItems = (data.appointments ?? [])
      .filter((item) => item.status === "scheduled" && item.date === todayValue)
      .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
    const lowFabrics = (data.fabrics ?? []).filter((fabric) => fabric.quantityCm <= fabric.minThresholdCm);

    printDocument({
      title: `Fiche du jour — ${todayValue}`,
      subtitle: data.user.atelierName ?? "Atelier",
      meta: `${dayItems.length} rendez-vous · ${lowFabrics.length} tissu(s) en alerte`,
      body: (
        <>
          <h2 className="print-h2">Rendez-vous du jour</h2>
          <table className="print-table">
            <thead>
              <tr><th>Heure</th><th>Client</th><th>Type</th><th>Détail</th></tr>
            </thead>
            <tbody>
              {dayItems.length ? (
                dayItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.time ?? "—"}</td>
                    <td>{data.clients.find((client) => client.id === item.clientId)?.name ?? ""}</td>
                    <td>{item.kind === "fitting" ? "Essayage" : item.kind === "delivery" ? "Livraison" : "RDV"}</td>
                    <td>{item.title}</td>
                  </tr>
                ))
              ) : (
                <tr><td>—</td><td>Aucun rendez-vous prévu</td><td /><td /></tr>
              )}
            </tbody>
          </table>

          <h2 className="print-h2">Stock à surveiller</h2>
          <table className="print-table">
            <thead>
              <tr><th>Tissu</th><th>Stock</th><th>Seuil</th></tr>
            </thead>
            <tbody>
              {lowFabrics.length ? (
                lowFabrics.map((fabric) => (
                  <tr key={fabric.id}>
                    <td>{fabric.name}</td>
                    <td>{((fabric.quantityCm ?? 0) / 100).toFixed(2).replace(".", ",")} m</td>
                    <td>{((fabric.minThresholdCm ?? 0) / 100).toFixed(2).replace(".", ",")} m</td>
                  </tr>
                ))
              ) : (
                <tr><td>Aucune alerte</td><td /><td /></tr>
              )}
            </tbody>
          </table>
        </>
      ),
    });
  }

  return (
    <div className="tools-view">
      <div className="plan-card">
        <small>PLAN ACTUEL</small>
        <h3>Gratuit — période de lancement</h3>
        <p>
          Toutes les fonctionnalités sont accessibles pendant la phase de lancement. Certaines options deviendront
          payantes plus tard ; vous serez prévenu avant tout changement.
        </p>
        <div className="plan-usage">
          <div><small>CLIENTS</small><b>{data.clients.length}</b></div>
          <div><small>COMMANDES</small><b>{data.orders.length}</b></div>
          <div><small>ÉQUIPE</small><b>{data.team.length}</b></div>
          <div><small>DÉPENSES</small><b>{data.expenses.length}</b></div>
        </div>
      </div>

      <div className="stat-block">
        <h3>Identité de l’atelier</h3>
        <p>Ces informations apparaissent sur vos reçus et fiches de coupe.</p>
        <form className="app-form" onSubmit={saveProfile}>
          <label className="field-label">
            Nom de l’atelier
            <input value={name} onChange={(event) => setName(event.target.value)} required minLength={2} disabled={saving} />
          </label>
          <label className="field-label">
            Ville ou quartier
            <input
              value={city ?? ""}
              onChange={(event) => setCity(event.target.value)}
              placeholder="Ex. Kara, Ouagadougou, Dakar"
              disabled={saving}
            />
            <small className="field-hint">Facultatif. Affiché en entête de votre espace.</small>
          </label>
          {error && <p className="recover-error" role="alert">{error}</p>}
          {!online && <p className="recover-error">La modification de l’identité nécessite une connexion internet.</p>}
          <button type="submit" className="button button-primary" disabled={saving || !online || name.trim().length < 2}>
            {saving ? "Enregistrement…" : "Enregistrer l’identité"}
          </button>
        </form>
      </div>

      <div className="stat-block">
        <h3>Exports et sauvegardes</h3>
        <p>
          Récupérez vos données à tout moment. Le JSON contient tout l’atelier ; les CSV s’ouvrent dans un tableur.
        </p>
        <div className="settings-row">
          <button type="button" className="button button-primary" onClick={exportJson}>
            Sauvegarde complète (JSON)
          </button>
          <button type="button" className="button button-primary" onClick={exportWorkbook}>
            Classeur Excel (.xls)
          </button>
          <button type="button" className="button button-light" onClick={exportClientsCsv}>
            Clients (CSV)
          </button>
          <button type="button" className="button button-light" onClick={exportOrdersCsv}>
            Commandes (CSV)
          </button>
          <button type="button" className="button button-light" onClick={exportAgendaCsv}>
            Agenda (CSV)
          </button>
          <button type="button" className="button button-light" onClick={exportStockCsv}>
            Stock (CSV)
          </button>
          <button type="button" className="button button-light" onClick={printDaySheet}>
            Imprimer la fiche du jour
          </button>
        </div>
      </div>

      <div className="stat-block">
        <h3>Hors-ligne et synchronisation</h3>
        <p>
          AtelierPLUS fonctionne sans internet : vos saisies sont gardées sur l’appareil puis envoyées au serveur
          dès que la connexion revient.
        </p>
        <div className="plan-usage" style={{ marginTop: 0 }}>
          <div style={{ background: "#f5ece1" }}>
            <small style={{ color: "#7c6450" }}>ÉTAT</small>
            <b style={{ color: "#2b1c12" }}>{online ? "En ligne" : "Hors-ligne"}</b>
          </div>
          <div style={{ background: "#f5ece1" }}>
            <small style={{ color: "#7c6450" }}>SAISIES À ENVOYER</small>
            <b style={{ color: "#2b1c12" }}>{data.orders.length + data.clients.length}</b>
          </div>
        </div>
        <p className="stat-note">
          <b>Conseil :</b> exportez une sauvegarde JSON une fois par semaine. Elle vous protège en cas de téléphone
          perdu ou de manipulation imprévue.
        </p>
      </div>
    </div>
  );
}
