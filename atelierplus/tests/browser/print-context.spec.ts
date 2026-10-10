import "dotenv/config";
import { randomInt, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ateliers, clients, orders } from "@/db/schema";
import type { SafeUser } from "@/lib/atelier-types";

let token = "";
let workshopId: string | null = null;
let clientName = "";
let workshopName = "";
const browserErrors = new WeakMap<Page, string[]>();

test.beforeAll(async ({ request }) => {
  // Each project uses a new isolated atelier; never log in as an existing user.
  const suffix = randomUUID().slice(0, 8);
  workshopName = `Test impression ${suffix}`;
  clientName = `Client PDF ${suffix}`;
  const phone = `+999${Date.now().toString().slice(-10)}${randomInt(10, 99)}`;
  const registration = await request.post("/api/auth", {
    data: {
      action: "register", accountType: "owner", workshopName,
      fullName: "Patron de test", phone, password: randomUUID(),
    },
  });
  expect(registration.status()).toBe(201);
  const session = await registration.json() as { token: string; user: SafeUser };
  token = session.token;
  workshopId = session.user.atelierId;
  expect(token).toBeTruthy();
  expect(workshopId).toBeTruthy();

  const now = new Date().toISOString();
  const clientId = randomUUID();
  const orderId = randomUUID();
  const operations = [
    {
      queueId: randomUUID(), type: "client.upsert",
      payload: { id: clientId, name: clientName, phone: "+999000000000", gender: "femme", notes: null, createdAt: now, updatedAt: now },
    },
    {
      queueId: randomUUID(), type: "measurement.create",
      payload: { id: randomUUID(), clientId, values: { LR: 120, P: 92, T: 74, BS: 98 }, measuredAt: now },
    },
    {
      queueId: randomUUID(), type: "order.create",
      payload: { id: orderId, clientId, garment: "robe_femme", model: "Modèle de test", fabricSource: "client", totalAmount: 25000, dueDate: now.slice(0, 10), adjustments: { T: 2 }, notes: "Consignes de test", createdAt: now },
    },
    {
      queueId: randomUUID(), type: "payment.create",
      payload: { id: randomUUID(), orderId, amount: 10000, note: "Acompte de test", paidAt: now },
    },
    {
      queueId: randomUUID(), type: "appointment.create",
      payload: { id: randomUUID(), clientId, orderId, kind: "fitting", title: "Essayage de test", date: now.slice(0, 10), time: "10:30", notes: null, createdAt: now },
    },
  ];
  const sync = await request.post("/api/sync", {
    headers: { Authorization: `Bearer ${token}` },
    data: { ownerId: session.user.id, operations },
  });
  expect(sync.ok()).toBe(true);
  const result = await sync.json() as { results: { ok: boolean; message?: string }[] };
  expect(result.results).toHaveLength(operations.length);
  for (const operation of result.results) expect(operation.ok, operation.message).toBe(true);
});

test.afterAll(async () => {
  // Tenant-scoped cleanup of this spec's synthetic atelier. Failures are logged
  // but never mask the actual test result; Playwright ends the worker process.
  if (!workshopId) return;
  try {
    await db.transaction(async (transaction) => {
      await transaction.delete(orders).where(eq(orders.atelierId, workshopId!));
      await transaction.delete(clients).where(eq(clients.atelierId, workshopId!));
      await transaction.delete(ateliers).where(eq(ateliers.id, workshopId!));
    });
  } catch (error) {
    console.error(`Nettoyage incomplet pour ${workshopId}:`, error instanceof Error ? error.message : error);
  }
});

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Section failed|usePrint must|application error/.test(message.text())) {
      errors.push(message.text());
    }
  });
  await page.addInitScript((sessionToken) => {
    localStorage.setItem("atelierplus-session-token", sessionToken);
    // Only the OS dialog is stubbed. The actual provider, portal, CSS and exports run.
    window.print = () => window.dispatchEvent(new Event("atelier-test-print-called"));
    window.addEventListener("atelier-test-print-called", () => {
      const count = Number(document.documentElement.dataset.printCalls ?? 0);
      document.documentElement.dataset.printCalls = String(count + 1);
    });
  }, token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace-shell")).toBeVisible();
});

