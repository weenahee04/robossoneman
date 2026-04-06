-- AlterTable
ALTER TABLE "wash_sessions"
ADD COLUMN "scan_token_id" TEXT,
ADD COLUMN "scan_nonce" TEXT,
ADD COLUMN "scan_issued_at" TIMESTAMP(3),
ADD COLUMN "scan_expires_at" TIMESTAMP(3),
ADD COLUMN "scan_source" TEXT;

-- Backfill existing rows with deterministic placeholders so the new constraint can be applied safely.
UPDATE "wash_sessions"
SET "scan_token_id" = 'legacy-session-' || "id"
WHERE "scan_token_id" IS NULL;

-- AlterTable
ALTER TABLE "wash_sessions"
ALTER COLUMN "scan_token_id" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wash_sessions_scan_token_id_key" ON "wash_sessions"("scan_token_id");
