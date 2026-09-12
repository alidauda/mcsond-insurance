#!/bin/sh
set -e

# Apply pending DB migrations before serving. Set SKIP_MIGRATIONS=true to boot
# without touching the schema (e.g. when running several replicas).
if [ "$SKIP_MIGRATIONS" != "true" ]; then
  node migrate.cjs
fi

exec node server.js
