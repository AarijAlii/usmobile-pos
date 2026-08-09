-- CreateTable
CREATE TABLE "returns" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "organization_id" TEXT NOT NULL,
    "store_id" TEXT NOT NULL,
    "sale_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "reason" TEXT,
    "subtotal_cents" INTEGER NOT NULL,
    "tax_cents" INTEGER NOT NULL,
    "total_cents" INTEGER NOT NULL,
    "stripe_refund_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "return_line_items" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "return_id" TEXT NOT NULL,
    "sale_line_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "line_total_cents" INTEGER NOT NULL,

    CONSTRAINT "return_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "returns_organization_id_store_id_idx" ON "returns"("organization_id", "store_id");

-- CreateIndex
CREATE INDEX "returns_sale_id_idx" ON "returns"("sale_id");

-- CreateIndex
CREATE INDEX "return_line_items_return_id_idx" ON "return_line_items"("return_id");

-- CreateIndex
CREATE INDEX "return_line_items_sale_line_item_id_idx" ON "return_line_items"("sale_line_item_id");

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_store_id_fkey" FOREIGN KEY ("store_id") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_fkey" FOREIGN KEY ("sale_id") REFERENCES "sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_line_items" ADD CONSTRAINT "return_line_items_return_id_fkey" FOREIGN KEY ("return_id") REFERENCES "returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "return_line_items" ADD CONSTRAINT "return_line_items_sale_line_item_id_fkey" FOREIGN KEY ("sale_line_item_id") REFERENCES "sale_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
