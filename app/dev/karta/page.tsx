import { notFound } from 'next/navigation'
import { ALBUMS, blurOf } from '@/data/albums'
import { MOODS, FIGURE_SRC, type Mood } from '@/data/moods'
import { OVERRIDE_ON } from '@/lib/date'
import { CARD_H, CARD_W, CardAtmosphere } from '@/components/CardAtmosphere'

/**
 * Atmosfera jedne karte (album × raspoloženje), tačno W × H piksela — s nje
 * scripts/bake-cards.ts ispeče sliku za kartu u traci (public/karte). Samo lokalno.
 *   /dev/karta?album=<id ili "bez">&mood=<raspoloženje>
 */
export default async function KartaPage({ searchParams }: { searchParams: Promise<{ album?: string; mood?: string }> }) {
  if (!OVERRIDE_ON) notFound()
  const { album, mood } = await searchParams
  if (!mood || !(mood in MOODS)) notFound()
  const a = ALBUMS.find((x) => x.id === album)
  const m = MOODS[mood as Mood]
  // slike koje atmosfera koristi — skripta čeka da se sve dekodiraju
  const blur = Number((CARD_W * 0.14).toFixed(0))
  const imgs = a ? [a.cover, blurOf(a.cover, blur / (1.3 * Math.max(CARD_W, CARD_H))) ?? a.cover] : [FIGURE_SRC]
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <div style={{ position: 'absolute', left: 0, top: 0, width: CARD_W, height: CARD_H, fontSize: 1, overflow: 'hidden', background: m.gradient[0], fontFamily: 'var(--font-sans), sans-serif' }}>
        <CardAtmosphere mood={mood as Mood} cover={a?.cover} lift={a?.lift} />
      </div>
      {imgs.map((src) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={src} src={src} alt="" data-wait style={{ position: 'absolute', width: 1, height: 1, opacity: 0, left: -10 }} />
      ))}
      <script
        dangerouslySetInnerHTML={{
          __html: `Promise.all([document.fonts.ready, ...[...document.querySelectorAll('img[data-wait]')].map(i => i.decode().catch(() => {}))]).then(() => setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => { document.documentElement.dataset.ready = '1' })), 400))`,
        }}
      />
    </div>
  )
}
