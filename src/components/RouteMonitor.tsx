import { useState } from 'react'
import type { TranStarCorridor } from '@/types'
import { CorridorDetail } from '@/components/CorridorDetail'

function corridorStatus(c: TranStarCorridor): { dot: string; bg: string } {
  if (c.travelMin < 0) return { dot: 'bg-[#4a5a72]', bg: '' }
  if (c.delayMin <= 1)  return { dot: 'bg-emerald-400', bg: 'bg-emerald-500/[0.04]' }
  if (c.delayMin <= 4)  return { dot: 'bg-yellow-400',  bg: 'bg-yellow-500/[0.04]' }
  if (c.delayMin <= 9)  return { dot: 'bg-orange-400',  bg: 'bg-orange-500/[0.04]' }
  return                       { dot: 'bg-red-400',     bg: 'bg-red-500/[0.04]' }
}

interface RouteMonitorProps {
  corridors: TranStarCorridor[]
  loading: boolean
  onCameraSelect: (id: string) => void
}

export function RouteMonitor({ corridors, loading, onCameraSelect }: RouteMonitorProps) {
  const [selected, setSelected] = useState<TranStarCorridor | null>(null)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px]">⚽</span>
          <span className="text-[9px] font-mono tracking-[0.12em] text-[#7a8ba8] uppercase">NRG Stadium Route Monitor</span>
        </div>
        <span className="text-[7px] font-mono text-[#4a5a72]">TranStar</span>
      </div>

      {/* Corridor rows */}
      <div className="flex-1 overflow-hidden px-2 py-1.5 flex flex-col gap-0.5">
        {loading && corridors.length === 0 && (
          <div className="text-[9px] font-mono text-[#4a5a72] text-center py-2">Loading routes…</div>
        )}
        {corridors.map((c, i) => {
          const st = corridorStatus(c)
          const noData = c.travelMin < 0
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelected(c)}
              title="Click for segment detail"
              className={[
                'w-full flex items-center gap-2 px-2 py-1 rounded transition-colors hover:bg-white/[0.05] cursor-pointer',
                st.bg,
              ].join(' ')}
            >
              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${st.dot}`} />
              <span className="text-[8px] font-mono text-[#c8d6e8] flex-1 truncate text-left">{c.label}</span>
              <span className="text-[7px] font-mono text-[#4a5a72] w-5 text-right">{c.dir}</span>
              <span className="text-[8px] font-mono font-bold text-[#e8edf5] w-8 text-right">
                {noData ? '—' : `${c.travelMin}m`}
              </span>
              <span className={`text-[7px] font-mono w-14 text-right tabular-nums ${
                noData ? 'text-[#4a5a72]' :
                c.delayMin > 0 ? 'text-orange-400' : 'text-emerald-500'
              }`}>
                {noData ? 'no data' : c.delayMin > 0 ? `+${c.delayMin}m dly` : 'on time'}
              </span>
            </button>
          )
        })}
      </div>

      {selected && (
        <CorridorDetail
          corridor={selected}
          onClose={() => setSelected(null)}
          onCameraSelect={onCameraSelect}
        />
      )}
    </div>
  )
}
