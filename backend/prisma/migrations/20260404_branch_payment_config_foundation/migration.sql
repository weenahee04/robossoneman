-- CreateEnum
CREATE TYPE "BranchPaymentMode" AS ENUM ('hq_managed', 'branch_managed', 'manual_promptpay');

-- CreateEnum
CREATE TYPE "BranchPaymentProvider" AS ENUM ('promptpay_manual', 'opn', 'stripe', 'bank_qr', 'custom');

-- CreateEnum
CREATE TYPE "SettlementOwnerType" AS ENUM ('hq', 'franchisee');

-- CreateTable
CREATE TABLE "branch_payment_configs" (
    "id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "mode" "BranchPaymentMode" NOT NULL,
    "provider" "BranchPaymentProvider" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_name" TEXT NOT NULL,
    "statement_name" TEXT,
    "settlement_owner_type" "SettlementOwnerType" NOT NULL DEFAULT 'franchisee',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_payment_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_payment_credentials" (
    "id" TEXT NOT NULL,
    "branch_payment_config_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value_encrypted" TEXT NOT NULL,
    "masked_value" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_payment_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branch_payment_capabilities" (
    "id" TEXT NOT NULL,
    "branch_payment_config_id" TEXT NOT NULL,
    "supports_webhook" BOOLEAN NOT NULL DEFAULT false,
    "supports_polling" BOOLEAN NOT NULL DEFAULT false,
    "supports_dynamic_qr" BOOLEAN NOT NULL DEFAULT false,
    "supports_reference_binding" BOOLEAN NOT NULL DEFAULT false,
    "supports_refund" BOOLEAN NOT NULL DEFAULT false,
    "supports_slipless_confirmation" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branch_payment_capabilities_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "wash_sessions"
ADD COLUMN "payment_config_id" TEXT,
ADD COLUMN "payment_routing_mode" TEXT;

-- AlterTable
ALTER TABLE "payments"
ADD COLUMN "scan_token_id" TEXT,
ADD COLUMN "payment_config_id" TEXT,
ADD COLUMN "provider_payload" JSONB,
ADD COLUMN "payment_qr_type" TEXT,
ADD COLUMN "payment_confirmed_source" TEXT;

-- CreateIndex
CREATE INDEX "branch_payment_configs_branch_id_is_active_idx" ON "branch_payment_configs"("branch_id", "is_active");

-- CreateIndex
CREATE UNIQUE INDEX "branch_payment_credentials_branch_payment_config_id_key_key" ON "branch_payment_credentials"("branch_payment_config_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "branch_payment_capabilities_branch_payment_config_id_key" ON "branch_payment_capabilities"("branch_payment_config_id");

-- AddForeignKey
ALTER TABLE "branch_payment_configs" ADD CONSTRAINT "branch_payment_configs_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment_credentials" ADD CONSTRAINT "branch_payment_credentials_branch_payment_config_id_fkey" FOREIGN KEY ("branch_payment_config_id") REFERENCES "branch_payment_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branch_payment_capabilities" ADD CONSTRAINT "branch_payment_capabilities_branch_payment_config_id_fkey" FOREIGN KEY ("branch_payment_config_id") REFERENCES "branch_payment_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wash_sessions" ADD CONSTRAINT "wash_sessions_payment_config_id_fkey" FOREIGN KEY ("payment_config_id") REFERENCES "branch_payment_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_payment_config_id_fkey" FOREIGN KEY ("payment_config_id") REFERENCES "branch_payment_configs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
