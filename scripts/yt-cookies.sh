#!/bin/sh
# YouTube kolačići za GitHub (tajna YT_COOKIES) — da workflow za pjesme ne
# dobija "Sign in to confirm you're not a bot". Vidi DEPLOY.md → Pjesme.
#
#   npm run cookies -- "Stih dana"     iz Chrome profila tog imena (preporuka)
#   npm run cookies                    iz glavnog Chrome profila
#
# TRAJNI kolačići: poseban Chrome profil samo za ovo. Prijaviš se na YouTube,
# zatvoriš prozor tog profila i više ga ne otvaraš — kolačiće onda niko ne
# "rotira" (YouTube ih zamijeni čim preglednik nastavi raditi s njima), pa
# važe mjesecima. Iz profila koji svakodnevno koristiš istroše se za dan-dva.
#
# Uzme samo YouTube/Google kolačiće (ništa drugo), kopira ih i otvori GitHub
# stranicu za tajnu: Name YT_COOKIES, Secret Cmd+V, Add/Update secret.
set -e
arg="${1:-chrome}"
case "$arg" in
  chrome|chrome:*|safari|firefox|firefox:*|brave|brave:*|edge|edge:*) browser="$arg" ;;
  *)
    # ime Chrome profila (kako piše u Chromeu) → njegov folder
    dir=$(python3 -c "
import json, os, sys
s = json.load(open(os.path.expanduser('~/Library/Application Support/Google/Chrome/Local State')))
hit = [k for k, v in s.get('profile', {}).get('info_cache', {}).items() if v.get('name', '').lower() == sys.argv[1].lower()]
print(hit[0] if hit else '')" "$arg")
    if [ -z "$dir" ]; then
      echo "Nema Chrome profila \"$arg\". Napravi ga (Chrome → slika gore desno → Add), prijavi se na youtube.com, zatvori ga, pa ponovi."
      exit 1
    fi
    browser="chrome:$dir"
    ;;
esac
# fajl ne smije postojati unaprijed — yt-dlp bi ga prvo pokušao pročitati
tmpdir="$(mktemp -d -t yt-cookies)"
tmp="$tmpdir/cookies.txt"
trap 'rm -rf "$tmpdir"' EXIT
yt-dlp --quiet --no-warnings --cookies-from-browser "$browser" --cookies "$tmp" \
  --skip-download "https://www.youtube.com/watch?v=lKgI7Cxm0go" >/dev/null
n=$(grep -cE '^[^[:space:]]*(youtube|google)\.com' "$tmp" || true)
if [ "$n" -eq 0 ]; then
  echo "Nema YouTube kolačića ($browser) — prijavi se na youtube.com u tom profilu pa ponovi."
  exit 1
fi
(head -1 "$tmp"; grep -E '^[^[:space:]]*(youtube|google)\.com' "$tmp") | pbcopy
echo "✓ Kopirano ($n kolačića). Na GitHubu: Name YT_COOKIES, Secret Cmd+V, Add/Update secret."
echo "  Ne otvaraj više taj profil — tako kolačići ostaju važeći."
open "https://github.com/pandzicharis/dino-merlin-stih-dana/settings/secrets/actions"
