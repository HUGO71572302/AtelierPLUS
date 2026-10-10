"use client";

import { useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { apiFetch, saveStoredToken } from "@/lib/api-client";
import { RecoveryCodeCard } from "@/components/recovery-code-card";
import { PhoneField } from "@/components/phone-field";
import { isPhoneComplete } from "@/lib/countries";

type AccountType = "owner" | "member";
type Done = { firstName: string; role: AccountType; recoveryCode: string | null };

function Glyph({ children, size = 20 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

const arrow = <path d="M5 12h14M13 6l6 6-6 6" />;
const check = <path d="m5 12 4.2 4.2L19 6.5" />;

function passwordScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

const SCORE_LABELS = ["Trop court", "Correct", "Bien", "Solide", "Excellent"];

export default function RegisterPage() {
  const [loading, setLoading] = useState(true);
  const [accountType, setAccountType] = useState<AccountType>("owner");
  const [signedInAs, setSignedInAs] = useState<string | null>(null);
  const [workshopName, setWorkshopName] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      setInviteCode(code.toUpperCase().slice(0, 20));
      setAccountType("member");
    }
    apiFetch("/api/auth", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((session: { user: { fullName: string } | null } | null) => {
        if (session?.user) setSignedInAs(session.user.fullName);
      })
      .catch(() => setError("Pas de connexion internet : la création de compte nécessite le réseau."))
      .finally(() => setLoading(false));
  }, []);

  const score = useMemo(() => passwordScore(password), [password]);
  const passwordsMatch = password.length >= 8 && password === confirmation;
  const canSubmit =
    !busy &&
    fullName.trim().length >= 2 &&
    isPhoneComplete(phone) &&
    passwordsMatch &&
    (accountType === "owner" || inviteCode.replace(/[^A-Za-z0-9]/g, "").length >= 8);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "register",
          accountType,
          workshopName: accountType === "owner" ? workshopName.trim() || `Atelier ${fullName.trim()}` : undefined,
          fullName: fullName.trim(),
          phone: phone.trim(),
          password,
          inviteCode: accountType === "member" ? inviteCode : undefined,
        }),
      });
      const result = (await response.json()) as {
        user?: { fullName: string; role: AccountType };
        token?: string;
        recoveryCode?: string | null;
        error?: string;
      };
      if (!response.ok || !result.user) {
        setError(result.error ?? "Création du compte impossible. Réessayez.");
        return;
      }
      if (result.token) saveStoredToken(result.token);
      setDone({
        firstName: result.user.fullName.split(" ")[0] ?? result.user.fullName,
        role: result.user.role,
        recoveryCode: result.recoveryCode ?? null,
      });
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="register-shell">
      <section className="register-story">
        <Link className="register-brand" href="/">
          <span className="brand-mark"><Glyph size={24}><path d="M19 5 5 19M14.5 3.5l6 6M6 4l14 16M5 18l1 1" /></Glyph></span>
          <span className="brand-words"><strong>Atelier<span>PLUS</span></strong><small>LE GESTE BIEN GÉRÉ</small></span>
        </Link>
        <div className="register-story-copy">
          <p className="eyebrow light-eyebrow">REJOINDRE OU CRÉER UN ATELIER</p>
          <h1>Votre atelier,<br />en <em>toute simplicité.</em></h1>
          <p><b>Patron ou couturier ?</b> Créez votre compte en une minute. Vos clients, commandes et mesures vous accompagnent partout.</p>
        </div>
        <ol className="register-steps">
          <li>
            <span aria-hidden="true">👑</span>
            <div>
              <b>Vous dirigez l’atelier ?</b>
              <small>Créez votre atelier sans code. Vous gérez les finances et l’équipe.</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">✂</span>
            <div>
              <b>Vous êtes couturier ?</b>
              <small>Rejoignez l’atelier avec le code d’invitation de votre patron.</small>
            </div>
          </li>
          <li>
            <span aria-hidden="true">🔑</span>
            <div>
              <b>Un code de secours vous est donné</b>
              <small>Notez-le : il vous permet de retrouver l’accès sans aide.</small>
            </div>
          </li>
        </ol>
      </section>

      <section className="register-form-side">
        {done ? (
          <div className="register-card">
            <div className="register-success" role="status">
              <div className="success-ring"><Glyph size={36}>{check}</Glyph></div>
              <h2>Bienvenue, {done.firstName} !</h2>
              <p><b>Votre compte {done.role === "owner" ? "patron" : "couturier"} est prêt.</b></p>
            </div>
            {done.recoveryCode && (
              <RecoveryCodeCard
                title="Votre code de secours"
                note="Notez-le maintenant. Il vous permettra de changer votre mot de passe si vous l’oubliez. Il ne sera plus affiché."
                code={done.recoveryCode}
              />
            )}
            <div className="recover-actions" style={{ marginTop: 22 }}>
              <button type="button" className="button button-primary" onClick={() => window.location.assign("/")}>
                J’ai noté mon code, entrer dans l’atelier
              </button>
            </div>
          </div>
        ) : (
          <div className="register-card">
            <div className="auth-form-tag"><span className="tag-dot" />CRÉATION DE COMPTE</div>
            <h2>Créez votre espace.</h2>
            <p className="register-intro">Choisissez votre situation pour commencer.</p>

            <div className="role-selection-tabs" role="tablist" aria-label="Type de compte">
              <button
                type="button"
                role="tab"
                aria-selected={accountType === "owner"}
                className={`role-tab-btn ${accountType === "owner" ? "role-tab-active" : ""}`}
                onClick={() => { setAccountType("owner"); setError(""); }}
              >
                <span className="role-tab-badge">👑 PATRON</span>
                <strong>Créer mon atelier</strong>
                <small>Sans code d’invitation</small>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={accountType === "member"}
                className={`role-tab-btn ${accountType === "member" ? "role-tab-active" : ""}`}
                onClick={() => { setAccountType("member"); setError(""); }}
              >
                <span className="role-tab-badge">✂ COUTURIER</span>
                <strong>Rejoindre une équipe</strong>
                <small>Avec le code de mon patron</small>
              </button>
            </div>

            {signedInAs && (
              <div className="register-notice">
                <b>Connecté : {signedInAs}.</b> Créer un nouveau compte basculera sur ce nouvel espace.
                <Link href="/">Retourner à l’atelier</Link>
              </div>
            )}

            <form className="auth-form register-form" onSubmit={submit} noValidate>
              {accountType === "owner" ? (
                <label className="field-label">Nom de votre atelier (facultatif)
                  <input value={workshopName} onChange={(event) => setWorkshopName(event.target.value)} placeholder="Ex. Atelier Amina Couture" autoComplete="organization" disabled={loading} />
                  <small className="field-hint">Si vide, votre nom servira de nom d’atelier.</small>
                </label>
              ) : (
                <label className="field-label">Code d’invitation (donné par votre patron) *
                  <input
                    className="invite-input"
                    value={inviteCode}
                    onChange={(event) => setInviteCode(event.target.value.toUpperCase().slice(0, 20))}
                    placeholder="XXXXX-XXXXX"
                    autoComplete="one-time-code"
                    autoCapitalize="characters"
                    spellCheck={false}
                    disabled={loading}
                    required
                  />
                </label>
              )}

              <label className="field-label">Votre nom complet *
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ex. Aïssatou Diop" autoComplete="name" disabled={loading} required />
              </label>

              <div className="field-label">Téléphone (identifiant de connexion) *
                <PhoneField value={phone} onChange={setPhone} disabled={loading} required />
              </div>

              <label className="field-label">Mot de passe *
                <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" autoComplete="new-password" disabled={loading} required />
                {password && (
                  <span className={`strength strength-${score}`}>
                    <span className="strength-track"><i style={{ width: `${Math.max(1, score) * 25}%` }} /></span>
                    <b>{password.length < 8 ? SCORE_LABELS[0] : SCORE_LABELS[score]}</b>
                  </span>
                )}
              </label>

              <label className="field-label">Confirmez le mot de passe *
                <input type="password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Retapez votre mot de passe" autoComplete="new-password" disabled={loading} aria-invalid={confirmation.length > 0 && !passwordsMatch} className={confirmation.length > 0 && !passwordsMatch ? "input-error" : ""} required />
                {confirmation.length > 0 && !passwordsMatch && <small className="field-error-text">Les deux mots de passe ne correspondent pas.</small>}
              </label>

              {error && <div className="form-error" role="alert">{error}</div>}

              <button className="button button-primary auth-submit" type="submit" disabled={!canSubmit}>
                {busy ? <span className="button-spinner" /> : (
                  <>
                    <span>{accountType === "owner" ? "Créer mon compte patron" : "Rejoindre l’atelier"}</span>
                    <Glyph>{arrow}</Glyph>
                  </>
                )}
              </button>
            </form>

            <div className="auth-switch">
              Vous avez déjà un compte ? <Link className="text-link" href="/">Se connecter</Link>
            </div>
            <div className="auth-switch">
              Mot de passe oublié ? <Link className="text-link" href="/mot-de-passe-oublie">Le récupérer</Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
