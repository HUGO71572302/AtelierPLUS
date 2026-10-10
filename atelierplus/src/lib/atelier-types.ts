import type {
  AppointmentKind,
  AppointmentStatus,
  FabricMovementReason,
  MeasurementAdjustments,
  MeasurementValues,
  OrderStatus,
  UserRole,
} from "@/db/schema";

export type {
  AppointmentKind,
  AppointmentStatus,
  FabricMovementReason,
  MeasurementAdjustments,
  MeasurementValues,
  OrderStatus,
  UserRole,
};

export type SafeUser = {
  id: string;
  atelierId: string | null;
  atelierName: string | null;
  atelierCity: string | null;
  fullName: string;
  phone: string;
  role: UserRole;
};

export type Client = {
  id: string;
  name: string;
  phone: string | null;
  gender: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ClientMeasurement = {
  id: string;
  clientId: string;
  values: MeasurementValues;
  measuredAt: string;
  createdBy: string | null;
};

export type AtelierOrder = {
  id: string;
  orderNumber: string;
  clientId: string;
  garment: string;
  model: string | null;
  fabricSource: string | null;
  totalAmount: number | null;
  dueDate: string | null;
  status: OrderStatus;
  notes: string | null;
  adjustments: MeasurementAdjustments;
  revision: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Payment = {
  id: string;
  orderId: string;
  amount: number;
  paidAt: string;
  note: string | null;
  createdBy: string | null;
};

export type Expense = {
  id: string;
  date: string;
  amount: number;
  category: string;
  description: string;
  orderId: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type TeamMember = Pick<SafeUser, "id" | "fullName" | "phone" | "role"> & {
  createdAt: string;
};

/** Lighting the "trace": who created or edited an order or a payment.
 *  Only the id and full name — no financial detail — so members can load it too. */
export type TeamNameRef = { id: string; fullName: string };

export type Appointment = {
  id: string;
  clientId: string;
  orderId: string | null;
  kind: AppointmentKind;
  title: string;
  date: string;
  time: string | null;
  notes: string | null;
  status: AppointmentStatus;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Fabric = {
  id: string;
  name: string;
  color: string | null;
  widthCm: number | null;
  quantityCm: number;
  minThresholdCm: number;
  unitPrice: number | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FabricMovement = {
  id: string;
  fabricId: string;
  deltaCm: number;
  reason: FabricMovementReason;
  orderId: string | null;
  note: string | null;
  createdBy: string | null;
  createdAt: string;
};

export type InspirationModel = {
  id: string;
  title: string;
  garment: string;
  description: string | null;
  advice: string | null;
  /** Compressed JPEG/WebP data URL; optional because a model can be text-only. */
  imageData: string | null;
  imageName: string | null;
  measureCodes: string[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AtelierData = {
  user: SafeUser;
  clients: Client[];
  measurements: ClientMeasurement[];
  orders: AtelierOrder[];
  payments: Payment[];
  expenses: Expense[];
  team: TeamMember[];
  teamNames: TeamNameRef[];
  appointments: Appointment[];
  fabrics: Fabric[];
  fabricMovements: FabricMovement[];
  inspirationModels: InspirationModel[];
};

export type ClientDraft = Pick<Client, "id" | "name" | "phone" | "gender" | "notes"> & {
  createdAt: string;
  updatedAt: string;
};

export type MeasurementDraft = Pick<ClientMeasurement, "id" | "clientId" | "values" | "measuredAt">;

export type OrderDraft = Pick<
  AtelierOrder,
  "id" | "clientId" | "garment" | "model" | "fabricSource" | "totalAmount" | "dueDate" | "notes" | "adjustments"
> & { createdAt: string };

export type PaymentDraft = Pick<Payment, "id" | "orderId" | "amount" | "paidAt" | "note">;

export type ExpenseDraft = Pick<Expense, "id" | "date" | "amount" | "category" | "description" | "orderId">;

export type AppointmentDraft = Pick<
  Appointment,
  "id" | "clientId" | "orderId" | "kind" | "title" | "date" | "time" | "notes"
> & { createdAt: string };

export type FabricDraft = Pick<
  Fabric,
  "id" | "name" | "color" | "widthCm" | "quantityCm" | "minThresholdCm" | "unitPrice" | "notes"
> & { createdAt: string };

export type FabricMovementDraft = Pick<
  FabricMovement,
  "id" | "fabricId" | "deltaCm" | "reason" | "orderId" | "note"
> & { createdAt: string };

export type InspirationModelDraft = Pick<
  InspirationModel,
  "id" | "title" | "garment" | "description" | "advice" | "imageData" | "imageName" | "measureCodes"
> & { createdAt: string };

export type OfflineOperation =
  | { queueId: string; type: "client.upsert"; payload: ClientDraft }
  | { queueId: string; type: "measurement.create"; payload: MeasurementDraft }
  | { queueId: string; type: "order.create"; payload: OrderDraft }
  | {
      queueId: string;
      type: "order.status";
      payload: { orderId: string; status: OrderStatus; expectedRevision: number };
    }
  | { queueId: string; type: "payment.create"; payload: PaymentDraft }
  | { queueId: string; type: "expense.create"; payload: ExpenseDraft }
  | { queueId: string; type: "appointment.create"; payload: AppointmentDraft }
  | {
      queueId: string;
      type: "appointment.status";
      payload: { appointmentId: string; status: AppointmentStatus };
    }
  | { queueId: string; type: "fabric.create"; payload: FabricDraft }
  | { queueId: string; type: "fabric.movement"; payload: FabricMovementDraft }
  | { queueId: string; type: "inspiration.create"; payload: InspirationModelDraft }
  | { queueId: string; type: "inspiration.delete"; payload: { modelId: string } };

export type SyncConflict = {
  id: string;
  ownerId: string;
  message: string;
  createdAt: string;
  operation?: OfflineOperation;
};

export type MeasurementDefinition = {
  code: string;
  name: string;
  hint: string;
  optional?: boolean;
};

export const MEASUREMENT_CATALOG: MeasurementDefinition[] = [
  { code: "LC", name: "Longueur de chemise / corsage", hint: "Du creux du cou à l’ourlet" },
  { code: "E", name: "Longueur d’épaule", hint: "Du bas du cou à la pointe" },
  { code: "CA", name: "Carrure dos", hint: "D’une emmanchure à l’autre" },
  { code: "EN", name: "Tour d’encolure", hint: "À la base du cou" },
  { code: "P", name: "Tour de poitrine", hint: "Au point le plus fort" },
  { code: "T", name: "Tour de taille", hint: "Au point le plus étroit" },
  { code: "BS", name: "Tour de bassin", hint: "Au point le plus fort des hanches" },
  { code: "LM", name: "Longueur de manche", hint: "De l’épaule au poignet" },
  { code: "TM", name: "Tour de manche", hint: "Au point le plus fort du bras" },
  { code: "TP", name: "Tour de poignet", hint: "À hauteur du bracelet", optional: true },
  { code: "LP", name: "Longueur de pantalon", hint: "De la taille à la cheville" },
  { code: "EJ", name: "Entrejambe", hint: "De l’entrejambe à la cheville" },
  { code: "C", name: "Tour de cuisse", hint: "Au point le plus fort" },
  { code: "GE", name: "Tour de genou", hint: "Au point le plus large", optional: true },
  { code: "B", name: "Bas de pantalon", hint: "Largeur à la cheville" },
  { code: "LJ", name: "Longueur de jupe", hint: "De la taille à l’ourlet" },
  { code: "LR", name: "Longueur de robe", hint: "De l’épaule à l’ourlet" },
  { code: "O", name: "Hauteur du nombril", hint: "De l’épaule au nombril" },
  { code: "HP", name: "Hauteur de poitrine", hint: "De l’épaule à la pointe", optional: true },
];

export const GARMENT_TEMPLATES = [
  {
    value: "chemise_homme",
    label: "Chemise homme",
    required: ["LC", "E", "CA", "EN", "P", "LM", "TM"],
    optional: ["T", "TP"],
  },
  {
    value: "chemisier_femme",
    label: "Chemisier / corsage",
    required: ["LC", "E", "EN", "P", "LM", "TM"],
    optional: ["T", "CA", "HP", "TP"],
  },
  {
    value: "robe_femme",
    label: "Robe femme",
    required: ["LR", "P", "T", "BS"],
    optional: ["E", "EN", "LM", "TM", "O", "HP"],
  },
  { value: "jupe_femme", label: "Jupe femme", required: ["LJ", "T", "BS"], optional: [] },
  {
    value: "pantalon",
    label: "Pantalon",
    required: ["LP", "T", "BS", "EJ", "C", "B"],
    optional: ["GE"],
  },
  {
    value: "boubou",
    label: "Boubou / Grand boubou",
    required: ["LR", "P", "LM", "EN", "TM"],
    optional: ["O", "T"],
  },
  {
    value: "ensemble",
    label: "Ensemble deux pièces",
    required: ["LC", "LJ", "P", "T", "BS"],
    optional: ["LM", "EN", "E"],
  },
] as const;

export const ORDER_STATUSES: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "En attente" },
  { value: "in_progress", label: "En cours" },
  { value: "ready", label: "Prête" },
  { value: "delivered", label: "Livrée" },
];

export const EXPENSE_CATEGORIES = [
  "Tissus",
  "Fournitures",
  "Transport",
  "Loyer",
  "Électricité",
  "Salaires",
  "Autre",
];

export const APPOINTMENT_KINDS: { value: AppointmentKind; label: string }[] = [
  { value: "fitting", label: "Essayage" },
  { value: "delivery", label: "Livraison" },
  { value: "other", label: "Autre rendez-vous" },
];

export const APPOINTMENT_STATUSES: { value: AppointmentStatus; label: string }[] = [
  { value: "scheduled", label: "Prévu" },
  { value: "done", label: "Terminé" },
  { value: "cancelled", label: "Annulé" },
];

export const FABRIC_MOVEMENT_REASONS: { value: FabricMovementReason; label: string }[] = [
  { value: "purchase", label: "Achat" },
  { value: "cutting", label: "Coupe commande" },
  { value: "adjustment", label: "Ajustement" },
  { value: "loss", label: "Perte / chute" },
  { value: "inventory", label: "Inventaire" },
];

/** Centimetres in the database, metres on screen. */
export function cmToMetres(cm: number): string {
  return `${(cm / 100).toFixed(2).replace(".", ",")} m`;
}

export function metresToCm(metres: number): number {
  return Math.round(metres * 100);
}
