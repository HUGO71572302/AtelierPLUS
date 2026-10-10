"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { RecoveryCodeCard } from "@/components/recovery-code-card";

type ResetRequest = {
  id: string;
  fullName: string;
  phone: string;
  createdAt: string;
  codeExpiresAt: string | null;
  codeActive: boolean;
};

type GeneratedCode = { requestId: string; code: string; expiresAt: string };

type ToastFn = (message: string, kind?: "success" | "error" | "info") => void;

function clock(value: string): string {
  return new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

/**
 * Patron only. Two jobs:
 *  1. Give a 6-digit code to each member who forgot their password.
 *  2. Create or replace the patron's own personal recovery code.
 */
export function TeamSecurityPanel({ online, onToast }: { online: boolean; onToast: ToastFn }) {
  const [requests, setRequests] = useState<ResetRequest[]>([]);
  const [generated, setGenerated] = useState<GeneratedCode | null>(null);
  const [recoveryCode, setRecoveryCode] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyRecovery, setBusyRecovery] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/password/requests", { cache: "no-store" });
      if (!response.ok) return;
      const result = (await response.json()) as { requests: ResetRequest[] };
      setRequests(result.requests);
    } catch {
      // Offline: the list is refreshed when the connection returns.
    }
  }, []);

  useEffect(() => {
    if (online) void load();
  }, [online, load]);

  async function generateCode(requestId: string) {
    setBusyId(requestId);
    try {
      const response = await apiFetch("/api/password/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      const result = (await response.json()) as { code?: string; expiresAt?: string; error?: string };
      if (!response.ok || !result.code || !result.expiresAt) {
        onToast(result.error ?? "Impossible de créer le code.", "error");
        return;
      }
      setGenerated({ requestId, code: result.code, expiresAt: result.expiresAt });
      onToast("Code créé. Donnez-le au membre, il est valable 30 minutes.", "success");
      void load();
    } catch {
      onToast("Connexion impossible : le code n’a pas été créé.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function dismiss(requestId: string) {
    try {
      const response = await apiFetch(`/api/password/requests?id=${encodeURIComponent(requestId)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("dismiss");
      setRequests((current) => current.filter((item) => item.id !== requestId));
      onToast("Demande ignorée.", "info");
    } catch {
      onToast("Action impossible pour le moment.", "error");
    }
  }

  async function regenerateRecovery() {
    if (!window.confirm("Votre ancien code de secours ne fonctionnera plus. Continuer ?")) return;
    setBusyRecovery(true);
    try {
      const response = await apiFetch("/api/password/recovery-code", { method: "POST" });
      const result = (await response.json()) as { recoveryCode?: string; error?: string };
      if (!response.ok || !result.recoveryCode) {
        onToast(result.error ?? "Impossible de créer le code.", "error");
        return;
      }
      setRecoveryCode(result.recoveryCode);
      onToast("Nouveau code de secours créé.", "success");
    } catch {
      onToast("Connexion impossible pour le moment.", "error");
    } finally {
      setBusyRecovery(false);
    }
  }

  return (
    <section className="panel security-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">SÉCURITÉ DU COMPTE</p>
          <h2>Mots de passe oubliés</h2>
        </div>
      </div>

      <div className="security-block">
        <h3>Demandes de vos couturiers ({requests.length})</h3>
        {requests.length === 0 ? (
          <p className="security-empty">Aucune demande en attente. Quand un membre oublie son mot de passe, sa demande apparaît ici.</p>
        ) : (
          requests.map((item) => (
            <div className="request-row" key={item.id}>
              <div>
                <b>{item.fullName}</b>
                <span>{item.phone}</span>
                <small>Demandé à {clock(item.createdAt)}</small>
              </div>
              <div className="request-actions">
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busyId === item.id || !online}
                  onClick={() => void generateCode(item.id)}
                >
                  {busyId === item.id ? "Création…" : "Créer le code"}
                </button>
                <button type="button" className="button button-light" onClick={() => void dismiss(item.id)}>
                  Ignorer
                </button>
              </div>
              {generated?.requestId === item.id && (
                <div className="patron-code" role="status">
                  <small>Donnez ce code à {item.fullName}</small>
                  <strong>{generated.code}</strong>
                  <span>Valable jusqu’à {clock(generated.expiresAt)} · 5 essais maximum</span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="security-block">
        <h3>Mon code de secours</h3>
        <p>
          Ce code vous permet de changer votre mot de passe seul, sans passer par un autre patron.
          Créez-le maintenant si vous ne l’avez pas noté.
        </p>
        {recoveryCode ? (
          <RecoveryCodeCard code={recoveryCode} title="Nouveau code de secours" />
        ) : (
          <button
            type="button"
            className="button button-light"
            disabled={busyRecovery || !online}
            onClick={() => void regenerateRecovery()}
          >
            {busyRecovery ? "Création…" : "Créer ou remplacer mon code de secours"}
          </button>
        )}
      </div>
    </section>
  );
}