test.afterEach(async ({ page }, testInfo) => {
  if (testInfo.status !== testInfo.expectedStatus && !page.isClosed()) {
    console.log("Diagnostic de disposition:", await page.evaluate(() => {
      const box = (element: Element | null) => {
        if (!element) return null;
        const bounds = element.getBoundingClientRect();
        return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
      };
      const tile = [...document.querySelectorAll(".tool-tile")].find((element) => element.textContent?.includes("Réglages"));
      const bounds = tile?.getBoundingClientRect();
      return {
        viewport: { width: innerWidth, height: innerHeight, visualWidth: visualViewport?.width, scale: visualViewport?.scale },
        pageWidth: document.documentElement.scrollWidth,
        overflows: [...document.querySelectorAll(".topbar, .topbar > *, .topbar-actions > *, .page-content, .page-heading-row > *, .order-line > *, .metric-card, .panel-footer > *, .options-recent-chip")].map((element) => ({ className: element.className, bounds: box(element), scrollWidth: element.scrollWidth, clientWidth: element.clientWidth })).filter((item) => item.bounds && item.bounds.x + item.bounds.width > (visualViewport?.width ?? innerWidth) + 1).slice(0, 25),
        modal: box(document.querySelector(".modal-card")),
        backdrop: box(document.querySelector(".modal-backdrop")),
        settingsTile: box(tile ?? null),
        receivesClick: bounds ? document.elementsFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2).slice(0, 5).map((element) => ({ tag: element.tagName, className: element.className, text: element.textContent?.slice(0, 60) })) : [],
      };
    }).catch(() => "Page fermée"));
  }
  const errors = browserErrors.get(page) ?? [];
  if (errors.length) console.log(`Erreurs navigateur (${testInfo.title}): ${errors.join(" | ")}`);
  expect(errors, "Aucune erreur React ne doit être masquée par une frontière de section").toEqual([]);
});

async function openOptions(page: Page) {
  if (await page.locator(".topbar-options-btn").isVisible()) {
    await page.locator(".topbar-options-btn").click();
  } else {
    await page.getByRole("button", { name: "Menu de l’atelier", exact: true }).click();
    await page.getByRole("menuitem", { name: "Plus d’options", exact: true }).click();
  }
  await expect(page.locator(".tools-grid")).not.toHaveCount(0);
}

async function openTool(page: Page, title: string) {
  await page.locator(".tool-tile").filter({ has: page.locator("strong", { hasText: title }) }).click();
  await expect(page.locator(".tool-title")).toHaveText(title);
  await expect(page.locator(".section-error, .app-error-shell")).toHaveCount(0);
}

async function verifyPrintDocument(page: Page, expectedText: string, testName: string) {
  const portal = page.locator("body > #print-area");
  await expect(portal).toBeAttached();
  await expect(portal).toContainText(expectedText);
  await expect.poll(async () => Number(await page.locator("html").getAttribute("data-print-calls"))).toBeGreaterThan(0);

  // The portal must survive a non-blocking window.print() (mobile browsers).
  await page.waitForTimeout(180);
  await expect(portal).toBeAttached();
  await page.emulateMedia({ media: "print" });
  await expect(portal).toBeVisible();
  await expect(page.locator(".workspace-shell")).toBeHidden();
  const visibleBody = await page.locator("body").innerText();
  expect(visibleBody).toContain(expectedText);
  expect(visibleBody).not.toContain("NOUVEAU CLIENT");
  expect(visibleBody).not.toContain("Plus d’options");

  const pdf = await page.pdf({ format: "A4", printBackground: true });
  expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  expect(pdf.length).toBeGreaterThan(1000);
  await test.info().attach(testName, { body: pdf, contentType: "application/pdf" });

  await page.emulateMedia({ media: "screen" });
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(portal).toHaveCount(0);
  await expect(page.locator(".workspace-shell")).toBeVisible();
}

