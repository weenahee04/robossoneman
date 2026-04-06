CREATE TYPE "BranchPaymentApprovalStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected');

ALTER TABLE "branch_payment_configs"
ADD COLUMN "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "approval_status" "BranchPaymentApprovalStatus" NOT NULL DEFAULT 'draft',
ADD COLUMN "approved_at" TIMESTAMP(3),
ADD COLUMN "approved_by_admin_id" TEXT;
