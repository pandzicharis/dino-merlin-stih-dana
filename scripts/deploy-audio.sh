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
# spisak pjesama na glavnoj adresi (Cloudflare statične fajlove ne pokazuje kao listu)
node -e '
const fs = require("fs"), path = require("path")
const dir = path.join(process.argv[1], "audio")
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c])
const files = fs.readdirSync(dir).filter((f) => /\.(m4a|mp3)$/.test(f)).sort()
let total = 0
const rows = files.map((f) => {
  const mb = fs.statSync(path.join(dir, f)).size / 1048576
  total += mb
  const name = f.replace(/\.(m4a|mp3)$/, "").replace(/-/g, " ")
  return `<li><a href="/audio/${encodeURIComponent(f)}">${esc(name)}</a><span>${mb.toFixed(1)} MB</span></li>`
})
const html = `<!doctype html><html lang="bs"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Stih dana — pjesme</title>
<style>body{margin:0;background:#0b0a0a;color:#eee;font:15px/1.5 system-ui,sans-serif;padding:24px 16px}main{max-width:560px;margin:auto}h1{font-size:20px;margin:0 0 4px}p{color:#999;margin:0 0 20px}ol{padding-left:22px}li{padding:6px 0;border-bottom:1px solid #222}li span{float:right;color:#777;font-size:13px}a{color:#e2cfa6;text-decoration:none}</style></head>
<body><main><h1>Stih dana — pjesme</h1><p>${files.length} pjesama · ${total.toFixed(1)} MB · objavljeno ${new Date().toLocaleString("bs-BA", { timeZone: "Europe/Sarajevo" })}</p><ol>${rows.join("")}</ol></main></body></html>`
fs.writeFileSync(path.join(process.argv[1], "index.html"), html)
' "$OUT"

cd "$ROOT/cloudflare/audio"
# `npm run` stavlja i node_modules/.bin svih roditeljskih foldera ispred — tamo
# zna biti stari npx (npm 6) koji `--yes wrangler@4` pročita pogrešno i pokrene
# tuđi paket. Zato isti npm koji je pokrenuo skriptu, i paket izričito:
if [ -n "${npm_execpath:-}" ]; then
  node "$npm_execpath" exec --yes --package=wrangler@4 -- wrangler deploy
else
  npx --yes --package=wrangler@4 -- wrangler deploy
fi
