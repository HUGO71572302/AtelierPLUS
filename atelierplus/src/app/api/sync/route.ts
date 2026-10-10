import { NextResponse } from "next/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  clients,
  expenses,
  fabricMovements,
  fabrics,
  inspirationModels,
  measurements,
  orders,
  payments,
} from "@/db/schema";
import { getSessionUser } from "@/lib/auth";
import { EXPENSE_CATEGORIES } from "@/lib/atelier-types";
import type {
  AppointmentKind,
  AppointmentStatus,
  FabricMovementReason,
  OrderStatus,
  SafeUser,
} from "@/lib/atelier-types";

export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const allowedStatuses = new Set<OrderStatus>(["pending", "in_progress", "ready", "delivered"]);
const allowedAppointmentKinds = new Set<AppointmentKind>(["fitting", "delivery", "other"]);
const allowedAppointmentStatuses = new Set<AppointmentStatus>(["scheduled", "done", "cancelled"]);
const allowedMovementReasons = new Set<FabricMovementReason>(["purchase", "cutting", "adjustment", "loss", "inventory"]);
const allowedMeasures = new Set(["LC", "E", "CA", "EN", "P", "T", "BS", "LM", "TM", "TP", "LP", "EJ", "C", "GE", "B", "LJ", "LR", "O", "HP"]);
const allowedGarments = new Set(["chemise_homme", "chemisier_femme", "robe_femme", "jupe_femme", "pantalon", "boubou", "ensemble"]);
const MAX_MODEL_IMAGE_BYTES = 1_100_000; // compressed client-side before sync

type JsonRecord = Record<string, unknown>;
type SyncResult = {
  queueId: string;
  ok: boolean;
  conflict?: boolean;
  retry?: boolean;
  message?: string;
  orderNumber?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function cleanText(value: unknown, maximum = 500): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  return cleaned ? cleaned.slice(0, maximum) : null;
}

function cleanDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value ? null : value;
}

function cleanTime(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null;
  return value;
}

function asDate(value: unknown, fallback = new Date()): Date {
  if (typeof value !== "string") return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function positiveInteger(value: unknown, allowZero = false): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value > 2_147_483_647) return null;
  if (allowZero ? value < 0 : value <= 0) return null;
  return value;
}

function signedInteger(value: unknown, maxAbs = 1_000_000): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) return null;
  if (value === 0 || Math.abs(value) > maxAbs) return null;
  return value;
}

function cleanMeasurements(value: unknown): Record<string, number> | null {
  if (!isRecord(value)) return null;
  const result: Record<string, number> = {};
  for (const [code, amount] of Object.entries(value)) {
    if (!allowedMeasures.has(code) || typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0 || amount > 500) {
      return null;
    }
    result[code] = Math.round(amount * 10) / 10;
  }
  return result;
}

function cleanAdjustments(value: unknown): Record<string, number> | null {
  if (value === null || value === undefined) return {};
  if (!isRecord(value)) return null;
  const result: Record<string, number> = {};
  for (const [code, amount] of Object.entries(value)) {
    if (!allowedMeasures.has(code) || typeof amount !== "number" || !Number.isFinite(amount) || Math.abs(amount) > 100) {
      return null;
    }
    if (amount !== 0) result[code] = Math.round(amount * 10) / 10;
  }
  return result;
}

/** Every workshop only sees and touches its own rows. */
function sameAtelier(user: SafeUser, rowAtelierId: string | null): boolean {
  // A user without workshop never gets access to any row (no cross-workshop leak).
  if (!user.atelierId) return false;
  return rowAtelierId === user.atelierId;
}

