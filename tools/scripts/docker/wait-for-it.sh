#!/usr/bin/env sh
# Minimal wait-for-it using Node to check TCP connectivity.
# Usage: wait-for-it.sh host:port [--timeout=60] [--] command args...

set -eu

TARGET="${1:-}"
if [ -z "$TARGET" ]; then
  echo "Usage: $0 host:port [--timeout=60] [--] command..." >&2
  exit 2
fi

HOST=$(echo "$TARGET" | awk -F: '{print $1}')
PORT=$(echo "$TARGET" | awk -F: '{print $2}')
TIMEOUT=60
shift || true

if [ "${1:-}" != "--" ] && printf "%s" "$1" | grep -q "^--timeout="; then
  TIMEOUT=$(printf "%s" "$1" | cut -d= -f2)
  shift || true
fi

if [ "${1:-}" = "--" ]; then
  shift || true
fi

START=$(date +%s)
echo "Waiting for $HOST:$PORT up to ${TIMEOUT}s..."

while :; do
  node -e "const n=require('net');const s=n.connect({host:'$HOST',port:$PORT},()=>{process.exit(0)});s.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),2000)" \
    && break || true

  NOW=$(date +%s)
  ELAPSED=$((NOW-START))
  if [ "$ELAPSED" -ge "$TIMEOUT" ]; then
    echo "Timeout after ${TIMEOUT}s waiting for $HOST:$PORT" >&2
    exit 1
  fi
  sleep 1
done

echo "$HOST:$PORT is available"

if [ "$#" -gt 0 ]; then
  exec "$@"
fi

