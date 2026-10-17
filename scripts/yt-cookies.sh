#!/bin/sh
# YouTube kolačići za GitHub (tajna YT_COOKIES) — da workflow za pjesme ne
# dobija "Sign in to confirm you're not a bot". Vidi DEPLOY.md → Pjesme.
#
#   npm run cookies            (Chrome; ili: npm run cookies -- safari|brave|firefox|edge)
#
# Uzme samo YouTube/Google kolačiće iz preglednika (ništa drugo), kopira ih i
# otvori stranicu za novu tajnu: Name YT_COOKIES, Secret Cmd+V, Add secret.
# Privremeni fajl se briše odmah.
set -e
browser="${1:-chrome}"
# fajl ne smije postojati unaprijed — yt-dlp bi ga prvo pokušao pročitati
dir="$(mktemp -d -t yt-cookies)"
tmp="$dir/cookies.txt"
trap 'rm -rf "$dir"' EXIT
yt-dlp --quiet --no-warnings --cookies-from-browser "$browser" --cookies "$tmp" \
  --skip-download "https://www.youtube.com/watch?v=lKgI7Cxm0go" >/dev/null
n=$(grep -cE '^[^[:space:]]*(youtube|google)\.com' "$tmp" || true)
if [ "$n" -eq 0 ]; then
  echo "Nema YouTube kolačića u pregledniku ($browser) — prijavi se na youtube.com pa ponovi."
  exit 1
fi
(head -1 "$tmp"; grep -E '^[^[:space:]]*(youtube|google)\.com' "$tmp") | pbcopy
echo "✓ Kopirano ($n kolačića). Na GitHubu koji se otvara: Name YT_COOKIES, Secret Cmd+V, Add secret."
open "https://github.com/pandzicharis/dino-merlin-stih-dana/settings/secrets/actions/new"
