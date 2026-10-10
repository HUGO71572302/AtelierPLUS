"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { apiFetch, saveStoredToken } from "@/lib/api-client";
import { RecoveryCodeCard } from "@/components/recovery-code-card";
import { PhoneField } from "@/components/phone-field";
import { isPhoneComplete } from "@/lib/countries";

type Mode = "choose" | "recovery" | "patron";

type ApiResult = {
  ok?: boolean;
  error?: string;
  message?: string;
  token?: string;
  user?: { fullName: string };
  recoveryCode?: string | null;
};

type Success = { firstName: string; recoveryCode: string | null };

const NETWORK_ERROR = "Connexion impossible. Vérifiez votre réseau puis réessayez.";

export default function ForgotPasswordPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [patronStep, setPatronStep] = useState<"phone" | "code">("phone");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<Success | null>(null);

  const passwordsMatch = password.length >= 8 && password === confirmation;

  function goTo(next: Mode) {
    setMode(next);
    setError("");
    setInfo("");
    setCode("");
    setPassword("");
    setConfirmation("");
    setPatronStep("phone");
  }

  async function call(body: Record<string, unknown>): Promise<{ ok: boolean; result: ApiResult }> {
    try {
      const response = await apiFetch("/api/password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json().catch(() => ({}))) as ApiResult;
      if (!response.ok) {
        setError(result.error ?? "Opération impossible. Réessayez.");
        return { ok: false, result };
      }
      return { ok: true, result };
    } catch {
      setError(NETWORK_ERROR);
      return { ok: false, result: {} };
    }
  }

  async function finish(result: ApiResult) {
    if (result.token) saveStoredToken(result.token);
    setSuccess({
      firstName: result.user?.fullName.split(" ")[0] ?? "",
      recoveryCode: result.recoveryCode ?? null,
    });
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordsMatch) return;
    setBusy(true);
    setError("");
    const { ok, result } = await call({ mode: "recovery", phone, code, newPassword: password });
    setBusy(false);
    if (ok) await finish(result);
  }

  async function requestFromPatron(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isPhoneComplete(phone)) return;
    setBusy(true);
    setError("");
    const { ok, result } = await call({ mode: "request", phone });
    setBusy(false);
    if (ok) {
      setInfo(result.message ?? "Demande transmise au patron.");
      setPatronStep("code");
    }
  }

  async function submitPatronCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordsMatch) return;
    setBusy(true);
    setError("");
    const { ok, result } = await call({ mode: "patron", phone, code, newPassword: password });
    setBusy(false);
    if (ok) await finish(result);
  }

  // ───── Success: password changed, the user is signed in ─────
  if (success) {
    return (
      <main className="recover-shell">
        <section className="recover-card">
          <p className="recover-kicker">MOT DE PASSE MODIFIÉ</p>
          <h1>Bienvenue{success.firstName ? `, ${success.firstName}` : ""} !</h1>
          <p className="recover-lead">Votre mot de passe est changé et vous êtes connecté.</p>
          {success.recoveryCode && (
            <RecoveryCodeCard
              title="Votre nouveau code de secours"
              note="Votre ancien code ne fonctionne plus. Notez celui-ci en lieu sûr : il ne sera plus affiché."
              code={success.recoveryCode}
            />
          )}
          <div className="recover-actions">
            <button type="button" className="button button-primary" onClick={() => window.location.assign("/")}>
              Entrer dans mon atelier
            </button>
          </div>
        </section>
      </main>
    );
  }

  // ───── Choice screen ─────
  if (mode === "choose") {
    return (
      <main className="recover-shell">
        <section className="recover-card">
          <p className="recover-kicker">AIDE À LA CONNEXION</p>
          <h1>Mot de passe oublié ?</h1>
          <p className="recover-lead">Choisissez la solution qui vous correspond. Aucune n’efface vos données.</p>

          <div className="recover-choices">
            <button type="button" className="recover-choice" onClick={() => goTo("recovery")}>
              <span className="recover-choice-icon" aria-hidden="true">🔑</span>
              <span>
                <strong>J’ai mon code de secours<span className="recover-badge">RAPIDE</span></strong>
                <small>Le code à 12 caractères noté à la création de votre compte.</small>
              </span>
            </button>

            <button type="button" className="recover-choice" onClick={() => goTo("patron")}>
              <span className="recover-choice-icon" aria-hidden="true">✂</span>
              <span>
                <strong>Je demande à mon patron</strong>
                <small>Il vous donne un code à 6 chiffres depuis son espace Mon équipe.</small>
              </span>
            </button>
          </div>

          <p className="recover-login-link">
            Vous vous souvenez de votre mot de passe ? <Link href="/">Se connecter</Link>
          </p>
        </section>
      </main>
    );
  }

  // ───── Recovery code form ─────
  if (mode === "recovery") {
    return (
      <main className="recover-shell">
        <section className="recover-card">
          <button type="button" className="recover-back" onClick={() => goTo("choose")}>← Retour</button>
          <p className="recover-kicker">CODE DE SECOURS</p>
          <h1>Changer mon mot de passe</h1>
          <p className="recover-lead">Saisissez votre numéro, votre code de secours puis votre nouveau mot de passe.</p>

          <form className="recover-form" onSubmit={submitRecovery} noValidate>
            <div className="field-label">Votre numéro de téléphone
              <PhoneField value={phone} onChange={setPhone} required />
            </div>
            <label className="field-label">Votre code de secours (12 caractères)
              <input className="recover-code-input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase().slice(0, 20))} placeholder="XXXX-XXXX-XXXX" autoCapitalize="characters" spellCheck={false} autoComplete="off" required />
            </label>
            <label className="field-label">Nouveau mot de passe (8 caractères minimum)
              <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
            </label>
            <label className="field-label">Confirmez le nouveau mot de passe
              <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} />
            </label>
            {confirmation.length > 0 && !passwordsMatch && password.length >= 8 && (
              <p className="recover-error">Les deux mots de passe ne correspondent pas.</p>
            )}
            {error && <p className="recover-error" role="alert">{error}</p>}
            <div className="recover-actions">
              <button type="submit" className="button button-primary" disabled={busy || !passwordsMatch || code.length < 8 || !isPhoneComplete(phone)}>
                {busy ? "Vérification…" : "Changer mon mot de passe"}
              </button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  // ───── Patron code: step 1 request, step 2 enter code ─────
  return (
    <main className="recover-shell">
      <section className="recover-card">
        <button type="button" className="recover-back" onClick={() => goTo("choose")}>← Retour</button>
        <p className="recover-kicker">DEMANDE AU PATRON</p>
        <h1>Code à 6 chiffres</h1>

        {patronStep === "phone" && (
          <>
            <p className="recover-lead">Indiquez votre numéro. Votre patron verra votre demande et vous donnera un code.</p>
            <form className="recover-form" onSubmit={requestFromPatron} noValidate>
              <div className="field-label">Votre numéro de téléphone
                <PhoneField value={phone} onChange={setPhone} required />
              </div>
              {error && <p className="recover-error" role="alert">{error}</p>}
              <div className="recover-actions">
                <button type="submit" className="button button-primary" disabled={busy || !isPhoneComplete(phone)}>
                  {busy ? "Envoi…" : "Envoyer la demande au patron"}
                </button>
              </div>
            </form>
          </>
        )}

        {patronStep === "code" && (
          <>
            <p className="recover-hint">{info}</p>
            <form className="recover-form" onSubmit={submitPatronCode} noValidate>
              <label className="field-label">Le code donné par votre patron
                <input className="recover-otp-input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required />
              </label>
              <label className="field-label">Nouveau mot de passe (8 caractères minimum)
                <input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={8} />
              </label>
              <label className="field-label">Confirmez le nouveau mot de passe
                <input type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required minLength={8} />
              </label>
              {confirmation.length > 0 && !passwordsMatch && password.length >= 8 && (
                <p className="recover-error">Les deux mots de passe ne correspondent pas.</p>
              )}
              {error && <p className="recover-error" role="alert">{error}</p>}
              <div className="recover-actions">
                <button type="submit" className="button button-primary" disabled={busy || !passwordsMatch || code.length !== 6}>
                  {busy ? "Vérification…" : "Valider et changer mon mot de passe"}
                </button>
              </div>
            </form>
          </>
        )}
      </section>
    </main>
  );
}
