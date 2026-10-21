// Pjesme su statični fajlovi (assets, `dist/`). Cloudflare ih sam ne daje u
// dijelovima (Range → cijeli fajl), a iPhone (Safari) zvuk traži u dijelovima
// (206). Zato za /audio/* ide prvo ovaj kod: uzme fajl i vrati tačno traženi
// dio, uz CORS (aplikacija je na drugoj adresi) — i odgovori na CORS provjeru.
const BASE = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges, Content-Encoding, ETag',
  'Accept-Ranges': 'bytes',
  'Cache-Control': 'public, max-age=604800, stale-while-revalidate=2592000',
}
const PREFLIGHT = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
  'Access-Control-Allow-Headers': 'Range',
  'Access-Control-Max-Age': '86400',
}

/** `bytes=a-b`, `bytes=a-`, `bytes=-n` → [od, do] unutar `size`; null ako se ne da ispuniti. */
function span(range, size) {
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (!m || (m[1] === '' && m[2] === '')) return null
  let from, to
  if (m[1] === '') {
    from = Math.max(0, size - Number(m[2]))
    to = size - 1
  } else {
    from = Number(m[1])
    to = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1)
  }
  return from <= to && from < size ? [from, to] : null
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: PREFLIGHT })
    if (request.method !== 'GET' && request.method !== 'HEAD') return new Response(null, { status: 405, headers: BASE })

    // cijeli fajl (bez Range i bez `?v=` — fajl je isti)
    const url = new URL(request.url)
    url.search = ''
    const res = await env.ASSETS.fetch(new Request(url, { method: 'GET' }))
    if (!res.ok) return new Response(res.body, { status: res.status, headers: BASE })

    const headers = { ...BASE, 'Content-Type': res.headers.get('content-type') || 'audio/mp4' }
    const etag = res.headers.get('etag')
    if (etag) headers.ETag = etag
    // fajl cijeli u memoriju (pjesma ~2 MB): asset ne javlja svoju veličinu,
    // a dio se onda samo izreže — bez čitanja toka bajt po bajt
    const buf = await res.arrayBuffer()
    const size = buf.byteLength
    const head = request.method === 'HEAD'
    const range = request.headers.get('range')

    if (!range) {
      headers['Content-Length'] = String(size)
      return new Response(head ? null : buf, { status: 200, headers })
    }
    const r = span(range, size)
    if (!r) return new Response(null, { status: 416, headers: { ...BASE, 'Content-Range': `bytes */${size}` } })
    const [from, to] = r
    headers['Content-Range'] = `bytes ${from}-${to}/${size}`
    headers['Content-Length'] = String(to - from + 1)
    return new Response(head ? null : buf.slice(from, to + 1), { status: 206, headers })
  },
}
