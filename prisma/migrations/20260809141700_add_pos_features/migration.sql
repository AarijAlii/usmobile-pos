-- CreateEnum
CREATE TYPE "ReturnRefundMethod" AS ENUM ('STRIPE', 'STORE_CREDIT');

-- AlterEnum
ALTER TYPE "TrackingType" ADD VALUE 'SERVICE';

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "store_credit_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "returns" ADD COLUMN     "refund_method" "ReturnRefundMethod" NOT NULL DEFAULT 'STRIPE',
ALTER COLUMN "stripe_refund_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sales" ADD COLUMN     "store_credit_applied_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "bundles" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bundle_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "bundle_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "held_sales" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "note" TEXT,
    "cart" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "held_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "store_credit_transactions" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference_type" TEXT,
    "reference_id" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "store_credit_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bundles_organization_id_idx" ON "bundles"("organization_id");

-- CreateIndex
CREATE INDEX "bundle_items_bundle_id_idx" ON "bundle_items"("bundle_id");

-- CreateIndex
CREATE INDEX "held_sales_organization_id_store_id_idx" ON "held_sales"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "store_credit_transactions_organization_id_store_id_idx" ON "store_credit_transactions"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "store_credit_transactions_customer_id_idx" ON "store_credit_transactions"("customer_id");

-- AddForeignKey
ALTER TABLE "bundles" ADD CONSTRAINT "bundles_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey" FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "held_sales" ADD CONSTRAINT "held_sales_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_transactions" ADD CONSTRAINT "store_credit_transactions_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_transactions" ADD CONSTRAINT "store_credit_transactions_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_transactions" ADD CONSTRAINT "store_credit_transactions_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "store_credit_transactions" ADD CONSTRAINT "store_credit_transactions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
