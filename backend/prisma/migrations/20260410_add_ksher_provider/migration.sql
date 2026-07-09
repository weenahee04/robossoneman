-- AlterEnum: Add ksher to BranchPaymentProvider.
-- Keep this migration limited to the enum change so PostgreSQL can commit
-- the new value before any data updates reference it.
ALTER TYPE "BranchPaymentProvider" ADD VALUE IF NOT EXISTS 'ksher';
