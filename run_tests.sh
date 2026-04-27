#!/usr/bin/env bash
set -euo pipefail

# Install deps, browsers, start server, run tests, then stop server
python3 -m pip install --user -r requirements.txt

# If SKIP_BROWSER_INSTALL is set to 1, skip downloading Playwright browsers
if [ "${SKIP_BROWSER_INSTALL:-0}" != "1" ]; then
	echo "Installing Playwright browsers..."
	python3 -m playwright install chromium
else
	echo "SKIP_BROWSER_INSTALL=1 detected — skipping Playwright browser download."
fi

# start simple HTTP server in background
python3 -m http.server 8000 &
SERVER_PID=$!
echo "Started HTTP server (pid=${SERVER_PID})"
sleep 1

python3 tests/e2e_test.py

kill ${SERVER_PID} || true
echo "Stopped HTTP server"
