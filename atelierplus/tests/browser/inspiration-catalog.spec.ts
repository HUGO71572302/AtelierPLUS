import "dotenv/config";
import { randomInt, randomUUID } from "node:crypto";
import { access } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ateliers, clients, orders } from "@/db/schema";
import { CATALOG_FAMILIES, INSPIRATION_CATALOG, catalogOrderDetails } from "@/lib/inspiration-catalog";
import { GARMENT_TEMPLATES, MEASUREMENT_CATALOG } from "@/lib/atelier-types";
import type { AtelierData, SafeUser } from "@/lib/atelier-types";

let token = "";
let workshopId: string | null = null;
let workshopName = "";
let clientName = "";
const errorsByPage = new WeakMap<Page, string[]>();

test.beforeAll(async ({ request }) => {
  workshopName = `Test catalogue ${randomUUID().slice(0, 8)}`;
  clientName = `Cliente Catalogue Test`;
  const clientId = randomUUID();
  const lateOrderId = randomUUID();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const registered = await request.post("/api/auth", {
    data: {
      action: "register", accountType: "owner", workshopName,
      fullName: "Patron catalogue test", phone: `+999${Date.now().toString().slice(-10)}${randomInt(10, 99)}`,
      password: randomUUID(),
    },
  });
  expect(registered.status()).toBe(201);
  const auth = await registered.json() as { token: string; user: SafeUser };
  token = auth.token;
  workshopId = auth.user.atelierId;
  expect(token).toBeTruthy();
  expect(workshopId).toBeTruthy();
  const now = new Date().toISOString();
  const response = await request.post("/api/sync", {
    headers: { Authorization: `Bearer ${token}` },
    data: { ownerId: auth.user.id, operations: [
      {
        queueId: randomUUID(), type: "client.upsert",
        payload: { id: clientId, name: clientName, phone: null, gender: "femme", notes: null, createdAt: now, updatedAt: now },
      },
      {
        // A deliberately overdue order so the dashboard priority shortcut has a target.
        queueId: randomUUID(), type: "order.create",
        payload: { id: lateOrderId, clientId, garment: "jupe_femme", model: "Commande en retard", fabricSource: "client", totalAmount: 12000, dueDate: yesterday, adjustments: {}, notes: null, createdAt: now },
      },
    ] },
  });
  expect(response.ok()).toBe(true);
  const synced = await response.json() as { results: { ok: boolean }[] };
  expect(synced.results[0].ok).toBe(true);
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

async function openInspiration(page: Page) {
  if (await page.locator(".topbar-options-btn").isVisible()) {
    await page.locator(".topbar-options-btn").click();
  } else {
    await page.getByRole("button", { name: "Menu de l’atelier", exact: true }).click();
    await page.getByRole("menuitem", { name: "Plus d’options", exact: true }).click();
  }
  await page.locator(".tool-tile").filter({ has: page.locator("strong", { hasText: "Inspiration" }) }).click();
  await expect(page.locator(".modal-card .inspiration-catalog")).toBeVisible();
  await expect(page.locator(".section-error")).toHaveCount(0);
}

function inspirationCatalog(page: Page) {
  return page.locator(".modal-card .inspiration-catalog");
}

test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  errorsByPage.set(page, errors);
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && /Section failed|usePrint must|application error/.test(message.text())) errors.push(message.text());
  });
  await page.addInitScript((authToken) => { localStorage.setItem("atelierplus-session-token", authToken); }, token);
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".workspace-shell")).toBeVisible();
  // Wait until the workshop records have loaded so dashboard shortcuts act on
  // real data instead of an empty first paint.
  await expect.poll(() => page.locator(".order-line").count(), { timeout: 15_000 }).toBeGreaterThan(0);
  if ((page.viewportSize()?.width ?? 1440) <= 760) {
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth), {
      message: "Une commande existante ne doit pas élargir le viewport mobile",
    }).toBeLessThanOrEqual(page.viewportSize()!.width + 1);
  }
  await openInspiration(page);
});

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus && !page.isClosed()) {
    console.log("Disposition en échec :", await page.evaluate(() => {
      const width = visualViewport?.width ?? innerWidth;
      return {
        width, innerWidth, pageWidth: document.documentElement.scrollWidth,
        overflowing: [...document.querySelectorAll(".topbar, .topbar > *, .page-content, .order-line > *, .panel-footer, .panel-heading, .page-heading-row > *, .modal-card, .inspiration-form > *, .model-measure-picker > *, .form-actions")]
          .map((element) => { const r = element.getBoundingClientRect(); return { class: element.className, x: r.x, width: r.width, bottom: r.bottom, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth }; })
          .filter((item) => item.x + item.width > width + 1 || item.scrollWidth > item.clientWidth + 1),
      };
    }).catch(() => "Page fermée"));
  }
  expect(errorsByPage.get(page) ?? [], "Aucune erreur React dans le catalogue").toEqual([]);
});

