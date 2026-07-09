-- Stamp transaction ledger for anti-fraud controls.
-- A wash session can earn stamps only once.

CREATE TABLE "stamp_transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "stamp_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "branch_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "stamp_count" INTEGER NOT NULL,
    "raw_stamp_count" INTEGER NOT NULL,
    "reason" TEXT NOT NULL DEFAULT 'wash_completed',
    "metadata" JSONB,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stamp_transactions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stamp_transactions_session_id_key" ON "stamp_transactions"("session_id");
CREATE INDEX "stamp_transactions_user_id_created_at_idx" ON "stamp_transactions"("user_id", "created_at");
CREATE INDEX "stamp_transactions_stamp_id_created_at_idx" ON "stamp_transactions"("stamp_id", "created_at");
CREATE INDEX "stamp_transactions_branch_id_created_at_idx" ON "stamp_transactions"("branch_id", "created_at");

ALTER TABLE "stamp_transactions"
  ADD CONSTRAINT "stamp_transactions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stamp_transactions"
  ADD CONSTRAINT "stamp_transactions_stamp_id_fkey"
  FOREIGN KEY ("stamp_id") REFERENCES "stamps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stamp_transactions"
  ADD CONSTRAINT "stamp_transactions_session_id_fkey"
  FOREIGN KEY ("session_id") REFERENCES "wash_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "stamp_transactions"
  ADD CONSTRAINT "stamp_transactions_branch_id_fkey"
  FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stamp_transactions"
  ADD CONSTRAINT "stamp_transactions_package_id_fkey"
  FOREIGN KEY ("package_id") REFERENCES "wash_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
