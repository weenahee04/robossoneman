CREATE TYPE "MembershipStatus" AS ENUM ('pending', 'active', 'expired', 'cancelled');

CREATE TABLE "membership_plans" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'THB',
    "wash_limit" INTEGER NOT NULL DEFAULT 10,
    "graphene_limit" INTEGER NOT NULL DEFAULT 2,
    "free_vacuum_per_visit" BOOLEAN NOT NULL DEFAULT true,
    "vip_fast_lane" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "membership_plans_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'pending',
    "wash_used" INTEGER NOT NULL DEFAULT 0,
    "graphene_used" INTEGER NOT NULL DEFAULT 0,
    "payment_amount" INTEGER NOT NULL DEFAULT 0,
    "payment_currency" TEXT NOT NULL DEFAULT 'THB',
    "payment_status" TEXT NOT NULL DEFAULT 'mock_confirmed',
    "payment_reference" TEXT,
    "activated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "membership_plans_code_key" ON "membership_plans"("code");
CREATE UNIQUE INDEX "user_memberships_payment_reference_key" ON "user_memberships"("payment_reference");
CREATE INDEX "user_memberships_user_id_status_idx" ON "user_memberships"("user_id", "status");
CREATE INDEX "user_memberships_plan_id_status_idx" ON "user_memberships"("plan_id", "status");

ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_memberships" ADD CONSTRAINT "user_memberships_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "membership_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "membership_plans" (
    "id", "code", "name", "description", "price", "currency", "wash_limit", "graphene_limit", "free_vacuum_per_visit", "vip_fast_lane", "is_active", "sort_order", "updated_at"
) VALUES (
    'plan_graphene_1290',
    'GRAPHENE_MEMBERSHIP',
    'ROBOSS Graphene Membership',
    '10 Washes, 2x Graphene Shield, Free Vacuum Every Visit, VIP Fast Lane',
    1290,
    'THB',
    10,
    2,
    true,
    true,
    true,
    1,
    CURRENT_TIMESTAMP
) ON CONFLICT ("code") DO NOTHING;
