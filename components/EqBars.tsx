/** Trake koje titraju kao muzika (stoje dok je pauza). Malo — i u zaglavlju početne. */
export function EqBars({ accent, on, h = 12 }: { accent: string; on: boolean; h?: number }) {
  return (
    <span className="flex items-end gap-[2px]" style={{ height: h }} aria-hidden>
      {[0, 0.32, 0.12, 0.46].map((d, i) => (
        <span
          key={i}
          className="eq-bar block w-[2px] rounded-full"
          style={{ background: accent, animationDelay: `${d}s`, animationPlayState: on ? 'running' : 'paused' }}
        />
      ))}
    </span>
  )
}
