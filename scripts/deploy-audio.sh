#!/usr/bin/env bash
# Pjesme iz public/audio na Cloudflare (workers.dev) — statični fajlovi
# Workera: besplatno, bez ograničenja zahtjeva i prenosa.
#   Prvi put:              npx wrangler login
#   Poslije nove pjesme:   npm run audio:deploy
# Adresa (https://stihdana-audio.<nalog>.workers.dev) ide u lib/site.ts (AUDIO_BASE).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/cloudflare/audio/dist"
rm -rf "$OUT"
mkdir -p "$OUT/audio"
cp "$ROOT"/public/audio/*.m4a "$OUT/audio/"
# CORS: aplikacija (druga adresa) čita pjesmu u service workeru i pušta je
# kroz Web Audio (utišavanje na iPhoneu) — bez ovoga bi bila tiha
cat > "$OUT/_headers" <<'H'
/audio/*
  Access-Control-Allow-Origin: *
  Access-Control-Expose-Headers: Content-Length, Content-Range, Accept-Ranges, Content-Encoding, ETag
  Cache-Control: public, max-age=604800, stale-while-revalidate=2592000
H
cd "$ROOT/cloudflare/audio"
# `npm run` stavlja i node_modules/.bin svih roditeljskih foldera ispred — tamo
# zna biti stari npx (npm 6) koji `--yes wrangler@4` pročita pogrešno i pokrene
# tuđi paket. Zato isti npm koji je pokrenuo skriptu, i paket izričito:
if [ -n "${npm_execpath:-}" ]; then
  node "$npm_execpath" exec --yes --package=wrangler@4 -- wrangler deploy
else
  npx --yes --package=wrangler@4 -- wrangler deploy
fi
