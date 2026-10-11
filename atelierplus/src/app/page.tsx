'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import Link from "next/link";
import { apiFetch, saveStoredToken, clearStoredToken } from "@/lib/api-client";
import { normalizeAtelierData } from "@/lib/normalize-data";
import {
  EXPENSE_CATEGORIES,
  GARMENT_TEMPLATES,
  MEASUREMENT_CATALOG,
  ORDER_STATUSES,
  cmToMetres,
  metresToCm,
} from "@/lib/atelier-types";
import { MeasurementGuideView } from "@/components/measurement-guide-modal";
import { OrderDetailView } from "@/components/order-detail-modal";
import { OptionsPanel } from "@/components/tools/options-panel";
import type { ToolView } from "@/components/tools/options-panel";
import type { ModelOrderDetails } from "@/lib/inspiration-catalog";
import { INSPIRATION_CATALOG, catalogOrderDetails } from "@/lib/inspiration-catalog";
import { InspirationView } from "@/components/tools/inspiration-view";
import { APP_IDENTITY } from "@/lib/app-identity";
import { TeamSecurityPanel } from "@/components/team-security-panel";
import { AgendaView } from "@/components/agenda-view";
import { AppTopbar } from "@/components/layout/app-topbar";
import { QuickLauncher } from "@/components/layout/quick-launcher";
import type { LauncherItem } from "@/components/layout/quick-launcher";
import { usePrint } from "@/components/print/print-document";
import { downloadTextPdf } from "@/lib/receipt-pdf";
import { PhoneField } from "@/components/phone-field";
import { isPhoneComplete, whatsappDigits } from "@/lib/countries";
import { AppointmentForm, FabricForm, FabricMovementForm } from "@/components/agenda-forms";
import type { AppointmentPrefill } from "@/components/agenda-forms";
import type {
  Appointment,
  AppointmentDraft,
  AppointmentStatus,
  AtelierData,
  AtelierOrder,
  Client,
  ClientDraft,
  ExpenseDraft,
  Fabric,
  FabricDraft,
  FabricMovementDraft,
  InspirationModel,
  InspirationModelDraft,
  MeasurementValues,
  OfflineOperation,
  OrderStatus,
  PaymentDraft,
  SafeUser,
  SyncConflict,
} from "@/lib/atelier-types";
import {
  addToQueue,
  clearLocalWorkspace,
  moveToConflict,
  readConflicts,
  readQueue,
  readSnapshot,
  removeConflict,
  removeFromQueue,
  saveSnapshot,
} from "@/lib/offline-store";

type AppTab = "dashboard" | "orders" | "clients" | "agenda" | "expenses" | "team";
type ModalKind =
  | "client"
  | "order"
  | "expense"
  | "team"
  | "payment"
  | "measurement"
  | "client-details"
  | "order-details"
  | "measurement-guide"
  | "appointment"
  | "fabric"
  | "fabric-movement"
  | "options"
  | "share"
  | null;
type ToastState = { message: string; kind: "success" | "error" | "info" } | null;
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const NAV_ITEMS: { key: AppTab; label: string; icon: string; ownerOnly?: boolean }[] = [
  { key: "dashboard", label: "Vue d’ensemble", icon: "home" },
  { key: "clients", label: "Clients & mesures", icon: "clients" },
  { key: "orders", label: "Commandes", icon: "orders" },
  { key: "agenda", label: "Agenda", icon: "calendar" },
  { key: "expenses", label: "Dépenses", icon: "wallet", ownerOnly: true },
  { key: "team", label: "Mon équipe", icon: "team", ownerOnly: true },
];

function Icon({ name, size = 20, className = "" }: { name: string; size?: number; className?: string }) {
  const drawings: Record<string, ReactNode> = {
    home: <><path d="m3 10 9-7 9 7" /><path d="M5 9v11h14V9M9 20v-6h6v6" /></>,
    orders: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z" /><path d="M4 5.5v13M8 7h8M8 11h8M8 15h5" /></>,
    clients: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20v-1.2A5.3 5.3 0 0 1 8.8 13.5h.4a5.3 5.3 0 0 1 5.3 5.3V20z" /><path d="M15 4.8a3.2 3.2 0 0 1 0 6.2M16 14a4.8 4.8 0 0 1 4.5 4.8V20" /></>,
    wallet: <><rect x="3" y="5" width="18" height="15" rx="2.2" /><path d="M3 9h18M16 14h2M7 5V3h10v2" /></>,
    team: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20v-1.3A5.2 5.2 0 0 1 8.7 13.5h.6a5.2 5.2 0 0 1 5.2 5.2V20z" /><path d="M16 5.2a3 3 0 0 1 0 5.6M16.2 14a4.6 4.6 0 0 1 4.3 4.6V20" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.6" /><path d="m16 16 4.3 4.3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
    arrowUp: <><path d="M12 19V5m-6 6 6-6 6 6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18M7 14h3M7 17h3" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
    check: <><path d="m5 12 4.2 4.2L19 6.5" /></>,
    close: <><path d="m6 6 12 12M18 6 6 18" /></>,
    phone: <><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" /><path d="M10 17h4" /></>,
    shirt: <><path d="m8 4 4 2 4-2 5 3-2 4-3-1v11H8V10l-3 1-2-4z" /><path d="M10 7v2M14 7v2" /></>,
    needle: <><path d="M19 5 5 19M14.5 3.5l6 6M6 4l14 16M5 18l1 1" /><circle cx="16" cy="6" r="1" /></>,
    cloud: <><path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.1 8.4 4.8 4.8 0 0 0 7 18Z" /><path d="m9 13 3 3 3-3M12 10v6" /></>,
    wifi: <><path d="M5 9a11 11 0 0 1 14 0M8 12a6.5 6.5 0 0 1 8 0m-5 3h2" /><circle cx="12" cy="18" r=".8" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></>,
    logout: <><path d="M10 17l5-5-5-5M15 12H3" /><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" /></>,
    download: <><path d="M12 3v12m-5-5 5 5 5-5" /><path d="M5 17v3h14v-3" /></>,
    trend: <><path d="m4 16 5-5 4 3 7-8" /><path d="M14 6h6v6" /></>,
    dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    ruler: <><path d="m3 16 13-13 5 5L8 21z" /><path d="m13 6 5 5M10 9l2 2M7 12l2 2M4 15l2 2" /></>,
    sparkle: <><path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="m19 16 .7 2.1L22 19l-2.3.8L19 22l-.7-2.2L16 19l2.3-.9z" /></>,
  };
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {drawings[name] ?? drawings.sparkle}
    </svg>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand-lockup ${compact ? "brand-compact" : ""}`}>
      <div className="brand-mark"><Icon name="needle" size={22} /></div>
      <div className="brand-words"><strong>Atelier<span>PLUS</span></strong>{!compact && <small>LE GESTE BIEN GÉRÉ</small>}</div>
    </div>
  );
}

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

function localDateValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function makeId() {
  return globalThis.crypto.randomUUID();
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "A";
}

function garmentName(value: string) {
  return GARMENT_TEMPLATES.find((item) => item.value === value)?.label ?? value;
}

function statusLabel(status: OrderStatus) {
  return ORDER_STATUSES.find((item) => item.value === status)?.label ?? "En attente";
}

function StatusPill({ status }: { status: OrderStatus }) {
  return <span className={`status-pill status-${status}`}><i />{statusLabel(status)}</span>;
}

function Modal({
  title,
  subtitle,
  onClose,
  children,
  wide = false,
}: {
  title?: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className={`modal-card ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-heading">
          <div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-button modal-close" type="button" onClick={onClose} aria-label="Fermer"><Icon name="close" /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function AuthScreen({
  needsSetup,
  onAuthenticated,
  installPrompt,
}: {
  needsSetup: boolean;
  onAuthenticated: (user: SafeUser) => Promise<void>;
  installPrompt: InstallPromptEvent | null;
}) {
  const [mode, setMode] = useState<"setup" | "login">(needsSetup ? "setup" : "login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setMode(needsSetup ? "setup" : "login"), [needsSetup]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await apiFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, fullName, phone, password }),
      });
      const result = (await response.json()) as { user?: SafeUser; token?: string; error?: string };
      if (!response.ok || !result.user) {
        setError(result.error ?? "Une erreur est survenue. Réessayez.");
        return;
      }
      if (result.token) saveStoredToken(result.token);
      await onAuthenticated(result.user);
    } catch {
      setError("Connexion impossible. Vérifiez votre réseau puis réessayez.");
    } finally {
      setBusy(false);
    }
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
  }

  return (
    <main className="auth-shell">
      <section className="auth-story">
        <div className="auth-story-top"><Logo /><span className="auth-beta"><i />VOTRE ATELIER, EN MIEUX</span></div>
        <div className="auth-story-copy">
          <p className="eyebrow light-eyebrow">LE QUOTIDIEN DE L’ATELIER, SIMPLIFIÉ</p>
          <h1>Vos idées<br />prennent <em>forme.</em></h1>
          <p>Clients, mesures, commandes et acomptes. Tout ce qu’il faut pour coudre l’esprit tranquille.</p>
        </div>
        <div className="auth-preview">
          <div className="auth-preview-top"><span>VOTRE ATELIER</span><span className="preview-live"><i /> EN ACTIVITÉ</span></div>
          <div className="preview-greeting">Bonjour, Aïssatou <span>✦</span></div>
          <div className="preview-metrics"><div><small>COMMANDES EN COURS</small><strong>08</strong></div><div><small>À LIVRER</small><strong>03</strong></div></div>
          <div className="preview-order"><div className="preview-thread"><span /><span /><span /></div><div><b>#CMD-024</b><small>Ensemble · Awa Koné</small></div><span className="preview-due">Demain</span></div>
          <div className="preview-order preview-order-two"><div className="preview-fabric">✳</div><div><b>Une journée plus légère</b><small>Votre atelier au même endroit.</small></div></div>
        </div>
        <div className="auth-footnote"><span>01</span><div><b>Pensé pour les ateliers d’ici.</b><small>Simple, même quand le réseau s’en va.</small></div><span className="auth-needle"><Icon name="needle" size={31} /></span></div>
        <div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" />
      </section>

      <section className="auth-form-side">
        <div className="auth-mobile-brand"><Logo compact /></div>
        <div className="auth-form-wrap">
          <div className="auth-form-tag"><span className="tag-dot" />{mode === "setup" ? "VOTRE ESPACE COMMENCE ICI" : "HEUREUX DE VOUS REVOIR"}</div>
          <h2>{mode === "setup" ? "Créons votre atelier." : "On reprend le fil ?"}</h2>
          <p className="auth-intro">{mode === "setup" ? "Créez le compte patron pour commencer à organiser votre activité." : "Connectez-vous à votre espace AtelierPLUS."}</p>
          <form className="auth-form" onSubmit={submit}>
            {mode === "setup" && <label className="field-label">Votre nom complet<input autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ex. Aïssatou Diop" required minLength={2} /></label>}
            <div className="field-label">Téléphone<PhoneField value={phone} onChange={setPhone} required /></div>
            <label className="field-label">Mot de passe<div className="password-field"><input type={showPassword ? "text" : "password"} autoComplete={mode === "setup" ? "new-password" : "current-password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "setup" ? "8 caractères minimum" : "Votre mot de passe"} required minLength={mode === "setup" ? 8 : 1} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Masquer" : "Voir"}</button></div></label>
            {mode === "login" && <Link className="forgot-link" href="/mot-de-passe-oublie">Mot de passe oublié ?</Link>}
            {error && <div className="form-error"><Icon name="close" size={16} />{error}</div>}
            <button className="button button-primary auth-submit" type="submit" disabled={busy || !isPhoneComplete(phone)}>{busy ? <span className="button-spinner" /> : <>{mode === "setup" ? "Créer mon atelier" : "Se connecter"}<Icon name="arrow" size={18} /></>}</button>
          </form>
          <div className="auth-switch">{mode === "setup" ? <>Vous avez déjà un espace ? <button type="button" onClick={() => { setMode("login"); setError(""); }}>Se connecter</button></> : <>Pas encore de compte ? <Link className="register-link" href="/inscription">Créer un compte</Link></>}</div>
          <div className="auth-separator"><span /><small>VOTRE ESPACE EST PRIVÉ</small><span /></div>
          <div className="auth-security"><div className="security-icon"><Icon name="needle" size={17} /></div><p>Chaque membre a son compte. <b>Les finances restent visibles par le patron uniquement.</b></p></div>
          {installPrompt && <button className="install-link" type="button" onClick={install}><Icon name="download" size={16} /> Installer AtelierPLUS sur cet appareil</button>}
        </div>
        <div className="auth-footer"><span>ATELIERPLUS · FAIT AVEC SOIN</span><span><Icon name="cloud" size={15} /> Fonctionne aussi hors-ligne</span></div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return <label className={`field-label ${className}`}>{label}{children}{hint && <small className="field-hint">{hint}</small>}</label>;
}

function ClientForm({
  onSave,
  onCancel,
  onOpenGuide,
}: {
  onSave: (draft: ClientDraft, values: MeasurementValues) => Promise<void>;
  onCancel: () => void;
  onOpenGuide?: () => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [gender, setGender] = useState("");
  const [notes, setNotes] = useState("");
  const [withMeasurements, setWithMeasurements] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const now = new Date().toISOString();
    const draft: ClientDraft = {
      id: makeId(), name: name.trim(), phone: phone.trim() || null, gender: gender || null,
      notes: notes.trim() || null, createdAt: now, updatedAt: now,
    };
    const parsedValues: MeasurementValues = {};
    for (const [code, value] of Object.entries(values)) {
      const parsed = Number(value);
      if (value && Number.isFinite(parsed) && parsed > 0) parsedValues[code] = parsed;
    }
    await onSave(draft, withMeasurements ? parsedValues : {});
    setBusy(false);
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="form-grid form-grid-two">
        <Field label="Nom du client *"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Awa Koné" required /></Field>
        <div className="field-label">Téléphone<PhoneField value={phone} onChange={setPhone} /></div>
      </div>
      <Field label="Pour quel type de coupe ?"><select value={gender} onChange={(event) => setGender(event.target.value)}><option value="">Ne pas préciser</option><option value="femme">Femme</option><option value="homme">Homme</option></select></Field>
      <Field label="Une note à retenir"><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Préférences, détails utiles…" /></Field>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <label className="check-row"><input type="checkbox" checked={withMeasurements} onChange={(event) => setWithMeasurements(event.target.checked)} /><span className="custom-check"><Icon name="check" size={13} /></span><span>Ajouter ses mensurations maintenant <small>(facultatif, en cm)</small></span></label>
        {onOpenGuide && <button type="button" className="text-link" onClick={onOpenGuide}><Icon name="ruler" size={14} />Guide des 19 mesures</button>}
      </div>
      {withMeasurements && <div className="measurement-entry-grid">{MEASUREMENT_CATALOG.map((measurement) => <label className="mini-measure-field" key={measurement.code}><span>{measurement.code}<small>{measurement.name}</small></span><div><input type="number" min="0.1" max="500" step="0.1" value={values[measurement.code] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [measurement.code]: event.target.value }))} placeholder="—" /><em>cm</em></div></label>)}</div>}
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || name.trim().length < 2 || (phone !== "" && !isPhoneComplete(phone))}>{busy ? "Enregistrement…" : "Enregistrer le client"}<Icon name="arrow" size={17} /></button></div>
    </form>
  );
}

