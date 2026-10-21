/**
 * Male i unaprijed zamućene varijante omota (iz public/albumi/hq).
 *
 *   npm run brand:covers   (poslije svakog novog albuma u data/albums.ts)
 *
 *   sm/<id>.webp          240 px — sličice u plejeru (46–72 px, oštre i na 3× ekranu)
 *   md/<id>.webp          960 px — oštri omot u kartama špila (karta ≤ 320 px, 3× ekran)
 *   glow/<id>.webp        128 × 173 px — podloga omota (odraz + omot) unaprijed
 *                         zamućena: blur(28px) saturate(1.15) iz .album-glow
 *   blur/<id>.webp        128 px, zamućen + saturate(1.2) — atmosfera iza stiha
 *   blur-card/<id>.webp   128 px, jače zamućen — atmosfera karte u panelu
 *   lock/<id>.jpg         512 px JPEG — omot na zaključanom ekranu (Media Session;
 *                         iPhone ga iz velikog WebP-a zna ne učitati pa pokaže ikonu)
 *   precache.json         svi ovi URL-ovi — data/albums.ts po njemu zna koje varijante postoje
 *
 * CSS `filter: blur()` preko omota od 1200 px iPhone plaća dvaput: dekodira
 * cijeli omot (~5,7 MB) i zamućuje ga pri svakom crtanju sloja. Mutna slika od
 * 128 px, rastegnuta, izgleda isto — u njoj ionako nema detalja.
 *
 * Koliko zamutiti — σ kao dio stranice omota onako kako je prikazan, za
 * telefon 390×844 (data/albums.ts `COVER_BLURS`):
 *
 *   MoodBackground: sloj -inset-[15%] → 507 × 1097 px; bg-cover kvadrata → omot
 *   je visok 1097 px. blur(56px) važi u prostoru elementa (scale-110 ide poslije
 *   i uvećava omot i blur jednako) → σ = 56 / 1097 = 5,10% → na 128 px: 6,5 px.
 *
 *   MoodStill, karta W×H = 390×620 em: inset -15% → 507 × 806 em; omot 806 em.
 *   blur(390 × 0.14 = 54,6 → "55"em) → σ = 55 / 806 = 6,82% → na 128 px: 8,7 px.
 *
 *   Razlika je 34% (> 20%), pa dvije varijante. Prezentacija (MoodStill 402×874
 *   i 384×832 em) pada na 4,9–5,0% → koristi prvu; ostalo zadrži CSS blur.
 *
 * Boje: CSS je `blur(...) saturate(1.2)` — prvo blur, pa saturate, oba nad
 * sRGB vrijednostima. Zato dva koraka i saturate kao matrica iz specifikacije
 * (recomb), ne `modulate` (on radi u LCh i daje druge boje). Gauss je pun
 * (minAmplitude 0.001), ne sharpov podrazumijevani, odsječen na 20% vrha.
 *
 * Rubovi: CSS blur uzima prozirno van elementa, a ovdje je zamućen cijeli
 * omot. Gore i dole je rub elementa 2,9σ (karta 2,2σ) van vidljivog dijela —
 * razlika < 2% sloja. Lijevo i desno element seže samo 1,4σ van ekrana (karte),
 * pa je CSS sloj na samoj ivici ~9% prozirniji, a 1σ unutra < 1%. Izmjereno
 * (sloj na 32%, prije sjenke i vinjete koje idu preko): na krajnjih ~20 px
 * do 4–7/255, dalje od 60 px ≤ 2/255 — ne vidi se. Taj rub se namjerno ne peče
 * u sliku: zavisi od razmjera ekrana, a ovako je raspored isti na svakom telefonu.
 */
// sharp nije u package.json — dolazi uz next (njegova opciona zavisnost)
import sharp from 'sharp'
import { mkdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ALBUMS, COVER_BLURS } from '../data/albums'

const PUB = join(process.cwd(), 'public')
const SM = 240
const MD = 960
const BLUR = 128

// CSS saturate(s) — matrica iz Filter Effects specifikacije
type Row = [number, number, number]
const sat = (s: number): [Row, Row, Row] => [
  [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s],
  [0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s],
  [0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s],
]

const urls: string[] = []
const kb = (f: string) => (statSync(f).size / 1024).toFixed(1)

