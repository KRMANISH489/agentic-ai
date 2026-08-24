#!/bin/sh
set -eu

API_PORT="${API_PORT:-7860}"
export API_ORIGIN="http://127.0.0.1:${API_PORT}"
export OPEN_BROWSER=0

if [ -z "${FRONTEND_URL:-}" ] && [ -n "${RAILWAY_PUBLIC_DOMAIN:-}" ]; then
  export FRONTEND_URL="https://${RAILWAY_PUBLIC_DOMAIN}"
fi
if [ -z "${AUTH_BASE_URL:-}" ] && [ -n "${FRONTEND_URL:-}" ]; then
  export AUTH_BASE_URL="${FRONTEND_URL}"
fi

python -m uvicorn app:app --host 127.0.0.1 --port "${API_PORT}" &
cd /app/frontend
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
