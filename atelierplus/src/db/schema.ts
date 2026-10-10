import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export type UserRole = "owner" | "member";
export type OrderStatus = "pending" | "in_progress" | "ready" | "delivered";
export type AppointmentKind = "fitting" | "delivery" | "other";
export type AppointmentStatus = "scheduled" | "done" | "cancelled";
export type FabricMovementReason = "purchase" | "cutting" | "adjustment" | "loss" | "inventory";
export type MeasurementValues = Record<string, number>;
export type MeasurementAdjustments = Record<string, number>;

export const ateliers = pgTable(
  "ateliers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    city: text("city"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const atelierUsers = pgTable(
  "atelier_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    passwordHash: text("password_hash").notNull(),
    recoveryCodeHash: text("recovery_code_hash"),
    role: text("role").$type<UserRole>().notNull().default("member"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    phoneUnique: uniqueIndex("atelier_users_phone_unique").on(table.phone),
    atelierIndex: index("atelier_users_atelier_idx").on(table.atelierId),
  }),
);

export const atelierInvitations = pgTable(
  "atelier_invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    codeHash: text("code_hash").notNull(),
    role: text("role").$type<UserRole>().notNull().default("member"),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedBy: uuid("used_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    codeUnique: uniqueIndex("atelier_invitations_code_unique").on(table.codeHash),
    atelierIndex: index("atelier_invitations_atelier_idx").on(table.atelierId),
  }),
);

export const passwordResetRequests = pgTable(
  "password_reset_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => atelierUsers.id, { onDelete: "cascade" }),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    codeHash: text("code_hash"),
    codeExpiresAt: timestamp("code_expires_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (table) => ({
    atelierIndex: index("password_resets_atelier_idx").on(table.atelierId),
    userIndex: index("password_resets_user_idx").on(table.userId),
  }),
);

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    gender: text("gender"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    nameIndex: index("clients_name_idx").on(table.name),
    atelierIndex: index("clients_atelier_idx").on(table.atelierId),
  }),
);

export const measurements = pgTable(
  "measurements",
  {
    id: uuid("id").primaryKey(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    values: jsonb("values").$type<MeasurementValues>().notNull().default({}),
    measuredAt: timestamp("measured_at", { withTimezone: true }).notNull().defaultNow(),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
  },
  (table) => ({ clientIndex: index("measurements_client_idx").on(table.clientId, table.measuredAt) }),
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    orderNumber: text("order_number").notNull(),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    garment: text("garment").notNull(),
    model: text("model"),
    fabricSource: text("fabric_source"),
    totalAmount: integer("total_amount").notNull().default(0),
    dueDate: text("due_date"),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    notes: text("notes"),
    adjustments: jsonb("adjustments").$type<MeasurementAdjustments>().notNull().default({}),
    revision: integer("revision").notNull().default(1),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    numberUnique: uniqueIndex("orders_atelier_number_unique").on(table.atelierId, table.orderNumber),
    atelierNumberIndex: index("orders_atelier_number_idx").on(table.atelierId, table.orderNumber),
    updatedIndex: index("orders_updated_idx").on(table.updatedAt),
  }),
);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    amount: integer("amount").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }).notNull().defaultNow(),
    note: text("note"),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
  },
  (table) => ({ orderIndex: index("payments_order_idx").on(table.orderId, table.paidAt) }),
);

export const expenses = pgTable(
  "expenses",
  {
    id: uuid("id").primaryKey(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    date: text("date").notNull(),
    amount: integer("amount").notNull(),
    category: text("category").notNull(),
    description: text("description").notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    dateIndex: index("expenses_date_idx").on(table.date),
    atelierIndex: index("expenses_atelier_idx").on(table.atelierId),
  }),
);

export const appointments = pgTable(
  "appointments",
  {
    id: uuid("id").primaryKey(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    clientId: uuid("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "cascade" }),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    kind: text("kind").$type<AppointmentKind>().notNull().default("fitting"),
    title: text("title").notNull(),
    date: text("date").notNull(),
    time: text("time"),
    notes: text("notes"),
    status: text("status").$type<AppointmentStatus>().notNull().default("scheduled"),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    atelierDateIndex: index("appointments_atelier_date_idx").on(table.atelierId, table.date, table.status),
    clientIndex: index("appointments_client_idx").on(table.clientId),
  }),
);

export const fabrics = pgTable(
  "fabrics",
  {
    id: uuid("id").primaryKey(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    widthCm: integer("width_cm"),
    // Stock stored in centimetres to avoid float rounding. Display converts to metres.
    quantityCm: integer("quantity_cm").notNull().default(0),
    minThresholdCm: integer("min_threshold_cm").notNull().default(0),
    // Purchase price per metre in FCFA. Owner-only when exposed to members.
    unitPrice: integer("unit_price"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    atelierIndex: index("fabrics_atelier_idx").on(table.atelierId),
    nameIndex: index("fabrics_name_idx").on(table.name),
  }),
);

export const fabricMovements = pgTable(
  "fabric_movements",
  {
    id: uuid("id").primaryKey(),
    fabricId: uuid("fabric_id")
      .notNull()
      .references(() => fabrics.id, { onDelete: "cascade" }),
    // Positive = stock in (purchase, inventory), negative = stock out (cutting, loss).
    deltaCm: integer("delta_cm").notNull(),
    reason: text("reason").$type<FabricMovementReason>().notNull(),
    orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
    note: text("note"),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({ fabricIndex: index("fabric_movements_fabric_idx").on(table.fabricId, table.createdAt) }),
);

/** Personal model catalogue: compressed image data is stored in the atelier database. */
export const inspirationModels = pgTable(
  "inspiration_models",
  {
    id: uuid("id").primaryKey(),
    atelierId: uuid("atelier_id").references(() => ateliers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    garment: text("garment").notNull(),
    description: text("description"),
    advice: text("advice"),
    imageData: text("image_data"),
    imageName: text("image_name"),
    measureCodes: jsonb("measure_codes").$type<string[]>().notNull().default([]),
    createdBy: uuid("created_by").references(() => atelierUsers.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    atelierIndex: index("inspiration_models_atelier_idx").on(table.atelierId, table.createdAt),
    creatorIndex: index("inspiration_models_creator_idx").on(table.createdBy),
  }),
);
