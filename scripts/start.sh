#!/bin/sh
set -e
echo "Running database migrations..."
node node_modules/payload/bin.js migrate
echo "Starting server..."
exec node server.js
