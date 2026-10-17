#!/bin/sh
# GitHub runner na ovom Macu — workflow za pjesme (.github/workflows/audio.yml)
# radi ovdje kad YouTube odbije GitHubov server. Kućnu adresu YouTube ne
# blokira, pa ne trebaju kolačići. Postavlja se jednom:
#
#   npm run runner
#
# Runner radi u pozadini i sam se pali s Macom. Kad je Mac ugašen, posao
# čeka na GitHubu (do 24 h) i završi se čim se Mac upali.
# Ukloniti: cd ~/actions-runner-stih-dana && ./svc.sh uninstall && ./config.sh remove
set -e
DIR="$HOME/actions-runner-stih-dana"
REPO="https://github.com/pandzicharis/dino-merlin-stih-dana"
if [ -f "$DIR/.runner" ]; then
  echo "Runner je već postavljen u $DIR:"
  cd "$DIR" && ./svc.sh status
  exit 0
fi
ver=$(curl -fsSL https://api.github.com/repos/actions/runner/releases/latest | python3 -c "import json,sys; print(json.load(sys.stdin)['tag_name'].lstrip('v'))")
mkdir -p "$DIR" && cd "$DIR"
echo "↓ GitHub runner $ver…"
curl -fsSL -o runner.tar.gz "https://github.com/actions/runner/releases/download/v$ver/actions-runner-osx-arm64-$ver.tar.gz"
tar xzf runner.tar.gz && rm runner.tar.gz
open "$REPO/settings/actions/runners/new?arch=arm64&os=osx"
echo
echo "Na GitHub stranici koja se otvorila, u dijelu \"Configure\", kopiraj samo token"
echo "(niz slova iza --token) i zalijepi ga ovdje. Ne vidi se dok kucaš."
printf "Token: "
stty -echo; read -r token; stty echo; echo
./config.sh --unattended --url "$REPO" --token "$token" \
  --name "$(scutil --get LocalHostName)-stih-dana" --labels stih-dana --replace
./svc.sh install
./svc.sh start
echo
echo "✓ Runner radi u pozadini — pjesme koje GitHub ne može preuzeti preuzima ovaj Mac."
