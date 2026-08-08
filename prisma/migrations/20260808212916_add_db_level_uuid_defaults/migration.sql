-- AlterTable
ALTER TABLE "buyback_transactions" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "customers" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "inventory_units" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "organizations" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "products" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "repair_parts_used" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "repair_tickets" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "sale_line_items" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "sales" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "stock_levels" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "stock_movements" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "stores" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
