-- CreateEnum
CREATE TYPE "CouponPurchaseStatus" AS ENUM ('pending_transfer', 'pending_review', 'confirmed', 'rejected', 'expired', 'cancelled');

-- AlterTable
ALTER TABLE "coupons" ADD COLUMN "is_purchasable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "coupons" ADD COLUMN "purchase_price" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "coupon_purchases" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "coupon_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "issued_user_coupon_id" TEXT,
    "status" "CouponPurchaseStatus" NOT NULL DEFAULT 'pending_transfer',
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "payment_method" TEXT NOT NULL DEFAULT 'bank_transfer',
    "reference" TEXT NOT NULL,
    "transfer_target_id" TEXT,
    "transfer_target_name" TEXT,
    "slip_image" TEXT,
    "slip_file_name" TEXT,
    "slip_mime_type" TEXT,
    "slip_uploaded_at" TIMESTAMP(3),
    "customer_note" TEXT,
    "admin_note" TEXT,
    "reviewed_by_admin_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "rejected_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_purchases_issued_user_coupon_id_key" ON "coupon_purchases"("issued_user_coupon_id");
CREATE UNIQUE INDEX "coupon_purchases_reference_key" ON "coupon_purchases"("reference");
CREATE INDEX "coupon_purchases_user_id_status_idx" ON "coupon_purchases"("user_id", "status");
CREATE INDEX "coupon_purchases_coupon_id_status_idx" ON "coupon_purchases"("coupon_id", "status");
CREATE INDEX "coupon_purchases_branch_id_status_idx" ON "coupon_purchases"("branch_id", "status");

-- AddForeignKey
ALTER TABLE "coupon_purchases" ADD CONSTRAINT "coupon_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_purchases" ADD CONSTRAINT "coupon_purchases_coupon_id_fkey" FOREIGN KEY ("coupon_id") REFERENCES "coupons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_purchases" ADD CONSTRAINT "coupon_purchases_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "coupon_purchases" ADD CONSTRAINT "coupon_purchases_issued_user_coupon_id_fkey" FOREIGN KEY ("issued_user_coupon_id") REFERENCES "user_coupons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
