#!/bin/sh
# Startup script: try migrate deploy, fallback to db push if it fails
echo "==> Running database migrations..."
npx prisma migrate deploy 2>&1 || {
  echo "==> migrate deploy failed, syncing schema with db push..."
  npx prisma db push --accept-data-loss 2>&1
}
echo "==> Starting server..."
exec node dist/index.js
