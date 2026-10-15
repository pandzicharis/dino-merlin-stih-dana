import { DECK_VERSE } from './deck'

/**
 * Pregled linka (WhatsApp, Viber, Facebook, Instagram bio): zajedničko za
 * početnu i za stihove — Next metadata spaja plitko, pa svaka stranica
 * mora nositi cijeli `openGraph`.
 */
export const OG_BASE = { siteName: 'Stih dana', locale: 'bs_BA', type: 'website' } as const

/**
 * Slika za početni link (QR na plakatu, bio Magaze): uvijek isti stih —
 * aplikacije pamte pregled po adresi, pa bi dnevni stih ostao zamrznut
 * na onom koji je prvi uhvaćen.
 */
export const HOME_IMAGE = {
  url: `/og/${DECK_VERSE}/post`,
  width: 1080,
  height: 1080,
  alt: 'Stih dana — Dino Merlin',
}
