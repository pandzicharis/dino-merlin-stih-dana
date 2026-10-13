/**
 * Znak izdavača (Magaza). SVG je crn, pa se boji kroz CSS masku — ista
 * datoteka radi na tamnoj i svijetloj podlozi, u bilo kojoj boji.
 */
export function MagazaLogo({
  height = 14,
  color = 'currentColor',
  className,
}: {
  height?: number
  color?: string
  className?: string
}) {
  const mask = 'url(/brand/magaza.svg) center / contain no-repeat'
  return (
    <span
      role="img"
      aria-label="Magaza"
      className={`inline-block ${className ?? ''}`}
      style={{
        height,
        width: Math.round((height * 316) / 87),
        background: color,
        mask,
        WebkitMask: mask,
      }}
    />
  )
}