function MeasurementForm({
  client,
  onSave,
  onCancel,
  onOpenGuide,
}: {
  client: Client;
  onSave: (values: MeasurementValues) => Promise<void>;
  onCancel: () => void;
  onOpenGuide?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const parsed: MeasurementValues = {};
    for (const [code, value] of Object.entries(values)) {
      const amount = Number(value);
      if (value && Number.isFinite(amount) && amount > 0) parsed[code] = amount;
    }
    if (Object.keys(parsed).length) await onSave(parsed);
    setBusy(false);
  }
  return (
    <form className="app-form" onSubmit={submit}>
      <div className="measure-client-chip"><div className="avatar avatar-small">{initials(client.name)}</div><span><b>{client.name}</b><small>Nouveau relevé · centimètres</small></span></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <p className="form-tip">Saisissez les mesures prises aujourd’hui. L’ancien relevé restera dans son historique.</p>
        {onOpenGuide && <button type="button" className="text-link" onClick={onOpenGuide}><Icon name="ruler" size={14} />Schéma & Guide</button>}
      </div>
      <div className="measurement-entry-grid measurement-entry-scroll">{MEASUREMENT_CATALOG.map((measurement) => <label className="mini-measure-field" key={measurement.code}><span>{measurement.code}<small>{measurement.name}</small></span><div><input type="number" min="0.1" max="500" step="0.1" value={values[measurement.code] ?? ""} onChange={(event) => setValues((current) => ({ ...current, [measurement.code]: event.target.value }))} placeholder="—" /><em>cm</em></div></label>)}</div>
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || !Object.values(values).some((value) => Number(value) > 0)}>{busy ? "Enregistrement…" : "Enregistrer le relevé"}<Icon name="arrow" size={17} /></button></div>
    </form>
  );
}

function OrderForm({
  clients,
  measurements,
  onSave,
  onCancel,
  onCreateClient,
  onOpenGuide,
  initialGarment,
  initialModelDetails,
  fabrics,
  showFabricUsage,
}: {
  clients: Client[];
  measurements: AtelierData["measurements"];
  onSave: (order: Omit<AtelierOrder, "orderNumber" | "revision" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"> & { createdAt: string }, firstPayment: number, fabricUsage?: { fabricId: string; metres: number }) => Promise<void>;
  onCancel: () => void;
  onCreateClient: () => void;
  onOpenGuide?: () => void;
  initialGarment?: string;
  initialModelDetails?: ModelOrderDetails;
  fabrics?: AtelierData["fabrics"];
  showFabricUsage?: boolean;
}) {
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [garment, setGarment] = useState<string>(initialGarment ?? GARMENT_TEMPLATES[0].value);
  const [model, setModel] = useState(initialModelDetails?.model ?? "");
  const [fabricSource, setFabricSource] = useState("client");
  const [totalAmount, setTotalAmount] = useState("");
  const [firstPayment, setFirstPayment] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState(initialModelDetails?.notes ?? "");
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [showAdjustments, setShowAdjustments] = useState(false);
  const [busy, setBusy] = useState(false);
  const [selectedFabricId, setSelectedFabricId] = useState("");
  const [fabricMetres, setFabricMetres] = useState("");
  const selectedGarment = GARMENT_TEMPLATES.find((item) => item.value === garment) ?? GARMENT_TEMPLATES[0];
  const latestMeasurement = measurements.filter((item) => item.clientId === clientId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  const adjustmentCodes = [...selectedGarment.required, ...selectedGarment.optional];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Math.round(Number(totalAmount));
    const advance = Math.round(Number(firstPayment) || 0);
    if (!clientId || !Number.isSafeInteger(amount) || amount <= 0 || amount > 2_147_483_647 || !Number.isSafeInteger(advance) || advance < 0 || advance > amount) return;
    setBusy(true);
    const parsedAdjustments: Record<string, number> = {};
    for (const [code, value] of Object.entries(adjustments)) {
      const parsed = Number(value);
      if (value && Number.isFinite(parsed) && parsed !== 0) parsedAdjustments[code] = parsed;
    }
    const fabricUsage = fabricSource === "atelier" && selectedFabricId && Number(fabricMetres) > 0
      ? { fabricId: selectedFabricId, metres: Number(fabricMetres) }
      : undefined;
    await onSave({
      id: makeId(), clientId, garment, model: model.trim() || null, fabricSource,
      totalAmount: amount, dueDate: dueDate || null, status: "pending", notes: notes.trim() || null,
      adjustments: parsedAdjustments, createdAt: new Date().toISOString(),
    }, advance, fabricUsage);
    setBusy(false);
  }

  return (
    <form className="app-form" onSubmit={submit}>
      {clients.length ? <Field label="Pour quel client ? *"><select value={clientId} onChange={(event) => setClientId(event.target.value)} required>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}{client.phone ? ` · ${client.phone}` : ""}</option>)}</select></Field> : <div className="empty-inline"><span>Commencez par créer une fiche client.</span><button type="button" className="text-link" onClick={onCreateClient}>Créer un client <Icon name="arrow" size={15} /></button></div>}
      <Field label="Vêtement à réaliser *"><select value={garment} onChange={(event) => { setGarment(event.target.value); setAdjustments({}); }} required>{GARMENT_TEMPLATES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></Field>
      <div className="form-grid form-grid-two">
        <Field label="Prix convenu *"><div className="input-suffix"><input inputMode="numeric" type="number" min="1" max="2147483647" step="1" value={totalAmount} onChange={(event) => setTotalAmount(event.target.value)} placeholder="Ex. 25 000" required /><span>F CFA</span></div></Field>
        <Field label="Acompte reçu"><div className="input-suffix"><input inputMode="numeric" type="number" min="0" step="1" max={totalAmount || undefined} value={firstPayment} onChange={(event) => setFirstPayment(event.target.value)} placeholder="0" /><span>F CFA</span></div></Field>
      </div>
      <div className="form-grid form-grid-two">
        <Field label="Date de livraison"><input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Field>
        <Field label="Modèle (facultatif)"><input value={model} onChange={(event) => setModel(event.target.value)} placeholder="Ex. broderie col" /></Field>
      </div>
      <Field label="Tissu fourni par"><div className="segmented-control"><button type="button" className={fabricSource === "client" ? "selected" : ""} onClick={() => setFabricSource("client")}>Le client</button><button type="button" className={fabricSource === "atelier" ? "selected" : ""} onClick={() => setFabricSource("atelier")}>L’atelier</button></div></Field>
      {fabricSource === "atelier" && showFabricUsage && fabrics && fabrics.length > 0 && (
        <div className="form-grid form-grid-two">
          <Field label="Tissu du stock (facultatif)" hint="La quantité sera déduite automatiquement."><select value={selectedFabricId} onChange={(event) => setSelectedFabricId(event.target.value)}><option value="">Ne pas déduire</option>{fabrics.map((fabric) => <option key={fabric.id} value={fabric.id}>{fabric.name} · {cmToMetres(fabric.quantityCm)} dispo</option>)}</select></Field>
          <Field label="Mètres utilisés"><input type="number" inputMode="decimal" min={0} max={1000} step={0.25} value={fabricMetres} onChange={(event) => setFabricMetres(event.target.value)} placeholder="Ex. 2,5" /></Field>
        </div>
      )}
      {latestMeasurement && <div className="order-measurements">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fcfdfa", paddingRight: 10 }}>
          <button type="button" className="measure-toggle" style={{ flex: 1 }} onClick={() => setShowAdjustments(!showAdjustments)}><span><Icon name="ruler" size={17} />Ajustements des mesures <small>{Object.values(adjustments).filter(Boolean).length || "facultatif"}</small></span><span>{showAdjustments ? "−" : "+"}</span></button>
          {onOpenGuide && <button type="button" className="text-link" style={{ fontSize: 9 }} onClick={onOpenGuide}>Guide 📏</button>}
        </div>
        {showAdjustments && <div className="adjustment-list">{adjustmentCodes.map((code) => {
          const definition = MEASUREMENT_CATALOG.find((item) => item.code === code);
          return <label className="adjustment-row" key={code}><b>{code}</b><span>{definition?.name}</span><small>{latestMeasurement.values[code] ? `${latestMeasurement.values[code]} cm` : "Non relevé"}</small><div className="adjustment-input"><input type="number" step="0.1" value={adjustments[code] ?? ""} onChange={(event) => setAdjustments((current) => ({ ...current, [code]: event.target.value }))} placeholder="0" /><span>cm</span></div></label>;
        })}<p>Ces écarts ne modifient pas les mensurations de base du client.</p></div>}
      </div>}
      <Field label="Une précision pour l’équipe"><textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Détails utiles pour la confection…" /></Field>
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || !clientId || Number(totalAmount) <= 0 || Number(totalAmount) > 2147483647 || Number(firstPayment || 0) > Number(totalAmount)}>{busy ? "Enregistrement…" : "Créer la commande"}<Icon name="arrow" size={17} /></button></div>
    </form>
  );
}

function PaymentForm({
  order,
  balance,
  onSave,
  onCancel,
}: {
  order: AtelierOrder;
  balance: number;
  onSave: (draft: PaymentDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Math.round(Number(amount));
    if (!Number.isSafeInteger(value) || value <= 0 || value > balance) return;
    setBusy(true);
    await onSave({ id: makeId(), orderId: order.id, amount: value, paidAt: new Date().toISOString(), note: note.trim() || null });
    setBusy(false);
  }
  return (
    <form className="app-form" onSubmit={submit}>
      <div className="payment-order-card"><span className="payment-order-icon"><Icon name="shirt" /></span><div><b>{order.orderNumber}</b><small>{garmentName(order.garment)} · Reste {money(balance)}</small></div><StatusPill status={order.status} /></div>
      <Field label="Montant reçu *"><div className="input-suffix"><input autoFocus inputMode="numeric" type="number" min="1" step="1" max={balance || undefined} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex. 10 000" required /><span>F CFA</span></div></Field>
      <Field label="Note (facultatif)"><input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Acompte, solde…" /></Field>
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || Number(amount) <= 0}>{busy ? "Enregistrement…" : "Enregistrer le paiement"}<Icon name="check" size={17} /></button></div>
    </form>
  );
}

function ExpenseForm({
  orders,
  onSave,
  onCancel,
}: {
  orders: AtelierOrder[];
  onSave: (draft: ExpenseDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(localDateValue());
  const [orderId, setOrderId] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Math.round(Number(amount));
    if (!Number.isSafeInteger(value) || value <= 0 || value > 2_147_483_647) return;
    setBusy(true);
    await onSave({ id: makeId(), amount: value, category, description: description.trim(), date, orderId: orderId || null });
    setBusy(false);
  }
  return (
    <form className="app-form" onSubmit={submit}>
      <div className="form-grid form-grid-two"><Field label="Montant *"><div className="input-suffix"><input autoFocus type="number" inputMode="numeric" min="1" max="2147483647" step="1" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Ex. 5 000" required /><span>F CFA</span></div></Field><Field label="Date"><input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></Field></div>
      <Field label="Catégorie"><select value={category} onChange={(event) => setCategory(event.target.value)}>{EXPENSE_CATEGORIES.map((item) => <option key={item}>{item}</option>)}</select></Field>
      <Field label="Description *"><input value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex. Fil et boutons" required maxLength={300} /></Field>
      <Field label="Rattacher à une commande"><select value={orderId} onChange={(event) => setOrderId(event.target.value)}><option value="">Aucune commande</option>{orders.map((order) => <option key={order.id} value={order.id}>{order.orderNumber} · {garmentName(order.garment)}</option>)}</select></Field>
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || !description.trim() || Number(amount) <= 0 || Number(amount) > 2147483647}>{busy ? "Enregistrement…" : "Enregistrer la dépense"}<Icon name="check" size={17} /></button></div>
    </form>
  );
}

function TeamForm({
  onSave,
  onCancel,
  online,
}: {
  onSave: (fullName: string, phone: string, password: string) => Promise<void>;
  onCancel: () => void;
  online: boolean;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    await onSave(name.trim(), phone.trim(), password);
    setBusy(false);
  }
  return (
    <form className="app-form" onSubmit={submit}>
      {!online && <div className="form-tip form-tip-warning"><Icon name="wifi" size={16} />La création d’un compte nécessite une connexion internet.</div>}
      <Field label="Nom du membre *"><input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Fatou Ndiaye" required minLength={2} /></Field>
      <div className="field-label">Téléphone de connexion *<PhoneField value={phone} onChange={setPhone} required /></div>
      <Field label="Mot de passe provisoire *" hint="Au moins 8 caractères. Le membre pourra se connecter avec ces identifiants."><input type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="8 caractères minimum" required minLength={8} /></Field>
      <div className="role-explanation"><span><Icon name="team" size={18} /></span><p><b>Accès membre</b><small>Commandes, clients, mesures et saisie des paiements. Pas d’accès aux finances.</small></p></div>
      <div className="form-actions"><button type="button" className="button button-quiet" onClick={onCancel}>Annuler</button><button type="submit" className="button button-primary" disabled={busy || !online || !isPhoneComplete(phone)}>{busy ? "Création…" : "Créer le compte"}<Icon name="arrow" size={17} /></button></div>
    </form>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon name={icon} size={23} /></div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

function MetricCard({
  label,
  value,
  note,
  icon,
  tone = "mint",
}: {
  label: string;
  value: string;
  note: string;
  icon: string;
  tone?: string;
}) {
  return <article className="metric-card"><div className={`metric-icon metric-${tone}`}><Icon name={icon} size={19} /></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><span className="metric-note">{note}</span></article>;
}

function OrderLine({
  order,
  client,
  balance,
  paid,
  owner,
  online: _online,
  onStatus,
  onPayment,
  onShare,
  onOpenDetails,
}: {
  order: AtelierOrder;
  client?: Client;
  balance: number;
  paid: number;
  owner: boolean;
  online: boolean;
  onStatus: (order: AtelierOrder) => void;
  onPayment: (order: AtelierOrder) => void;
  onShare: (order: AtelierOrder, kind: "receipt" | "balance" | "ready") => void;
  onOpenDetails: (order: AtelierOrder) => void;
}) {
  return (
    <div
      className="order-line"
      onClick={() => onOpenDetails(order)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpenDetails(order);
        }
      }}
    >
      <div className="order-code">
        <div className="order-garment-icon"><Icon name="shirt" size={18} /></div>
        <div>
          <b>{order.orderNumber.startsWith("LOCAL-") ? "À synchroniser" : `#${order.orderNumber}`}</b>
          <small>{client?.name ?? "Client"}</small>
        </div>
      </div>
      <div className="order-garment">
        <b>{garmentName(order.garment)}</b>
        <small>{order.model || (order.fabricSource === "atelier" ? "Tissu atelier" : "Tissu client")}</small>
      </div>
      <div className="order-delivery">
        <small>Livraison</small>
        <b>{shortDate(order.dueDate)}</b>
      </div>
      <div className="order-status-cell">
        <button
          type="button"
          className="status-action"
          title="Cliquer pour changer d’étape"
          onClick={(e) => {
            e.stopPropagation();
            onStatus(order);
          }}
        >
          <StatusPill status={order.status} />
        </button>
      </div>
      {owner && (
        <div className="order-balance">
          <small>{balance > 0 ? "Reste" : "Soldée"}</small>
          <b>{money(balance > 0 ? balance : 0)}</b>
          {order.totalAmount !== null && <span>Reçu {money(paid)}</span>}
        </div>
      )}
      <div className="order-actions" onClick={(e) => e.stopPropagation()}>
        {owner && (
          <button
            className="share-order-button"
            type="button"
            title="Voir et partager le reçu"
            aria-label="Partager le reçu"
            onClick={() => onShare(order, "receipt")}
          >
            <Icon name="arrow" size={14} />
          </button>
        )}
        {owner && balance > 0 && (
          <button
            className="share-order-button share-reminder-button"
            type="button"
            title="Préparer un rappel de solde"
            aria-label="Rappeler le solde"
            onClick={() => onShare(order, "balance")}
          >
            <Icon name="bell" size={14} />
          </button>
        )}
        {order.status === "ready" && (
          <button
            className="share-order-button share-ready-button"
            type="button"
            title="Prévenir le client que sa commande est prête"
            aria-label="Prévenir le client"
            onClick={() => onShare(order, "ready")}
          >
            <Icon name="check" size={14} />
          </button>
        )}
        <button
          className="button button-light button-sm"
          type="button"
          onClick={() => onPayment(order)}
        >
          <Icon name="plus" size={15} />
          {owner ? "Paiement" : "Saisir un paiement"}
        </button>
      </div>
    </div>
  );
}

function clientMeasurementValues(clientId: string, records: AtelierData["measurements"]): MeasurementValues {
  const latest = records.filter((record) => record.clientId === clientId).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
  return latest?.values ?? {};
}