async function main() {
  for (const dir of ['sm', 'md', 'glow', 'lock', ...COVER_BLURS.map((b) => b.dir)]) mkdirSync(join(PUB, 'albumi', dir), { recursive: true })

  for (const a of ALBUMS) {
    const id = a.cover.match(/^\/albumi\/hq\/([a-z0-9-]+)\.webp$/)?.[1]
    if (!id) throw new Error(`${a.id}: omot nije u /albumi/hq/ — ${a.cover}`)
    const src = join(PUB, a.cover)

    const sm = `/albumi/sm/${id}.webp`
    await sharp(src).resize(SM, SM, { fit: 'cover' }).webp({ quality: 80, effort: 6 }).toFile(join(PUB, sm))
    urls.push(sm)
    const line = [`sm ${kb(join(PUB, sm))} KB`]

    const md = `/albumi/md/${id}.webp`
    await sharp(src).resize(MD, MD, { fit: 'cover' }).webp({ quality: 82, effort: 6 }).toFile(join(PUB, md))
    urls.push(md)
    line.push(`md ${kb(join(PUB, md))} KB`)

    const lock = `/albumi/lock/${id}.jpg`
    await sharp(src).removeAlpha().resize(512, 512, { fit: 'cover' }).jpeg({ quality: 86, mozjpeg: true }).toFile(join(PUB, lock))
    urls.push(lock)
    line.push(`lock ${kb(join(PUB, lock))} KB`)

    // Podloga omota (.album-glow): kutija 1 × 1.35 širine — gore odraz gornjih
    // 35% omota (preokrenut), ispod cijeli omot; pa blur(28px) saturate(1.15).
    // Telefon 390 px: σ = 28 / 390 = 7,18% širine kutije. Maska kutije je na sva
    // četiri ruba nula, pa rub zamućenja ne pravi razliku.
    const G = 512
    const strip = Math.round(G * 0.35)
    const base = await sharp(src).removeAlpha().resize(G, G, { fit: 'cover' }).raw().toBuffer()
    const top = await sharp(base, { raw: { width: G, height: G, channels: 3 } }).extract({ left: 0, top: 0, width: G, height: strip }).flip().raw().toBuffer()
    const { data: gd, info: gi } = await sharp({ create: { width: G, height: G + strip, channels: 3, background: '#000' } })
      .composite([
        { input: top, raw: { width: G, height: strip, channels: 3 }, top: 0, left: 0 },
        { input: base, raw: { width: G, height: G, channels: 3 }, top: strip, left: 0 },
      ])
      .raw()
      .toBuffer({ resolveWithObject: true })
    const glow = `/albumi/glow/${id}.webp`
    await sharp(await sharp(gd, { raw: gi }).blur({ sigma: (28 / 390) * G, minAmplitude: 0.001, precision: 'float' }).raw().toBuffer(), { raw: gi })
      .resize(BLUR, Math.round(BLUR * 1.35))
      .recomb(sat(1.15))
      .webp({ quality: 95, smartSubsample: true, effort: 6 })
      .toFile(join(PUB, glow))
    urls.push(glow)
    line.push(`glow ${kb(join(PUB, glow))} KB`)


    for (const b of COVER_BLURS) {
      // 1) blur u 512 px (sharp radi jedan resize po prolazu, pa smanjenje ide u 2. koraku)
      const { data, info } = await sharp(src)
        .removeAlpha()
        .resize(512, 512, { fit: 'cover' })
        .blur({ sigma: b.sigma * 512, minAmplitude: 0.001, precision: 'float' })
        .raw()
        .toBuffer({ resolveWithObject: true })
      // 2) na 128 px i saturate(1.2); q95 — rastegnuta je 8× i više, a niža kvaliteta
      //    ostavi kocke od kompresije (q95 griješi ≤ 1,5/255 u sloju, bez gubitaka 10× veća)
      const url = `/albumi/${b.dir}/${id}.webp`
      await sharp(data, { raw: info })
        .resize(BLUR, BLUR)
        .recomb(sat(1.2))
        .webp({ quality: 95, smartSubsample: true, effort: 6 })
        .toFile(join(PUB, url))
      urls.push(url)
      line.push(`${b.dir} ${kb(join(PUB, url))} KB`)
    }
    console.log('  ✓', id.padEnd(30), line.join(' · '))
  }

  writeFileSync(join(PUB, 'albumi/precache.json'), JSON.stringify(urls, null, 2) + '\n')
  console.log(`  ✓ public/albumi/precache.json (${urls.length})\n`)
}

main().catch((e) => {
  console.error('\n✖', e instanceof Error ? e.message : e, '\n')
  process.exit(1)
})
