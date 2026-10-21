/**
 * ZASTOR DOK SE NE ZNA IMA LI NOVA OBAVIJEST.
 *
 * Oznaku "stigla je obavijest" drži service worker u kešu, a keš se čita
 * asinhrono — stranica bi zato prvo pokazala (već viđen) stih, pa tek onda
 * tombolu. Kad obavijest MOŽE čekati (poslije podneva, obavijesti uključene,
 * današnja još nije izvučena), ekran se prekrije bojom tombole PRIJE prvog
 * kadra: na hladnom startu skripta u <head> (CEKAJ_SCRIPT), pri povratku u
 * aplikaciju odmah na `visibilitychange`. Provjera ga onda ili pretvori u
 * tombolu, ili skine za par milisekundi. Ispod je tombole i kapije
 * (globals.css `html[data-cekaj]`).
 */

import { SEND_HOUR, TZ, verseDayInTz } from './date'

/** dan za koji je obavijest već izvučena (tombola poslije podneva) */
const DONE = 'stihdana:obavijestDan'
/** boja zastora — podloga zadnje tombole, da prelaz ne trepne */
const BG = 'stihdana:cekajBg'

function hourInTz(): number {
  return Number(new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
}

/** Može li sad čekati nepročitana obavijest — sinhrono, bez keša. */
export function mayWait(): boolean {
  try {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
    if (localStorage.getItem('stihdana:notify') === 'false') return false
    return hourInTz() >= SEND_HOUR && !handledToday()
  } catch {
    return false
  }
}

let safety = 0
export function cover() {
  document.documentElement.dataset.cekaj = ''
  // nikad ne ostaje zaglavljen: ako se tombola nije pokrenula, makni ga
  clearTimeout(safety)
  safety = window.setTimeout(() => {
    if (!document.querySelector('[data-izvlacenje]')) uncover()
  }, 3500)
}

export function uncover() {
  delete document.documentElement.dataset.cekaj
}

/** dan kad je obavijest izvučena (oznaka obrisana poslije tombole) — u bilo koje doba */
const USED = 'stihdana:obavijestIzvucena'

/** Tombola s obavijesti je završena — oznaka za danas je potrošena. */
export function markUsed(day: string) {
  try {
    localStorage.setItem(USED, day)
  } catch {
    /* privatni prozor */
  }
}

/**
 * Današnja obavijest je već izvučena — tombola poslije podneva ili tombola s
 * obavijesti. Jedna tombola s obavijesti na dan, nikad dvije.
 */
export function handledToday(day = verseDayInTz()): boolean {
  try {
    return localStorage.getItem(DONE) === verseDayInTz() || localStorage.getItem(USED) === day
  } catch {
    return false
  }
}

/** Tombola poslije podneva je izvučena — danas više nema zastora. */
export function markHandled() {
  try {
    if (hourInTz() >= SEND_HOUR) localStorage.setItem(DONE, verseDayInTz())
  } catch {
    /* privatni prozor */
  }
}

/** Boja zastora = podloga tombole (mood stiha), i za sljedeći hladan start. */
export function setCoverColor(bg: string) {
  document.documentElement.style.setProperty('--cekaj', bg)
  try {
    localStorage.setItem(BG, bg)
  } catch {
    /* privatni prozor */
  }
}

/**
 * Isto kao `mayWait` + `cover`, kao skripta u <head>: prije prvog kadra.
 * Dodir na obavijest otvara `/?izvuci` — tad uvijek. Ne u prezentaciji
 * (telefon u njoj je iframe; OS_SCRIPT prije ovoga postavi `data-deck`).
 */
export const CEKAJ_SCRIPT = `try{var d=document.documentElement;if(location.pathname==='/'&&!('deck' in d.dataset)){var ok=/[?&]izvuci/.test(location.search);if(!ok&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&localStorage.getItem('stihdana:notify')!=='false'){var n=new Date(),h=+new Intl.DateTimeFormat('en-GB',{timeZone:'${TZ}',hour:'2-digit',hourCycle:'h23'}).format(n),t=new Intl.DateTimeFormat('en-CA',{timeZone:'${TZ}'}).format(n);ok=h>=${SEND_HOUR}&&localStorage.getItem('${DONE}')!==t&&localStorage.getItem('${USED}')!==t}if(ok){var b=localStorage.getItem('${BG}');if(b)d.style.setProperty('--cekaj',b);d.dataset.cekaj='';setTimeout(function(){if(!document.querySelector('[data-izvlacenje]'))delete d.dataset.cekaj},4000)}}}catch(e){}`
