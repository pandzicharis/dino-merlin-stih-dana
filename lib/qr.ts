import QRCode from 'qrcode'

/** Moduli QR koda kao niz '1'/'0', red po red — lako se šalje klijentu. */
export type QrMatrix = { size: number; bits: string }

/**
 * Računa se na serveru; klijent dobije samo matricu i sam je nacrta
 * (`components/deck/QrCode.tsx`), pa biblioteka ne ide u bundle.
 *
 * Nivo korekcije H (~30%) — sredina koda se prekriva potpisom, a odštampan
 * plakat zna biti i izgreban i pod odsjajem izloga.
 */
export function qrMatrix(text: string): QrMatrix {
  const { size, data } = QRCode.create(text, { errorCorrectionLevel: 'H' }).modules
  let bits = ''
  for (let i = 0; i < size * size; i++) bits += data[i] ? '1' : '0'
  return { size, bits }
}