type ShareSheetState = { title: string; subtitle: string; text: string; phone: string | null; fileName: string };
type ToastFn = (message: string, kind?: "success" | "error" | "info") => void;

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    area.remove();
    return copied;
  }
}

function downloadText(text: string, fileName: string) {
  const file = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function ShareSheet({ sheet, online, onToast }: { sheet: ShareSheetState; online: boolean; onToast: ToastFn }) {
  const [copied, setCopied] = useState(false);
  const { print: printDocument } = usePrint();
  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const digits = whatsappDigits(sheet.phone) ?? "";
  const hasValidPhone = digits !== "";

  const appUrl = hasValidPhone
    ? `whatsapp://send?phone=${digits}&text=${encodeURIComponent(sheet.text)}`
    : `whatsapp://send?text=${encodeURIComponent(sheet.text)}`;

  const webUrl = hasValidPhone
    ? `https://web.whatsapp.com/send?phone=${digits}&text=${encodeURIComponent(sheet.text)}`
    : `https://web.whatsapp.com/send?text=${encodeURIComponent(sheet.text)}`;

  async function copyAction() {
    const ok = await copyText(sheet.text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
      onToast("Reçu copié ! Vous pouvez le coller directement dans WhatsApp ou un SMS.", "success");
    } else {
      onToast("Sélectionnez le texte du reçu pour le copier.", "error");
    }
  }

  async function nativeShareAction() {
    try {
      await navigator.share({ title: sheet.title, text: sheet.text });
      onToast("Partage effectué.", "success");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyAction();
      onToast("Partage direct indisponible : le texte a été copié.", "info");
    }
  }

  function printAction() {
    printDocument({
      title: sheet.title,
      subtitle: sheet.subtitle,
      body: <pre className="print-receipt-text">{sheet.text}</pre>,
    });
  }

  function downloadPdfAction() {
    downloadTextPdf(
      {
        title: sheet.title,
        subtitle: sheet.subtitle,
        lines: sheet.text.split("\n"),
      },
      sheet.fileName.replace(/\.txt$/i, ".pdf"),
    );
    onToast("PDF du reçu téléchargé sur cet appareil.", "success");
  }

  return (
    <div className="share-sheet">
      <div className="receipt-paper">
        <div className="receipt-perforation" />
        <pre>{sheet.text}</pre>
      </div>

      <div className="share-banner-help">
        <Icon name="sparkle" size={16} />
        <div>
          <b>Besoin de partager sur WhatsApp ?</b>
          <span> Sur téléphone, utilisez <b>WhatsApp App</b> ou <b>Partager…</b>. Si un lien web est bloqué par votre navigateur, appuyez sur <b>Copier le texte</b> puis collez-le directement dans votre discussion.</span>
        </div>
      </div>

      <div className="share-actions-grid">
        <button
          type="button"
          className="button share-btn-primary"
          onClick={() => void copyAction()}
        >
          <Icon name={copied ? "check" : "needle"} size={17} />
          {copied ? "✔ Reçu copié dans le presse-papier !" : "Copier tout le texte du reçu"}
        </button>

        {canNativeShare && (
          <button
            type="button"
            className="button button-light share-btn-secondary"
            onClick={() => void nativeShareAction()}
          >
            <Icon name="arrow" size={16} />
            Partager (WhatsApp, SMS…)
          </button>
        )}

        <a
          className="button share-btn-whatsapp-app"
          href={appUrl}
          onClick={() => {
            void copyAction();
          }}
        >
          <Icon name="phone" size={17} />
          Ouvrir dans WhatsApp App
        </a>

        {online && (
          <a
            className="button button-light share-btn-secondary"
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              void copyText(sheet.text);
            }}
          >
            <Icon name="cloud" size={15} />
            WhatsApp Web
          </a>
        )}

        <button
          type="button"
          className="button share-btn-pdf"
          onClick={downloadPdfAction}
        >
          <Icon name="download" size={16} />
          Télécharger le PDF
        </button>

        <button
          type="button"
          className="button button-light share-btn-secondary"
          onClick={printAction}
        >
          <Icon name="calendar" size={15} />
          Imprimer ce reçu
        </button>

        <button
          type="button"
          className="button button-light share-btn-secondary"
          onClick={() => {
            downloadText(sheet.text, sheet.fileName);
            onToast("Fichier reçu téléchargé.", "success");
          }}
        >
          <Icon name="download" size={15} />
          Télécharger (.txt)
        </button>
      </div>
    </div>
  );
}

type InvitationSummary = { id: string; expiresAt: string; createdAt: string };

