#!/bin/bash
# CallCrafter - After Hours Auto-Ticket AGI Script
# Called from extensions.conf after-hours context
# Sends call info to CallCrafter API for automatic ticket creation

API_URL="${EMARE_TICKET_API_URL:-http://app:3000}"
WEBHOOK_SECRET="${EMARE_WEBHOOK_SECRET:-}"

# Read AGI variables
while read -r line; do
  if [[ "$line" ==agi_* ]]; then
    eval "$line" 2>/dev/null
  fi
  if [[ "$line" =~ ^\ *$ ]]; then
    break
  fi
done

CALLER_PHONE="${agi_callerid:-unknown}"
CALLED_NUMBER="${agi_extension:-unknown}"
CALL_ID="${agi_uniqueid:-unknown}"

PAYLOAD=$(cat <<EOF
{
  "callerPhone": "$CALLER_PHONE",
  "calledNumber": "$CALLED_NUMBER",
  "callId": "$CALL_ID",
  "source": "asterisk_after_hours"
}
EOF
)

curl -s -X POST "${API_URL}/api/webhooks/after-hours" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: ${WEBHOOK_SECRET}" \
  -d "$PAYLOAD"

exit 0
