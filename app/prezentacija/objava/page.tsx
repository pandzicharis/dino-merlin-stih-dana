import type { Metadata } from 'next'
import { SocialPost, SocialStory } from '@/components/deck/Poster'
import { PromoToolbar } from '@/components/deck/PromoToolbar'
import { deckData } from '../data'

export const metadata: Metadata = { title: 'Objave za društvene mreže' }

export const revalidate = 3600

/**
 * Objava 4:5 i story 9:16.
 *
 * `?samo=objava` ili `?samo=story` crta samo sliku preko cijelog prozora —
 * prozor 1080×1350 (ili 1080×1920) daje tačan PNG za Instagram.
 */
export default async function ObjavaPage({ searchParams }: { searchParams: Promise<{ samo?: string }> }) {
  const [{ samo }, data] = await Promise.all([searchParams, deckData()])

  if (samo === 'objava' || samo === 'story') {
    const Art = samo === 'objava' ? SocialPost : SocialStory
    return (
      <div style={{ background: '#070708', minHeight: '100dvh' }}>
        <Art data={data.poster} width="100vw" />
      </div>
    )
  }

  return (
    <div className="print-page" style={{ ['--w' as string]: 'min(44vw, calc((100dvh - 150px) / 1.7778))' }}>
      <PromoToolbar
        active="/prezentacija/objava"
        title="Objava 4:5 i story 9:16 · Instagram, Facebook, WhatsApp status"
        hint="Za tačan PNG otvori ?samo=objava ili ?samo=story u prozoru 1080 piksela širine."
        print={false}
      />
      <div className="flex flex-wrap items-start justify-center gap-8 px-6 pb-16 pt-6">
        <figure className="flex flex-col items-center gap-3">
          <SocialPost data={data.poster} width="calc(var(--w) * 1.4222)" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }} />
          <figcaption className="text-[12px] uppercase tracking-[0.2em] text-white/45">
            Objava · 1080 × 1350 ·{' '}
            <a className="text-[#BFA87F] underline-offset-4 hover:underline" href="/prezentacija/objava?samo=objava" target="_blank">
              samo slika
            </a>
          </figcaption>
        </figure>
        <figure className="flex flex-col items-center gap-3">
          <SocialStory data={data.poster} width="var(--w)" style={{ boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }} />
          <figcaption className="text-[12px] uppercase tracking-[0.2em] text-white/45">
            Story · 1080 × 1920 ·{' '}
            <a className="text-[#BFA87F] underline-offset-4 hover:underline" href="/prezentacija/objava?samo=story" target="_blank">
              samo slika
            </a>
          </figcaption>
        </figure>
      </div>
    </div>
  )
}