function InvitePanel({ online, onToast }: { online: boolean; onToast: ToastFn }) {
  const [invites, setInvites] = useState<InvitationSummary[]>([]);
  const [fresh, setFresh] = useState<{ code: string; link: string; expiresAt: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await apiFetch("/api/invitations", { cache: "no-store" });
      if (!response.ok) return;
      const result = (await response.json()) as { invitations: InvitationSummary[] };
      setInvites(result.invitations);
    } catch {
      // Hors-ligne : la liste sera rechargée au retour du réseau.
    }
  }, []);

  useEffect(() => { if (online) void load(); }, [online, load]);

  async function createInvite() {
    setBusy(true);
    try {
      const response = await apiFetch("/api/invitations", { method: "POST" });
      const result = (await response.json()) as { code?: string; expiresAt?: string; error?: string };
      if (!response.ok || !result.code || !result.expiresAt) {
        onToast(result.error ?? "Impossible de créer le code.", "error");
        return;
      }
      setFresh({ code: result.code, expiresAt: result.expiresAt, link: `${window.location.origin}/inscription?code=${encodeURIComponent(result.code)}` });
      onToast("Code d’invitation créé.", "success");
      void load();
    } catch {
      onToast("Connexion impossible : le code n’a pas été créé.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      const response = await apiFetch(`/api/invitations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("revoke");
      setInvites((current) => current.filter((item) => item.id !== id));
      onToast("Invitation annulée.", "info");
    } catch {
      onToast("Annulation impossible pour le moment.", "error");
    }
  }

  const message = fresh
    ? `Bonjour ! Rejoignez notre atelier sur AtelierPLUS.\n\n1. Ouvrez ce lien : ${fresh.link}\n2. Code d’invitation : ${fresh.code}\n\nLe code est valable 7 jours et ne sert qu’une fois.`
    : "";

  return (
    <section className="panel invite-panel">
      <div className="panel-heading">
        <div><p className="eyebrow">AGRANDIR L’ÉQUIPE</p><h2>Inviter un membre</h2></div>
        <button className="button button-primary button-sm" type="button" disabled={busy || !online} onClick={() => void createInvite()}>
          {busy ? <span className="button-spinner" /> : <><Icon name="plus" size={15} />Créer un code</>}
        </button>
      </div>
      <p className="invite-intro"><b>Le membre crée lui-même son compte</b> sur la page d’inscription avec ce code. Valable 7 jours, utilisable une seule fois.</p>
      {!online && <p className="share-tip share-tip-offline"><Icon name="wifi" size={15} /><span><b>Hors-ligne :</b> la création d’invitation nécessite le réseau.</span></p>}
      {fresh && (
        <div className="invite-fresh">
          <small>CODE À TRANSMETTRE</small>
          <strong className="invite-code">{fresh.code}</strong>
          <span className="invite-expiry">Expire le {fullDate(fresh.expiresAt)} · <b>il ne sera plus affiché après fermeture</b></span>
          <div className="share-actions-grid">
            <button
              className="button button-primary share-btn-primary"
              type="button"
              onClick={() => void copyText(message).then((ok) => onToast(ok ? "Invitation copiée !" : "Copie impossible.", ok ? "success" : "error"))}
            >
              <Icon name="check" size={16} />Copier l’invitation
            </button>
            <a
              className="button share-btn-whatsapp-app"
              href={`whatsapp://send?text=${encodeURIComponent(message)}`}
              onClick={() => { void copyText(message); }}
            >
              <Icon name="phone" size={16} />Envoyer par WhatsApp
            </a>
          </div>
        </div>
      )}
      {invites.length > 0 && (
        <div className="invite-list">
          <b>Invitations en attente ({invites.length})</b>
          {invites.map((invite) => (
            <div className="invite-row" key={invite.id}>
              <span className="invite-dot" />
              <span>Créée le {shortDate(invite.createdAt)} · expire le {shortDate(invite.expiresAt)}</span>
              <button type="button" className="text-link" onClick={() => void revoke(invite.id)}>Annuler</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AuthLoading() {
  return <main className="app-loading"><div className="loading-mark"><Icon name="needle" size={25} /></div><span>On prépare votre atelier…</span><div className="loading-line" /></main>;
}

export default function HomePage() {
  const [phase, setPhase] = useState<"loading" | "auth" | "app">("loading");
  const [needsSetup, setNeedsSetup] = useState(false);
  const [data, setData] = useState<AtelierData | null>(null);
  const dataRef = useRef<AtelierData | null>(null);
  const syncingRef = useRef(false);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [tab, setTab] = useState<AppTab>("dashboard");
  const [modal, setModal] = useState<ModalKind>(null);
  const [optionsView, setOptionsView] = useState<ToolView>("home");
  const [preselectedGarment, setPreselectedGarment] = useState<string | undefined>(undefined);
  const [preselectedModelDetails, setPreselectedModelDetails] = useState<ModelOrderDetails | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState<"all" | OrderStatus>("all");
  const [onlyDue, setOnlyDue] = useState(false);
  const [onlyUrgent, setOnlyUrgent] = useState(false);
  const [clientFilter, setClientFilter] = useState<"all" | "due" | "measures" | "femme" | "homme">("all");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [shareSheet, setShareSheet] = useState<ShareSheetState | null>(null);
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [appointmentPrefill, setAppointmentPrefill] = useState<AppointmentPrefill | undefined>(undefined);
  const [selectedFabric, setSelectedFabric] = useState<Fabric | null>(null);
  const [movementDirection, setMovementDirection] = useState<"in" | "out">("out");

  const setDataAndCache = useCallback(async (nextData: AtelierData) => {
    // Old offline snapshots may not know recent feature arrays. Normalize once
    // here so every screen receives a safe, complete workspace shape.
    const normalized = normalizeAtelierData(nextData);
    dataRef.current = normalized;
    setData(normalized);
    await saveSnapshot(normalized).catch(() => undefined);
  }, []);

  const showToast = useCallback((message: string, kind: "success" | "error" | "info" = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast((current) => current?.message === message ? null : current), 3600);
  }, []);

  const syncPending = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.onLine || syncingRef.current || !dataRef.current) return;
    syncingRef.current = true;
    setSyncing(true);
    try {
      const activeUserId = dataRef.current.user.id;
      const queued = await readQueue(activeUserId);
      if (dataRef.current?.user.id !== activeUserId) return;
      setPendingCount(queued.length);
      if (!queued.length) return;
      const response = await apiFetch("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ownerId: activeUserId, operations: queued }),
      });
      if (!response.ok) return;
      const result = (await response.json()) as { results?: { queueId: string; ok: boolean; conflict?: boolean; retry?: boolean; message?: string; orderNumber?: string }[] };
      let shouldReload = false;
      for (const item of result.results ?? []) {
        if (item.retry) break;
        if (item.ok) {
          try {
            await removeFromQueue(item.queueId);
          } catch {
            break;
          }
          shouldReload = true;
          if (item.orderNumber && dataRef.current) {
            const queuedOperation = queued.find((operation) => operation.queueId === item.queueId);
            if (queuedOperation?.type === "order.create") {
              const localData = dataRef.current;
              await setDataAndCache({
                ...localData,
                orders: localData.orders.map((order) => order.id === queuedOperation.payload.id ? { ...order, orderNumber: item.orderNumber as string } : order),
              });
            }
          }
        } else {
          const conflict: SyncConflict = {
            id: item.queueId,
            ownerId: activeUserId,
            message: item.message ?? "Une opération n’a pas pu être appliquée.",
            createdAt: new Date().toISOString(),
            operation: queued.find((operation) => operation.queueId === item.queueId),
          };
          try {
            await moveToConflict(item.queueId, conflict);
          } catch {
            break;
          }
          setConflicts((current) => [conflict, ...current.filter((entry) => entry.id !== conflict.id)]);
          shouldReload = true;
        }
      }
      const remaining = await readQueue(activeUserId).catch(() => []);
      setPendingCount(remaining.length);
      if (shouldReload) {
        const latest = await apiFetch("/api/data", { cache: "no-store" });
        if (latest.ok) {
          const updated = (await latest.json()) as AtelierData;
          if (updated.user.id === activeUserId) await setDataAndCache(updated);
        }
      }
    } catch {
      // La file IndexedDB reste intacte et sera réessayée au prochain retour du réseau.
    } finally {
      syncingRef.current = false;
      setSyncing(false);
    }
  }, [setDataAndCache]);

  useEffect(() => {
    let active = true;
    const updateConnection = () => {
      const connected = navigator.onLine;
      setOnline(connected);
      if (connected) void syncPending();
    };
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    const onGlobalKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setLauncherOpen(true);
      }
    };
    window.addEventListener("keydown", onGlobalKey);
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("beforeinstallprompt", handleInstall);
    setOnline(navigator.onLine);

    async function loadWorkspace() {
      const cached = await readSnapshot().catch(() => null);
      const queued = await readQueue(cached?.user.id).catch(() => []);
      const storedConflicts = await readConflicts(cached?.user.id).catch(() => []);
      if (!active) return;
      setPendingCount(queued.length);
      setConflicts(storedConflicts);
      let authenticatedUserId: string | null = null;
      try {
        const authResponse = await apiFetch("/api/auth", { cache: "no-store" });
        if (!authResponse.ok) throw new Error("auth");
        const session = (await authResponse.json()) as { user: SafeUser | null; needsSetup: boolean };
        if (!active) return;
        if (!session.user) {
          if (session.needsSetup) {
            setNeedsSetup(true);
            setData(null);
            dataRef.current = null;
          } else {
            setNeedsSetup(false);
            setData(null);
            dataRef.current = null;
          }
          setPhase("auth");
          return;
        }
        authenticatedUserId = session.user.id;
        setNeedsSetup(false);
        const [accountQueue, accountConflicts] = await Promise.all([
          readQueue(session.user.id).catch(() => []),
          readConflicts(session.user.id).catch(() => []),
        ]);
        setPendingCount(accountQueue.length);
        setConflicts(accountConflicts);
        const dataResponse = await apiFetch("/api/data", { cache: "no-store" });
        if (dataResponse.ok) {
          const remote = (await dataResponse.json()) as AtelierData;
          if (active) await setDataAndCache(remote);
        } else if (cached?.user.id === session.user.id) {
          await setDataAndCache(cached);
        } else {
          await setDataAndCache({ user: session.user, clients: [], measurements: [], orders: [], payments: [], expenses: [], team: [], teamNames: [], appointments: [], fabrics: [], fabricMovements: [], inspirationModels: [] });
        }
        if (!active) return;
        setPhase("app");
        if (navigator.onLine) void syncPending();
      } catch {
        if (!active) return;
        if (cached && (!authenticatedUserId || cached.user.id === authenticatedUserId)) {
          const normalizedCached = normalizeAtelierData(cached);
          dataRef.current = normalizedCached;
          setData(normalizedCached);
          const [cachedQueue, cachedConflicts] = await Promise.all([
            readQueue(cached.user.id).catch(() => []),
            readConflicts(cached.user.id).catch(() => []),
          ]);
          setPendingCount(cachedQueue.length);
          setConflicts(cachedConflicts);
          setPhase("app");
        } else {
          dataRef.current = null;
          setData(null);
          setNeedsSetup(false);
          setPhase("auth");
        }
      }
    }
    void loadWorkspace();
    return () => {
      active = false;
      window.removeEventListener("keydown", onGlobalKey);
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("beforeinstallprompt", handleInstall);
    };
  }, [setDataAndCache, syncPending]);

  async function authenticate(user: SafeUser) {
    // Keep this account's last known data if the server cannot be reached,
    // instead of showing an empty workshop.
    const cached = await readSnapshot().catch(() => null);
    // The login/registration response already saved the token to web storage.
    // In embedded frames web storage may be blocked, so recover it from
    // IndexedDB now that the browser had time to settle.
    try {
      const asyncToken = await import("@/lib/api-client").then((m) => m.getStoredTokenAsync());
      if (asyncToken && !(await import("@/lib/api-client").then((m) => m.getStoredToken()))) {
        await import("@/lib/api-client").then((m) => m.saveStoredToken(asyncToken));
      }
    } catch {
      // IndexedDB unavailable: fall back to in-memory token only.
    }
    try {
      const response = await apiFetch("/api/data", { cache: "no-store" });
      if (response.ok) {
        const remote = (await response.json()) as AtelierData;
        await setDataAndCache(remote);
      } else if (cached?.user.id === user.id) {
        await setDataAndCache(cached);
      } else {
        await setDataAndCache({ user, clients: [], measurements: [], orders: [], payments: [], expenses: [], team: [], teamNames: [], appointments: [], fabrics: [], fabricMovements: [], inspirationModels: [] });
      }
    } catch {
      if (cached?.user.id === user.id) {
        await setDataAndCache(cached);
      } else {
        await setDataAndCache({ user, clients: [], measurements: [], orders: [], payments: [], expenses: [], team: [], teamNames: [], appointments: [], fabrics: [], fabricMovements: [], inspirationModels: [] });
      }
    }
    const [accountQueue, accountConflicts] = await Promise.all([
      readQueue(user.id).catch(() => []),
      readConflicts(user.id).catch(() => []),
    ]);
    setPendingCount(accountQueue.length);
    setConflicts(accountConflicts);
    setNeedsSetup(false);
    setPhase("app");
    if (navigator.onLine) void syncPending();
  }

  async function commitOperations(
    operations: OfflineOperation[],
    update: (current: AtelierData) => AtelierData,
  ): Promise<boolean> {
    const current = dataRef.current;
    if (!current) {
      showToast("La session a changé. Reconnectez-vous avant d’enregistrer.", "error");
      return false;
    }

    const storedQueueIds: string[] = [];
    try {
      for (const operation of operations) {
        await addToQueue(operation, current.user.id);
        storedQueueIds.push(operation.queueId);
      }
    } catch {
      await Promise.all(storedQueueIds.map((queueId) => removeFromQueue(queueId).catch(() => undefined)));
      showToast("Le stockage hors-ligne est indisponible. Aucune modification n’a été enregistrée.", "error");
      return false;
    }

    if (dataRef.current?.user.id !== current.user.id) {
      await Promise.all(storedQueueIds.map((queueId) => removeFromQueue(queueId).catch(() => undefined)));
      showToast("La session a changé. Réessayez depuis le compte actif.", "error");
      return false;
    }
    await setDataAndCache(update(current));
    const queued = await readQueue(current.user.id).catch(() => null);
    if (queued) setPendingCount(queued.length);
    if (navigator.onLine) void syncPending();
    return true;
  }

  async function saveClient(draft: ClientDraft, values: MeasurementValues) {
    const operations: OfflineOperation[] = [{ queueId: makeId(), type: "client.upsert", payload: draft }];
    const measuredAt = new Date().toISOString();
    const measurement = Object.keys(values).length ? { id: makeId(), clientId: draft.id, values, measuredAt } : null;
    if (measurement) operations.push({ queueId: makeId(), type: "measurement.create", payload: measurement });
    const saved = await commitOperations(operations, (current) => ({
      ...current,
      clients: [draft, ...current.clients.filter((client) => client.id !== draft.id)].sort((a, b) => a.name.localeCompare(b.name, "fr")),
      measurements: measurement ? [ { ...measurement, createdBy: current.user.id }, ...current.measurements ] : current.measurements,
    }));
    if (!saved) return;
    setModal(null);
    showToast(values && Object.keys(values).length ? "Client et mensurations enregistrés." : "Fiche client enregistrée.");
  }

  async function saveMeasurement(values: MeasurementValues) {
    if (!selectedClientId) return;
    const measurement = { id: makeId(), clientId: selectedClientId, values, measuredAt: new Date().toISOString() };
    const operation: OfflineOperation = { queueId: makeId(), type: "measurement.create", payload: measurement };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      measurements: [{ ...measurement, createdBy: current.user.id }, ...current.measurements],
    }));
    if (!saved) return;
    setModal("client-details");
    showToast("Nouveau relevé ajouté à l’historique.");
  }

  async function saveOrder(
    draft: Omit<AtelierOrder, "orderNumber" | "revision" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"> & { createdAt: string },
    firstPayment: number,
    fabricUsage?: { fabricId: string; metres: number },
  ) {
    if (!dataRef.current) return;
    const draftForSync = { ...draft, totalAmount: draft.totalAmount ?? 0 };
    const operation: OfflineOperation = { queueId: makeId(), type: "order.create", payload: draftForSync };
    const nextOrder: AtelierOrder = {
      ...draft,
      orderNumber: `LOCAL-${draft.id.slice(0, 5).toUpperCase()}`,
      totalAmount: dataRef.current.user.role === "owner" ? draft.totalAmount : null,
      revision: 1,
      createdBy: dataRef.current.user.id,
      updatedBy: dataRef.current.user.id,
      updatedAt: draft.createdAt,
    };
    const operations: OfflineOperation[] = [operation];
    let fabricMovementOp: OfflineOperation | null = null;
    let fabricDeltaCm = 0;
    if (fabricUsage && fabricUsage.metres > 0 && dataRef.current) {
      fabricDeltaCm = -metresToCm(fabricUsage.metres);
      const movementDraft = {
        id: makeId(),
        fabricId: fabricUsage.fabricId,
        deltaCm: fabricDeltaCm,
        reason: "cutting" as const,
        orderId: draft.id,
        note: "Coupe commande",
        createdAt: new Date().toISOString(),
      };
      fabricMovementOp = { queueId: makeId(), type: "fabric.movement", payload: movementDraft };
      operations.push(fabricMovementOp);
    }
    let localPayment: AtelierData["payments"][number] | null = null;
    if (firstPayment > 0) {
      const paymentDraft: PaymentDraft = { id: makeId(), orderId: draft.id, amount: firstPayment, paidAt: new Date().toISOString(), note: "Acompte" };
      operations.push({ queueId: makeId(), type: "payment.create", payload: paymentDraft });
      if (dataRef.current.user.role === "owner") localPayment = { ...paymentDraft, createdBy: dataRef.current.user.id };
    }
    const movementForCache = fabricMovementOp && fabricMovementOp.type === "fabric.movement" ? fabricMovementOp.payload : null;
    const saved = await commitOperations(operations, (current) => ({
      ...current,
      orders: [nextOrder, ...current.orders],
      payments: localPayment ? [localPayment, ...current.payments] : current.payments,
      fabrics: fabricUsage
        ? current.fabrics.map((fabric) =>
            fabric.id === fabricUsage.fabricId ? { ...fabric, quantityCm: fabric.quantityCm + fabricDeltaCm } : fabric,
          )
        : current.fabrics,
      fabricMovements:
        movementForCache && current.user.role === "owner"
          ? [{ ...movementForCache, createdBy: current.user.id, createdAt: movementForCache.createdAt }, ...current.fabricMovements]
          : current.fabricMovements,
    }));
    if (!saved) return;
    setModal(null);
    setTab("orders");
    showToast(online ? "Commande ajoutée à la file de synchronisation." : "Commande enregistrée hors-ligne.", "success");
  }

  async function savePayment(draft: PaymentDraft) {
    const operation: OfflineOperation = { queueId: makeId(), type: "payment.create", payload: draft };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      payments: current.user.role === "owner" ? [{ ...draft, createdBy: current.user.id }, ...current.payments] : current.payments,
    }));
    if (!saved) return;
    setModal(null);
    showToast(online ? "Paiement enregistré." : "Paiement enregistré hors-ligne.");
  }

  async function saveExpense(draft: ExpenseDraft) {
    const operation: OfflineOperation = { queueId: makeId(), type: "expense.create", payload: draft };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      expenses: [{ ...draft, createdBy: current.user.id, createdAt: new Date().toISOString() }, ...current.expenses],
    }));
    if (!saved) return;
    setModal(null);
    showToast(online ? "Dépense enregistrée." : "Dépense enregistrée hors-ligne.");
  }

  async function saveAppointment(draft: AppointmentDraft) {
    const operation: OfflineOperation = { queueId: makeId(), type: "appointment.create", payload: draft };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      appointments: [
        { ...draft, status: "scheduled" as const, createdBy: current.user.id, updatedAt: draft.createdAt },
        ...current.appointments,
      ].sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? "")),
    }));
    if (!saved) return;
    setModal(null);
    setAppointmentPrefill(undefined);
    showToast(online ? "Rendez-vous planifié." : "Rendez-vous enregistré hors-ligne.");
  }

  async function updateAppointmentStatus(appointment: Appointment, status: AppointmentStatus) {
    if (appointment.status === status || !dataRef.current) return;
    const operation: OfflineOperation = {
      queueId: makeId(),
      type: "appointment.status",
      payload: { appointmentId: appointment.id, status },
    };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === appointment.id ? { ...item, status, updatedAt: new Date().toISOString() } : item,
      ),
    }));
    if (!saved) return;
    showToast(
      status === "done" ? "Rendez-vous terminé." : status === "cancelled" ? "Rendez-vous annulé." : "Rendez-vous reprogrammé.",
      "info",
    );
  }

  async function remindAppointment(appointment: Appointment) {
    const current = dataRef.current;
    if (!current) return;
    const client = current.clients.find((item) => item.id === appointment.clientId);
    const clientName = client?.name ?? "Bonjour";
    const workshop = current.user.atelierName || "AtelierPLUS";
    const kindWord = appointment.kind === "fitting" ? "votre essayage" : appointment.kind === "delivery" ? "la livraison de votre commande" : "votre rendez-vous";
    const text = [
      `Bonjour ${clientName},`,
      "",
      `Rappel de ${workshop} : ${kindWord} « ${appointment.title} » est prévu le ${fullDate(appointment.date)}${appointment.time ? ` à ${appointment.time}` : ""}.`,
      "",
      "À très vite ! ✂",
    ].join("\n");
    setShareSheet({
      title: "Rappel de rendez-vous",
      subtitle: `${clientName} · ${fullDate(appointment.date)}${appointment.time ? ` à ${appointment.time}` : ""}`,
      text,
      phone: client?.phone ?? null,
      fileName: `rappel-rdv-${appointment.date}.txt`,
    });
    setModal("share");
  }

  function planDeliveryForOrder(order: AtelierOrder) {
    const client = dataRef.current?.clients.find((item) => item.id === order.clientId);
    setAppointmentPrefill({
      clientId: order.clientId,
      orderId: order.id,
      kind: "delivery",
      title: `Livraison ${order.orderNumber.startsWith("LOCAL-") ? "commande" : `#${order.orderNumber}`}${client ? ` — ${client.name}` : ""}`,
      date: order.dueDate || localDateValue(),
    });
    setModal("appointment");
  }

  async function saveFabric(draft: FabricDraft) {
    const operation: OfflineOperation = { queueId: makeId(), type: "fabric.create", payload: draft };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      fabrics: [
        { ...draft, createdBy: current.user.id, updatedAt: draft.createdAt },
        ...current.fabrics,
      ].sort((a, b) => a.name.localeCompare(b.name, "fr")),
    }));
    if (!saved) return;
    setModal(null);
    showToast(online ? "Tissu ajouté au stock." : "Tissu enregistré hors-ligne.");
  }

  async function saveFabricMovement(draft: FabricMovementDraft) {
    const operation: OfflineOperation = { queueId: makeId(), type: "fabric.movement", payload: draft };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      fabrics: current.fabrics.map((fabric) =>
        fabric.id === draft.fabricId ? { ...fabric, quantityCm: fabric.quantityCm + draft.deltaCm } : fabric,
      ),
      fabricMovements:
        current.user.role === "owner"
          ? [{ ...draft, createdBy: current.user.id, createdAt: draft.createdAt }, ...current.fabricMovements]
          : current.fabricMovements,
    }));
    if (!saved) return;
    setModal(null);
    setSelectedFabric(null);
    showToast(draft.deltaCm > 0 ? "Entrée de stock enregistrée." : "Sortie de stock enregistrée.");
  }

  function openFabricAdjust(fabric: Fabric, direction: "in" | "out") {
    setSelectedFabric(fabric);
    setMovementDirection(direction);
    setModal("fabric-movement");
  }

  async function saveInspirationModel(draft: InspirationModelDraft) {
    const operation: OfflineOperation = { queueId: makeId(), type: "inspiration.create", payload: draft };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      inspirationModels: [
        { ...draft, createdBy: current.user.id, updatedAt: draft.createdAt },
        ...current.inspirationModels,
      ],
    }));
    if (!saved) return;
    showToast(online ? "Modèle ajouté au catalogue de l’atelier." : "Modèle enregistré hors-ligne.");
  }

  async function deleteInspirationModel(model: InspirationModel) {
    const current = dataRef.current;
    if (!current) return;
    const canDelete = current.user.role === "owner" || model.createdBy === current.user.id;
    if (!canDelete) {
      showToast("Seul le créateur ou le patron peut supprimer ce modèle.", "error");
      return;
    }
    const confirmed = window.confirm(`Supprimer « ${model.title} » du catalogue de l’atelier ?`);
    if (!confirmed) return;
    const operation: OfflineOperation = { queueId: makeId(), type: "inspiration.delete", payload: { modelId: model.id } };
    const saved = await commitOperations([operation], (workspace) => ({
      ...workspace,
      inspirationModels: workspace.inspirationModels.filter((item) => item.id !== model.id),
    }));
    if (!saved) return;
    showToast("Modèle supprimé du catalogue.", "info");
  }

  async function saveTeamMember(fullName: string, phone: string, password: string) {
    try {
      const response = await apiFetch("/api/team", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, password }),
      });
      const result = (await response.json()) as { member?: SafeUser; error?: string };
      if (!response.ok || !result.member) {
        showToast(result.error ?? "Impossible de créer ce compte.", "error");
        return;
      }
      if (dataRef.current) {
        const member = { ...result.member, createdAt: new Date().toISOString() };
        await setDataAndCache({ ...dataRef.current, team: [...dataRef.current.team, member] });
      }
      setModal(null);
      showToast(`${fullName} a maintenant un compte membre.`);
    } catch {
      showToast("Connexion impossible. Le compte n’a pas été créé.", "error");
    }
  }

  async function shareOrder(order: AtelierOrder, kind: "receipt" | "balance" | "ready") {
    const current = dataRef.current;
    if (!current) return;
    const client = current.clients.find((item) => item.id === order.clientId);
    const clientName = client?.name ?? "Bonjour";
    const paid = current.payments.filter((payment) => payment.orderId === order.id).reduce((sum, payment) => sum + payment.amount, 0);
    const due = Math.max(0, (order.totalAmount ?? 0) - paid);
    const workshop = current.user.atelierName || "AtelierPLUS";

    const orderLabel = order.orderNumber.startsWith("LOCAL-") ? "en cours d’enregistrement" : `#${order.orderNumber}`;
    const lines = kind === "ready"
      ? [
          `Bonjour ${clientName},`,
          "",
          `✂ Votre vêtement est prêt !`,
          `Commande : ${orderLabel} (${garmentName(order.garment)})`,
          due > 0 && current.user.role === "owner" ? `Solde à régler au retrait : ${money(due)}` : "",
          "",
          `Nous vous attendons avec plaisir chez ${workshop}.`,
          "À très bientôt !",
        ].filter((line, index, all) => line !== "" || (index > 0 && all[index - 1] !== ""))
      : kind === "balance"
        ? [
            `Bonjour ${clientName},`,
            "",
            `Petit rappel concernant votre commande ${orderLabel} (${garmentName(order.garment)}).`,
            `Reste à régler : ${money(due)}`,
            "",
            `Merci de votre confiance,\n${workshop}`,
          ]
        : [
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            `   ${workshop.toUpperCase()}`,
            "   REÇU DE COMMANDE",
            "━━━━━━━━━━━━━━━━━━━━━━━━",
            `Commande : ${orderLabel}`,
            `Date : ${fullDate(order.createdAt)}`,
            `Client : ${clientName}`,
            `Vêtement : ${garmentName(order.garment)}${order.model ? ` (${order.model})` : ""}`,
            order.dueDate ? `Livraison prévue : ${fullDate(order.dueDate)}` : "",
            "────────────────────────",
            `Prix convenu   : ${money(order.totalAmount)}`,
            `Montant reçu   : ${money(paid)}`,
            `RESTE À PAYER  : ${money(due)}`,
            due === 0 ? "✔ COMMANDE SOLDÉE" : "",
            "────────────────────────",
            "Merci de votre confiance ✂",
          ].filter((line) => line !== undefined);

    const titles = { receipt: "Reçu de commande", balance: "Rappel de solde", ready: "Commande prête" } as const;
    setShareSheet({
      title: titles[kind],
      subtitle: `${clientName} · ${garmentName(order.garment)}`,
      text: lines.join("\n"),
      phone: client?.phone ?? null,
      fileName: `${kind === "receipt" ? "recu" : kind === "balance" ? "rappel" : "commande-prete"}-${order.orderNumber.toLowerCase()}.txt`,
    });
    setModal("share");
  }

  async function exportWorkspace() {
    const current = dataRef.current;
    if (!current || current.user.role !== "owner") return;
    const [queuedOperations, syncConflicts] = await Promise.all([
      readQueue(current.user.id).catch(() => []),
      readConflicts(current.user.id).catch(() => []),
    ]);
    const backup = {
      application: "AtelierPLUS",
      format: "atelierplus-backup-v2",
      exportedAt: new Date().toISOString(),
      user: current.user,
      clients: current.clients,
      measurements: current.measurements,
      orders: current.orders,
      payments: current.payments,
      expenses: current.expenses,
      team: current.team,
      appointments: current.appointments,
      fabrics: current.fabrics,
      fabricMovements: current.fabricMovements,
      inspirationModels: current.inspirationModels,
      queuedOperations,
      syncConflicts,
    };
    const file = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = `atelierplus-sauvegarde-${localDateValue()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(`Sauvegarde exportée${queuedOperations.length ? ` avec ${queuedOperations.length} opération${queuedOperations.length === 1 ? "" : "s"} en attente` : ""}.`);
  }

  async function changeOrderStatus(order: AtelierOrder, nextStatus: OrderStatus) {
    if (!dataRef.current || order.status === nextStatus) return;
    const operation: OfflineOperation = {
      queueId: makeId(),
      type: "order.status",
      payload: { orderId: order.id, status: nextStatus, expectedRevision: order.revision },
    };
    const saved = await commitOperations([operation], (current) => ({
      ...current,
      orders: current.orders.map((item) => item.id === order.id ? { ...item, status: nextStatus, revision: item.revision + 1, updatedAt: new Date().toISOString() } : item),
    }));
    if (!saved) return;
    showToast(`Statut mis à jour : ${statusLabel(nextStatus)}.`, "info");
  }

  async function advanceOrder(order: AtelierOrder) {
    const currentIndex = ORDER_STATUSES.findIndex((status) => status.value === order.status);
    if (currentIndex < 0 || currentIndex >= ORDER_STATUSES.length - 1) return;
    const nextStatus = ORDER_STATUSES[currentIndex + 1].value;
    await changeOrderStatus(order, nextStatus);
  }

  async function logout() {
    const ownerId = dataRef.current?.user.id;
    if (!ownerId) return;
    if (!navigator.onLine) {
      showToast("Pour vous déconnecter sans perdre vos saisies, reconnectez-vous d’abord à internet.", "info");
      return;
    }

    let queued;
    try {
      queued = await readQueue(ownerId);
    } catch {
      showToast("Impossible de vérifier les saisies en attente. Réessayez avant de vous déconnecter.", "error");
      return;
    }

    if (queued.length > 0) {
      await syncPending();
      try {
        queued = await readQueue(ownerId);
      } catch {
        showToast("Vérification interrompue. Vos saisies restent sur cet appareil.", "error");
        return;
      }
      setPendingCount(queued.length);
      if (queued.length > 0) {
        showToast(`${queued.length} saisie${queued.length === 1 ? " attend" : "s attendent"} la synchronisation. Vous restez connecté pour ne rien perdre.`, "info");
        return;
      }
    }

    let outstandingConflicts: SyncConflict[];
    try {
      outstandingConflicts = await readConflicts(ownerId);
    } catch {
      showToast("Impossible de vérifier les alertes de synchronisation. Réessayez avant de vous déconnecter.", "error");
      return;
    }
    if (outstandingConflicts.length > 0) {
      showToast("Lisez ou prenez en compte l’alerte de synchronisation avant de fermer cette session.", "info");
      return;
    }

    try {
      const response = await apiFetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout" }),
      });
      if (!response.ok) {
        showToast("Déconnexion impossible pour le moment. Réessayez dans un instant.", "error");
        return;
      }
    } catch {
      showToast("Connexion interrompue. Votre session est conservée sur cet appareil.", "error");
      return;
    }

    clearStoredToken();
    let localCacheCleared = true;
    try {
      await clearLocalWorkspace(ownerId);
    } catch {
      localCacheCleared = false;
    }
    dataRef.current = null;
    setData(null);
    setPendingCount(0);
    setConflicts([]);
    setModal(null);
    setTab("dashboard");
    setNeedsSetup(false);
    setPhase("auth");
    if (!localCacheCleared) {
      showToast("Session fermée. Le cache local n’a pas pu être effacé; verrouillez cet appareil.", "error");
    }
  }

  async function dismissConflict(conflictId: string) {
    await removeConflict(conflictId).catch(() => undefined);
    setConflicts((current) => current.filter((item) => item.id !== conflictId));
  }

  const isOwner = data?.user.role === "owner";
  const atelierDisplayName = data?.user.atelierName || "Mon atelier";
  const clientsById = useMemo(() => new Map((data?.clients ?? []).map((client) => [client.id, client])), [data?.clients]);
  const teamNamesById = useMemo(() => new Map((data?.teamNames ?? []).map((member) => [member.id, member.fullName])), [data?.teamNames]);
  const paymentTotals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const payment of data?.payments ?? []) totals.set(payment.orderId, (totals.get(payment.orderId) ?? 0) + payment.amount);
    return totals;
  }, [data?.payments]);
  const query = search.trim().toLocaleLowerCase("fr");
  const allOrders = useMemo(() => data?.orders ?? [], [data?.orders]);
  const visibleOrders = useMemo(() => {
    return allOrders
      .filter((order) => orderFilter === "all" || order.status === orderFilter)
      .filter((order) => {
        if (!onlyDue) return true;
        const paid = paymentTotals.get(order.id) ?? 0;
        return (order.totalAmount ?? 0) - paid > 0;
      })
      .filter((order) => {
        if (!onlyUrgent) return true;
        if (!order.dueDate || order.status === "delivered") return false;
        const dueTime = new Date(order.dueDate).getTime();
        const nowTime = Date.now();
        const diffDays = (dueTime - nowTime) / (1000 * 60 * 60 * 24);
        // No lower bound: an order 3 days late is even more urgent than one due soon.
        return diffDays <= 7;
      })
      .filter((order) => {
        if (!query) return true;
        const client = clientsById.get(order.clientId);
        return [order.orderNumber, garmentName(order.garment), order.model, client?.name, client?.phone].some((value) => value?.toLocaleLowerCase("fr").includes(query));
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [allOrders, orderFilter, onlyDue, onlyUrgent, query, clientsById, paymentTotals]);

  const visibleClients = useMemo(() => {
    return (data?.clients ?? [])
      .filter((client) => {
        if (clientFilter === "due") {
          const due = allOrders
            .filter((o) => o.clientId === client.id && o.totalAmount !== null)
            .reduce((sum, o) => sum + Math.max(0, (o.totalAmount ?? 0) - (paymentTotals.get(o.id) ?? 0)), 0);
          return due > 0;
        }
        if (clientFilter === "measures") {
          return (data?.measurements ?? []).some((m) => m.clientId === client.id);
        }
        if (clientFilter === "femme") return client.gender === "femme";
        if (clientFilter === "homme") return client.gender === "homme";
        return true;
      })
      .filter((client) => !query || `${client.name} ${client.phone ?? ""}`.toLocaleLowerCase("fr").includes(query));
  }, [data?.clients, data?.measurements, clientFilter, allOrders, paymentTotals, query]);

  const selectedClient = selectedClientId ? clientsById.get(selectedClientId) : undefined;
  const selectedOrder = selectedOrderId ? allOrders.find((order) => order.id === selectedOrderId) : undefined;
  const dateNow = new Date();
  const monthStart = new Date(dateNow.getFullYear(), dateNow.getMonth(), 1);
  const monthOrders = allOrders.filter((order) => new Date(order.createdAt) >= monthStart);
  const monthPayments = (data?.payments ?? []).filter((payment) => new Date(payment.paidAt) >= monthStart);
  const monthExpenses = (data?.expenses ?? []).filter((expense) => new Date(`${expense.date}T12:00:00`) >= monthStart);
  const activeOrders = allOrders.filter((order) => order.status !== "delivered");
  const readyOrders = allOrders.filter((order) => order.status === "ready");
  const upcomingOrders = allOrders.filter((order) => order.status !== "delivered" && order.dueDate).sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "")).slice(0, 4);
  const allAppointments = data?.appointments ?? [];
  const scheduledAppointments = allAppointments.filter((item) => item.status === "scheduled");
  const todayStr = localDateValue();
  const todayAppointments = scheduledAppointments
    .filter((item) => item.date === todayStr)
    .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
  const tomorrowStr = (() => {
    const date = new Date(`${todayStr}T12:00:00`);
    date.setDate(date.getDate() + 1);
    const offset = date.getTimezoneOffset();
    return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 10);
  })();
  const tomorrowAppointments = scheduledAppointments.filter((item) => item.date === tomorrowStr);
  const allFabrics = data?.fabrics ?? [];
  const lowStockFabrics = allFabrics
    .filter((fabric) => fabric.quantityCm <= fabric.minThresholdCm)
    .sort((a, b) => a.quantityCm - a.minThresholdCm - (b.quantityCm - b.minThresholdCm));
  const lateOrders = activeOrders.filter((order) => order.dueDate && new Date(`${order.dueDate}T23:59:59`).getTime() < Date.now());
  const debtorClients = isOwner
    ? (data?.clients ?? [])
        .map((client) => {
          const unpaidOrders = allOrders
            .filter((order) => order.clientId === client.id && (order.totalAmount ?? 0) - (paymentTotals.get(order.id) ?? 0) > 0)
            .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
          const due = unpaidOrders.reduce((sum, order) => sum + Math.max(0, (order.totalAmount ?? 0) - (paymentTotals.get(order.id) ?? 0)), 0);
          return { client, due, oldestUnpaid: unpaidOrders[0] };
        })
        .filter((entry) => entry.due > 0)
        .sort((a, b) => b.due - a.due)
        .slice(0, 5)
    : [];
  const openBalance = isOwner ? allOrders.reduce((sum, order) => sum + Math.max(0, (order.totalAmount ?? 0) - (paymentTotals.get(order.id) ?? 0)), 0) : 0;
  const debtClientCount = isOwner ? new Set(allOrders.filter((order) => (order.totalAmount ?? 0) - (paymentTotals.get(order.id) ?? 0) > 0).map((order) => order.clientId)).size : 0;
  const greeting = dateNow.getHours() < 12 ? "Bonjour" : dateNow.getHours() < 18 ? "Bon après-midi" : "Bonsoir";
  const displayDate = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long" }).format(dateNow);

  if (phase === "loading") return <AuthLoading />;
  if (phase === "auth") return <AuthScreen needsSetup={needsSetup} onAuthenticated={authenticate} installPrompt={installPrompt} />;
  if (!data) return <AuthLoading />;

  // The launcher searches both navigation actions and real workshop records.
  // Records are capped so the list stays fast on a large client book.
  const launcherItems: LauncherItem[] = [
    { id: "nav-dashboard", group: "Aller à", label: "Vue d’ensemble", hint: "Tableau de bord de l’atelier", icon: <Icon name="home" size={17} />, run: () => setTab("dashboard") },
    { id: "nav-clients", group: "Aller à", label: "Clients & mesures", hint: "Carnet de clients", icon: <Icon name="clients" size={17} />, run: () => setTab("clients") },
    { id: "nav-orders", group: "Aller à", label: "Commandes", hint: "Toutes les commandes", icon: <Icon name="orders" size={17} />, run: () => setTab("orders") },
    { id: "nav-agenda", group: "Aller à", label: "Agenda", hint: "Essayages et livraisons", icon: <Icon name="calendar" size={17} />, run: () => setTab("agenda") },
    { id: "nav-expenses", group: "Aller à", label: "Dépenses", hint: "Suivi des sorties", icon: <Icon name="wallet" size={17} />, ownerOnly: true, run: () => setTab("expenses") },
    { id: "nav-team", group: "Aller à", label: "Mon équipe", hint: "Comptes et invitations", icon: <Icon name="team" size={17} />, ownerOnly: true, run: () => setTab("team") },
    { id: "create-client", group: "Créer", label: "Nouveau client", hint: "Fiche client et mensurations", icon: <Icon name="plus" size={17} />, run: () => setModal("client") },
    { id: "create-order", group: "Créer", label: "Nouvelle commande", hint: "Client, vêtement, prix", icon: <Icon name="plus" size={17} />, run: openOrder },
    { id: "create-appointment", group: "Créer", label: "Planifier un rendez-vous", hint: "Essayage ou livraison", icon: <Icon name="calendar" size={17} />, run: () => { setAppointmentPrefill(undefined); setModal("appointment"); } },
    { id: "create-expense", group: "Créer", label: "Ajouter une dépense", icon: <Icon name="plus" size={17} />, ownerOnly: true, run: () => setModal("expense") },
    { id: "tool-guide", group: "Outils", label: "Guide des mesures", hint: "19 points illustrés", icon: <Icon name="ruler" size={17} />, run: openGuide },
    { id: "tool-fabric", group: "Outils", label: "Calcul de tissu", hint: "Estimer le métrage", icon: <Icon name="ruler" size={17} />, run: () => openOptions("fabric") },
    { id: "tool-photo", group: "Outils", label: "Mesure par photo", hint: "Estimation au téléphone", icon: <Icon name="phone" size={17} />, run: () => openOptions("photo") },
    { id: "tool-reminders", group: "Outils", label: "Rappels", hint: "Relances WhatsApp groupées", icon: <Icon name="bell" size={17} />, run: () => openOptions("reminders") },
    { id: "tool-stock", group: "Outils", label: "Stock tissu", hint: "Rouleaux et mètres", icon: <Icon name="wallet" size={17} />, ownerOnly: true, run: () => openOptions("stock") },
    { id: "tool-stats", group: "Outils", label: "Statistiques", hint: "Chiffres clés", icon: <Icon name="trend" size={17} />, ownerOnly: true, run: () => openOptions("statistics") },
    { id: "tool-inspiration", group: "Outils", label: "Inspiration", hint: "Modèles et idées", icon: <Icon name="shirt" size={17} />, run: () => openOptions("inspiration") },
    { id: "atelier-export", group: "Atelier", label: "Exports et sauvegardes", hint: "JSON, Excel, CSV", icon: <Icon name="download" size={17} />, ownerOnly: true, run: () => openOptions("settings") },
    { id: "atelier-plan", group: "Atelier", label: "Abonnement", hint: "Plan de l’atelier", icon: <Icon name="wallet" size={17} />, ownerOnly: true, run: () => openOptions("plan") },
    { id: "atelier-sync", group: "Atelier", label: "Synchroniser maintenant", icon: <Icon name="cloud" size={17} />, run: () => (online ? void syncPending() : showToast("Vous êtes hors-ligne. Vos saisies restent sur cet appareil.", "info")) },
  ];

  const orderCountByClient = new Map<string, number>();
  for (const order of allOrders) {
    orderCountByClient.set(order.clientId, (orderCountByClient.get(order.clientId) ?? 0) + 1);
  }

  const clientEntries: LauncherItem[] = (data?.clients ?? []).slice(0, 150).map((client) => ({
    id: `client-${client.id}`,
    group: "Clients",
    label: client.name,
    hint: client.phone ?? "Pas de téléphone",
    meta: `${orderCountByClient.get(client.id) ?? 0} cmd`,
    icon: <Icon name="clients" size={17} />,
    run: () => openClientDetails(client.id),
  }));

  const orderEntries: LauncherItem[] = allOrders.slice(0, 150).map((order) => ({
    id: `order-${order.id}`,
    group: "Commandes",
    label: order.orderNumber.startsWith("LOCAL-") ? "Commande en cours d’envoi" : `#${order.orderNumber}`,
    hint: `${garmentName(order.garment)} · ${clientsById.get(order.clientId)?.name ?? "Client"}`,
    meta: statusLabel(order.status),
    icon: <Icon name="orders" size={17} />,
    run: () => openOrderDetails(order),
  }));

  const fabricEntries: LauncherItem[] = (data?.fabrics ?? []).slice(0, 80).map((fabric) => ({
    id: `fabric-${fabric.id}`,
    group: "Stock",
    label: fabric.name,
    hint: fabric.color ?? "Tissu de l’atelier",
    meta: cmToMetres(fabric.quantityCm),
    icon: <Icon name="wallet" size={17} />,
    run: () => openOptions("stock"),
  }));

  const modelEntries: LauncherItem[] = INSPIRATION_CATALOG.slice(0, 20).map((model) => ({
    id: `model-${model.id}`,
    group: "Modèles",
    label: model.title,
    hint: model.description,
    meta: model.audience,
    icon: <Icon name="shirt" size={17} />,
    run: () => openOrderWithGarment(model.garment, catalogOrderDetails(model)),
  }));

  launcherItems.push(...clientEntries, ...orderEntries, ...fabricEntries, ...modelEntries);

  const navItems = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);
  const pageTitles: Record<AppTab, { title: string; eyebrow: string }> = {
    dashboard: { title: "Votre atelier, au clair.", eyebrow: "VUE D’ENSEMBLE" },
    orders: { title: "Les commandes", eyebrow: "LE CARNET DE L’ATELIER" },
    clients: { title: "Les clients", eyebrow: "CLIENTS & MENSURATIONS" },
    agenda: { title: "L’agenda", eyebrow: "ESSAYAGES & LIVRAISONS" },
    expenses: { title: "Les dépenses", eyebrow: "SUIVI DE L’ATELIER" },
    team: { title: "Votre équipe", eyebrow: "COMPTES & INVITATIONS" },
  };
  const currentPage = pageTitles[tab];
  const ownerCollections = monthPayments.reduce((sum, payment) => sum + payment.amount, 0);
  const currentMonthName = new Intl.DateTimeFormat("fr-FR", { month: "long" }).format(dateNow);

  function openOrder() { setPreselectedGarment(undefined); setPreselectedModelDetails(undefined); setModal("order"); }
  function openClientDetails(clientId: string) { setSelectedClientId(clientId); setModal("client-details"); }
  function openOrderDetails(order: AtelierOrder) { setSelectedOrderId(order.id); setModal("order-details"); }
  function openPayment(order: AtelierOrder) { setSelectedOrderId(order.id); setModal("payment"); }
  function startClientFromOrder() { setModal("client"); }
  function openGuide() { setModal("measurement-guide"); }
  function openOrderWithGarment(garmentValue: string, details?: ModelOrderDetails) {
    setPreselectedGarment(garmentValue);
    setPreselectedModelDetails(details);
    setModal("order");
  }
  function openOptions(view: ToolView = "home") { setOptionsView(view); setModal("options"); }
  function openWorkshopSettings() { if (isOwner) openOptions("settings"); }

  function renderInspirationCatalog(key: string) {
    const currentData = dataRef.current;
    if (!currentData) return null;
    return (
      <InspirationView
        key={key}
        customModels={currentData.inspirationModels ?? []}
        currentUserId={currentData.user.id}
        isOwner={isOwner}
        onSelectGarment={openOrderWithGarment}
        onSaveCustomModel={saveInspirationModel}
        onDeleteCustomModel={deleteInspirationModel}
      />
    );
  }

  function renderOrderList(ordersToShow: AtelierOrder[], emptyTitle: string, emptyDescription: string) {
    if (!ordersToShow.length) return <EmptyState icon="orders" title={emptyTitle} description={emptyDescription} action={<button className="button button-light" type="button" onClick={openOrder}><Icon name="plus" size={16} />Créer une commande</button>} />;
    return (
      <div className="orders-list">
        {ordersToShow.map((order) => {
          const paid = paymentTotals.get(order.id) ?? 0;
          const balance = Math.max(0, (order.totalAmount ?? 0) - paid);
          return (
            <OrderLine
              key={order.id}
              order={order}
              client={clientsById.get(order.clientId)}
              balance={balance}
              paid={paid}
              owner={Boolean(isOwner)}
              online={online}
              onStatus={advanceOrder}
              onPayment={openPayment}
              onShare={shareOrder}
              onOpenDetails={openOrderDetails}
            />
          );
        })}
      </div>
    );
  }

  return (
    <main className="workspace-shell">
      <aside className="sidebar">
        <Logo />
        <div
          className="workspace-switcher"
          onClick={openWorkshopSettings}
          title={isOwner ? "Cliquer pour modifier le nom de l’atelier" : undefined}
          role={isOwner ? "button" : undefined}
          tabIndex={isOwner ? 0 : undefined}
        >
          <div className="workspace-avatar">{initials(atelierDisplayName).slice(0, 1)}</div>
          <div>
            <b>{atelierDisplayName}</b>
            <small>{isOwner ? "Espace patron ✎" : "Espace membre"}</small>
          </div>
          <span className="switcher-chevron">⌄</span>
        </div>

        <nav className="side-navigation" aria-label="Navigation principale">
          <p className="nav-caption">MENU PRINCIPAL</p>
          {navItems.map((item) => (
            <button
              type="button"
              key={item.key}
              className={`nav-link ${tab === item.key ? "nav-link-active" : ""}`}
              onClick={() => { setTab(item.key); setSearch(""); }}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.key === "orders" && activeOrders.length > 0 && <small className="nav-count">{activeOrders.length}</small>}
              {item.key === "agenda" && todayAppointments.length > 0 && <small className="nav-count">{todayAppointments.length}</small>}
              {item.key === "team" && data.team.length > 0 && <small className="nav-count">{data.team.length}</small>}
            </button>
          ))}
          <button
            type="button"
            className={`nav-link ${modal === "options" ? "nav-link-active" : ""}`}
            onClick={() => openOptions("home")}
          >
            <Icon name="dots" size={19} />
            <span>Plus d’options</span>
          </button>
        </nav>

        <div className="sidebar-note">
          <div className="sidebar-note-icon"><Icon name="sparkle" size={17} /></div>
          <b>Le réseau fait des siennes ?</b>
          <p>Continuez à travailler. Vos données se synchronisent dès le retour d’internet.</p>
          <div className="sidebar-sync"><span className={online ? "connection-dot" : "connection-dot is-offline"} />{online ? "Prêt à synchroniser" : "Mode hors-ligne actif"}</div>
        </div>

        <div className="sidebar-bottom">
          <div className="user-mini">
            <div className="avatar">{initials(data.user.fullName)}</div>
            <div className="user-mini-copy">
              <b>{data.user.fullName}</b>
              <small>{isOwner ? "Patronne / patron" : "Membre de l’équipe"}</small>
            </div>
            <button className="mini-menu" type="button" title="Se déconnecter" onClick={() => void logout()}><Icon name="dots" size={19} /></button>
          </div>
          <button className="sidebar-logout" type="button" onClick={() => void logout()}><Icon name="logout" size={17} />Se déconnecter</button>
        </div>
      </aside>

      <section className="workspace-main">
        <AppTopbar
          workshopName={atelierDisplayName}
          roleLabel={isOwner ? "Espace patron" : "Espace membre"}
          search={search}
          onSearchChange={setSearch}
          online={online}
          syncing={syncing}
          pendingCount={pendingCount}
          onSync={() => (online ? void syncPending() : showToast("Vous êtes hors-ligne. Vos saisies restent sur cet appareil.", "info"))}
          onOpenLauncher={() => setLauncherOpen(true)}
          onOpenGuide={openGuide}
          onOpenTeam={() => setTab("team")}
          onOpenOptions={() => openOptions("home")}
          onLogout={() => void logout()}
        >
          <button className="topbar-avatar" type="button" onClick={() => void logout()} title="Déconnexion">
            {initials(data.user.fullName)}
          </button>
        </AppTopbar>

        <div className={`page-content page-view-${tab}`}>
          {conflicts.length > 0 && (
            <div className="conflict-banner">
              <div className="conflict-mark">!</div>
              <div>
                <b>{conflicts.length === 1 ? "Un changement demande votre attention" : `${conflicts.length} changements demandent votre attention`}</b>
                <p>{conflicts[0].message}</p>
              </div>
              <button type="button" onClick={() => void dismissConflict(conflicts[0].id)} aria-label="Fermer"><Icon name="close" size={17} /></button>
            </div>
          )}

          <div className="page-heading-row">
            <div>
              <p className="eyebrow">{currentPage.eyebrow}</p>
              <h1>{tab === "dashboard" ? <>{greeting}, {data.user.fullName.split(" ")[0]} <span className="greeting-star">✳</span></> : currentPage.title}</h1>
              <p className="page-subtitle">
                {tab === "dashboard" ? <>{displayDate.charAt(0).toUpperCase() + displayDate.slice(1)} · Voici comment se porte votre atelier <b>{atelierDisplayName}</b>.</> :
                 tab === "orders" ? "Gardez un œil sur chaque pièce, de la première coupe à la livraison." :
                 tab === "clients" ? "Leurs préférences et leurs mesures, toujours à portée de main." :
                 tab === "agenda" ? "Essayages, livraisons et rappels clients, jour par jour." :
                 tab === "expenses" ? `Vos sorties d’argent, simplement suivies pour ${currentMonthName}.` :
                 "Gérez les accès de votre atelier, créez des invitations et suivez votre équipe."}
              </p>
            </div>
            <div className="page-heading-actions">
              {tab === "dashboard" && isOwner && <button className="button button-light" type="button" onClick={() => void exportWorkspace()}><Icon name="download" size={16} />Sauvegarder</button>}
              {tab === "dashboard" && isOwner && <button className="button button-light" type="button" onClick={() => setTab("team")}><Icon name="team" size={16} />Inviter un membre</button>}
              {tab === "dashboard" || tab === "orders" ? <button className="button button-primary" type="button" onClick={openOrder}><Icon name="plus" size={18} />Nouvelle commande</button> :
               tab === "clients" ? <button className="button button-primary" type="button" onClick={() => setModal("client")}><Icon name="plus" size={18} />Ajouter un client</button> :
               tab === "agenda" ? <button className="button button-primary" type="button" onClick={() => { setAppointmentPrefill(undefined); setModal("appointment"); }}><Icon name="plus" size={18} />Nouveau rendez-vous</button> :
               tab === "expenses" && isOwner ? <button className="button button-primary" type="button" onClick={() => setModal("expense")}><Icon name="plus" size={18} />Ajouter une dépense</button> :
               tab === "team" && isOwner ? <button className="button button-primary" type="button" onClick={() => setModal("team")}><Icon name="plus" size={18} />Ajouter un membre</button> : null}
            </div>
          </div>

          {tab === "dashboard" && <>
            <button type="button" className="hero-new-client" onClick={() => setModal("client")}>
              <span className="hero-new-client-plus"><Icon name="plus" size={30} /></span>
              <span className="hero-new-client-text">
                <b>NOUVEAU CLIENT</b>
                <small>Créez d’abord la fiche de votre client, puis lancez sa commande.</small>
              </span>
              <span className="hero-new-client-arrow"><Icon name="arrow" size={24} /></span>
            </button>
            <section className="welcome-banner">
              <div className="welcome-copy">
                <span className="banner-kicker"><i /> {atelierDisplayName.toUpperCase()} · EN ACTIVITÉ</span>
                <h2>Du premier point<br />à la dernière <em>retouche.</em></h2>
                <p>Vous avez {activeOrders.length} commande{activeOrders.length === 1 ? "" : "s"} en cours. Gardez le rythme, on s’occupe du reste.</p>
                <button type="button" className="banner-button" onClick={openOrder}>Créer une commande <Icon name="arrow" size={17} /></button>
              </div>
              <div className="banner-art" aria-hidden="true">
                <div className="banner-circle" />
                <div className="banner-ruler">A&nbsp; B&nbsp; C&nbsp; D&nbsp; E&nbsp; F</div>
                <div className="banner-thread" />
                <div className="banner-stitch banner-stitch-one" />
                <div className="banner-stitch banner-stitch-two" />
                <div className="banner-label"><span>FAIT<br />À LA MAIN</span><Icon name="needle" size={26} /></div>
                <div className="banner-art-small">ATELIER<br /><b>PLUS</b></div>
              </div>
              <div className="banner-foot"><span>✳</span><small>CHAQUE COMMANDE COMPTE</small><i>·</i><small>CHAQUE CLIENT AUSSI</small></div>
            </section>

            <section className={`metrics-grid ${isOwner ? "metrics-owner" : ""}`} aria-label="Indicateurs de l’atelier">
              <MetricCard label="Commandes actives" value={String(activeOrders.length).padStart(2, "0")} note={`${allOrders.length} au total`} icon="orders" tone="mint" />
              {isOwner ? <MetricCard label="Encaissé ce mois" value={money(ownerCollections)} note={`${monthPayments.length} paiement${monthPayments.length === 1 ? "" : "s"} enregistré${monthPayments.length === 1 ? "" : "s"}`} icon="wallet" tone="peach" /> : <MetricCard label="À coudre" value={String(activeOrders.filter((order) => order.status === "pending" || order.status === "in_progress").length).padStart(2, "0")} note="En attente ou en cours" icon="needle" tone="peach" />}
              {isOwner ? <MetricCard label="Reste à encaisser" value={money(openBalance)} note={`${debtClientCount} client${debtClientCount === 1 ? "" : "s"} avec un solde`} icon="trend" tone="lavender" /> : <MetricCard label="Prêtes à livrer" value={String(readyOrders.length).padStart(2, "0")} note="N’attendent plus que leur client" icon="check" tone="lavender" />}
              <MetricCard label={isOwner ? "Dépenses du mois" : "Clients suivis"} value={isOwner ? money(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0)) : String((data.clients ?? []).length).padStart(2, "0")} note={isOwner ? `${monthExpenses.length} dépense${monthExpenses.length === 1 ? "" : "s"} enregistrée${monthExpenses.length === 1 ? "" : "s"}` : "Fiches dans votre carnet"} icon={isOwner ? "wallet" : "clients"} tone="yellow" />
            </section>

            <section className="priority-strip" aria-label="Vos priorités du jour">
              <p className="priority-label">VOS PRIORITÉS</p>
              <div className="priority-row">
                <button
                  type="button"
                  className={`priority-chip ${lateOrders.length > 0 ? "priority-urgent" : ""}`}
                  onClick={() => { setTab("orders"); setOrderFilter("all"); setOnlyUrgent(lateOrders.length > 0); setOnlyDue(false); }}
                >
                  <span className="priority-icon" aria-hidden="true">⏳</span>
                  <span className="priority-text"><b>{lateOrders.length}</b><small>en retard</small></span>
                </button>
                <button
                  type="button"
                  className={`priority-chip ${todayAppointments.length > 0 ? "priority-live" : ""}`}
                  onClick={() => setTab("agenda")}
                >
                  <span className="priority-icon" aria-hidden="true">📅</span>
                  <span className="priority-text"><b>{todayAppointments.length}</b><small>RDV aujourd’hui</small></span>
                </button>
                {isOwner && (
                  <button
                    type="button"
                    className={`priority-chip ${debtorClients.length > 0 ? "priority-warn" : ""}`}
                    onClick={() => openOptions("reminders")}
                  >
                    <span className="priority-icon" aria-hidden="true">🔔</span>
                    <span className="priority-text"><b>{debtorClients.length}</b><small>soldes à relancer</small></span>
                  </button>
                )}
                {isOwner && lowStockFabrics.length > 0 && (
                  <button type="button" className="priority-chip priority-warn" onClick={() => openOptions("stock")}>
                    <span className="priority-icon" aria-hidden="true">🧵</span>
                    <span className="priority-text"><b>{lowStockFabrics.length}</b><small>tissus bas</small></span>
                  </button>
                )}
              </div>
            </section>

            <div className="status-strip" role="group" aria-label="Répartition des commandes">
              <button type="button" className="status-strip-chip" onClick={() => { setTab("orders"); setOrderFilter("pending"); setOnlyUrgent(false); setOnlyDue(false); }}>
                <span className="chip-dot chip-pending" />En attente<b>{allOrders.filter((o) => o.status === "pending").length}</b>
              </button>
              <button type="button" className="status-strip-chip" onClick={() => { setTab("orders"); setOrderFilter("in_progress"); setOnlyUrgent(false); setOnlyDue(false); }}>
                <span className="chip-dot chip-inprogress" />En cours<b>{allOrders.filter((o) => o.status === "in_progress").length}</b>
              </button>
              <button type="button" className="status-strip-chip" onClick={() => { setTab("orders"); setOrderFilter("ready"); setOnlyUrgent(false); setOnlyDue(false); }}>
                <span className="chip-dot chip-ready" />Prêtes<b>{readyOrders.length}</b>
              </button>
              <button type="button" className={`status-strip-chip chip-late ${lateOrders.length === 0 ? "chip-late-calm" : ""}`} onClick={() => { setTab("orders"); setOrderFilter("all"); setOnlyUrgent(true); setOnlyDue(false); }}>
                <span className="chip-dot chip-late-dot" />En retard<b>{lateOrders.length}</b>
              </button>
              <button type="button" className="status-strip-chip" onClick={() => { setTab("orders"); setOrderFilter("delivered"); setOnlyUrgent(false); setOnlyDue(false); }}>
                <span className="chip-dot chip-done" />Livrées<b>{allOrders.filter((o) => o.status === "delivered").length}</b>
              </button>
            </div>

            <div className="dashboard-grid">
              <section className="panel latest-panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">ON GARDE LE FIL</p><h2>Commandes récentes</h2></div>
                  <button className="text-link" type="button" onClick={() => setTab("orders")}>Tout voir <Icon name="arrow" size={15} /></button>
                </div>
                <div className="panel-body">{renderOrderList(allOrders.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4), "Pas encore de commande", "Une fois la première commande créée, elle apparaîtra ici.")}</div>
                <div className="panel-footer">
                  <span><i className="connection-dot" />Le carnet se met à jour avec votre équipe</span>
                  {isOwner && <button className="text-link" type="button" onClick={() => setTab("expenses")}>Voir les dépenses <Icon name="arrow" size={14} /></button>}
                </div>
              </section>

              <aside className="dashboard-side">
                {isOwner && (
                  <section className={`team-dashboard-widget debtors-widget ${debtorClients.length === 0 ? "debtors-calm" : ""}`}>
                    <div className="team-dashboard-header">
                      <h3>Soldes à régler</h3>
                      <span className="role-badge role-owner">{debtorClients.length} client{debtorClients.length === 1 ? "" : "s"}</span>
                    </div>
                    {debtorClients.length === 0 ? (
                      <p className="debtors-clear">✔ Aucune dette : tous les solde sont réglés.</p>
                    ) : (
                      <div className="debtors-list">
                        {debtorClients.map(({ client, due, oldestUnpaid }) => (
                          <div className="debtor-row" key={client.id}>
                            <button type="button" className="debtor-main" onClick={() => openClientDetails(client.id)} title="Ouvrir la fiche client">
                              <span className="team-avatar-pill">{initials(client.name)}</span>
                              <span className="debtor-copy"><b>{client.name}</b><small>{oldestUnpaid ? `depuis ${shortDate(oldestUnpaid.createdAt)}` : ""}</small></span>
                              <b className="debtor-amount">{money(due)}</b>
                            </button>
                            {oldestUnpaid && (
                              <button
                                type="button"
                                className="share-order-button"
                                title={`Rappeler le solde (${oldestUnpaid.orderNumber})`}
                                aria-label="Envoyer un rappel de solde"
                                onClick={() => void shareOrder(oldestUnpaid, "balance")}
                              >
                                <Icon name="bell" size={15} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {isOwner && (
                  <section className="team-dashboard-widget">
                    <div className="team-dashboard-header">
                      <h3>Mon équipe</h3>
                      <span className="role-badge role-owner">{data.team.length} membre{data.team.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="team-dashboard-avatars">
                      {data.team.slice(0, 4).map((member) => (
                        <div key={member.id} className="team-avatar-pill" title={`${member.fullName} (${member.role === "owner" ? "Patron" : "Membre"})`}>
                          {initials(member.fullName)}
                        </div>
                      ))}
                      {data.team.length > 4 && <span className="team-dashboard-count">+{data.team.length - 4}</span>}
                    </div>
                    <button type="button" className="button button-light team-dashboard-btn" onClick={() => setTab("team")}>
                      <Icon name="team" size={15} /> Gérer l’équipe & Inviter
                    </button>
                  </section>
                )}

                <section className="team-dashboard-widget">
                  <div className="team-dashboard-header">
                    <h3>Aujourd’hui à l’atelier</h3>
                    <span className="role-badge role-member">{todayAppointments.length + tomorrowAppointments.length} RDV</span>
                  </div>
                  {todayAppointments.length === 0 && tomorrowAppointments.length === 0 ? (
                    <p className="debtors-clear">✔ Agenda dégagé pour aujourd’hui et demain.</p>
                  ) : (
                    <div className="debtors-list">
                      {[...todayAppointments.map((item) => ({ item, day: "Aujourd’hui" })), ...tomorrowAppointments.slice(0, 2).map((item) => ({ item, day: "Demain" }))].slice(0, 4).map(({ item, day }) => (
                        <div className="debtor-row" key={item.id}>
                          <button type="button" className="debtor-main" onClick={() => setTab("agenda")} title="Ouvrir l’agenda">
                            <span className="team-avatar-pill">{item.time ? item.time.slice(0, 2) + "h" : "📅"}</span>
                            <span className="debtor-copy"><b>{clientsById.get(item.clientId)?.name ?? "Client"}</b><small>{day}{item.time ? ` à ${item.time}` : ""} · {item.title}</small></span>
                          </button>
                          <button type="button" className="share-order-button" title="Rappeler sur WhatsApp" aria-label="Rappeler le rendez-vous" onClick={() => void remindAppointment(item)}>
                            <Icon name="bell" size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button type="button" className="button button-light team-dashboard-btn" style={{ marginTop: 10 }} onClick={() => setTab("agenda")}>
                    <Icon name="calendar" size={15} /> Voir tout l’agenda
                  </button>
                </section>

                {isOwner && lowStockFabrics.length > 0 && (
                  <section className="team-dashboard-widget debtors-widget">
                    <div className="team-dashboard-header">
                      <h3>Stock à surveiller</h3>
                      <span className="role-badge role-owner">{lowStockFabrics.length} tissu{lowStockFabrics.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="debtors-list">
                      {lowStockFabrics.slice(0, 3).map((fabric) => (
                        <div className="debtor-row" key={fabric.id}>
                          <div className="debtor-main" style={{ cursor: "default" }}>
                            <span className="team-avatar-pill">🧵</span>
                            <span className="debtor-copy"><b>{fabric.name}</b><small>Seuil {cmToMetres(fabric.minThresholdCm)}</small></span>
                            <b className="debtor-amount">{cmToMetres(fabric.quantityCm)}</b>
                          </div>
                        </div>
                      ))}
                    </div>
                    <button type="button" className="button button-light team-dashboard-btn" style={{ marginTop: 10 }} onClick={() => openOptions("stock")}>
                      Gérer le stock
                    </button>
                  </section>
                )}

                <section className="panel deliveries-panel">
                  <div className="panel-heading"><div><p className="eyebrow">ON APPROCHE DU JOUR J</p><h2>Prochaines livraisons</h2></div><div className="small-icon-circle"><Icon name="calendar" size={17} /></div></div>
                  <div className="delivery-list">
                    {upcomingOrders.length ? upcomingOrders.map((order) => (
                      <div className="delivery-item" key={order.id}>
                        <div className={`delivery-date ${order.status === "ready" ? "delivery-date-ready" : ""}`}>
                          <b>{order.dueDate ? shortDate(order.dueDate).split(" ")[0] : "—"}</b>
                          <small>{order.dueDate ? shortDate(order.dueDate).split(" ")[1] : "Date"}</small>
                        </div>
                        <div className="delivery-copy">
                          <b>{clientsById.get(order.clientId)?.name ?? "Client"}</b>
                          <small>{garmentName(order.garment)} · {order.orderNumber}</small>
                        </div>
                        <span className={`delivery-indicator ${order.status === "ready" ? "is-ready" : ""}`} title={statusLabel(order.status)} />
                      </div>
                    )) : (
                      <div className="delivery-empty"><Icon name="calendar" size={21} /><span>Aucune livraison prévue pour le moment.</span></div>
                    )}
                  </div>
                  <button className="delivery-all" type="button" onClick={() => { setTab("orders"); setOrderFilter("all"); }}>Voir le carnet des commandes <Icon name="arrow" size={15} /></button>
                </section>

                <section className="tip-card">
                  <div className="tip-top"><div className="tip-icon"><Icon name="ruler" size={18} /></div><span>LE PETIT CONSEIL</span><Icon name="dots" size={18} /></div>
                  <h3>Une bonne mesure,<br />c’est une retouche en moins.</h3>
                  <p>Les mesures de vos clients restent enregistrées. Ajoutez seulement un ajustement quand une commande le demande.</p>
                  <button type="button" onClick={() => setTab("clients")}>Voir les fiches clients <Icon name="arrow" size={15} /></button>
                  <div className="tip-stitches" />
                </section>
              </aside>
            </div>
            <section aria-label="Catalogue d’inspiration">
              {renderInspirationCatalog("dashboard-inspiration")}
            </section>
          </>}

          {tab === "orders" && (
            <>
            <section className="panel list-page-panel">
              <div className="list-toolbar">
                <div>
                  <div className="result-count"><b>{visibleOrders.length}</b> commande{visibleOrders.length === 1 ? "" : "s"}</div>
                  <small>Cliquez sur une commande pour ouvrir sa fiche de coupe complète.</small>
                </div>
                <div className="filter-tabs">
                  <button type="button" className={orderFilter === "all" ? "filter-active" : ""} onClick={() => setOrderFilter("all")}>Toutes <span>{allOrders.length}</span></button>
                  {ORDER_STATUSES.map((status) => (
                    <button type="button" className={orderFilter === status.value ? "filter-active" : ""} key={status.value} onClick={() => setOrderFilter(status.value)}>
                      {status.label}<span>{allOrders.filter((order) => order.status === status.value).length}</span>
                    </button>
                  ))}
                </div>
                <div className="quick-filter-chips">
                  {isOwner && (
                    <button
                      type="button"
                      className={`chip-toggle ${onlyDue ? "chip-toggle-active" : ""}`}
                      onClick={() => setOnlyDue(!onlyDue)}
                    >
                      <span>🔴 Soldes impayés ({allOrders.filter((o) => (o.totalAmount ?? 0) - (paymentTotals.get(o.id) ?? 0) > 0).length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className={`chip-toggle ${onlyUrgent ? "chip-toggle-active" : ""}`}
                    onClick={() => setOnlyUrgent(!onlyUrgent)}
                  >
                    <span>⏳ Livraisons urgentes (&lt; 7 jours)</span>
                  </button>
                </div>
              </div>
              <div className="orders-list-page-heading">
                <span>COMMANDE & CLIENT</span>
                <span>VÊTEMENT</span>
                <span>LIVRAISON</span>
                <span>ÉTAPE</span>
                {isOwner && <span>RESTE À PAYER</span>}
                <span />
              </div>
              {renderOrderList(visibleOrders, "Aucune commande trouvée", query || onlyDue || onlyUrgent ? "Modifiez vos filtres ou effectuez une autre recherche." : "Commencez par ajouter votre prochaine création au carnet.")}
            </section>
            <section aria-label="Catalogue d’inspiration">
              {renderInspirationCatalog("orders-inspiration")}
            </section>
            </>
          )}

          {tab === "agenda" && (
            <section className="panel list-page-panel">
              <AgendaView
                appointments={data.appointments ?? []}
                clients={data.clients}
                orders={data.orders}
                teamNamesById={teamNamesById}
                activeCount={scheduledAppointments.length}
                onCreate={() => { setAppointmentPrefill(undefined); setModal("appointment"); }}
                onStatus={updateAppointmentStatus}
                onRemind={remindAppointment}
                onOpenClient={openClientDetails}
                onOpenOrder={openOrderDetails}
              />
            </section>
          )}

          {tab === "clients" && (
            <section className="clients-section">
              <div className="panel list-page-panel" style={{ marginBottom: 14 }}>
                <div className="list-toolbar">
                  <div>
                    <div className="result-count"><b>{visibleClients.length}</b> client{visibleClients.length === 1 ? "" : "s"}</div>
                    <small>Fiches de mesures, historique et coordonnées.</small>
                  </div>
                  <div className="filter-tabs">
                    <button type="button" className={clientFilter === "all" ? "filter-active" : ""} onClick={() => setClientFilter("all")}>Tous <span>{(data?.clients ?? []).length}</span></button>
                    {isOwner && (
                      <button type="button" className={clientFilter === "due" ? "filter-active" : ""} onClick={() => setClientFilter("due")}>🔴 Avec dette</button>
                    )}
                    <button type="button" className={clientFilter === "measures" ? "filter-active" : ""} onClick={() => setClientFilter("measures")}>📏 Avec mesures</button>
                    <button type="button" className={clientFilter === "femme" ? "filter-active" : ""} onClick={() => setClientFilter("femme")}>Femmes</button>
                    <button type="button" className={clientFilter === "homme" ? "filter-active" : ""} onClick={() => setClientFilter("homme")}>Hommes</button>
                  </div>
                </div>
              </div>

              {visibleClients.length ? (
                <div className="client-grid">
                  {visibleClients.map((client) => {
                    const latest = data.measurements.filter((item) => item.clientId === client.id).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt))[0];
                    const orderCount = data.orders.filter((order) => order.clientId === client.id).length;
                    const due = data.orders.filter((order) => order.clientId === client.id && order.totalAmount !== null).reduce((sum, order) => sum + Math.max(0, (order.totalAmount ?? 0) - (paymentTotals.get(order.id) ?? 0)), 0);
                    return (
                      <button type="button" className="client-card" key={client.id} onClick={() => openClientDetails(client.id)}>
                        <div className="client-card-top">
                          <div className="avatar client-avatar">{initials(client.name)}</div>
                          <span className="client-card-more"><Icon name="dots" size={18} /></span>
                        </div>
                        <h3>{client.name}</h3>
                        <p className="client-phone">{client.phone ? <><Icon name="phone" size={14} />{client.phone}</> : <span>Pas de téléphone renseigné</span>}</p>
                        <div className="client-card-divider" />
                        <div className="client-card-meta">
                          <span><Icon name="ruler" size={15} />{latest ? `${Object.keys(latest.values).length} mesures` : "Pas de mesures"}</span>
                          <span>{orderCount} commande{orderCount === 1 ? "" : "s"}</span>
                        </div>
                        {isOwner && due > 0 && <div className="client-due"><span>Reste à payer</span><b>{money(due)}</b></div>}
                      </button>
                    );
                  })}
                  <button type="button" className="client-card client-add-card" onClick={() => setModal("client")}>
                    <span className="client-add-plus"><Icon name="plus" size={21} /></span>
                    <b>Ajouter un client</b>
                    <small>La prochaine belle rencontre commence ici.</small>
                  </button>
                </div>
              ) : (
                <div className="panel client-empty-panel">
                  <EmptyState icon="clients" title={query || clientFilter !== "all" ? "Aucun client ne correspond au filtre" : "Votre carnet est encore vierge"} description={query || clientFilter !== "all" ? "Changez de filtre ou essayez une autre recherche." : "Ajoutez vos clients pour retrouver leurs contacts, mensurations et commandes au même endroit."} action={!query && clientFilter === "all" ? <button className="button button-primary" type="button" onClick={() => setModal("client")}><Icon name="plus" size={17} />Ajouter le premier client</button> : undefined} />
                </div>
              )}
            </section>
          )}

          {tab === "expenses" && isOwner && (
            <section className="expenses-layout">
              <div className="expense-summary-strip">
                <div className="expense-summary-icon"><Icon name="wallet" size={19} /></div>
                <div>
                  <small>SORTIES EN {currentMonthName.toLocaleUpperCase("fr")}</small>
                  <b>{money(monthExpenses.reduce((sum, expense) => sum + expense.amount, 0))}</b>
                </div>
                <span>{monthExpenses.length} mouvement{monthExpenses.length === 1 ? "" : "s"}</span>
              </div>
              <section className="panel expenses-panel">
                <div className="panel-heading">
                  <div><p className="eyebrow">LE SUIVI, SANS COMPTABILITÉ COMPLIQUÉE</p><h2>Toutes les dépenses</h2></div>
                  <button className="button button-light button-sm" type="button" onClick={() => setModal("expense")}><Icon name="plus" size={15} />Nouvelle dépense</button>
                </div>
                {data.expenses.length ? (
                  <div className="expense-list">
                    {data.expenses.filter((expense) => !query || `${expense.description} ${expense.category}`.toLocaleLowerCase("fr").includes(query)).map((expense) => (
                      <div className="expense-row" key={expense.id}>
                        <div className="expense-category-icon"><Icon name="wallet" size={17} /></div>
                        <div className="expense-description">
                          <b>{expense.description}</b>
                          <small>{expense.category}{expense.orderId ? ` · ${allOrders.find((order) => order.id === expense.orderId)?.orderNumber ?? "Commande liée"}` : ""}</small>
                        </div>
                        <span className="expense-date">{shortDate(expense.date)}</span>
                        <b className="expense-amount">− {money(expense.amount)}</b>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState icon="wallet" title="Aucune dépense enregistrée" description="Tissu, fournitures, transport… notez les sorties de l’atelier au fur et à mesure." action={<button className="button button-light" type="button" onClick={() => setModal("expense")}><Icon name="plus" size={16} />Ajouter une dépense</button>} />
                )}
              </section>
              <div className="privacy-note">
                <Icon name="needle" size={17} />
                <p>Cette rubrique est visible uniquement par le compte patron. Les membres ne voient ni les dépenses ni les soldes.</p>
              </div>
            </section>
          )}

          {tab === "team" && isOwner && (
            <>
              <InvitePanel online={online} onToast={showToast} />
              <TeamSecurityPanel online={online} onToast={showToast} />
              <section className="team-page-grid">
                <div className="panel team-panel">
                  <div className="panel-heading">
                    <div><p className="eyebrow">LES MAINS QUI FONT L’ATELIER</p><h2>Les accès de l’équipe</h2></div>
                    <span className="team-total">{data.team.length} compte{data.team.length === 1 ? "" : "s"}</span>
                  </div>
                  <div className="team-list">
                    {data.team.map((member) => (
                      <div className="team-row" key={member.id}>
                        <div className={`avatar ${member.role === "owner" ? "owner-avatar" : ""}`}>{initials(member.fullName)}</div>
                        <div className="team-row-copy">
                          <b>{member.fullName}{member.id === data.user.id && <small className="you-label">Vous</small>}</b>
                          <span>{member.phone}</span>
                        </div>
                        <span className={`role-badge ${member.role === "owner" ? "role-owner" : "role-member"}`}>{member.role === "owner" ? "Patron" : "Membre"}</span>
                      </div>
                    ))}
                  </div>
                  {data.team.length === 1 && (
                    <div className="team-empty-note">
                      <span><Icon name="team" size={18} /></span>
                      <p>Invitez vos couturiers et apprentis ci-dessus grâce aux codes d’invitation, ou créez un compte directement.</p>
                    </div>
                  )}
                </div>

                <aside className="team-access-card">
                  <div className="team-access-decoration"><Icon name="needle" size={28} /></div>
                  <p className="eyebrow">LES BONS ACCÈS, À CHACUN</p>
                  <h3>Les chiffres restent<br /><em>entre vos mains.</em></h3>
                  <div className="access-row"><span className="access-check"><Icon name="check" size={14} /></span><p><b>Le patron</b><small>Vue d’ensemble, soldes et dépenses de l’atelier.</small></p></div>
                  <div className="access-row"><span className="access-check"><Icon name="check" size={14} /></span><p><b>Les membres</b><small>Clients, mesures, commandes et saisie des paiements.</small></p></div>
                  <div className="access-lock"><Icon name="wallet" size={16} />Les finances sont protégées côté serveur.</div>
                  <button className="button button-primary" type="button" onClick={() => setModal("team")}><Icon name="plus" size={17} />Créer un compte membre</button>
                </aside>
              </section>
            </>
          )}

          <footer className="page-footer">
            <span>{atelierDisplayName} <i>✳</i> L’atelier avance, on garde le fil.</span>
            <span><Icon name="cloud" size={15} />Vos données restent disponibles hors-ligne</span>
          </footer>
          <p className="author-signature">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="author-signature-photo" src={APP_IDENTITY.author.photo} alt="" width={28} height={28} />
            <span>{APP_IDENTITY.name} · conçu et développé par <b>{APP_IDENTITY.author.fullName}</b>, {APP_IDENTITY.author.role}</span>
          </p>
        </div>
      </section>

      {/* Mobile Bottom Navigation: Displays all accessible tabs */}
      <nav className="mobile-bottom-nav" aria-label="Navigation mobile">
        {navItems.map((item) => (
          <button
            type="button"
            key={item.key}
            className={tab === item.key ? "mobile-nav-active" : ""}
            onClick={() => setTab(item.key)}
          >
            <Icon name={item.icon} size={20} />
            <span>
              {item.key === "dashboard" ? "Accueil" :
               item.key === "orders" ? "Commandes" :
               item.key === "clients" ? "Clients" :
               item.key === "expenses" ? "Dépenses" :
                item.key === "agenda" ? "Agenda" : "Équipe"}
            </span>
          </button>
        ))}
      </nav>

      <QuickLauncher items={launcherItems} open={launcherOpen} onClose={() => setLauncherOpen(false)} />

      {modal === "client" && <Modal title="Ajouter un client" subtitle="Une fiche courte, que vous compléterez à votre rythme." onClose={() => setModal(null)} wide><ClientForm onSave={saveClient} onCancel={() => setModal(null)} onOpenGuide={openGuide} /></Modal>}
      {modal === "order" && <Modal title="Une nouvelle commande" subtitle="Quelques détails suffisent pour commencer." onClose={() => setModal(null)} wide><OrderForm clients={data.clients} measurements={data.measurements} onSave={saveOrder} onCancel={() => setModal(null)} onCreateClient={startClientFromOrder} onOpenGuide={openGuide} initialGarment={preselectedGarment} initialModelDetails={preselectedModelDetails} fabrics={data.fabrics ?? []} showFabricUsage={Boolean(isOwner)} /></Modal>}
      {modal === "expense" && isOwner && <Modal title="Ajouter une dépense" subtitle="Un tissu, un trajet, une petite fourniture…" onClose={() => setModal(null)}><ExpenseForm orders={data.orders} onSave={saveExpense} onCancel={() => setModal(null)} /></Modal>}
      {modal === "team" && isOwner && <Modal title="Ajouter un membre" subtitle="Un compte à son nom, avec les accès utiles à son travail." onClose={() => setModal(null)}><TeamForm onSave={saveTeamMember} onCancel={() => setModal(null)} online={online} /></Modal>}
      {modal === "payment" && selectedOrder && <Modal title="Saisir un paiement" subtitle="Les acomptes restent liés à cette commande." onClose={() => setModal(null)}><PaymentForm order={selectedOrder} balance={Math.max(0, (selectedOrder.totalAmount ?? 0) - (paymentTotals.get(selectedOrder.id) ?? 0))} onSave={savePayment} onCancel={() => setModal(null)} /></Modal>}
      {modal === "measurement" && selectedClient && <Modal title="Nouveau relevé" subtitle="Les mesures précédentes restent dans l’historique." onClose={() => setModal("client-details")} wide><MeasurementForm client={selectedClient} onSave={saveMeasurement} onCancel={() => setModal("client-details")} onOpenGuide={openGuide} /></Modal>}
      {modal === "client-details" && selectedClient && <Modal title={selectedClient.name} subtitle={selectedClient.phone ?? "Fiche client"} onClose={() => setModal(null)} wide><div className="client-detail-layout"><div className="client-detail-side"><div className="avatar client-detail-avatar">{initials(selectedClient.name)}</div><h3>{selectedClient.name}</h3><p>{selectedClient.phone ?? "Pas de téléphone"}</p><span>{selectedClient.gender === "femme" ? "Femme" : selectedClient.gender === "homme" ? "Homme" : "Client"}</span>{selectedClient.notes && <div className="client-note"><small>À RETENIR</small><p>{selectedClient.notes}</p></div>}<button type="button" className="button button-primary button-full" onClick={openOrder}><Icon name="plus" size={16} />Nouvelle commande</button></div><div className="client-detail-main"><div className="detail-section-heading"><div><p className="eyebrow">LE CARNET DES MESURES</p><h3>Mensurations de base</h3></div><button type="button" className="button button-light button-sm" onClick={() => setModal("measurement")}><Icon name="plus" size={15} />Nouveau relevé</button></div>{(() => { const records = data.measurements.filter((item) => item.clientId === selectedClient.id).sort((a, b) => b.measuredAt.localeCompare(a.measuredAt)); const latest = records[0]; return latest ? <><div className="measurements-meta"><span><Icon name="calendar" size={14} />Dernier relevé · {fullDate(latest.measuredAt)}</span><span>{records.length} relevé{records.length === 1 ? "" : "s"} au total</span></div><div className="client-measure-grid">{MEASUREMENT_CATALOG.filter((definition) => latest.values[definition.code] !== undefined).map((definition) => <div className="client-measure-value" key={definition.code}><b>{definition.code}</b><span>{latest.values[definition.code]} <small>cm</small></span><small>{definition.name}</small></div>)}</div>{records.length > 1 && <div className="measurement-history"><b>Relevés précédents</b>{records.slice(1).map((record) => <div key={record.id}><span>{fullDate(record.measuredAt)}</span><small>{Object.keys(record.values).length} mesures</small></div>)}</div>}</> : <div className="no-measures"><Icon name="ruler" size={20} /><span>Aucun relevé pour le moment. Ajoutez les mesures de base pour les réutiliser sur les prochaines commandes.</span></div>; })()}<div className="detail-section-heading client-orders-heading"><div><p className="eyebrow">SON HISTORIQUE</p><h3>Commandes</h3></div><span>{data.orders.filter((order) => order.clientId === selectedClient.id).length}</span></div>{data.orders.filter((order) => order.clientId === selectedClient.id).length ? <div className="client-order-history">{data.orders.filter((order) => order.clientId === selectedClient.id).map((order) => <div key={order.id}><span className="history-garment"><Icon name="shirt" size={16} /></span><span><b>{order.orderNumber}</b><small>{garmentName(order.garment)} · {shortDate(order.createdAt)}</small></span><StatusPill status={order.status} />{isOwner && <strong>{money(Math.max(0, (order.totalAmount ?? 0) - (paymentTotals.get(order.id) ?? 0)))}</strong>}</div>)}</div> : <p className="no-client-orders">Pas encore de commande pour ce client.</p>}</div></div></Modal>}

      {modal === "order-details" && selectedOrder && (
        <Modal
          title={`Commande ${selectedOrder.orderNumber.startsWith("LOCAL-") ? "" : "#"}${selectedOrder.orderNumber}`}
          subtitle={`${garmentName(selectedOrder.garment)} · ${clientsById.get(selectedOrder.clientId)?.name || "Client"}`}
          onClose={() => setModal(null)}
          wide
        >
          <OrderDetailView
            order={selectedOrder}
            client={clientsById.get(selectedOrder.clientId)}
            latestMeasurements={clientMeasurementValues(selectedOrder.clientId, data.measurements)}
            payments={data.payments.filter((p) => p.orderId === selectedOrder.id)}
            isOwner={isOwner}
            online={online}
            onStatusChange={changeOrderStatus}
            onAddPayment={openPayment}
            onShare={shareOrder}
            onOpenClient={openClientDetails}
            onPlanDelivery={planDeliveryForOrder}
            nameOf={(id) => (id ? teamNamesById.get(id) ?? null : null)}
          />
        </Modal>
      )}

      {modal === "measurement-guide" && (
        <Modal
          title="Guide illustré des mensurations"
          subtitle="19 points de mesure expliqués pour la prise de mesure et l’apprentissage"
          onClose={() => setModal(null)}
          wide
        >
          <MeasurementGuideView />
        </Modal>
      )}

      {modal === "options" && (
        <Modal
          title={optionsView === "home" ? "Plus d’options" : undefined}
          subtitle={optionsView === "home" ? "Choisissez un outil de l’atelier" : undefined}
          onClose={() => setModal(null)}
          wide
        >
          <OptionsPanel
            data={data}
            online={online}
            initialView={optionsView}
            onToast={showToast}
            onOpenTeam={() => { setModal(null); setTab("team"); }}
            onLogout={() => { setModal(null); void logout(); }}
            onUpdatedAtelier={(atelier) => {
              if (dataRef.current) {
                void setDataAndCache({
                  ...dataRef.current,
                  user: { ...dataRef.current.user, atelierName: atelier.name, atelierCity: atelier.city },
                });
              }
            }}
            onSelectGarment={openOrderWithGarment}
            onSaveInspirationModel={saveInspirationModel}
            onDeleteInspirationModel={deleteInspirationModel}
            onShareOrder={shareOrder}
            onCreateFabric={() => setModal("fabric")}
            onAdjustFabric={openFabricAdjust}
          />
        </Modal>
      )}

      {modal === "appointment" && (
        <Modal title="Planifier un rendez-vous" subtitle="Essayage, livraison ou rappel client." onClose={() => { setModal(null); setAppointmentPrefill(undefined); }}>
          <AppointmentForm clients={data.clients} orders={data.orders} prefill={appointmentPrefill} onSave={saveAppointment} onCancel={() => { setModal(null); setAppointmentPrefill(undefined); }} />
        </Modal>
      )}
      {modal === "fabric" && isOwner && (
        <Modal title="Ajouter un tissu" subtitle="Un rouleau suivi au mètre près." onClose={() => setModal(null)}>
          <FabricForm onSave={saveFabric} onCancel={() => setModal(null)} />
        </Modal>
      )}
      {modal === "fabric-movement" && selectedFabric && isOwner && (
        <Modal
          title={movementDirection === "in" ? "Entrée de stock" : "Sortie de stock"}
          subtitle={selectedFabric.name}
          onClose={() => { setModal(null); setSelectedFabric(null); }}
        >
          <FabricMovementForm fabric={selectedFabric} direction={movementDirection} orders={data.orders} onSave={saveFabricMovement} onCancel={() => { setModal(null); setSelectedFabric(null); }} />
        </Modal>
      )}
      {modal === "share" && shareSheet && <Modal title={shareSheet.title} subtitle={shareSheet.subtitle} onClose={() => setModal(null)}><ShareSheet sheet={shareSheet} online={online} onToast={showToast} /></Modal>}
      {toast && <div className={`toast toast-${toast.kind}`} role="status"><span className="toast-check"><Icon name={toast.kind === "error" ? "close" : "check"} size={16} /></span>{toast.message}<button type="button" onClick={() => setToast(null)} aria-label="Fermer"><Icon name="close" size={15} /></button></div>}
    </main>
  );
}
