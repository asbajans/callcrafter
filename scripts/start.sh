#!/bin/sh
set -e

echo "Cleaning up temp files..."
rm -rf /tmp/* 2>/dev/null || true

# tsx cache fills up small /tmp tmpfs, redirect to app directory
export TMPDIR=/app/.tmp

echo "Running database migrations..."
./node_modules/.bin/payload migrate

echo "Cleaning up tsx cache..."
rm -rf /app/.tmp/* 2>/dev/null || true

echo "Starting server..."
exec node server.js
