-- CreateEnum
CREATE TYPE "CouponPaymentAccountType" AS ENUM ('hq', 'branch');

-- AlterTable
ALTER TABLE "coupon_purchases" ADD COLUMN "payment_account_id" TEXT;
ALTER TABLE "coupon_purchases" ADD COLUMN "slip_image_hash" TEXT;
ALTER TABLE "coupon_purchases" ADD COLUMN "review_checklist" JSONB;

-- CreateTable
CREATE TABLE "coupon_payment_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "account_type" "CouponPaymentAccountType" NOT NULL DEFAULT 'hq',
    "branch_id" TEXT,
    "promptpay_id" TEXT NOT NULL,
    "promptpay_name" TEXT NOT NULL,
    "bank_name" TEXT,
    "account_name" TEXT,
    "account_number" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "coupon_payment_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "coupon_payment_accounts_code_key" ON "coupon_payment_accounts"("code");
CREATE UNIQUE INDEX "coupon_purchases_slip_image_hash_key" ON "coupon_purchases"("slip_image_hash");
CREATE INDEX "coupon_payment_accounts_account_type_is_active_is_default_idx" ON "coupon_payment_accounts"("account_type", "is_active", "is_default");
CREATE INDEX "coupon_payment_accounts_branch_id_is_active_is_default_idx" ON "coupon_payment_accounts"("branch_id", "is_active", "is_default");
CREATE INDEX "coupon_purchases_payment_account_id_status_idx" ON "coupon_purchases"("payment_account_id", "status");

-- AddForeignKey
ALTER TABLE "coupon_payment_accounts" ADD CONSTRAINT "coupon_payment_accounts_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_purchases" ADD CONSTRAINT "coupon_purchases_payment_account_id_fkey" FOREIGN KEY ("payment_account_id") REFERENCES "coupon_payment_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
