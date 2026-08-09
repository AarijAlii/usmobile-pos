-- CreateEnum
CREATE TYPE "LayawayStatus" AS ENUM ('ACTIVE', 'PAID_OFF', 'CANCELLED', 'FORFEITED');

-- CreateEnum
CREATE TYPE "LayawayPaymentStatus" AS ENUM ('AWAITING_PAYMENT', 'PAID');

-- AlterTable
ALTER TABLE "buyback_transactions" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "inventory_units" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "repair_tickets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "staff" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stock_levels" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "stores" ALTER COLUMN "updated_at" DROP DEFAULT;

-- CreateTable
CREATE TABLE "layaways" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "inventory_unit_id" TEXT NOT NULL,
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "paid_cents" INTEGER NOT NULL DEFAULT 0,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "LayawayStatus" NOT NULL DEFAULT 'ACTIVE',
    "resulting_sale_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "layaways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "layaway_payments" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "layaway_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "status" "LayawayPaymentStatus" NOT NULL DEFAULT 'AWAITING_PAYMENT',
    "stripe_checkout_session_id" TEXT,
    "stripe_payment_intent_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "layaway_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "layaways_inventory_unit_id_key" ON "layaways"("inventory_unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "layaways_resulting_sale_id_key" ON "layaways"("resulting_sale_id");

-- CreateIndex
CREATE INDEX "layaways_organization_id_store_id_idx" ON "layaways"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "layaways_store_id_status_idx" ON "layaways"("store_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "layaway_payments_stripe_checkout_session_id_key" ON "layaway_payments"("stripe_checkout_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "layaway_payments_stripe_payment_intent_id_key" ON "layaway_payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "layaway_payments_layaway_id_idx" ON "layaway_payments"("layaway_id");

-- AddForeignKey
ALTER TABLE "layaways" ADD CONSTRAINT "layaways_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layaways" ADD CONSTRAINT "layaways_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layaways" ADD CONSTRAINT "layaways_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layaways" ADD CONSTRAINT "layaways_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layaways" ADD CONSTRAINT "layaways_inventory_unit_id_fkey" FOREIGN KEY ("inventory_unit_id") REFERENCES "inventory_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layaways" ADD CONSTRAINT "layaways_resulting_sale_id_fkey" FOREIGN KEY ("resulting_sale_id") REFERENCES "sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "layaway_payments" ADD CONSTRAINT "layaway_payments_layaway_id_fkey" FOREIGN KEY ("layaway_id") REFERENCES "layaways"("id") ON DELETE CASCADE ON UPDATE CASCADE;
