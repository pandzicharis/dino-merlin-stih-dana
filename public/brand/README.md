# Brand asseti — PLACEHOLDER

Fajlovi u ovom folderu preuzeti su sa **dinomerlin.com** i tu su isključivo
za privatni prototip koji se pokazuje njegovom timu.

| Fajl | Izvor | Status |
|---|---|---|
| `wordmark.svg` | `dinomerlin.com/assets/img/DinoMerlin.svg` | zaštićeni znak — traži odobrenje |
| `signature.webp` | rukom pisani potpis; pravi se iz `signature-src.png` sa `npm run brand:signature` | zaštićeni znak — traži odobrenje |
| `figure-mi.webp` | lik iz najave albuma „Mi“ (isti kao `gate.webp`); alfa izvučena iz luminacije pa se lik stapa s pozadinom | fotografija ima zasebnog autora |
| `gate.webp` | ista fotografija iz najave albuma „Mi“, bez natpisa — pozadina uvodnog ekrana | fotografija ima zasebnog autora |

## Prije bilo kakvog javnog launcha

Oba fajla moraju biti **zamijenjena licenciranim materijalom** ili
eksplicitno odobrena od njegovog tima. Fotografija nosi dva prava odjednom:
autora fotografije i lik osobe na njoj.

Aplikacija radi i bez njih:

- potpis i logotip: `components/Signature.tsx` sam pada nazad na tipografski
  ispis kad fajla nema, pa je dovoljno obrisati `signature.webp`
- portret se gasi postavljanjem `figure: 0` za svaki mood u `data/moods.ts`
  (pozadina ostaje gradijent + efekti) i brisanjem `<Splash />` iz
  `components/DailyVerse.tsx`

Isti razgovor u kojem tražiš dozvolu za stihove pokriva i ovo.

## Magaza

| Fajl | Izvor | Status |
|---|---|---|
| `magaza.svg` | `magaza.com.ba/assets/img/magaza_logo_20190410.svg`, bez „SARAJEVO“ ispod (samo riječ s potezom, 316×67) | znak izdavača — koristi se uz njihovo odobrenje |

SVG je crn; aplikacija ga boji preko CSS maske (`components/MagazaLogo.tsx`)
i na slici za dijeljenje preko canvasa.
