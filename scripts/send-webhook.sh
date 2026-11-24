#!/usr/bin/env bash

set -euo pipefail

SECRET=${WEBHOOK_SECRET:-dev-secret-change-me}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PAYLOAD="${1:-$SCRIPT_DIR/sample-order.json}"
if [[ ! -f $PAYLOAD ]]; then
  echo "Payload file not found: $PAYLOAD." >&2
  exit 1
fi
SIGNATURE=$(openssl dgst -sha256 \
  -hmac "$SECRET" \
  -binary "$PAYLOAD" | openssl base64 -A)

curl -sS -i \
    -X POST "${URL:-http://localhost:3000/webhooks/orders}" \
    -H "Content-Type: application/json" \
    -H "X-Signature: $SIGNATURE" \
    --data-binary @"$PAYLOAD"
