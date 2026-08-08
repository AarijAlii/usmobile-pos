-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('OWNER', 'ADMIN', 'STAFF');

-- CreateEnum
CREATE TYPE "TrackingType" AS ENUM ('SERIALIZED', 'QUANTITY');

-- CreateEnum
CREATE TYPE "InventoryUnitStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'SOLD', 'DEFECTIVE');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'AWAITING_PAYMENT', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BuybackStatus" AS ENUM ('COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('INTAKE', 'DIAGNOSING', 'IN_REPAIR', 'READY_FOR_PICKUP', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('SALE', 'SALE_VOID_RESTOCK', 'BUYBACK_INTAKE', 'REPAIR_PART_CONSUMED', 'MANUAL_ADJUSTMENT', 'INITIAL_STOCK');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stores" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT,
    "email" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL DEFAULT 'STAFF',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "tracking_type" "TrackingType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "default_price_cents" INTEGER NOT NULL,
    "is_part" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_units" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "imei" TEXT,
    "serialNumber" TEXT,
    "status" "InventoryUnitStatus" NOT NULL DEFAULT 'IN_STOCK',
    "condition" TEXT,
    "cost_cents" INTEGER,
    "asking_price_cents" INTEGER,
    "acquired_via_buyback_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_levels" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity_on_hand" INTEGER NOT NULL DEFAULT 0,
    "reorder_level" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sale_line_items" (
    "id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "inventory_unit_id" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,

    CONSTRAINT "sale_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyback_transactions" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "device_description" TEXT NOT NULL,
    "imei" TEXT,
    "condition_notes" TEXT,
    "offer_price_cents" INTEGER NOT NULL,
    "payout_method" TEXT NOT NULL DEFAULT 'cash',
    "status" "BuybackStatus" NOT NULL DEFAULT 'COMPLETED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "buyback_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_tickets" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "assigned_to_id" TEXT,
    "device_description" TEXT NOT NULL,
    "imei" TEXT,
    "reported_issue" TEXT NOT NULL,
    "diagnosis_notes" TEXT,
    "status" "RepairStatus" NOT NULL DEFAULT 'INTAKE',
    "labor_cents" INTEGER NOT NULL DEFAULT 0,
    "parts_total_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "customer_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "repair_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repair_parts_used" (
    "id" TEXT NOT NULL,
    "repair_ticket_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_cost_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,

    CONSTRAINT "repair_parts_used_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "product_id" TEXT,
    "inventory_unit_id" TEXT,
    "reason" "StockMovementReason" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "performed_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "stores_organization_id_idx" ON "stores"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "staff_email_key" ON "staff"("email");

-- CreateIndex
CREATE INDEX "staff_organization_id_idx" ON "staff"("organization_id");

-- CreateIndex
CREATE INDEX "staff_store_id_idx" ON "staff"("store_id");

-- CreateIndex
CREATE INDEX "customers_organization_id_idx" ON "customers"("organization_id");

-- CreateIndex
CREATE INDEX "customers_organization_id_phone_idx" ON "customers"("organization_id", "phone");

-- CreateIndex
CREATE INDEX "products_organization_id_idx" ON "products"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "products_organization_id_sku_key" ON "products"("organization_id", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_imei_key" ON "inventory_units"("imei");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_units_acquired_via_buyback_id_key" ON "inventory_units"("acquired_via_buyback_id");

-- CreateIndex
CREATE INDEX "inventory_units_organization_id_store_id_idx" ON "inventory_units"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "inventory_units_store_id_status_idx" ON "inventory_units"("store_id", "status");

-- CreateIndex
CREATE INDEX "stock_levels_organization_id_idx" ON "stock_levels"("organization_id");

-- CreateIndex
CREATE UNIQUE INDEX "stock_levels_store_id_product_id_key" ON "stock_levels"("store_id", "product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_stripe_checkout_session_id_key" ON "sales"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_stripe_payment_intent_id_key" ON "sales"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "sales_organization_id_store_id_idx" ON "sales"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "sales_store_id_status_idx" ON "sales"("store_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "sale_line_items_inventory_unit_id_key" ON "sale_line_items"("inventory_unit_id");

-- CreateIndex
CREATE INDEX "sale_line_items_sale_id_idx" ON "sale_line_items"("sale_id");

-- CreateIndex
CREATE INDEX "buyback_transactions_organization_id_store_id_idx" ON "buyback_transactions"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "repair_tickets_organization_id_store_id_idx" ON "repair_tickets"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "repair_tickets_store_id_status_idx" ON "repair_tickets"("store_id", "status");

-- CreateIndex
CREATE INDEX "repair_parts_used_repair_ticket_id_idx" ON "repair_parts_used"("repair_ticket_id");

-- CreateIndex
CREATE INDEX "stock_movements_organization_id_store_id_idx" ON "stock_movements"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "stock_movements_reference_type_reference_id_idx" ON "stock_movements"("reference_type", "reference_id");

-- AddForeignKey
ALTER TABLE "stores" ADD CONSTRAINT "stores_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_units" ADD CONSTRAINT "inventory_units_acquired_via_buyback_id_fkey" FOREIGN KEY ("acquired_via_buyback_id") REFERENCES "buyback_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line_items" ADD CONSTRAINT "sale_line_items_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line_items" ADD CONSTRAINT "sale_line_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sale_line_items" ADD CONSTRAINT "sale_line_items_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_transactions" ADD CONSTRAINT "buyback_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_transactions" ADD CONSTRAINT "buyback_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyback_transactions" ADD CONSTRAINT "buyback_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_tickets" ADD CONSTRAINT "repair_tickets_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_parts_used" ADD CONSTRAINT "repair_parts_used_repair_ticket_id_fkey" FOREIGN KEY ("repair_ticket_id") REFERENCES "repair_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repair_parts_used" ADD CONSTRAINT "repair_parts_used_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_performed_by_id_fkey" FOREIGN KEY ("performed_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
