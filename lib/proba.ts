import { isValidISODate } from './date'

/**
 * Proba opterećenja za push (scripts/proba-5000.mjs) — sve što pravi kod
 * treba znati o lažnim pretplatama, na jednom mjestu.
 *
 * Lažna pretplata nosi svoje ponašanje u adresi i vodi na lažni push servis
 * na istom deployu (app/api/proba-push):
 *
 *   https://<test-deploy>/api/proba-push?id=17&tip=prolazno&p=<oznaka>
 *
 * Proba ide direktno na produkciju (radi i na previewu), pa je sve iza
 * ključa: prijava lažne adrese, slanje probe, izvještaj i čišćenje traže
 * `CRON_SECRET`, a lažni push servis prima samo poruke potpisane našim
 * VAPID ključem. Lokalno (`next dev`) je sve isključeno.
 *
 * Baza drži pravo slanje i probu potpuno odvojeno (`p_proba`,
 * supabase/schema.sql): pravi korisnici ne mogu dobiti probnu obavijest, a
 * lažni pravu. Dan probe je izmišljen (2099-…), pa ne dira ni oznaku dana.
 */

export const PROBA_PATH = '/api/proba-push'

export const TIPOVI = ['ok', 'sporo', 'prolazno', 'gust', 'mrtva', 'visi'] as const
export type Tip = (typeof TIPOVI)[number]

/** Na Vercelu (produkcija i preview) da, lokalno ne. */
export function probaOn(): boolean {
  const env = process.env.VERCEL_ENV
  return env === 'production' || env === 'preview'
}

/** Oznaka jedne probe. Samo mala slova i brojevi — u SQL ide bez ikakvog escapeanja. */
export function isOznaka(s: unknown): s is string {
  return typeof s === 'string' && /^[a-z0-9]{6,32}$/.test(s)
}

/** Ista tajna kao za slanje: `x-cron-secret` ili `Authorization: Bearer`. */
export function hasCronSecret(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return req.headers.get('x-cron-secret') === secret || req.headers.get('authorization') === `Bearer ${secret}`
}

/**
 * Adrese ovog deploya. `req.url` na Vercelu zna biti i localhost (vidi
 * `selfOrigin` u ruti za slanje), pa se uzima sve pod čim nas zovu.
 */
export function ownOrigins(req: Request): string[] {
  const out = new Set<string>()
  const add = (raw: string | null | undefined) => {
    if (!raw) return
    try {
      out.add(new URL(raw.includes('://') ? raw : `https://${raw}`).origin)
    } catch {
      /* neispravno — preskoči */
    }
  }
  add(req.url)
  add(req.headers.get('x-forwarded-host')?.split(',')[0].trim())
  add(req.headers.get('host'))
  add(process.env.VERCEL_URL)
  add(process.env.VERCEL_BRANCH_URL)
  add(process.env.VERCEL_PROJECT_PRODUCTION_URL)
  add(process.env.NEXT_PUBLIC_SITE_URL)
  return [...out]
}

/**
 * Lažna adresa — tačno ovog oblika i samo prema ovom deployu, da aplikacija
 * ne postane generator zahtjeva na tuđe adrese. `p` mora biti zadnji: po
 * tom kraju adrese baza razdvaja probe.
 */
export function parseProbaEndpoint(raw: unknown, origins: string[]): { id: number; tip: Tip; p: string } | null {
  if (typeof raw !== 'string' || raw.length > 300) return null
  const m = /^(https:\/\/[^/?#]+)\/api\/proba-push\?id=(\d{1,7})&tip=([a-z]+)&p=([a-z0-9]{6,32})$/.exec(raw)
  if (!m || !origins.includes(m[1]) || !(TIPOVI as readonly string[]).includes(m[3])) return null
  return { id: Number(m[2]), tip: m[3] as Tip, p: m[4] }
}

/** Tip iz lažne adrese (za izvještaj). */
export function probaTip(endpoint: string): Tip | null {
  const t = /[?&]tip=([a-z]+)/.exec(endpoint)?.[1]
  return t && (TIPOVI as readonly string[]).includes(t) ? (t as Tip) : null
}

/** Izmišljen dan probe — samo 2099-MM-DD, da se nikad ne sudari s pravim danom. */
export function probaDay(raw: string | null | undefined): string | null {
  return raw && /^2099-\d{2}-\d{2}$/.test(raw) && isValidISODate(raw) ? raw : null
}

/** Glumljeni sarajevski sat (0–23). */
export function probaHour(raw: string | null): number | null {
  if (raw === null || !/^\d{1,2}$/.test(raw)) return null
  const h = Number(raw)
  return h <= 23 ? h : null
}

/**
 * Produkcija je javna, ali preview je obično iza Vercelove prijave
 * (Deployment Protection). Pozivi koje deploy upućuje sam sebi — workeri i
 * lažni push servis — tad nose zaobilaznicu, ako je u projektu uključena:
 * Settings → Deployment Protection → Protection Bypass for Automation.
 * Vercel je sam ubaci u okruženje deploya; u kodu i bazi je nema.
 */
export function bypassHeaders(): Record<string, string> | undefined {
  const s = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
  return probaOn() && s ? { 'x-vercel-protection-bypass': s } : undefined
}
