#!/bin/sh
set -e
echo "Running database migrations..."
./node_modules/.bin/payload migrate
echo "Starting server..."
exec node server.js
