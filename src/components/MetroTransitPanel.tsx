import { useState } from 'react'
import { Bus, ChevronDown, ChevronRight, Eye, EyeOff, RefreshCw, TrainFront } from 'lucide-react'
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
  return ''
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

function isRail(update: MetroTripUpdate) {
  return update.routeType === 0 || update.routeType === 1 || update.routeType === 2
}

function routeNumber(update: MetroTripUpdate): string {
  return String(update.routeShortName ?? update.routeId ?? '').replace(/^0+/, '')
}

export interface RouteGroup {
  id: string
  label: string
  icon: 'rail' | 'bus'
  routes: Set<string> | null  // null = rail (matched by routeType)
  defaultOpen: boolean
}

export const ROUTE_GROUPS: RouteGroup[] = [
  { id: 'rail',     label: 'METROrail',                  icon: 'rail', routes: null,                                                                  defaultOpen: false },
  { id: 'nrg',      label: 'Bus to NRG Stadium',         icon: 'bus',  routes: new Set(['8','11','14','60','73','84','87','211']),                     defaultOpen: false },
  { id: 'festival', label: 'Bus to Fan Festival',        icon: 'bus',  routes: new Set(['40','41']),                                                   defaultOpen: false },
  { id: 'airport',  label: 'Airport Routes to Downtown', icon: 'bus',  routes: new Set(['500','102','40']),                                            defaultOpen: false },
  { id: 'parkride', label: 'Park & Ride to Downtown',    icon: 'bus',  routes: new Set(['151','209','108','219','229','249','259','269']),              defaultOpen: false },
  { id: 'local',    label: 'Local Bus to Downtown',      icon: 'bus',  routes: new Set(['20','54','82','85','137']),                                   defaultOpen: false },
]

function getGroupTrips(updates: MetroTripUpdate[], group: RouteGroup): MetroTripUpdate[] {
  const filtered = updates.filter(u =>
    group.routes === null
      ? isRail(u)
      : !isRail(u) && group.routes!.has(routeNumber(u))
  )
  return filtered.sort((a, b) => {
    const aTime = a.arrivalTime ? new Date(a.arrivalTime).getTime() : Number.MAX_SAFE_INTEGER
    const bTime = b.arrivalTime ? new Date(b.arrivalTime).getTime() : Number.MAX_SAFE_INTEGER
    return aTime - bTime
  })
}

interface TripCardProps {
  update: MetroTripUpdate
  selected: boolean
  onSelect: (id: string | null) => void
}

function TripCard({ update, selected, onSelect }: TripCardProps) {
  const delay = formatDelay(update.delaySeconds)
  const lineColor = railLineColor(update)
  const dir = directionLabel(update.directionId)

  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? null : update.id)}
      className={[
        'w-full text-left mb-1 p-1.5 rounded border transition-colors',
        selected
          ? 'border-cyan-400/50 bg-cyan-500/10'
          : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]',
      ].join(' ')}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
            style={lineColor
              ? { background: lineColor + '28', color: lineColor, border: `1px solid ${lineColor}40` }
              : { background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.15)' }
            }
          >
            {update.routeShortName || update.routeId}
          </span>
          <span className="text-[9px] text-[#e8edf5] font-medium truncate">
            {routeLabel(update)}
          </span>
          {update.isScheduled && (
            <span className="flex-shrink-0 text-[7px] font-mono px-1 py-0.5 rounded bg-white/[0.06] text-[#7a8ba8] border border-white/[0.08]">
              SCHED
            </span>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-[9px] font-mono text-[#e8edf5]">{formatArrival(update.arrivalTime)}</div>
          <div className={`text-[8px] font-mono ${delay.className}`}>{delay.label}</div>
        </div>
      </div>
      {dir && (
        <div className="text-[7px] font-mono text-[#4a5a72] mt-0.5">{dir}</div>
      )}
    </button>
  )
}

interface MetroTransitPanelProps {
  updates: MetroTripUpdate[]
  selectedId: string | null
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onSelect: (id: string | null) => void
  onRefresh: () => void
  enabledGroups: Set<string>
  onToggleGroup: (id: string) => void
}

export function MetroTransitPanel({ updates, selectedId, loading, error, lastUpdated, onSelect, onRefresh, enabledGroups, onToggleGroup }: MetroTransitPanelProps) {
  const [openGroups, setOpenGroups] = useState<Set<string>>(
    () => new Set(ROUTE_GROUPS.filter(g => g.defaultOpen).map(g => g.id))
  )

  const toggleGroup = (id: string) => {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  const routeCount = new Set(updates.map(u => u.routeId).filter(Boolean)).size

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Bus size={13} className="text-[#7a8ba8] flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-[9px] font-mono tracking-[0.12em] text-[#7a8ba8] uppercase">METRO Live Transit — World Cup Houston 2026</div>
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

      <div className="flex-1 overflow-y-auto py-1.5 px-2">
        {error && (
          <div className="text-[9px] font-mono text-red-400/80 bg-red-950/20 border border-red-500/20 rounded p-2 mb-2">
            {error}
          </div>
        )}
        {loading && updates.length === 0 && (
          <div className="text-[9px] font-mono text-[#4a5a72] text-center py-3">Loading METRO feed...</div>
        )}

        {ROUTE_GROUPS.map(group => {
          const trips = getGroupTrips(updates, group)
          const isOpen = openGroups.has(group.id)

          const groupEnabled = enabledGroups.has(group.id)
          return (
            <div key={group.id} className="mb-1">
              <div className={`flex items-center px-1.5 py-1 rounded hover:bg-white/[0.04] transition-colors ${!groupEnabled ? 'opacity-50' : ''}`}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  className="flex-1 flex items-center justify-between gap-1.5 min-w-0"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {group.icon === 'rail'
                      ? <TrainFront size={9} className="text-[#7a8ba8] flex-shrink-0" />
                      : <Bus size={9} className="text-[#7a8ba8] flex-shrink-0" />
                    }
                    <span className="text-[8px] font-mono font-bold text-[#a0b0c8] uppercase tracking-[0.08em]">
                      {group.label}
                    </span>
                    {group.id === 'rail' && (
                      <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-amber-500/10 text-amber-400/70 border border-amber-500/20">
                        scheduled
                      </span>
                    )}
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-white/[0.07] text-[#7a8ba8] border border-white/[0.08]">
                      {trips.length}
                    </span>
                  </div>
                  {isOpen
                    ? <ChevronDown size={9} className="text-[#4a5a72] flex-shrink-0" />
                    : <ChevronRight size={9} className="text-[#4a5a72] flex-shrink-0" />
                  }
                </button>
                <button
                  type="button"
                  onClick={() => onToggleGroup(group.id)}
                  className="flex-shrink-0 ml-2 text-[#4a5a72] hover:text-[#7a8ba8] transition-colors"
                  title={groupEnabled ? 'Hide on map' : 'Show on map'}
                >
                  {groupEnabled
                    ? <Eye size={9} />
                    : <EyeOff size={9} />
                  }
                </button>
              </div>

              {isOpen && (
                <div className="mt-0.5 pl-1 border-l border-white/[0.06]">
                  {trips.length === 0 ? (
                    <div className="text-[8px] font-mono text-[#4a5a72] py-1.5 pl-1">No active trips</div>
                  ) : (
                    trips.map(update => (
                      <TripCard
                        key={update.id}
                        update={update}
                        selected={update.id === selectedId}
                        onSelect={onSelect}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
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
