/**
 * Ikone aplikacije iz potpisa.
 *
 *   npm run brand:icons   (traži public/brand/signature.webp)
 *
 * Potpis je širok 1.4:1, pa na kvadratu stoji centriran s dosta zraka —
 * to je ionako kako potpis i izgleda na omotu ploče.
 */
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const sig = join(process.cwd(), 'public/brand/signature.webp')
if (!existsSync(sig)) {
  console.error('\n✖ Nema public/brand/signature.webp — prvo: npm run brand:signature\n')
  process.exit(1)
}

const py = `
from PIL import Image, ImageDraw
import sys

sig = Image.open(sys.argv[1]).convert('RGBA')
GOLD = (191, 168, 127)          # #BFA87F sa dinomerlin.com

def radial_glow(S):
    img = Image.new('RGB', (S, S), (0, 0, 0))
    d = ImageDraw.Draw(img)
    for i in range(140, 0, -1):
        t = i / 140
        r = 0.66 * S * t
        v = int(20 * (1 - t) ** 1.9)
        d.ellipse([S/2-r, S*0.46-r, S/2+r, S*0.46+r], fill=(v + v//2, v, v//2))
    return img

def make(size, safe, path):
    S = size * 4
    img = radial_glow(S).convert('RGBA')
    w = int(S * safe)
    h = round(w * sig.height / sig.width)
    mark = Image.new('RGBA', (w, h), (*GOLD, 255))
    mark.putalpha(sig.getchannel('A').resize((w, h), Image.LANCZOS))
    img.alpha_composite(mark, ((S - w) // 2, (S - h) // 2))
    img.convert('RGB').resize((size, size), Image.LANCZOS).save(path, 'PNG', optimize=True)
    print('  ✓', path)

make(192, 0.78, 'public/icons/icon-192.png')
make(512, 0.78, 'public/icons/icon-512.png')
make(512, 0.58, 'public/icons/icon-maskable-512.png')   # maskable: 20% sigurna zona
make(180, 0.78, 'public/icons/apple-touch-icon.png')
make(192, 0.78, 'app/icon.png')
make(180, 0.78, 'app/apple-icon.png')
`

execFileSync('python3', ['-c', py, sig], { stdio: 'inherit' })
console.log('')
