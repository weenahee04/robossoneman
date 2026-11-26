-- Additive migration. Apply only after backup and staging verification.
ALTER TYPE "AdminRole" ADD VALUE IF NOT EXISTS 'cashier';
ALTER TABLE "membership_plans" ADD COLUMN "duration_months" INTEGER NOT NULL DEFAULT 6;
ALTER TABLE "membership_plans" ADD COLUMN "group" TEXT NOT NULL DEFAULT 'bundle';
-- Preserve the duration/group previously supplied by the legacy code catalog.
UPDATE "membership_plans" SET "duration_months" = 12, "group" = 'best_seller' WHERE "code" = 'GRAPHENE_MEMBERSHIP';
UPDATE "membership_plans" SET "duration_months" = 1, "group" = 'membership' WHERE "code" IN ('QUICK_PASS_777', 'BLACK_CARD_1499', 'GRAPHENE_CLUB_399', 'FAMILY_PACK_1299');
UPDATE "membership_plans" SET "duration_months" = 1, "group" = 'motorcycle' WHERE "code" = 'RIDER_PASS_299';
CREATE TABLE "app_content" (
  "id" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "category" TEXT NOT NULL DEFAULT '',
  "image_url" TEXT,
  "is_published" BOOLEAN NOT NULL DEFAULT false,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "app_content_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "app_content_kind_slug_key" ON "app_content"("kind", "slug");
CREATE INDEX "app_content_kind_is_published_sort_order_idx" ON "app_content"("kind", "is_published", "sort_order");