test("Le catalogue contient 16 modèles illustrés, 12 nouveautés et les sources Pinterest", async ({ page }) => {
  expect(INSPIRATION_CATALOG).toHaveLength(16);
  expect(new Set(INSPIRATION_CATALOG.map((item) => item.id)).size).toBe(16);
  expect(INSPIRATION_CATALOG.filter((item) => item.isNew)).toHaveLength(12);
  expect(new Set(INSPIRATION_CATALOG.map((item) => item.garment)).size).toBe(7);
  const catalog = inspirationCatalog(page);
  await expect(catalog.locator(".catalog-card")).toHaveCount(16);
  await expect(catalog.locator(".catalog-new")).toHaveCount(12);
  await expect(catalog.locator(".catalog-source")).toHaveCount(12);
  await expect(catalog.locator(".catalog-provenance")).toContainText("illustrations IA ou des croquis originaux");

  const codes = new Set(MEASUREMENT_CATALOG.map((item) => item.code));
  const garments = new Set(GARMENT_TEMPLATES.map((item) => item.value));
  for (const item of INSPIRATION_CATALOG) {
    expect(garments.has(item.garment)).toBe(true);
    expect(item.codes.every((code) => codes.has(code))).toBe(true);
    await access(`public${item.image}`);
    const card = catalog.locator(`[data-catalog-id="${item.id}"]`);
    const image = card.locator("img");
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
    if (item.reference) {
      const source = card.locator("a.catalog-source");
      await expect(source).toHaveAttribute("href", item.reference.url);
      await expect(source).toHaveAttribute("target", "_blank");
      await expect(source).toHaveAttribute("rel", "noopener noreferrer");
      expect(new URL(item.reference.url).hostname).toMatch(/(^|\.)pinterest\.com$/);
    }
  }
  await expect(page.locator(".modal-card")).toBeVisible();
  const overflow = await page.locator(".modal-card").evaluate((element) => element.scrollWidth - element.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});


test("La visionneuse agrandit une image, se ferme et navigue entre les modèles", async ({ page }) => {
  const catalog = inspirationCatalog(page);
  const card = catalog.locator(".catalog-card").filter({ hasText: "Robe sirène indigo" });
  await card.locator(".catalog-cover-button").click();
  const viewer = page.locator(".lightbox-backdrop");
  await expect(viewer).toBeVisible();
  await expect(viewer).toHaveAttribute("aria-label", "Robe sirène indigo — photo en plein écran");
  const stage = viewer.locator(".lightbox-stage");
  await expect(stage.locator("img")).toBeVisible();
  await expect(viewer.locator(".lightbox-head, .lightbox-foot, .lightbox-facts")).toHaveCount(0);
  const size = await stage.locator("img").boundingBox();
  expect(size!.height).toBeGreaterThan(300);

  await viewer.getByRole("button", { name: "Modèle suivant", exact: true }).click();
  await expect(viewer).toHaveAttribute("aria-label", "Robe portefeuille en wax — photo en plein écran");
  await viewer.getByRole("button", { name: "Modèle précédent", exact: true }).click();
  await expect(viewer).toHaveAttribute("aria-label", "Robe sirène indigo — photo en plein écran");

  await page.keyboard.press("Escape");
  await expect(viewer).toHaveCount(0);
  await expect(catalog.locator(".catalog-card")).toHaveCount(16);
  await expect(page.locator(".modal-card")).toBeVisible();
});


test("La recherche globale trouve un client, une commande et un modèle", async ({ page }) => {
  const clientName = "Cliente Catalogue Test";
  await page.keyboard.press("Control+k");
  const launcher = page.locator(".launcher-backdrop");
  await expect(launcher).toBeVisible();

  await page.getByRole("textbox", { name: "Recherche rapide", exact: true }).fill("Cliente");
  await expect(launcher.locator(".launcher-group").filter({ hasText: "Clients" }).first()).toBeVisible();
  await expect(launcher.getByRole("option").filter({ hasText: clientName }).first()).toBeVisible();

  await page.getByRole("textbox", { name: "Recherche rapide", exact: true }).fill("Robe sirène");
  await expect(launcher.getByRole("option").filter({ hasText: "Robe sirène indigo" }).first()).toBeVisible();
  await page.getByRole("textbox", { name: "Recherche rapide", exact: true }).fill("Cliente");
  await launcher.getByRole("option").filter({ hasText: clientName }).first().click();
  await expect(launcher).toHaveCount(0);
  // The launcher must open the real client record, not just a navigation action.
  await expect(page.locator(".client-detail-layout")).toBeVisible();
  await expect(page.locator(".client-detail-side h3")).toHaveText(clientName);
  await page.getByRole("button", { name: "Fermer", exact: true }).click();
});

test("Le tableau de bord expose des raccourcis de priorités actionnables", async ({ page }) => {
  // Open from the dashboard so no options dialog is layered on top.
  await page.locator(".modal-close").click();
  await expect(page.locator(".priority-strip")).toBeVisible();
  await expect(page.locator(".priority-label")).toHaveText("VOS PRIORITÉS");
  const chips = page.locator(".priority-chip");
  await expect(chips).not.toHaveCount(0);

  // The agenda shortcut must navigate to the agenda view.
  await chips.filter({ hasText: "RDV aujourd’hui" }).click();
  await expect(page.locator(".agenda-view")).toBeVisible();

  // The sidebar is hidden on mobile: use the bottom navigation bar there.
  const isMobile = (page.viewportSize()?.width ?? 1440) <= 760;
  if (isMobile) {
    await page.locator(".mobile-bottom-nav button").filter({ hasText: "Accueil" }).click();
  } else {
    await page.locator(".nav-link").filter({ hasText: "Vue d’ensemble" }).click();
  }
  await page.locator(".priority-chip").filter({ hasText: "en retard" }).click();
  await expect(page.locator(".order-line").first()).toBeVisible();
});

test("Une nouvelle fiche client ouvre sa commande et sa fiche est bien visible", async ({ page }) => {
  await page.locator(".modal-backdrop").last().getByRole("button", { name: "Fermer", exact: true }).click();
  const navigation = page.viewportSize()!.width <= 760
    ? page.locator(".mobile-bottom-nav")
    : page.locator(".side-navigation");
  await navigation.getByRole("button", { name: /Clients/ }).click();

  const savedClientCard = page.locator(".client-record-card").first();
  await expect(savedClientCard).toBeVisible();
  const cardColors = await savedClientCard.evaluate((element) => {
    const styles = getComputedStyle(element);
    return { background: styles.backgroundColor, border: styles.borderLeftColor };
  });
  expect(cardColors.background).toBe("rgb(244, 247, 237)");
  expect(cardColors.border).toBe("rgb(102, 132, 63)");

  await page.locator(".client-add-card").click();
  const clientName = `Client commande ${randomUUID().slice(0, 6)}`;
  const clientDialog = page.getByRole("dialog", { name: "Ajouter un client" });
  await clientDialog.getByLabel("Nom du client *").fill(clientName);
  await clientDialog.getByRole("button", { name: "Enregistrer le client" }).click();

  const orderDialog = page.getByRole("dialog", { name: "Une nouvelle commande" });
  await expect(orderDialog).toBeVisible();
  await expect(orderDialog.getByLabel("Pour quel client ? *").locator("option:checked")).toHaveText(clientName);
});

test("La signature de l’auteur apparaît dans l’application mais jamais sur le reçu", async ({ page }) => {
  // The beforeEach opens the Inspiration dialog: close it to reach the shell.
  await page.locator(".modal-close").click();
  await expect(page.locator(".modal-card")).toHaveCount(0);

  // The author sign-off is part of the persistent page footer.
  await expect(page.locator(".author-signature")).toContainText("Atissoli KABRAME");
  await expect(page.locator(".author-signature")).toContainText("FabManager");

  // The About panel lists the author, the role and both support lines.
  if (await page.locator(".topbar-options-btn").isVisible()) {
    await page.locator(".topbar-options-btn").click();
  } else {
    await page.getByRole("button", { name: "Menu de l’atelier", exact: true }).click();
    await page.getByRole("menuitem", { name: "Plus d’options", exact: true }).click();
  }
  await page.locator(".tool-tile").filter({ has: page.locator("strong", { hasText: "À propos" }) }).click();
  await expect(page.locator(".about-signature h3")).toHaveText("Atissoli KABRAME");
  await expect(page.locator(".signature-role")).toHaveText("FabManager");
  await expect(page.locator(".signature-photo")).toBeVisible();
  await expect(page.locator(".signature-phone").first()).toContainText("+228 96933893");
  await expect(page.locator(".signature-phone").nth(1)).toContainText("+228 71572302");
  await page.locator(".modal-close").click();

  // The photo is part of the signature.

  // The receipt belongs to the workshop: no author information on it.
  await page.getByRole("button", { name: "Partager le reçu", exact: true }).first().click();
  const receipt = page.locator(".receipt-paper pre");
  await expect(receipt).not.toContainText("Atissoli KABRAME");
  await expect(receipt).not.toContainText("FabManager");
  await expect(receipt).not.toContainText("+228 96933893");
  await expect(receipt).not.toContainText("AtelierPLUS");
});

test("Les filtres et la recherche sans accents trouvent les bons modèles", async ({ page }) => {
  const catalog = inspirationCatalog(page);
  const search = catalog.getByRole("searchbox", { name: "Rechercher un modèle" });
  await search.fill("sirene");
  await expect(catalog.locator(".catalog-card")).toHaveCount(1);
  await expect(catalog.locator(".catalog-card")).toContainText("Robe sirène indigo");
  await search.fill("");
  for (const family of CATALOG_FAMILIES.filter((item) => item.value !== "all")) {
    await catalog.locator(".catalog-filter").filter({ hasText: family.label }).click();
    await expect(catalog.locator(".catalog-card")).toHaveCount(INSPIRATION_CATALOG.filter((item) => item.family === family.value).length);
  }
  await catalog.locator(".catalog-filter").filter({ hasText: "Tous les modèles" }).click();
  await catalog.getByRole("combobox", { name: "Occasion du modèle" }).selectOption("Travail");
  await expect(catalog.locator(".catalog-card")).toHaveCount(3);
  await catalog.getByRole("combobox", { name: "Occasion du modèle" }).selectOption("all");
  await search.fill("zzzz-inexistant");
  await expect(catalog.locator(".catalog-card")).toHaveCount(0);
  await expect(catalog.getByRole("heading", { name: "Aucun modèle avec ces filtres" })).toBeVisible();
  await catalog.getByRole("button", { name: "Réinitialiser les filtres", exact: true }).click();
  await expect(catalog.locator(".catalog-card")).toHaveCount(16);
});

test("Un modèle choisi préremplit une commande et ses notes sont conservées en base", async ({ page, request }) => {
  const item = INSPIRATION_CATALOG.find((entry) => entry.id === "pantalon-palazzo")!;
  const preset = catalogOrderDetails(item);
  await inspirationCatalog(page).getByRole("article", { name: item.title, exact: true }).getByRole("button", { name: "Créer cette commande", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Une nouvelle commande", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("Vêtement à réaliser", { exact: false })).toHaveValue("pantalon");
  await expect(dialog.getByLabel("Modèle (facultatif)", { exact: true })).toHaveValue(item.title);
  await expect(dialog.getByRole("textbox", { name: "Une précision pour l’équipe", exact: true })).toHaveValue(preset.notes);
  await dialog.getByLabel("Prix convenu", { exact: false }).fill("18000");
  await dialog.getByRole("button", { name: "Créer la commande", exact: false }).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => {
    const response = await request.get("/api/data", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as AtelierData;
    return data.orders.some((order) => order.model === item.title && order.garment === "pantalon" && order.notes === preset.notes && order.totalAmount === 18000);
  }).toBe(true);
  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await expect(page.locator(".order-line").filter({ hasText: item.title })).toHaveCount(1);
});

test("Le formulaire personnel continue d’ajouter une photo et une fiche dans l’atelier", async ({ page, request }) => {
  const title = `Création personnelle ${randomUUID().slice(0, 6)}`;
  const catalog = inspirationCatalog(page);
  await catalog.getByRole("button", { name: "+ Ajouter mon modèle", exact: true }).click();
  const form = page.locator(".inspiration-form");
  await form.locator('input[type="file"]').setInputFiles("public/images/robe-portefeuille-wax.jpg");
  await expect(form.getByRole("img", { name: "Aperçu du modèle", exact: true })).toBeVisible();
  await form.getByLabel("Nom du modèle", { exact: false }).fill(title);
  await form.getByLabel("Type de vêtement", { exact: false }).selectOption("robe_femme");
  await form.getByLabel("Description", { exact: true }).fill("Robe portefeuille personnalisée à l’atelier.");
  await form.getByRole("button", { name: "LR", exact: true }).click();
  await form.getByRole("button", { name: "Ajouter au catalogue", exact: true }).click();
  await expect(catalog.locator(".inspiration-custom-card").filter({ hasText: title })).toBeVisible();
  await expect.poll(async () => {
    const response = await request.get("/api/data", { headers: { Authorization: `Bearer ${token}` } });
    const data = await response.json() as AtelierData;
    return data.inspirationModels.some((model) => model.title === title && model.imageData?.startsWith("data:image/jpeg;base64,") && model.measureCodes.includes("LR"));
  }).toBe(true);
  await page.reload();
  await expect(page.locator(".workspace-shell")).toBeVisible();
  await openInspiration(page);
  const catalogAfterReload = inspirationCatalog(page);
  await expect(catalogAfterReload.locator(".inspiration-custom-card").filter({ hasText: title })).toBeVisible();
  await expect(catalogAfterReload.locator(".catalog-card")).toHaveCount(INSPIRATION_CATALOG.length);
});
