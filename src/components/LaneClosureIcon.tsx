const TRIANGLE_POINTS = '16,3 31,29 1,29'

function iconColor(hotspot: boolean, selected: boolean) {
  return selected ? '#2563eb' : hotspot ? '#f59e0b' : '#d97706'
}

export function laneClosureIconMarkup(hotspot: boolean, selected = false, size = selected ? 28 : 22) {
  const color = iconColor(hotspot, selected)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" style="cursor:pointer;filter:drop-shadow(0 0 ${selected ? 6 : 3}px ${color}90) drop-shadow(0 2px 4px rgba(0,0,0,.5))">
    <polygon points="${TRIANGLE_POINTS}" fill="${color}" stroke="rgba(255,255,255,0.92)" stroke-width="2.2" stroke-linejoin="round"/>
    <text x="16" y="24" text-anchor="middle" font-family="Inter,Arial,sans-serif" font-weight="800" font-size="${selected ? 13 : 11}" fill="rgba(255,255,255,0.95)">!</text>
  </svg>`
}

export function LaneClosureIcon({ hotspot, selected = false, size = 18 }: {
  hotspot: boolean
  selected?: boolean
  size?: number
}) {
  const color = iconColor(hotspot, selected)
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 32 32"
      className="flex-shrink-0"
      style={{ filter: `drop-shadow(0 0 ${selected ? 4 : 2}px ${color}90) drop-shadow(0 1px 2px rgba(0,0,0,.5))` }}
    >
      <polygon points={TRIANGLE_POINTS} fill={color} stroke="rgba(255,255,255,0.92)" strokeWidth="2.2" strokeLinejoin="round" />
      <text x="16" y="24" textAnchor="middle" fontFamily="Inter,Arial,sans-serif" fontWeight="800" fontSize={selected ? 13 : 11} fill="rgba(255,255,255,0.95)">!</text>
    </svg>
  )
}
