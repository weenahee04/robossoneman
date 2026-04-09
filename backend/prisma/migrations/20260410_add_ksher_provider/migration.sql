-- AlterEnum: Add ksher to BranchPaymentProvider
ALTER TYPE "BranchPaymentProvider" ADD VALUE 'ksher';

-- Update all active branch payment configs to use ksher provider
UPDATE "branch_payment_configs"
SET provider = 'ksher',
    updated_at = NOW()
WHERE is_active = true;

-- Ensure capabilities support dynamic QR / webhook / polling / reference binding
UPDATE "branch_payment_capabilities" bpc
SET supports_dynamic_qr = true,
    supports_webhook = true,
    supports_polling = true,
    supports_reference_binding = true,
    supports_slipless_confirmation = true,
    updated_at = NOW()
FROM "branch_payment_configs" bpconfig
WHERE bpc.branch_payment_config_id = bpconfig.id
  AND bpconfig.is_active = true;
