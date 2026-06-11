import { Bus, RefreshCw } from 'lucide-react'
import type { MetroTripUpdate } from '@/types'

function formatDelay(seconds: number | null): { label: string; className: string } {
  if (seconds == null) return { label: 'scheduled', className: 'text-[#7a8ba8]' }
  const minutes = Math.round(seconds / 60)
  if (minutes <= 0) return { label: 'on time', className: 'text-emerald-400' }
  if (minutes < 5) return { label: `+${minutes}m`, className: 'text-amber-400' }
  return { label: `+${minutes}m`, className: 'text-orange-400' }
}

function formatArrival(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

function directionLabel(directionId?: number): string {
  if (directionId === 0) return 'Outbound'
  if (directionId === 1) return 'Inbound'
  return 'Direction --'
}

function routeLabel(update: MetroTripUpdate): string {
  const shortName = update.routeShortName || update.routeId
  return update.routeLongName ? `${shortName} - ${update.routeLongName}` : `Route ${shortName}`
}

function railLineColor(update: MetroTripUpdate): string | null {
  const rail = update.routeType === 0 || update.routeType === 1 || update.routeType === 2
  if (!rail) return null
  const long = (update.routeLongName ?? '').toLowerCase()
  const id   = (update.routeShortName ?? update.routeId ?? '').toLowerCase()
  if (long.includes('red')    || id.includes('red'))    return '#CC1030'
  if (long.includes('green')  || id.includes('green'))  return '#007A33'
  if (long.includes('purple') || id.includes('purple')) return '#5C2882'
  return '#6b21a8'
}

interface MetroTransitPanelProps {
  updates: MetroTripUpdate[]
  selectedId: string | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onSelect: (id: string | null) => void
  onRefresh: () => void
}

export function MetroTransitPanel({ updates, selectedId, loading, error, lastUpdated, onSelect, onRefresh }: MetroTransitPanelProps) {
  const visible = updates
    .sort((a, b) => {
      const aTime = a.arrivalTime ? new Date(a.arrivalTime).getTime() : Number.MAX_SAFE_INTEGER
      const bTime = b.arrivalTime ? new Date(b.arrivalTime).getTime() : Number.MAX_SAFE_INTEGER
      return aTime - bTime
    })
    .slice(0, 12)
  const routeCount = new Set(updates.map(update => update.routeId).filter(Boolean)).size

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bus size={13} className="text-[#7a8ba8] flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] font-mono tracking-[0.12em] text-[#7a8ba8] uppercase">METRO Live Bus Transit To/From NRG Stadium</div>
            <div className="text-[10px] text-[#e8edf5] truncate">
              {routeCount} route{routeCount !== 1 ? 's' : ''} / {updates.length} trips
            </div>
          </div>
        </div>
        <button
          onClick={onRefresh}
          className="text-[#4a5a72] hover:text-[#7a8ba8] transition-colors"
          title="Refresh METRO transit"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {error && (
          <div className="text-[9px] font-mono text-red-400/80 bg-red-950/20 border border-red-500/20 rounded p-2 mb-2">
            {error}
          </div>
        )}

        {loading && visible.length === 0 && (
          <div className="text-[9px] font-mono text-[#4a5a72] text-center py-3">
            Loading METRO feed...
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="text-[9px] font-mono text-[#4a5a72] text-center py-3">
            No active trip updates
          </div>
        )}

        {visible.map(update => {
          const delay = formatDelay(update.delaySeconds)
          const lineColor = railLineColor(update)
          return (
            <button
              key={update.id}
              type="button"
              onClick={() => onSelect(update.id === selectedId ? null : update.id)}
              className={[
                'w-full text-left mb-1.5 p-2 rounded border transition-colors',
                update.id === selectedId
                  ? 'border-cyan-400/50 bg-cyan-500/10'
                  : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                      style={lineColor
                        ? { background: lineColor + '28', color: lineColor, border: `1px solid ${lineColor}40` }
                        : { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.15)' }
                      }
                    >
                      {update.routeShortName || update.routeId}
                    </span>
                    <span className="text-[10px] text-[#e8edf5] font-medium truncate">
                      {routeLabel(update)}
                    </span>
                    {update.isScheduled && (
                      <span className="flex-shrink-0 text-[8px] font-mono px-1 py-0.5 rounded bg-white/[0.06] text-[#7a8ba8] border border-white/[0.08]">
                        SCHED
                      </span>
                    )}
                  </div>
                  <div className="text-[8px] font-mono text-[#4a5a72] mt-1 truncate">
                    {directionLabel(update.directionId)} / Trip {update.tripId}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] font-mono text-[#e8edf5]">{formatArrival(update.arrivalTime)}</div>
                  <div className={`text-[8px] font-mono ${delay.className}`}>{delay.label}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1.5 text-[8px] font-mono text-[#4a5a72]">
                <span className="truncate">
                  Stop {update.nextStopId ?? '--'}
                  {update.nextStopSequence != null ? ` / seq ${update.nextStopSequence}` : ''}
                </span>
                <span className="flex-shrink-0">
                  {update.positionSource === 'vehicle' ? 'vehicle map' : update.positionSource === 'stop' ? 'stop map' : 'no position'}
                </span>
                <span className="flex-shrink-0">{update.stopUpdates} updates</span>
              </div>
            </button>
          )
        })}

        {lastUpdated && (
          <div className="text-[7px] font-mono text-[#4a5a72] text-center pt-1">
            Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
          </div>
        )}
      </div>
    </div>
  )
}
