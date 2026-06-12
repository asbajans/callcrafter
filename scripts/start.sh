#!/bin/sh
set -e

echo "Cleaning up temp files..."
rm -rf /tmp/* 2>/dev/null || true

# Disable tsx disk cache to avoid ENOSPC on small /tmp tmpfs
export TSX_DISABLE_CACHE=1

echo "Running database migrations..."
./node_modules/.bin/payload migrate

echo "Starting server..."
exec node server.js
