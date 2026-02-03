#!/bin/bash
set -euo pipefail

echo BUILD_COMMIT=$(git rev-parse HEAD || true)
echo BUILD_BRANCH=$(git rev-parse --abbrev-ref HEAD || true)
echo FRONTEND_SERVICE_TS_PATH_LINES:
grep -n 'path:' frontend/encore.service.ts || true
echo FRONTEND_SERVICE_TS_HEAD:
head -n 30 frontend/encore.service.ts | nl -ba || true

