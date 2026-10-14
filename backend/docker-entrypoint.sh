#!/bin/sh
set -e

if [ "${RUN_MIGRATIONS_ON_STARTUP:-true}" = "true" ]; then
  echo "Running Prisma migrations..."
  npx prisma migrate deploy
fi

exec "$@"