test("Réglages et Abonnement s’ouvrent sans erreur de contexte", async ({ page }) => {
  await openOptions(page);
  for (const tool of ["Réglages", "Abonnement", "Réglages"]) {
    await openTool(page, tool);
    await expect(page.getByRole("heading", { name: "Identité de l’atelier", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Imprimer la fiche du jour", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Toutes les options", exact: true }).click();
  }
});

test("Les réglages sont sauvegardés puis relus après rechargement", async ({ page }) => {
  await openOptions(page);
  await openTool(page, "Réglages");
  const updatedName = `${workshopName} PDF`;
  await page.getByLabel("Nom de l’atelier", { exact: true }).fill(updatedName);
  await page.getByLabel("Ville ou quartier", { exact: false }).fill("Kara");
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/atelier") && response.request().method() === "PUT");
  await page.getByRole("button", { name: "Enregistrer l’identité", exact: true }).click();
  expect((await responsePromise).ok()).toBe(true);
  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
      message: "Le nom de l’atelier ne doit pas élargir le viewport mobile",
    }).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
  await openOptions(page);
  await openTool(page, "Réglages");
  await expect(page.getByLabel("Nom de l’atelier", { exact: true })).toHaveValue(updatedName);
  await expect(page.getByLabel("Ville ou quartier", { exact: false })).toHaveValue("Kara");
});

test("La fiche du jour s’imprime seule et le portail peut être réutilisé", async ({ page }) => {
  await openOptions(page);
  await openTool(page, "Réglages");
  await page.getByRole("button", { name: "Imprimer la fiche du jour", exact: true }).click();
  await verifyPrintDocument(page, "Essayage de test", "fiche-du-jour.pdf");
  await page.getByRole("button", { name: "Imprimer la fiche du jour", exact: true }).click();
  await verifyPrintDocument(page, "Essayage de test", "fiche-du-jour-second-appel.pdf");
});

test("La fiche de coupe reçoit le contexte et n’imprime pas le tableau de bord", async ({ page }) => {
  await page.locator(".order-line").filter({ hasText: clientName }).first().locator(".order-code").click();
  await expect(page.locator(".order-sheet-title")).toHaveText("Robe femme");
  await page.getByRole("button", { name: /Imprimer la fiche/ }).click();
  await verifyPrintDocument(page, "Cote finale", "fiche-de-coupe.pdf");
});

test("Le reçu s’ouvre, se télécharge en PDF et s’imprime seul", async ({ page }) => {
  await page.getByRole("button", { name: "Partager le reçu", exact: true }).first().click();
  await expect(page.locator(".share-sheet")).toBeVisible();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Télécharger le PDF", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  const downloadedPath = await download.path();
  expect(downloadedPath).not.toBeNull();
  const bytes = await readFile(downloadedPath!);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  expect(bytes.subarray(-1024).toString()).toContain("%%EOF");
  await test.info().attach("recu-telecharge.pdf", { body: bytes, contentType: "application/pdf" });
  await page.getByRole("button", { name: "Imprimer ce reçu", exact: true }).click();
  await verifyPrintDocument(page, clientName, "recu-imprime.pdf");
});

test("Réglages, Abonnement et impression restent disponibles hors-ligne", async ({ page, context }) => {
  // Warm the real PWA shell and wait for its persisted workspace before losing network.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await openOptions(page);
  await openTool(page, "Réglages");
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await openOptions(page);
  await openTool(page, "Abonnement");
  await expect(page.getByRole("heading", { name: "Gratuit — période de lancement", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Toutes les options", exact: true }).click();
  await openTool(page, "Réglages");
  await expect(page.getByRole("button", { name: "Enregistrer l’identité", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Imprimer la fiche du jour", exact: true }).click();
  await verifyPrintDocument(page, "Essayage de test", "fiche-hors-ligne.pdf");
  await context.setOffline(false);
});
