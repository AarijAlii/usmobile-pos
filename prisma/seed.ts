/**
 * Demo data seed. Requires live Supabase credentials in .env.local — creates
 * both Postgres rows (via Prisma, using the privileged connection, which is
 * the one place in this app that's expected to bypass RLS) and Supabase Auth
 * users (via the Admin API, since `staff.id` must equal `auth.users.id`).
 *
 * Safe to re-run: looks up existing demo organizations/auth users by their
 * fixed slugs/emails instead of blindly inserting duplicates.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const DEMO_PASSWORD = "Demo1234!";

async function getOrCreateAuthUser(email: string) {
  const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true,
  });
  if (!error && created.user) return created.user.id;

  const { data: list } = await supabaseAdmin.auth.admin.listUsers();
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;

  throw new Error(`Failed to create or find auth user for ${email}: ${error?.message}`);
}

function centsFor(dollars: number) {
  return Math.round(dollars * 100);
}

async function main() {
  console.log("Seeding demo data...");

  // --- Organization A: the main demo tenant -------------------------------
  const orgA = await prisma.organization.upsert({
    where: { slug: "usmobile-demo" },
    update: {},
    create: { name: "USMobile Downtown", slug: "usmobile-demo" },
  });

  const storeA =
    (await prisma.store.findFirst({ where: { organizationId: orgA.id } })) ??
    (await prisma.store.create({
      data: {
        organizationId: orgA.id,
        name: "USMobile Downtown — Main St",
        address: "123 Main St, Austin, TX 78701",
        taxRateBps: 825, // 8.25% TX sales tax
      },
    }));

  const ownerId = await getOrCreateAuthUser("owner@usmobile.demo");
  const adminId = await getOrCreateAuthUser("admin@usmobile.demo");
  const staffId = await getOrCreateAuthUser("staff@usmobile.demo");

  await prisma.staff.upsert({
    where: { id: ownerId },
    update: {},
    create: {
      id: ownerId,
      organizationId: orgA.id,
      email: "owner@usmobile.demo",
      fullName: "Priya Shah",
      role: "OWNER",
      storeId: null,
    },
  });
  await prisma.staff.upsert({
    where: { id: adminId },
    update: {},
    create: {
      id: adminId,
      organizationId: orgA.id,
      email: "admin@usmobile.demo",
      fullName: "Marcus Reed",
      role: "ADMIN",
      storeId: null,
    },
  });
  await prisma.staff.upsert({
    where: { id: staffId },
    update: {},
    create: {
      id: staffId,
      organizationId: orgA.id,
      email: "staff@usmobile.demo",
      fullName: "Dana Kim",
      role: "STAFF",
      storeId: storeA.id,
    },
  });

  // --- Organization B: a second tenant, used only to prove RLS isolation --
  const orgB = await prisma.organization.upsert({
    where: { slug: "acme-wireless-demo" },
    update: {},
    create: { name: "Acme Wireless", slug: "acme-wireless-demo" },
  });
  await (prisma.store.findFirst({ where: { organizationId: orgB.id } }).then(
    (existing) =>
      existing ??
      prisma.store.create({
        data: { organizationId: orgB.id, name: "Acme Wireless — Uptown", taxRateBps: 700 },
      }),
  ));
  const orgBOwnerId = await getOrCreateAuthUser("owner@acmewireless.demo");
  await prisma.staff.upsert({
    where: { id: orgBOwnerId },
    update: {},
    create: {
      id: orgBOwnerId,
      organizationId: orgB.id,
      email: "owner@acmewireless.demo",
      fullName: "Sam Ortiz",
      role: "OWNER",
      storeId: null,
    },
  });
  await prisma.product.upsert({
    where: { organizationId_sku: { organizationId: orgB.id, sku: "ACME-IP13-128" } },
    update: {},
    create: {
      organizationId: orgB.id,
      sku: "ACME-IP13-128",
      name: "iPhone 13 128GB (Acme stock — should never appear for USMobile staff)",
      category: "phone",
      trackingType: "SERIALIZED",
      defaultPriceCents: centsFor(649),
    },
  });

  // --- Customers (org A) ---------------------------------------------------
  const [jordan, maria, kevin, aisha, tom] = await Promise.all(
    [
      { fullName: "Jordan Blake", phone: "512-555-0101" },
      { fullName: "Maria Gonzalez", phone: "512-555-0142" },
      { fullName: "Kevin Chen", phone: "512-555-0177" },
      { fullName: "Aisha Williams", phone: "512-555-0198" },
      { fullName: "Tom Becker", phone: "512-555-0133" },
    ].map((c) =>
      prisma.customer.create({ data: { organizationId: orgA.id, ...c } }),
    ),
  );

  // --- Product catalog (org A) ---------------------------------------------
  async function upsertProduct(input: {
    sku: string; name: string; category: string; trackingType: "SERIALIZED" | "QUANTITY";
    brand?: string; model?: string; priceCents: number; isPart?: boolean;
  }) {
    return prisma.product.upsert({
      where: { organizationId_sku: { organizationId: orgA.id, sku: input.sku } },
      update: {},
      create: {
        organizationId: orgA.id,
        sku: input.sku,
        name: input.name,
        category: input.category,
        trackingType: input.trackingType,
        brand: input.brand,
        model: input.model,
        defaultPriceCents: input.priceCents,
        isPart: input.isPart ?? false,
      },
    });
  }

  const iphone13 = await upsertProduct({ sku: "IP13-128-MID", name: "iPhone 13 128GB Midnight", category: "phone", trackingType: "SERIALIZED", brand: "Apple", model: "A2633", priceCents: centsFor(649) });
  const iphone14pro = await upsertProduct({ sku: "IP14P-256-BLK", name: "iPhone 14 Pro 256GB Space Black", category: "phone", trackingType: "SERIALIZED", brand: "Apple", model: "A2650", priceCents: centsFor(999) });
  const galaxyS23 = await upsertProduct({ sku: "SGS23-128-BLK", name: "Samsung Galaxy S23 128GB Phantom Black", category: "phone", trackingType: "SERIALIZED", brand: "Samsung", model: "SM-S911U", priceCents: centsFor(699) });
  const pixel7 = await upsertProduct({ sku: "PIX7-128-OBS", name: "Google Pixel 7 128GB Obsidian", category: "phone", trackingType: "SERIALIZED", brand: "Google", model: "GVU6C", priceCents: centsFor(499) });
  const iphoneSE3 = await upsertProduct({ sku: "IPSE3-64-RED", name: "iPhone SE (3rd gen) 64GB Red", category: "phone", trackingType: "SERIALIZED", brand: "Apple", model: "A2595", priceCents: centsFor(429) });
  const iphone12used = await upsertProduct({ sku: "IP12-64-BLK-USED", name: "iPhone 12 64GB Black (Used)", category: "phone", trackingType: "SERIALIZED", brand: "Apple", model: "A2172", priceCents: centsFor(379) });
  const iphoneSE2used = await upsertProduct({ sku: "IPSE2-64-USED", name: "iPhone SE (2nd gen) 64GB (Used)", category: "phone", trackingType: "SERIALIZED", brand: "Apple", model: "A2296", priceCents: centsFor(219) });

  const charger = await upsertProduct({ sku: "ACC-CHG-20W", name: "Apple 20W USB-C Charger", category: "accessory", trackingType: "QUANTITY", priceCents: centsFor(19) });
  const otterboxCase = await upsertProduct({ sku: "ACC-CASE-OB13", name: "Otterbox Defender Case (iPhone 13)", category: "accessory", trackingType: "QUANTITY", priceCents: centsFor(39) });
  const screenProtector = await upsertProduct({ sku: "ACC-GLASS-UNIV", name: "Tempered Glass Screen Protector", category: "accessory", trackingType: "QUANTITY", priceCents: centsFor(9) });
  const lightningCable = await upsertProduct({ sku: "ACC-CABLE-LTG", name: "Lightning Cable 1m", category: "accessory", trackingType: "QUANTITY", priceCents: centsFor(12) });
  const popSocket = await upsertProduct({ sku: "ACC-POP-GRIP", name: "PopSocket Phone Grip", category: "accessory", trackingType: "QUANTITY", priceCents: centsFor(10) });
  const iphoneBattery = await upsertProduct({ sku: "PART-BATT-IP", name: "iPhone Replacement Battery", category: "part", trackingType: "QUANTITY", priceCents: centsFor(29), isPart: true });
  const iphoneScreen = await upsertProduct({ sku: "PART-SCRN-IP", name: "iPhone Screen Assembly (Generic)", category: "part", trackingType: "QUANTITY", priceCents: centsFor(59), isPart: true });
  const samsungPort = await upsertProduct({ sku: "PART-PORT-SGS", name: "Samsung Charging Port Flex Cable", category: "part", trackingType: "QUANTITY", priceCents: centsFor(15), isPart: true });

  // --- Inventory units (serialized devices) --------------------------------
  async function upsertUnit(productId: string, imei: string, condition: string, priceCents: number, costCents?: number) {
    return prisma.inventoryUnit.upsert({
      where: { imei },
      update: {},
      create: {
        organizationId: orgA.id,
        storeId: storeA.id,
        productId,
        imei,
        status: "IN_STOCK",
        condition,
        costCents: costCents ?? Math.round(priceCents * 0.7),
        askingPriceCents: priceCents,
      },
    });
  }

  await upsertUnit(iphone13.id, "356938035600001", "new", centsFor(649));
  await upsertUnit(iphone13.id, "356938035600002", "excellent", centsFor(529));
  await upsertUnit(iphone14pro.id, "356938035600003", "new", centsFor(999));
  await upsertUnit(galaxyS23.id, "356938035600004", "new", centsFor(699));
  await upsertUnit(pixel7.id, "356938035600005", "new", centsFor(499));
  await upsertUnit(iphoneSE3.id, "356938035600006", "new", centsFor(429));

  // --- Stock levels (quantity items) ---------------------------------------
  async function upsertStockLevel(productId: string, quantity: number, reorderLevel: number) {
    return prisma.stockLevel.upsert({
      where: { storeId_productId: { storeId: storeA.id, productId } },
      update: { quantityOnHand: quantity, reorderLevel },
      create: { organizationId: orgA.id, storeId: storeA.id, productId, quantityOnHand: quantity, reorderLevel },
    });
  }

  await upsertStockLevel(charger.id, 25, 10);
  await upsertStockLevel(otterboxCase.id, 3, 5); // intentionally low stock for the dashboard demo
  await upsertStockLevel(screenProtector.id, 40, 15);
  await upsertStockLevel(lightningCable.id, 30, 10);
  await upsertStockLevel(popSocket.id, 20, 8);
  await upsertStockLevel(iphoneBattery.id, 8, 3);
  await upsertStockLevel(iphoneScreen.id, 4, 2);
  await upsertStockLevel(samsungPort.id, 2, 3); // intentionally low stock

  // --- Buy-backs (creates the two "used" inventory units) -------------------
  const existingBuyback1 = await prisma.buybackTransaction.findFirst({ where: { storeId: storeA.id, imei: "356938035600007" } });
  if (!existingBuyback1) {
    await prisma.$transaction(async (tx) => {
      const buyback = await tx.buybackTransaction.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          customerId: aisha.id,
          createdById: adminId,
          deviceDescription: "iPhone 12 64GB Black (Used)",
          imei: "356938035600007",
          conditionNotes: "Screen: minor scratches. Battery health 89%. Powers on and functions normally.",
          offerPriceCents: centsFor(220),
          payoutMethod: "cash",
          status: "COMPLETED",
        },
      });
      const unit = await tx.inventoryUnit.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          productId: iphone12used.id,
          imei: "356938035600007",
          status: "IN_STOCK",
          condition: buyback.conditionNotes,
          costCents: centsFor(220),
          askingPriceCents: centsFor(379),
          acquiredViaBuybackId: buyback.id,
        },
      });
      await tx.stockMovement.create({
        data: {
          organizationId: orgA.id, storeId: storeA.id, productId: iphone12used.id,
          inventoryUnitId: unit.id, reason: "BUYBACK_INTAKE", quantityDelta: 1,
          referenceType: "buyback", referenceId: buyback.id, performedById: adminId,
        },
      });
    });
  }

  const existingBuyback2 = await prisma.buybackTransaction.findFirst({ where: { storeId: storeA.id, imei: "356938035600008" } });
  if (!existingBuyback2) {
    await prisma.$transaction(async (tx) => {
      const buyback = await tx.buybackTransaction.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          customerId: tom.id,
          createdById: adminId,
          deviceDescription: "iPhone SE (2nd gen) 64GB",
          imei: "356938035600008",
          conditionNotes: "Fair condition — visible scuffs on back glass, screen intact, battery health 78%.",
          offerPriceCents: centsFor(150),
          payoutMethod: "store_credit",
          status: "COMPLETED",
        },
      });
      const unit = await tx.inventoryUnit.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          productId: iphoneSE2used.id,
          imei: "356938035600008",
          status: "IN_STOCK",
          condition: buyback.conditionNotes,
          costCents: centsFor(150),
          askingPriceCents: centsFor(219),
          acquiredViaBuybackId: buyback.id,
        },
      });
      await tx.stockMovement.create({
        data: {
          organizationId: orgA.id, storeId: storeA.id, productId: iphoneSE2used.id,
          inventoryUnitId: unit.id, reason: "BUYBACK_INTAKE", quantityDelta: 1,
          referenceType: "buyback", referenceId: buyback.id, performedById: adminId,
        },
      });
    });
  }

  // --- Historical sales (completed, PAID) -----------------------------------
  const existingSales = await prisma.sale.count({ where: { storeId: storeA.id } });
  if (existingSales === 0) {
    const salesData = [
      { customerId: jordan.id, items: [{ productId: charger.id, priceCents: centsFor(19), qty: 2 }, { productId: screenProtector.id, priceCents: centsFor(9), qty: 1 }] },
      { customerId: maria.id, items: [{ productId: otterboxCase.id, priceCents: centsFor(39), qty: 1 }] },
      { customerId: kevin.id, items: [{ productId: lightningCable.id, priceCents: centsFor(12), qty: 3 }, { productId: popSocket.id, priceCents: centsFor(10), qty: 1 }] },
      { customerId: null, items: [{ productId: screenProtector.id, priceCents: centsFor(9), qty: 2 }] },
    ];

    for (const s of salesData) {
      const subtotalCents = s.items.reduce((sum, i) => sum + i.priceCents * i.qty, 0);
      const taxCents = Math.round((subtotalCents * storeA.taxRateBps) / 10_000);
      await prisma.sale.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          customerId: s.customerId,
          createdById: staffId,
          status: "PAID",
          subtotalCents,
          taxCents,
          totalCents: subtotalCents + taxCents,
          lineItems: {
            create: s.items.map((i) => ({
              productId: i.productId,
              quantity: i.qty,
              unitPriceCents: i.priceCents,
              lineTotalCents: i.priceCents * i.qty,
            })),
          },
        },
      });
    }
  }

  // --- Repair tickets --------------------------------------------------------
  const existingTickets = await prisma.repairTicket.count({ where: { storeId: storeA.id } });
  if (existingTickets === 0) {
    await prisma.repairTicket.create({
      data: {
        organizationId: orgA.id,
        storeId: storeA.id,
        customerId: jordan.id,
        deviceDescription: "iPhone 12, cracked screen",
        reportedIssue: "Dropped the phone and the screen is cracked in the top right corner. Touch still works but there's a visible crack pattern.",
        status: "INTAKE",
        laborCents: 0,
        partsTotalCents: 0,
        totalCents: 0,
      },
    });

    await prisma.$transaction(async (tx) => {
      const ticket = await tx.repairTicket.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          customerId: maria.id,
          deviceDescription: "Samsung Galaxy S22, won't charge",
          reportedIssue: "Phone doesn't charge with any cable. Tried multiple chargers, no response at all.",
          diagnosisNotes: "Likely a damaged charging port flex cable — no response with known-good cables rules out the battery/logic board as the primary suspect.",
          status: "IN_REPAIR",
          laborCents: centsFor(45),
          partsTotalCents: centsFor(15),
          totalCents: centsFor(60),
        },
      });
      await tx.repairPartUsed.create({
        data: { repairTicketId: ticket.id, productId: samsungPort.id, quantity: 1, unitCostCents: centsFor(15), lineTotalCents: centsFor(15) },
      });
    });

    await prisma.$transaction(async (tx) => {
      const ticket = await tx.repairTicket.create({
        data: {
          organizationId: orgA.id,
          storeId: storeA.id,
          customerId: kevin.id,
          deviceDescription: "iPhone 13, battery drains fast",
          reportedIssue: "Battery goes from 100% to dead in about 3 hours even with light use.",
          diagnosisNotes: "Battery health check confirms degraded capacity — replacing the battery.",
          status: "READY_FOR_PICKUP",
          laborCents: centsFor(35),
          partsTotalCents: centsFor(29),
          totalCents: centsFor(64),
          customerNotifiedAt: new Date(),
        },
      });
      await tx.repairPartUsed.create({
        data: { repairTicketId: ticket.id, productId: iphoneBattery.id, quantity: 1, unitCostCents: centsFor(29), lineTotalCents: centsFor(29) },
      });
    });
  }

  console.log("Seed complete.");
  console.log("Demo logins (password: %s):", DEMO_PASSWORD);
  console.log("  Owner: owner@usmobile.demo");
  console.log("  Admin: admin@usmobile.demo");
  console.log("  Staff: staff@usmobile.demo");
  console.log("  Other org (RLS proof): owner@acmewireless.demo");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
