"use client";

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import {
  APPOINTMENT_KINDS,
  FABRIC_MOVEMENT_REASONS,
  cmToMetres,
  metresToCm,
} from "@/lib/atelier-types";
import type {
  AppointmentDraft,
  AppointmentKind,
  AtelierOrder,
  Client,
  Fabric,
  FabricDraft,
  FabricMovementDraft,
  FabricMovementReason,
} from "@/lib/atelier-types";

function makeId() {
  return globalThis.crypto.randomUUID();
}

function localToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="field-label">
      {label}
      {children}
      {hint && <small className="field-hint">{hint}</small>}
    </label>
  );
}

export type AppointmentPrefill = Partial<Pick<AppointmentDraft, "clientId" | "orderId" | "kind" | "title" | "date" | "notes">>;

export function AppointmentForm({
  clients,
  orders,
  prefill,
  onSave,
  onCancel,
}: {
  clients: Client[];
  orders: AtelierOrder[];
  prefill?: AppointmentPrefill;
  onSave: (draft: AppointmentDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [clientId, setClientId] = useState(prefill?.clientId ?? clients[0]?.id ?? "");
  const [orderId, setOrderId] = useState(prefill?.orderId ?? "");
  const [kind, setKind] = useState<AppointmentKind>(prefill?.kind ?? "fitting");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [date, setDate] = useState(prefill?.date ?? localToday());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const [busy, setBusy] = useState(false);

  const clientOrders = useMemo(() => orders.filter((order) => order.clientId === clientId), [orders, clientId]);
  const defaultTitle = kind === "fitting" ? "Essayage" : kind === "delivery" ? "Livraison de commande" : "Rendez-vous";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!clientId || !date) return;
    setBusy(true);
    await onSave({
      id: makeId(),
      clientId,
      orderId: orderId || null,
      kind,
      title: title.trim() || defaultTitle,
      date,
      time: time || null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
    });
    setBusy(false);
  }

  return (
    <form className="app-form" onSubmit={submit}>
      {clients.length === 0 ? (
        <p className="form-tip">Créez d’abord une fiche client pour planifier un rendez-vous.</p>
      ) : (
        <Field label="Pour quel client ? *">
          <select
            value={clientId}
            onChange={(event) => {
              setClientId(event.target.value);
              setOrderId("");
            }}
            required
          >
            {clients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.phone ? ` · ${client.phone}` : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="form-grid form-grid-two">
        <Field label="Type de rendez-vous">
          <select value={kind} onChange={(event) => setKind(event.target.value as AppointmentKind)}>
            {APPOINTMENT_KINDS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Commande liée (facultatif)">
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            <option value="">Aucune</option>
            {clientOrders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.orderNumber} · {order.garment}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Titre (facultatif)" hint={`Par défaut : « ${defaultTitle} »`}>
        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={defaultTitle} maxLength={120} />
      </Field>
      <div className="form-grid form-grid-two">
        <Field label="Date *">
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label="Heure (facultatif)">
          <input type="time" value={time} onChange={(event) => setTime(event.target.value)} />
        </Field>
      </div>
      <Field label="Note pour l’équipe (facultatif)">
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex. apporter le tissu restant" maxLength={500} />
      </Field>
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="button button-primary" disabled={busy || !clientId || !date}>
          {busy ? "Enregistrement…" : "Planifier le rendez-vous"}
        </button>
      </div>
    </form>
  );
}

export function FabricForm({
  onSave,
  onCancel,
}: {
  onSave: (draft: FabricDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("");
  const [width, setWidth] = useState("");
  const [quantity, setQuantity] = useState("");
  const [threshold, setThreshold] = useState("2");
  const [unitPrice, setUnitPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantityCm = metresToCm(Number(quantity) || 0);
    const thresholdCm = metresToCm(Number(threshold) || 0);
    const widthCm = width ? Math.round(Number(width)) : null;
    const price = unitPrice ? Math.round(Number(unitPrice)) : null;
    if (name.trim().length < 2 || quantityCm < 0 || thresholdCm < 0) return;
    if (widthCm !== null && (widthCm < 30 || widthCm > 400)) return;
    setBusy(true);
    await onSave({
      id: makeId(),
      name: name.trim(),
      color: color.trim() || null,
      widthCm,
      quantityCm,
      minThresholdCm: thresholdCm,
      unitPrice: price && price > 0 ? price : null,
      notes: notes.trim() || null,
      createdAt: new Date().toISOString(),
    });
    setBusy(false);
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="form-grid form-grid-two">
        <Field label="Nom du tissu *">
          <input autoFocus value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Wax rouge, Bazin blanc" required minLength={2} maxLength={80} />
        </Field>
        <Field label="Couleur / motif">
          <input value={color} onChange={(event) => setColor(event.target.value)} placeholder="Ex. Rouge à fleurs" maxLength={40} />
        </Field>
      </div>
      <div className="form-grid form-grid-two">
        <Field label="Laize (cm)" hint="Largeur du rouleau, entre 30 et 400.">
          <input type="number" inputMode="decimal" min={30} max={400} step={1} value={width} onChange={(event) => setWidth(event.target.value)} placeholder="Ex. 150" />
        </Field>
        <Field label="Prix d’achat au mètre (F CFA)">
          <div className="input-suffix">
            <input type="number" inputMode="numeric" min={0} step={50} value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="Ex. 2500" />
            <span>F CFA</span>
          </div>
        </Field>
      </div>
      <div className="form-grid form-grid-two">
        <Field label="Quantité initiale (mètres) *">
          <input type="number" inputMode="decimal" min={0} max={10000} step={0.25} value={quantity} onChange={(event) => setQuantity(event.target.value)} placeholder="Ex. 10" required />
        </Field>
        <Field label="Seuil d’alerte (mètres)" hint="En dessous, le tissu est signalé « stock bas ».">
          <input type="number" inputMode="decimal" min={0} max={10000} step={0.5} value={threshold} onChange={(event) => setThreshold(event.target.value)} placeholder="2" />
        </Field>
      </div>
      <Field label="Note (facultatif)">
        <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex. acheté au marché Hédzranawoé" maxLength={300} />
      </Field>
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="button button-primary" disabled={busy || name.trim().length < 2}>
          {busy ? "Enregistrement…" : "Ajouter au stock"}
        </button>
      </div>
    </form>
  );
}

export function FabricMovementForm({
  fabric,
  direction,
  orders,
  onSave,
  onCancel,
}: {
  fabric: Fabric;
  direction: "in" | "out";
  orders: AtelierOrder[];
  onSave: (draft: FabricMovementDraft) => Promise<void>;
  onCancel: () => void;
}) {
  const [metres, setMetres] = useState("");
  const [reason, setReason] = useState<FabricMovementReason>(direction === "in" ? "purchase" : "cutting");
  const [orderId, setOrderId] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const deltaCm = metresToCm(Number(metres) || 0) * (direction === "out" ? -1 : 1);
  const nextQuantity = fabric.quantityCm + deltaCm;
  const reasons = FABRIC_MOVEMENT_REASONS.filter((item) =>
    direction === "in" ? ["purchase", "adjustment", "inventory"].includes(item.value) : ["cutting", "adjustment", "loss"].includes(item.value),
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deltaCm === 0 || Math.abs(deltaCm) > 1_000_000) return;
    if (nextQuantity < 0) return;
    setBusy(true);
    await onSave({
      id: makeId(),
      fabricId: fabric.id,
      deltaCm,
      reason,
      orderId: orderId || null,
      note: note.trim() || null,
      createdAt: new Date().toISOString(),
    });
    setBusy(false);
  }

  return (
    <form className="app-form" onSubmit={submit}>
      <div className="payment-order-card">
        <span className="payment-order-icon">🧵</span>
        <div>
          <b>{fabric.name}</b>
          <small>
            Stock actuel : {cmToMetres(fabric.quantityCm)}
            {deltaCm !== 0 && nextQuantity >= 0 ? ` → ${cmToMetres(nextQuantity)}` : ""}
          </small>
        </div>
      </div>
      <Field label={direction === "in" ? "Mètres ajoutés *" : "Mètres utilisés *"}>
        <div className="input-suffix">
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min={0.05}
            max={10000}
            step={0.25}
            value={metres}
            onChange={(event) => setMetres(event.target.value)}
            placeholder="Ex. 2,5"
            required
          />
          <span>mètres</span>
        </div>
      </Field>
      {nextQuantity < 0 && (
        <p className="recover-error" role="alert">
          Stock insuffisant : il ne reste que {cmToMetres(fabric.quantityCm)} de ce tissu.
        </p>
      )}
      <Field label="Motif">
        <select value={reason} onChange={(event) => setReason(event.target.value as FabricMovementReason)}>
          {reasons.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </Field>
      {direction === "out" && orders.length > 0 && (
        <Field label="Commande liée (facultatif)">
          <select value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            <option value="">Aucune</option>
            {orders
              .filter((order) => order.status !== "delivered")
              .slice(0, 30)
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} · {order.garment}
                </option>
              ))}
          </select>
        </Field>
      )}
      <Field label="Note (facultatif)">
        <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Ex. coupe robe Mme Fadiga" maxLength={200} />
      </Field>
      <div className="form-actions">
        <button type="button" className="button button-quiet" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="button button-primary" disabled={busy || deltaCm === 0 || nextQuantity < 0}>
          {busy ? "Enregistrement…" : direction === "in" ? "Ajouter au stock" : "Sortir du stock"}
        </button>
      </div>
    </form>
  );
}