async function processOperation(value: unknown, user: SafeUser): Promise<SyncResult> {
  const operation = isRecord(value) ? value : {};
  const queueId = typeof operation.queueId === "string" ? operation.queueId.slice(0, 120) : "unknown";
  const payload = isRecord(operation.payload) ? operation.payload : {};
  const type = operation.type;

  try {
    if (type === "client.upsert") {
      const id = payload.id;
      const name = cleanText(payload.name, 120);
      if (!validUuid(id) || !name) return { queueId, ok: false, message: "Le nom du client ou son identifiant est invalide." };
      const [existing] = await db.select({ atelierId: clients.atelierId }).from(clients).where(eq(clients.id, id)).limit(1);
      if (existing && !sameAtelier(user, existing.atelierId)) {
        return { queueId, ok: false, message: "Ce client appartient à un autre atelier." };
      }
      const updatedAt = asDate(payload.updatedAt);
      await db
        .insert(clients)
        .values({
          id,
          atelierId: user.atelierId,
          name,
          phone: cleanText(payload.phone, 60),
          gender: cleanText(payload.gender, 20),
          notes: cleanText(payload.notes, 2000),
          createdAt: asDate(payload.createdAt),
          updatedAt,
        })
        .onConflictDoUpdate({
          target: clients.id,
          set: {
            name,
            phone: cleanText(payload.phone, 60),
            gender: cleanText(payload.gender, 20),
            notes: cleanText(payload.notes, 2000),
            updatedAt,
          },
        });
      return { queueId, ok: true };
    }

    if (type === "measurement.create") {
      const id = payload.id;
      const clientId = payload.clientId;
      const values = cleanMeasurements(payload.values);
      if (!validUuid(id) || !validUuid(clientId) || !values || Object.keys(values).length === 0) {
        return { queueId, ok: false, message: "Le relevé de mensurations est incomplet ou invalide." };
      }
      const [client] = await db.select({ id: clients.id, atelierId: clients.atelierId }).from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!client) return { queueId, ok: false, message: "Le client de ce relevé n’existe pas." };
      if (!sameAtelier(user, client.atelierId)) return { queueId, ok: false, message: "Ce client appartient à un autre atelier." };
      await db
        .insert(measurements)
        .values({ id, clientId, values, measuredAt: asDate(payload.measuredAt), createdBy: user.id })
        .onConflictDoNothing({ target: measurements.id });
      return { queueId, ok: true };
    }

    if (type === "order.create") {
      const id = payload.id;
      const clientId = payload.clientId;
      const garment = cleanText(payload.garment, 80);
      const totalAmount = positiveInteger(payload.totalAmount);
      const adjustments = cleanAdjustments(payload.adjustments);
      if (!validUuid(id) || !validUuid(clientId) || !garment || totalAmount === null || !adjustments) {
        return { queueId, ok: false, message: "La commande est incomplète ou invalide." };
      }
      const [client] = await db.select({ id: clients.id, atelierId: clients.atelierId }).from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!client) return { queueId, ok: false, message: "Le client de cette commande n’existe pas." };
      if (!sameAtelier(user, client.atelierId)) return { queueId, ok: false, message: "Ce client appartient à un autre atelier." };

      const orderNumber = await db.transaction(async (transaction) => {
        // One lock per workshop: numbering is independent between workshops.
        await transaction.execute(sql`SELECT pg_advisory_xact_lock(8524002, hashtext(${user.atelierId ?? ""}))`);
        const [existing] = await transaction
          .select({ orderNumber: orders.orderNumber })
          .from(orders)
          .where(eq(orders.id, id))
          .limit(1);
        if (existing) return existing.orderNumber;

        const savedNumbers = await transaction
          .select({ orderNumber: orders.orderNumber })
          .from(orders)
          .where(user.atelierId ? eq(orders.atelierId, user.atelierId) : isNull(orders.atelierId));
        const highest = savedNumbers.reduce((maximum, saved) => {
          const match = /^CMD-(\d+)$/.exec(saved.orderNumber);
          return match ? Math.max(maximum, Number(match[1])) : maximum;
        }, 0);
        const nextNumber = `CMD-${String(highest + 1).padStart(3, "0")}`;
        const createdAt = asDate(payload.createdAt);
        await transaction.insert(orders).values({
          id,
          atelierId: user.atelierId,
          orderNumber: nextNumber,
          clientId,
          garment,
          model: cleanText(payload.model, 120),
          fabricSource: cleanText(payload.fabricSource, 40),
          totalAmount,
          dueDate: cleanDate(payload.dueDate),
          status: "pending",
          notes: cleanText(payload.notes, 2000),
          adjustments,
          revision: 1,
          createdBy: user.id,
          updatedBy: user.id,
          createdAt,
          updatedAt: createdAt,
        });
        return nextNumber;
      });
      return { queueId, ok: true, orderNumber };
    }

    if (type === "order.status") {
      const orderId = payload.orderId;
      const status = payload.status;
      const expectedRevision = positiveInteger(payload.expectedRevision);
      if (!validUuid(orderId) || typeof status !== "string" || !allowedStatuses.has(status as OrderStatus) || expectedRevision === null || expectedRevision >= 2_147_483_647) {
        return { queueId, ok: false, message: "Le changement de statut est invalide." };
      }
      const [target] = await db.select({ atelierId: orders.atelierId }).from(orders).where(eq(orders.id, orderId)).limit(1);
      if (!target) return { queueId, ok: false, message: "Cette commande n’existe pas." };
      if (!sameAtelier(user, target.atelierId)) return { queueId, ok: false, message: "Cette commande appartient à un autre atelier." };
      const nextStatus = status as OrderStatus;
      const changed = await db
        .update(orders)
        .set({ status: nextStatus, revision: expectedRevision + 1, updatedBy: user.id, updatedAt: new Date() })
        .where(and(
          eq(orders.id, orderId),
          eq(orders.revision, expectedRevision),
        ))
        .returning({ id: orders.id });
      if (changed.length === 0) {
        const [currentOrder] = await db
          .select({ status: orders.status, revision: orders.revision })
          .from(orders)
          .where(eq(orders.id, orderId))
          .limit(1);
        if (currentOrder?.status === nextStatus && currentOrder.revision === expectedRevision + 1) {
          return { queueId, ok: true };
        }
        return {
          queueId,
          ok: false,
          conflict: true,
          message: "Cette commande a changé sur un autre appareil. Les dernières données ont été rechargées pour éviter d’écraser le travail de l’équipe.",
        };
      }
      return { queueId, ok: true };
    }

    if (type === "payment.create") {
      const id = payload.id;
      const orderId = payload.orderId;
      const amount = positiveInteger(payload.amount);
      if (!validUuid(id) || !validUuid(orderId) || amount === null) {
        return { queueId, ok: false, message: "Le montant du paiement est invalide." };
      }
      const paymentResult = await db.transaction(async (transaction) => {
        const [duplicate] = await transaction
          .select({ id: payments.id })
          .from(payments)
          .where(eq(payments.id, id))
          .limit(1);
        if (duplicate) return { ok: true as const };

        const [order] = await transaction
          .select({ id: orders.id, totalAmount: orders.totalAmount, atelierId: orders.atelierId })
          .from(orders)
          .where(eq(orders.id, orderId))
          .for("update")
          .limit(1);
        if (!order) return { ok: false as const, message: "La commande associée à ce paiement n’existe pas." };
        if (!sameAtelier(user, order.atelierId)) return { ok: false as const, message: "Cette commande appartient à un autre atelier." };

        const [paymentsSoFar] = await transaction
          .select({ total: sql<number>`coalesce(sum(${payments.amount}), 0)::int` })
          .from(payments)
          .where(eq(payments.orderId, orderId));
        const paidAmount = Number(paymentsSoFar?.total ?? 0);
        if (paidAmount + amount > order.totalAmount) {
          return { ok: false as const, message: "Ce paiement dépasse le reste à payer. Vérifiez le montant et réessayez." };
        }

        await transaction.insert(payments).values({
          id,
          orderId,
          amount,
          paidAt: asDate(payload.paidAt),
          note: cleanText(payload.note, 200),
          createdBy: user.id,
        });
        return { ok: true as const };
      });
      return paymentResult.ok
        ? { queueId, ok: true }
        : { queueId, ok: false, message: paymentResult.message };
    }

    if (type === "expense.create") {
      if (user.role !== "owner") return { queueId, ok: false, message: "Les dépenses sont réservées au patron." };
      const id = payload.id;
      const amount = positiveInteger(payload.amount);
      const category = cleanText(payload.category, 50);
      const date = cleanDate(payload.date);
      const description = cleanText(payload.description, 300);
      const orderId = payload.orderId === null || payload.orderId === "" ? null : payload.orderId;
      if (!validUuid(id) || amount === null || !category || !EXPENSE_CATEGORIES.includes(category) || !date || !description) {
        return { queueId, ok: false, message: "Cette dépense est incomplète ou invalide." };
      }
      if (orderId !== null && !validUuid(orderId)) return { queueId, ok: false, message: "La commande liée à cette dépense est invalide." };
      if (orderId !== null) {
        const [linked] = await db.select({ atelierId: orders.atelierId }).from(orders).where(eq(orders.id, orderId as string)).limit(1);
        if (!linked) return { queueId, ok: false, message: "La commande liée à cette dépense n’existe pas." };
        if (!sameAtelier(user, linked.atelierId)) return { queueId, ok: false, message: "Cette commande appartient à un autre atelier." };
      }
      await db
        .insert(expenses)
        .values({
          id,
          atelierId: user.atelierId,
          amount,
          category,
          date,
          description,
          orderId: orderId as string | null,
          createdBy: user.id,
        })
        .onConflictDoNothing({ target: expenses.id });
      return { queueId, ok: true };
    }

    if (type === "appointment.create") {
      const id = payload.id;
      const clientId = payload.clientId;
      const kind = payload.kind;
      const title = cleanText(payload.title, 120);
      const date = cleanDate(payload.date);
      const time = cleanTime(payload.time);
      const orderId = payload.orderId === null || payload.orderId === "" ? null : payload.orderId;
      const notes = cleanText(payload.notes, 1000);
      if (
        !validUuid(id) || !validUuid(clientId) || typeof kind !== "string" ||
        !allowedAppointmentKinds.has(kind as AppointmentKind) || !title || !date
      ) {
        return { queueId, ok: false, message: "Le rendez-vous est incomplet ou invalide." };
      }
      if (payload.time !== null && payload.time !== undefined && payload.time !== "" && time === null) {
        return { queueId, ok: false, message: "L’heure du rendez-vous est invalide (format HH:MM)." };
      }
      if (orderId !== null && !validUuid(orderId)) {
        return { queueId, ok: false, message: "La commande liée au rendez-vous est invalide." };
      }
      const [client] = await db.select({ id: clients.id, atelierId: clients.atelierId }).from(clients).where(eq(clients.id, clientId)).limit(1);
      if (!client) return { queueId, ok: false, message: "Le client de ce rendez-vous n’existe pas." };
      if (!sameAtelier(user, client.atelierId)) return { queueId, ok: false, message: "Ce client appartient à un autre atelier." };
      if (orderId !== null) {
        const [linked] = await db.select({ id: orders.id, atelierId: orders.atelierId, clientId: orders.clientId }).from(orders).where(eq(orders.id, orderId as string)).limit(1);
        if (!linked) return { queueId, ok: false, message: "La commande liée au rendez-vous n’existe pas." };
        if (!sameAtelier(user, linked.atelierId)) return { queueId, ok: false, message: "Cette commande appartient à un autre atelier." };
        if (linked.clientId !== clientId) return { queueId, ok: false, message: "La commande liée n’appartient pas à ce client." };
      }
      await db
        .insert(appointments)
        .values({
          id,
          atelierId: user.atelierId,
          clientId,
          orderId: orderId as string | null,
          kind: kind as AppointmentKind,
          title,
          date,
          time,
          notes,
          status: "scheduled",
          createdBy: user.id,
          createdAt: asDate(payload.createdAt),
          updatedAt: asDate(payload.createdAt),
        })
        .onConflictDoNothing({ target: appointments.id });
      return { queueId, ok: true };
    }

    if (type === "appointment.status") {
      const appointmentId = payload.appointmentId;
      const status = payload.status;
      if (!validUuid(appointmentId) || typeof status !== "string" || !allowedAppointmentStatuses.has(status as AppointmentStatus)) {
        return { queueId, ok: false, message: "Le changement de statut du rendez-vous est invalide." };
      }
      const [existing] = await db.select({ atelierId: appointments.atelierId }).from(appointments).where(eq(appointments.id, appointmentId)).limit(1);
      if (!existing) return { queueId, ok: false, message: "Ce rendez-vous n’existe pas." };
      if (!sameAtelier(user, existing.atelierId)) return { queueId, ok: false, message: "Ce rendez-vous appartient à un autre atelier." };
      await db
        .update(appointments)
        .set({ status: status as AppointmentStatus, updatedAt: new Date() })
        .where(eq(appointments.id, appointmentId));
      return { queueId, ok: true };
    }

    if (type === "fabric.create") {
      if (user.role !== "owner") return { queueId, ok: false, message: "Le stock de tissu est géré par le patron." };
      const id = payload.id;
      const name = cleanText(payload.name, 80);
      const color = cleanText(payload.color, 40);
      const widthCm = payload.widthCm === null || payload.widthCm === undefined ? null : positiveInteger(payload.widthCm);
      const quantityCm = payload.quantityCm === 0 ? 0 : positiveInteger(payload.quantityCm, true);
      const minThresholdCm = payload.minThresholdCm === null || payload.minThresholdCm === undefined ? 0 : positiveInteger(payload.minThresholdCm, true);
      const unitPrice = payload.unitPrice === null || payload.unitPrice === undefined ? null : positiveInteger(payload.unitPrice);
      const notes = cleanText(payload.notes, 500);
      if (!validUuid(id) || !name || name.length < 2) {
        return { queueId, ok: false, message: "Le nom du tissu est invalide." };
      }
      if (widthCm !== null && (widthCm < 30 || widthCm > 400)) {
        return { queueId, ok: false, message: "La laize du tissu doit être entre 30 et 400 cm." };
      }
      if (quantityCm === null || quantityCm > 1_000_000) {
        return { queueId, ok: false, message: "La quantité initiale est invalide." };
      }
      if (minThresholdCm === null || minThresholdCm > 1_000_000) {
        return { queueId, ok: false, message: "Le seuil d’alerte est invalide." };
      }
      await db
        .insert(fabrics)
        .values({
          id,
          atelierId: user.atelierId,
          name,
          color,
          widthCm,
          quantityCm,
          minThresholdCm,
          unitPrice,
          notes,
          createdBy: user.id,
          createdAt: asDate(payload.createdAt),
          updatedAt: asDate(payload.createdAt),
        })
        .onConflictDoNothing({ target: fabrics.id });
      return { queueId, ok: true };
    }

    if (type === "inspiration.create") {
      const id = payload.id;
      const title = cleanText(payload.title, 100);
      const garment = payload.garment;
      const description = cleanText(payload.description, 1200);
      const advice = cleanText(payload.advice, 1200);
      const imageData = payload.imageData === null || payload.imageData === undefined || payload.imageData === "" ? null : payload.imageData;
      const imageName = cleanText(payload.imageName, 120);
      const measureCodes = Array.isArray(payload.measureCodes) ? payload.measureCodes : null;
      if (!validUuid(id) || !title || typeof garment !== "string" || !allowedGarments.has(garment) || !measureCodes) {
        return { queueId, ok: false, message: "Le modèle est incomplet ou invalide." };
      }
      if (!measureCodes.every((code) => typeof code === "string" && allowedMeasures.has(code)) || measureCodes.length > 19) {
        return { queueId, ok: false, message: "Les mesures liées à ce modèle sont invalides." };
      }
      if (imageData !== null) {
        if (typeof imageData !== "string" || !/^data:image\/(jpeg|jpg|webp);base64,/i.test(imageData)) {
          return { queueId, ok: false, message: "La photo du modèle doit être un JPEG ou WebP." };
        }
        const payloadBytes = Math.ceil((imageData.length - imageData.indexOf(",") - 1) * 0.75);
        if (payloadBytes > MAX_MODEL_IMAGE_BYTES) {
          return { queueId, ok: false, message: "La photo est trop lourde. Choisissez une image plus légère." };
        }
      }
      await db
        .insert(inspirationModels)
        .values({
          id,
          atelierId: user.atelierId,
          title,
          garment,
          description,
          advice,
          imageData: imageData as string | null,
          imageName,
          measureCodes: measureCodes as string[],
          createdBy: user.id,
          createdAt: asDate(payload.createdAt),
          updatedAt: asDate(payload.createdAt),
        })
        .onConflictDoNothing({ target: inspirationModels.id });
      return { queueId, ok: true };
    }

    if (type === "inspiration.delete") {
      const modelId = payload.modelId;
      if (!validUuid(modelId)) return { queueId, ok: false, message: "Ce modèle est invalide." };
      const [model] = await db
        .select({ atelierId: inspirationModels.atelierId, createdBy: inspirationModels.createdBy })
        .from(inspirationModels)
        .where(eq(inspirationModels.id, modelId))
        .limit(1);
      if (!model) return { queueId, ok: true };
      if (!sameAtelier(user, model.atelierId)) return { queueId, ok: false, message: "Ce modèle appartient à un autre atelier." };
      if (user.role !== "owner" && model.createdBy !== user.id) {
        return { queueId, ok: false, message: "Seul le créateur ou le patron peut supprimer ce modèle." };
      }
      await db.delete(inspirationModels).where(eq(inspirationModels.id, modelId));
      return { queueId, ok: true };
    }

    if (type === "fabric.movement") {
      const id = payload.id;
      const fabricId = payload.fabricId;
      const deltaCm = signedInteger(payload.deltaCm, 1_000_000);
      const reason = payload.reason;
      const orderId = payload.orderId === null || payload.orderId === "" ? null : payload.orderId;
      const note = cleanText(payload.note, 300);
      if (!validUuid(id) || !validUuid(fabricId) || deltaCm === null || typeof reason !== "string" || !allowedMovementReasons.has(reason as FabricMovementReason)) {
        return { queueId, ok: false, message: "Le mouvement de stock est invalide." };
      }
      if (orderId !== null && !validUuid(orderId)) {
        return { queueId, ok: false, message: "La commande liée au mouvement est invalide." };
      }
      const result = await db.transaction(async (transaction) => {
        const [duplicate] = await transaction
          .select({ id: fabricMovements.id })
          .from(fabricMovements)
          .where(eq(fabricMovements.id, id))
          .limit(1);
        if (duplicate) return { ok: true as const };

        const [fabric] = await transaction
          .select({ id: fabrics.id, atelierId: fabrics.atelierId, quantityCm: fabrics.quantityCm })
          .from(fabrics)
          .where(eq(fabrics.id, fabricId))
          .for("update")
          .limit(1);
        if (!fabric) return { ok: false as const, message: "Ce tissu n’existe pas dans le stock." };
        if (!sameAtelier(user, fabric.atelierId)) return { ok: false as const, message: "Ce tissu appartient à un autre atelier." };

        if (orderId !== null) {
          const [linked] = await transaction
            .select({ id: orders.id, atelierId: orders.atelierId })
            .from(orders)
            .where(eq(orders.id, orderId as string))
            .limit(1);
          if (!linked) return { ok: false as const, message: "La commande liée au mouvement n’existe pas." };
          if (!sameAtelier(user, linked.atelierId)) return { ok: false as const, message: "Cette commande appartient à un autre atelier." };
        }

        const nextQuantity = fabric.quantityCm + deltaCm;
        if (nextQuantity < 0) {
          return { ok: false as const, message: "Stock insuffisant pour ce tissu. Vérifiez la quantité disponible." };
        }

        await transaction.insert(fabricMovements).values({
          id,
          fabricId,
          deltaCm,
          reason: reason as FabricMovementReason,
          orderId: orderId as string | null,
          note,
          createdBy: user.id,
          createdAt: asDate(payload.createdAt),
        });
        await transaction
          .update(fabrics)
          .set({ quantityCm: nextQuantity, updatedAt: new Date() })
          .where(eq(fabrics.id, fabricId));
        return { ok: true as const };
      });
      return result.ok
        ? { queueId, ok: true }
        : { queueId, ok: false, message: result.message };
    }

    return { queueId, ok: false, message: "Cette opération n’est pas reconnue." };
  } catch {
    return {
      queueId,
      ok: false,
      retry: true,
      message: "Synchronisation interrompue. L’opération reste enregistrée sur cet appareil.",
    };
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  let body: JsonRecord;
  try {
    const parsed: unknown = await request.json();
    if (!isRecord(parsed)) return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  if (body.ownerId !== user.id) {
    return NextResponse.json({ error: "Cette file de synchronisation appartient à une autre session." }, { status: 403 });
  }
  if (!Array.isArray(body.operations) || body.operations.length > 100) {
    return NextResponse.json({ error: "La file doit contenir au maximum 100 opérations." }, { status: 400 });
  }
  const results: SyncResult[] = [];
  for (const operation of body.operations) results.push(await processOperation(operation, user));
  return NextResponse.json({ results });
}
