#!/bin/sh
# Startup script for Render deployment
echo "==> Running database migrations..."

# Try prisma migrate deploy first
npx prisma migrate deploy 2>&1
MIGRATE_EXIT=$?

if [ $MIGRATE_EXIT -ne 0 ]; then
  echo "==> migrate deploy failed (exit $MIGRATE_EXIT), trying to baseline..."
  
  # Baseline all migrations as applied (schema already exists)
  npx prisma migrate resolve --applied 20260401_sprint1_franchise_foundation 2>&1 || true
  npx prisma migrate resolve --applied 20260402_admin_promotions_notifications_rewards_feedback 2>&1 || true
  npx prisma migrate resolve --applied 20260402_customer_profile_settings_fix 2>&1 || true
  npx prisma migrate resolve --applied 20260402_sprint3_payment_webhooks 2>&1 || true
  npx prisma migrate resolve --applied 20260404_branch_payment_config_foundation 2>&1 || true
  npx prisma migrate resolve --applied 20260404_payment_config_governance 2>&1 || true
  npx prisma migrate resolve --applied 20260404_scan_token_backend_foundation 2>&1 || true
  npx prisma migrate resolve --applied 20260404_session_binding_scan_token 2>&1 || true
  npx prisma migrate resolve --applied 20260410_add_ksher_provider 2>&1 || true
  
  echo "==> Baseline complete, running migrate deploy again..."
  npx prisma migrate deploy 2>&1 || true
fi

# Run seed to update branch payment configs to Ksher
echo "==> Running database seed..."
npx prisma db seed 2>&1 || true

echo "==> Starting server..."
exec node dist/index.js
