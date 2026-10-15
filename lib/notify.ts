/**
 * Dnevna obavijest — poziv, ne stih.
 *
 * Svako izvlači svoj stih (lib/draw.ts), a izvlačenje je ono što se čeka:
 * obavijest ga zato ne otkriva, nego zove. Dodir otvori aplikaciju i
 * papirići se zavrte. Poruka je ista za sve, pa server ne radi ništa po
 * čovjeku, a obavijest i aplikacija se ne mogu razići.
 */
export const INVITE = { title: 'Dino Merlin', body: 'Vrijeme je za stih dana! Uzmi svoj!' } as const
