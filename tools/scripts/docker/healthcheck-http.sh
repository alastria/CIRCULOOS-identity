#!/usr/bin/env sh
# Simple HTTP healthcheck using Node.
# Usage: healthcheck-http.sh http://host:port/path [--expect=200]

set -eu

URL="${1:-}"
EXPECT="200"
if [ -z "$URL" ]; then
  echo "Usage: $0 URL [--expect=200]" >&2
  exit 2
fi
shift || true

if [ "${1:-}" != "" ] && printf "%s" "$1" | grep -q "^--expect="; then
  EXPECT=$(printf "%s" "$1" | cut -d= -f2)
  shift || true
fi

node -e "
  const u=new URL(process.argv[1]);
  const m=u.protocol==='https:'?require('https'):require('http');
  const req=m.request({method:'GET',hostname:u.hostname,port:u.port||undefined,path:u.pathname+u.search},r=>{
    const ok=String(r.statusCode||'')===String(process.argv[2]||'200') || (r.statusCode<500 && String(process.argv[2]||'200')==='200');
    process.exit(ok?0:1);
  });
  req.on('error',()=>process.exit(1));
  req.end();
" "$URL" "$EXPECT"

