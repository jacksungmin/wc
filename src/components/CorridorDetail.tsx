import { useState } from 'react'
import { X } from 'lucide-react'
import type { TranStarCorridor } from '@/types'
import { ALL_CAMERAS } from '@/data/cameras'

type DetailTab = 'travel' | 'cameras'

function fmtSecs(s: number): string {
  if (s < 0) return '—'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec === 0 ? `${m}m` : `${m}m ${sec}s`
}

function delayColor(d: number): string {
  if (d <= 60)  return 'text-emerald-400'
  if (d <= 120) return 'text-yellow-400'
  if (d <= 300) return 'text-orange-400'
  return 'text-red-400'
}

function dirFull(dir: string): string {
  const map: Record<string, string> = { WB: 'Westbound', EB: 'Eastbound', NB: 'Northbound', SB: 'Southbound' }
  return map[dir] ?? dir
}

interface Props {
  corridor: TranStarCorridor
  onClose: () => void
  onCameraSelect: (id: string) => void
}

export function CorridorDetail({ corridor, onClose, onCameraSelect }: Props) {
  const [tab, setTab] = useState<DetailTab>('travel')

  const cameras = corridor.camHighway
    ? ALL_CAMERAS.filter(c => c.highway === corridor.camHighway)
    : []

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'travel',  label: 'Travel Times' },
    { id: 'cameras', label: `Cameras (${cameras.length})` },
  ]

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#09101e] border border-white/[0.12] rounded-lg shadow-2xl w-full max-w-[520px] max-h-[72vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
          <div>
            <div className="text-[12px] font-semibold text-[#e8edf5] tracking-wide">
              {corridor.label}
              <span className="text-[#4a5a72] font-normal mx-1.5">·</span>
              {dirFull(corridor.dir)}
            </div>
            <div className="text-[9px] font-mono text-[#4a5a72] mt-0.5 flex items-center gap-2">
              {corridor.travelMin > 0 && <span>{corridor.travelMin} min total</span>}
              {corridor.avgSpeed > 0 && (
                <><span className="text-white/20">·</span><span>avg {corridor.avgSpeed} mph</span></>
              )}
              {corridor.delayMin > 0 && (
                <><span className="text-white/20">·</span><span className="text-orange-400">+{corridor.delayMin}m delay</span></>
              )}
              {corridor.travelMin < 0 && <span>No live data</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4a5a72] hover:text-[#e8edf5] transition-colors p-1 rounded ml-3 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-white/[0.06] flex-shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                'flex-1 py-2 text-[7.5px] font-mono tracking-[0.08em] uppercase transition-colors',
                tab === t.id
                  ? 'text-violet-400 border-b-2 border-violet-400 -mb-px'
                  : 'text-[#4a5a72] hover:text-[#7a8ba8]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">

          {/* Travel Times */}
          {tab === 'travel' && (
            <div className="p-3">
              {corridor.segments.length === 0 ? (
                <div className="text-[9px] font-mono text-[#4a5a72] text-center py-6">
                  No segment data available for this corridor
                </div>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2 pr-2">Segment</th>
                        <th className="text-right text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2 pr-2">Speed</th>
                        <th className="text-right text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2 pr-2">Travel</th>
                        <th className="text-right text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2">Delay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corridor.segments.map((seg, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="py-1.5 pr-3 text-[9px] text-[#c8d6e8] leading-tight">{seg.ft}</td>
                          <td className="py-1.5 pr-2 text-right text-[9px] font-mono text-[#7a8ba8] tabular-nums whitespace-nowrap">
                            {seg.speedMph > 0 ? `${seg.speedMph} mph` : '—'}
                          </td>
                          <td className="py-1.5 pr-2 text-right text-[9px] font-mono text-[#c8d6e8] tabular-nums whitespace-nowrap">
                            {fmtSecs(seg.travelSec)}
                          </td>
                          <td className={`py-1.5 text-right text-[9px] font-mono tabular-nums whitespace-nowrap ${delayColor(seg.delaySec)}`}>
                            {seg.delaySec > 60 ? `+${fmtSecs(seg.delaySec)}` : 'on time'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-3 pt-2 border-t border-white/[0.04]">
                    TranStar Travel Time Monitoring System · refreshes every 60s
                  </div>
                </>
              )}
            </div>
          )}

          {/* Cameras */}
          {tab === 'cameras' && (
            <div className="p-3">
              {cameras.length === 0 ? (
                <div className="text-[9px] font-mono text-[#4a5a72] text-center py-6">
                  No cameras available for this corridor
                </div>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {cameras.map(cam => (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => { onCameraSelect(cam.id); onClose() }}
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/30 transition-colors group"
                      >
                        <span className="text-[16px] flex-shrink-0">📷</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-medium text-[#c8d6e8] truncate">{cam.name}</div>
                          <div className="text-[8px] font-mono text-[#4a5a72] mt-0.5">
                            {cam.direction} · {cam.highway}
                          </div>
                        </div>
                        <span className="text-[8px] font-mono text-[#4a5a72] group-hover:text-violet-400 transition-colors flex-shrink-0">
                          View →
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-3 pt-2 border-t border-white/[0.04]">
                    Click a camera to open its live feed in the main panel
                  </div>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
