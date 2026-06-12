#!/bin/sh
set -e
echo "Cleaning up temp files..."
rm -rf /tmp/* 2>/dev/null || true
echo "Running database migrations..."
./node_modules/.bin/payload migrate
echo "Starting server..."
exec node server.js
