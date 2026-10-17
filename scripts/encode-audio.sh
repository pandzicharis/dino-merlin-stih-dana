#!/bin/sh
# Pjesme u public/audio: HE-AAC 64 kbps (upola manje od AAC 128 — pola
# prenosa na Vercelu, brži početak na mobilnoj mreži) i trajanja u
# data/audio.json, da plejer zna dužinu bez preuzimanja zaglavlja fajla.
#
#   sh scripts/encode-audio.sh        (macOS: afconvert; treba ffprobe)
# Nove pjesme: npm run audio (preuzme, kodira i upiše trajanje odjednom).
#
# Već kodirani (HE-AAC) se preskaču, pa se smije pokretati koliko god puta.
set -e
cd "$(dirname "$0")/.."
tmp="$(mktemp -d)"
for f in public/audio/*.m4a; do
  profile="$(ffprobe -v error -select_streams a:0 -show_entries stream=profile -of default=nw=1:nk=1 "$f")"
  if [ "$profile" != "HE-AAC" ]; then
    afconvert -f m4af -d aach -b 64000 "$f" "$tmp/out.m4a"
    mv "$tmp/out.m4a" "$f"
    echo "  ✓ $f"
  fi
done
rmdir "$tmp"

# trajanja: { "slug": sekunde }
{
  printf '{\n'
  first=1
  for f in public/audio/*.m4a; do
    slug="$(basename "$f" .m4a)"
    d="$(ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 "$f")"
    [ $first -eq 1 ] || printf ',\n'
    printf '  "%s": %.1f' "$slug" "$d"
    first=0
  done
  printf '\n}\n'
} > data/audio.json
echo "  ✓ data/audio.json"
