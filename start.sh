#!/usr/bin/env bash

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER="$ROOT/server"
CLIENT="$ROOT/client"

echo "🚀 Starting DSA Arena..."

cleanup() {
    echo ""
    echo "🛑 Stopping DSA Arena..."
    kill "$CLIENT_PID" "$SERVER_PID" 2>/dev/null
    rm -f "$ROOT/.server.pid" "$ROOT/.client.pid"
    wait
    exit 0
}

trap cleanup SIGINT SIGTERM

# ── Check required compilers ───────────────────────────────────────────────
for cmd in g++ java javac node; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "⚠️  '$cmd' not found. Submissions in this language may fail unless installed."
  fi
done

# ── Start Node server ───────────────────────────────────────────────────────
echo "🟢 Starting Node.js server on port 8081..."
(
  cd "$SERVER" || exit
  npm run dev
) &
SERVER_PID=$!
echo "$SERVER_PID" > "$ROOT/.server.pid"

# ── Start Vite client ───────────────────────────────────────────────────────
echo "🎨 Starting Vite dev server on port 5174..."
(
  cd "$CLIENT" || exit
  npm run dev
) &
CLIENT_PID=$!
echo "$CLIENT_PID" > "$ROOT/.client.pid"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ✅  DSA Arena is running"
echo "  🌐  Frontend  →  http://localhost:5174"
echo "  🔧  Backend   →  http://localhost:8081"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Press Ctrl+C or run ./stop.sh to exit."
echo ""

wait
