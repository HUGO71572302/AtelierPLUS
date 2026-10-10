import { NextResponse } from "next/server";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  appointments,
  atelierUsers,
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

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Connexion requise." }, { status: 401 });

  const atelierId = user.atelierId;
  if (!atelierId) {
    // No workshop attached: never expose rows from other workshops.
    return NextResponse.json({
      user, clients: [], measurements: [], orders: [], payments: [], expenses: [], team: [],
      teamNames: [], appointments: [], fabrics: [], fabricMovements: [], inspirationModels: [],
    });
  }

  const clientQuery = atelierId
    ? db.select().from(clients).where(eq(clients.atelierId, atelierId)).orderBy(asc(clients.name))
    : db.select().from(clients).orderBy(asc(clients.name));

  const orderQuery = atelierId
    ? db.select().from(orders).where(eq(orders.atelierId, atelierId)).orderBy(desc(orders.updatedAt))
    : db.select().from(orders).orderBy(desc(orders.updatedAt));

  const expenseQuery = user.role === "owner"
    ? (atelierId
        ? db.select().from(expenses).where(eq(expenses.atelierId, atelierId)).orderBy(desc(expenses.date))
        : db.select().from(expenses).orderBy(desc(expenses.date)))
    : Promise.resolve([]);

  const teamQuery = user.role === "owner"
    ? (atelierId
        ? db
            .select({
              id: atelierUsers.id,
              fullName: atelierUsers.fullName,
              phone: atelierUsers.phone,
              role: atelierUsers.role,
              createdAt: atelierUsers.createdAt,
            })
            .from(atelierUsers)
            .where(eq(atelierUsers.atelierId, atelierId))
            .orderBy(asc(atelierUsers.createdAt))
        : db
            .select({
              id: atelierUsers.id,
              fullName: atelierUsers.fullName,
              phone: atelierUsers.phone,
              role: atelierUsers.role,
              createdAt: atelierUsers.createdAt,
            })
            .from(atelierUsers)
            .orderBy(asc(atelierUsers.createdAt)))
    : Promise.resolve([]);

  const namesQuery = atelierId
    ? db
        .select({ id: atelierUsers.id, fullName: atelierUsers.fullName })
        .from(atelierUsers)
        .where(eq(atelierUsers.atelierId, atelierId))
        .orderBy(asc(atelierUsers.fullName))
    : db
        .select({ id: atelierUsers.id, fullName: atelierUsers.fullName })
        .from(atelierUsers)
        .orderBy(asc(atelierUsers.fullName));

  const appointmentQuery = atelierId
    ? db.select().from(appointments).where(eq(appointments.atelierId, atelierId)).orderBy(asc(appointments.date), asc(appointments.time))
    : db.select().from(appointments).orderBy(asc(appointments.date), asc(appointments.time));

  const fabricQuery = atelierId
    ? db.select().from(fabrics).where(eq(fabrics.atelierId, atelierId)).orderBy(asc(fabrics.name))
    : db.select().from(fabrics).orderBy(asc(fabrics.name));

  const inspirationQuery = atelierId
    ? db.select().from(inspirationModels).where(eq(inspirationModels.atelierId, atelierId)).orderBy(desc(inspirationModels.createdAt))
    : db.select().from(inspirationModels).orderBy(desc(inspirationModels.createdAt));

  const [clientRows, orderRows, expenseRows, teamRows, nameRows, appointmentRows, fabricRows, inspirationRows] = await Promise.all([
    clientQuery,
    orderQuery,
    expenseQuery,
    teamQuery,
    namesQuery,
    appointmentQuery,
    fabricQuery,
    inspirationQuery,
  ]);

  const clientIds = clientRows.map((client) => client.id);
  const orderIds = orderRows.map((order) => order.id);
  const fabricIds = fabricRows.map((fabric) => fabric.id);

  const [measurementRows, paymentRows, movementRows] = await Promise.all([
    clientIds.length > 0
      ? db.select().from(measurements).where(inArray(measurements.clientId, clientIds)).orderBy(desc(measurements.measuredAt))
      : Promise.resolve([]),
    user.role === "owner" && orderIds.length > 0
      ? db.select().from(payments).where(inArray(payments.orderId, orderIds)).orderBy(desc(payments.paidAt))
      : Promise.resolve([]),
    user.role === "owner" && fabricIds.length > 0
      ? db.select().from(fabricMovements).where(inArray(fabricMovements.fabricId, fabricIds)).orderBy(desc(fabricMovements.createdAt))
      : Promise.resolve([]),
  ]);

  const visibleOrders =
    user.role === "owner"
      ? orderRows
      : orderRows.map((order) => ({ ...order, totalAmount: null }));

  // Members see quantities to prepare cuts, but never the purchase prices.
  const visibleFabrics =
    user.role === "owner"
      ? fabricRows
      : fabricRows.map((fabric) => ({ ...fabric, unitPrice: null }));

  return NextResponse.json({
    user,
    clients: clientRows,
    measurements: measurementRows,
    orders: visibleOrders,
    payments: paymentRows,
    expenses: expenseRows,
    team: teamRows,
    teamNames: nameRows,
    appointments: appointmentRows,
    fabrics: visibleFabrics,
    fabricMovements: movementRows,
    inspirationModels: inspirationRows,
  });
}
