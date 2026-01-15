#!/bin/bash
# Quick smoke test for anonymous event ingestion (no lead_id required)
# Usage: ./test_anonymous_event.sh [API_BASE_URL]

API_BASE="${1:-http://localhost:4000}"
ENDPOINT="${API_BASE}/marketing/ingest-intent-event"

echo "Testing anonymous event ingestion at ${ENDPOINT}..."
echo ""

# Test anonymous event (no lead_id, with anonymous_id)
curl -X POST "${ENDPOINT}" \
  -H "Content-Type: application/json" \
  -H "x-do-intent-key: test-key" \
  -H "origin: http://localhost:3000" \
  -d '{
    "event_type": "page_view",
    "anonymous_id": "test-anonymous-123",
    "url": "https://example.com/pricing",
    "path": "/pricing",
    "metadata": {
      "page_title": "Pricing Page"
    }
  }' \
  -w "\nHTTP Status: %{http_code}\n" \
  -s

echo ""
echo "Expected: HTTP Status 200 with event_id and lead_id: null"

