#!/usr/bin/env bash
# Grafike za preuzimanje (Grafike u prezentaciji) — iz pokrenutog dev servera,
# u punoj rezoluciji, kroz Chrome bez prozora. Pokreni ponovo kad se promijeni
# izgled (album, stih na plakatu…):  bash scripts/export-promo.sh [http://localhost:3111]
set -euo pipefail
BASE="${1:-http://localhost:3111}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
OUT="$(cd "$(dirname "$0")/.." && pwd)/public/promo"
mkdir -p "$OUT"
# poseban profil: ne smeta otvorenom Chromeu
PROFILE="$(mktemp -d)"
trap 'rm -rf "$PROFILE"' EXIT
shot() { # ime  širina  visina  adresa   (×2 piksela: 1754 → 3508)
  rm -f "$OUT/$1"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --user-data-dir="$PROFILE" \
    --window-size="$2,$3" --virtual-time-budget=12000 --screenshot="$OUT/$1" "$BASE$4" 2>/dev/null || true
  [ -s "$OUT/$1" ] && echo "✓ $1" || { echo "✗ $1 — je li server pokrenut na $BASE?"; exit 1; }
}
pdf() { # ime  adresa — veličinu papira daje @page na stranici
  rm -f "$OUT/$1"
  "$CHROME" --headless=new --disable-gpu --no-pdf-header-footer --user-data-dir="$PROFILE" --virtual-time-budget=12000 \
    --print-to-pdf="$OUT/$1" "$BASE$2" 2>/dev/null || true
  [ -s "$OUT/$1" ] && echo "✓ $1" || { echo "✗ $1"; exit 1; }
}
shot stih-dana-plakat-A3.png 1754 2481 '/prezentacija/plakat?samo=1'
shot stih-dana-plakat-A4-polozeno.png 1754 1240 '/prezentacija/plakat/a4?samo=1'
shot stih-dana-objava-4x5.png 1080 1350 '/prezentacija/objava?samo=objava'
shot stih-dana-story-9x16.png 1080 1920 '/prezentacija/objava?samo=story'
pdf stih-dana-plakat-A3.pdf '/prezentacija/plakat'
pdf stih-dana-plakat-A4-polozeno.pdf '/prezentacija/plakat/a4'
