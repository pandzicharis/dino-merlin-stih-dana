#!/usr/bin/env python3
"""
Izvuče zvuk pjesama s YouTubea u public/audio/<naziv>.mp3 — samo audio,
bez videa. Plejer u SongCredit.tsx traži upravo ta imena.

  pip3 install yt-dlp                      # jednom (treba i ffmpeg)
  python3 scripts/fetch-audio.py           # pjesme iz data/verses.ts
  python3 scripts/fetch-audio.py https://domen.app   # pjesme iz /api/verses (i one iz admina)

Pjesma bez YouTube linka se traži kao "Dino Merlin <naziv>". Postojeći
fajlovi se preskaču.
"""
import json, re, sys, unicodedata, urllib.request
from pathlib import Path

import yt_dlp

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'audio'


def slug(song: str) -> str:
    s = song.lower().replace('đ', 'dj')
    s = ''.join(c for c in unicodedata.normalize('NFD', s) if not unicodedata.combining(c))
    return re.sub(r'[^a-z0-9]+', '-', s).strip('-')


def songs() -> dict[str, tuple[str, str | None]]:
    if len(sys.argv) > 1:
        with urllib.request.urlopen(sys.argv[1].rstrip('/') + '/api/verses') as r:
            rows = [(v['song'], v.get('youtube')) for v in json.load(r)]
    else:
        src = (ROOT / 'data' / 'verses.ts').read_text()
        rows = []
        for block in re.findall(r'\{[^{}]*?song:[^{}]*\}', src):
            song = re.search(r"song:\s*'([^']+)'", block)
            yt = re.search(r"youtube:\s*'([^']+)'", block)
            if song:
                rows.append((song.group(1), yt.group(1) if yt else None))
    out: dict[str, tuple[str, str | None]] = {}
    for song, yt in rows:
        k = slug(song)
        if k not in out or (yt and not out[k][1]):
            out[k] = (song, yt)
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for k, (song, yt) in sorted(songs().items()):
        if (OUT / f'{k}.mp3').exists():
            print(f'✓ {k}.mp3 (već postoji)')
            continue
        url = yt or f'ytsearch1:Dino Merlin {song}'
        print(f'↓ {song} ← {url}')
        opts = {
            'format': 'bestaudio/best',
            'outtmpl': str(OUT / f'{k}.%(ext)s'),
            'noplaylist': True,
            'quiet': True,
            'no_warnings': True,
            'postprocessors': [{'key': 'FFmpegExtractAudio', 'preferredcodec': 'mp3', 'preferredquality': '128'}],
        }
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
        except Exception as e:  # jedna loša pjesma ne ruši ostale
            print(f'✗ {song}: {e}')


if __name__ == '__main__':
    main()
