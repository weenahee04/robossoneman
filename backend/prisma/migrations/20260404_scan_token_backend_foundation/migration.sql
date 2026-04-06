-- CreateTable
CREATE TABLE "machine_scan_tokens" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "machine_id" TEXT NOT NULL,
    "issued_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "nonce" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "consumed_by_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "machine_scan_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "machine_scan_tokens_token_hash_key" ON "machine_scan_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "machine_scan_tokens_nonce_key" ON "machine_scan_tokens"("nonce");

-- CreateIndex
CREATE INDEX "machine_scan_tokens_branch_id_machine_id_idx" ON "machine_scan_tokens"("branch_id", "machine_id");

-- CreateIndex
CREATE INDEX "machine_scan_tokens_expires_at_idx" ON "machine_scan_tokens"("expires_at");

-- AddForeignKey
ALTER TABLE "machine_scan_tokens" ADD CONSTRAINT "machine_scan_tokens_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "machine_scan_tokens" ADD CONSTRAINT "machine_scan_tokens_machine_id_fkey" FOREIGN KEY ("machine_id") REFERENCES "machines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
