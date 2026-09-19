/**
 * Pretvara sliku potpisa u bijeli potpis na providnoj podlozi.
 *
 *   1. spasi original kao  public/brand/signature-src.png  (ili .jpg)
 *   2. npm run brand:signature
 *
 * Skripta izvlači alfu iz tamnog poteza, pa podloga (bijela, siva, skenirana)
 * nestaje, a ostaje samo potez — obojiv kroz CSS.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(process.cwd(), 'public/brand')

/** Prihvata bilo šta nalik potpisu u public/brand/ ili korijenu projekta. */
function findSource(): string | undefined {
  const exts = /\.(png|jpe?g|webp)$/i
  for (const d of [dir, process.cwd()]) {
    if (!existsSync(d)) continue
    const hit = readdirSync(d)
      .filter((f) => exts.test(f) && /potpis|signature/i.test(f) && !/^signature\.webp$/i.test(f))
      .sort()[0]
    if (hit) return join(d, hit)
  }
  return undefined
}

const src = findSource()

if (!src) {
  console.error(
    '\n✖ Nema izvorne slike.\n' +
      '  Spasi potpis kao public/brand/signature-src.png (ili potpis.png u korijenu)\n' +
      '  pa pokreni ponovo.\n',
  )
  process.exit(1)
}

const py = `
from PIL import Image, ImageOps, ImageFilter
import sys

src = sys.argv[1]
im = ImageOps.exif_transpose(Image.open(src))

# Dva slučaja: slika već ima providnu podlogu, ili je potez taman na svijetlom.
alpha = im.getchannel('A') if im.mode in ('RGBA', 'LA') else None
useful = alpha is not None and alpha.getextrema()[0] < 8 and sum(alpha.histogram()[1:255]) > 0

if useful:
    a = alpha
else:
    a = ImageOps.invert(ImageOps.grayscale(im.convert('RGB')))

# odsijeci sivilo skena: sve ispod praga je podloga
lo, hi = 70, 190
a = a.point(lambda v: 0 if v < lo else (255 if v > hi else int(255 * (v - lo) / (hi - lo))))
a = a.filter(ImageFilter.SMOOTH)

# izrez na stvarni potez + mali dah okolo
box = a.getbbox()
if box:
    pad = max(a.width, a.height) // 60
    box = (max(0, box[0]-pad), max(0, box[1]-pad),
           min(a.width, box[2]+pad), min(a.height, box[3]+pad))
    a = a.crop(box)

W = 1000
a = a.resize((W, round(W * a.height / a.width)), Image.LANCZOS)

out = Image.new('RGBA', a.size, (255, 255, 255, 255))
out.putalpha(a)
out.save(sys.argv[2], 'WEBP', quality=92, method=6)
print(f'{a.size[0]}x{a.size[1]}')
`

const out = join(dir, 'signature.webp')
const size = execFileSync('python3', ['-c', py, src, out], { encoding: 'utf8' }).trim()
console.log(`\n✔ public/brand/signature.webp  ${size}\n`)
