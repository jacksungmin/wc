import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import type { InrixIncident, TranStarIncident, TranStarLaneClosure } from '@/types'
import { LaneClosureIcon } from '@/components/LaneClosureIcon'

function parseIncidentTime(time: string, date: string): Date | null {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i)
  if (!match) return null
  let h = parseInt(match[1], 10)
  const m = parseInt(match[2], 10)
  if (match[3].toUpperCase() === 'PM' && h !== 12) h += 12
  else if (match[3].toUpperCase() === 'AM' && h === 12) h = 0
  const d = new Date()
  if (date?.toLowerCase() === 'yesterday') d.setDate(d.getDate() - 1)
  d.setHours(h, m, 0, 0)
  return d
}

function within2Hours(inc: TranStarIncident): boolean {
  const t = parseIncidentTime(inc.time, inc.date)
  if (!t) return true
  return Date.now() - t.getTime() <= 2 * 60 * 60 * 1000
}

function severityLabel(s: number): string {
  return s === 4 ? 'Critical' : s === 3 ? 'Major' : s === 2 ? 'Minor' : 'Low'
}

function severityStyle(s: number): string {
  return s === 4 ? 'bg-red-500/20 text-red-400' :
         s === 3 ? 'bg-orange-500/20 text-orange-400' :
         s === 2 ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/10 text-[#7a8ba8]'
}

function incidentEmoji(type: string): string {
  if (/accident|crash/i.test(type)) return '💥'
  if (/clos/i.test(type)) return '⛔'
  if (/construct|work/i.test(type)) return '🚧'
  if (/hazard|condition/i.test(type)) return '⚠️'
  if (/weather/i.test(type)) return '🌩'
  if (/event/i.test(type)) return '📍'
  return '🔴'
}

function transtarEmoji(desc: string): string {
  if (/stall/i.test(desc)) return '🚗'
  if (/accident|crash/i.test(desc)) return '💥'
  if (/fire/i.test(desc)) return '🔥'
  if (/debris/i.test(desc)) return '⚠️'
  if (/flood/i.test(desc)) return '🌊'
  return '🟣'
}

function formatIncidentTime(iso: string): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = (Date.now() - date.getTime()) / 60000
  if (diff < -5) return 'Scheduled'
  if (diff < 1) return 'just now'
  if (diff < 60) return `${Math.round(diff)}m ago`
  if (diff < 24 * 60) return `${Math.round(diff / 60)}h ago`
  if (diff < 48 * 60) return '1d ago'
  if (diff < 7 * 24 * 60) return `${Math.round(diff / 1440)}d ago`
  return `Since ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
}

function incidentTypeLabel(inc: InrixIncident): string {
  return [inc.type, inc.subType]
    .filter(part => part && !/^\d+$/.test(part))
    .join(' · ')
}

interface IncidentListProps {
  incidents: InrixIncident[]
  selectedId: string | null
  connected: boolean
  loading: boolean
  error: string | null
  lastUpdated: Date | null
  onSelect: (id: string | null) => void
  onRefresh: () => void
  transtarIncidents: TranStarIncident[]
  transtarLaneClosures: TranStarLaneClosure[]
  transtarConnected: boolean
  transtarLoading: boolean
  transtarError: string | null
  transtarLastUpdated: Date | null
  selectedTranStarId: string | null
  onTranStarSelect: (id: string | null) => void
  onTranStarRefresh: () => void
}

type Tab = 'inrix' | 'transtar'

export function IncidentList({
  incidents, selectedId, connected, loading, error, lastUpdated, onSelect, onRefresh,
  transtarIncidents, transtarLaneClosures, transtarConnected, transtarLoading, transtarError,
  transtarLastUpdated, selectedTranStarId, onTranStarSelect, onTranStarRefresh,
}: IncidentListProps) {
  const [tab, setTab] = useState<Tab>('transtar')
  const [filter2h, setFilter2h] = useState(true)
  const sorted = [...incidents].sort((a, b) => b.severity - a.severity)
  const visibleTranstarIncidents = filter2h
    ? transtarIncidents.filter(within2Hours)
    : transtarIncidents
  const transtarTotal = visibleTranstarIncidents.length + transtarLaneClosures.length

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-white/[0.06] flex-shrink-0">
        <button
          type="button"
          onClick={() => setTab('transtar')}
          className={[
            'flex-1 flex flex-col items-center justify-center px-2 py-1.5 transition-colors',
            tab === 'transtar'
              ? 'text-violet-400 border-b-2 border-violet-400 -mb-px'
              : 'text-[#4a5a72] hover:text-[#7a8ba8]',
          ].join(' ')}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${transtarConnected ? 'bg-green-400' : transtarLoading ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-[9px] font-mono tracking-[0.10em] uppercase">TranStar</span>
            {transtarTotal > 0 && (
              <span className="px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 text-[7px]">{transtarTotal}</span>
            )}
          </div>
          <span className="text-[7px] font-mono text-[#4a5a72] mt-0.5 normal-case tracking-normal">
            Incidents · Lane Closures
          </span>
        </button>
        <button
          type="button"
          onClick={() => setTab('inrix')}
          className={[
            'flex-1 flex flex-col items-center justify-center px-2 py-1.5 transition-colors',
            tab === 'inrix'
              ? 'text-orange-400 border-b-2 border-orange-400 -mb-px'
              : 'text-[#4a5a72] hover:text-[#7a8ba8]',
          ].join(' ')}
        >
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block flex-shrink-0 ${connected ? 'bg-green-400' : loading ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-[9px] font-mono tracking-[0.10em] uppercase">INRIX</span>
            {incidents.length > 0 && (
              <span className="px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 text-[7px]">{incidents.length}</span>
            )}
          </div>
          <span className="text-[7px] font-mono text-[#4a5a72] mt-0.5 normal-case tracking-normal">
            Traffic Incidents
          </span>
        </button>
      </div>

      {/* Refresh row */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-white/[0.04] flex-shrink-0">
        <span className="text-[8px] font-mono text-[#4a5a72]">
          {tab === 'inrix' ? '2-hour window · INRIX' : 'Live · 1 min refresh'}
        </span>
        <div className="flex items-center gap-2">
          {tab === 'transtar' && (
            <button
              type="button"
              onClick={() => setFilter2h(f => !f)}
              title={filter2h ? 'Showing incidents from last 2 hours — click to show all' : 'Click to filter to last 2 hours'}
              className={[
                'text-[7px] font-mono px-1.5 py-0.5 rounded border transition-colors',
                filter2h
                  ? 'border-violet-500/40 bg-violet-500/10 text-violet-400'
                  : 'border-white/[0.08] bg-white/[0.02] text-[#4a5a72] hover:text-[#7a8ba8]',
              ].join(' ')}
            >
              2h filter
            </button>
          )}
          <button
            type="button"
            onClick={tab === 'inrix' ? onRefresh : onTranStarRefresh}
            className="text-[#4a5a72] hover:text-[#7a8ba8] transition-colors"
            title="Refresh"
          >
            <RefreshCw size={10} className={(tab === 'inrix' ? loading : transtarLoading) ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {tab === 'inrix' && (
          <>
            {error && !connected && (
              <div className="text-[9px] font-mono text-red-400/80 bg-red-950/20 border border-red-500/20 rounded p-2 mb-2">
                {error}
              </div>
            )}
            {loading && incidents.length === 0 && (
              <div className="text-[9px] font-mono text-[#4a5a72] text-center py-3">Connecting to INRIX…</div>
            )}
            {!loading && incidents.length === 0 && connected && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-500 py-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                No incidents near NRG Stadium
              </div>
            )}
            {sorted.map(inc => (
              <button
                key={inc.id}
                type="button"
                onClick={() => onSelect(inc.id === selectedId ? null : inc.id)}
                className={[
                  'w-full text-left mb-1.5 p-2 rounded border transition-colors',
                  inc.id === selectedId
                    ? 'border-blue-400/50 bg-blue-500/10'
                    : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-1 mb-0.5">
                  <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[11px] flex-shrink-0">{incidentEmoji(inc.type)}</span>
                    <span className="text-[9px] font-medium text-[#c8d6e8] truncate">{inc.shortDesc}</span>
                  </div>
                  <span className={`text-[7px] font-mono px-1 py-0.5 rounded flex-shrink-0 ${severityStyle(inc.severity)}`}>
                    {severityLabel(inc.severity)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {incidentTypeLabel(inc) && (
                    <span className="text-[8px] font-mono text-[#4a5a72] truncate">{incidentTypeLabel(inc)}</span>
                  )}
                  {inc.startTime && (
                    <span className="text-[7px] font-mono text-[#4a5a72] flex-shrink-0">{formatIncidentTime(inc.startTime)}</span>
                  )}
                </div>
              </button>
            ))}
            {lastUpdated && (
              <div className="text-[7px] font-mono text-[#4a5a72] text-center pt-1">
                Updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </>
        )}

        {tab === 'transtar' && (
          <>
            {transtarError && !transtarConnected && (
              <div className="text-[9px] font-mono text-red-400/80 bg-red-950/20 border border-red-500/20 rounded p-2 mb-2">
                {transtarError}
              </div>
            )}
            {transtarLoading && transtarTotal === 0 && (
              <div className="text-[9px] font-mono text-[#4a5a72] text-center py-3">Connecting to TranStar…</div>
            )}
            {!transtarLoading && transtarTotal === 0 && transtarConnected && (
              <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-500 py-2 px-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                {filter2h && transtarIncidents.length > visibleTranstarIncidents.length
                  ? 'No incidents in last 2 hours'
                  : 'No active incidents or closures in the current map extent'}
              </div>
            )}

            <div className="flex items-center gap-1.5 text-[8px] font-mono text-[#4a5a72] uppercase tracking-[0.12em] mb-1 px-1">
              <span>Incidents in Map · {visibleTranstarIncidents.length}</span>
              {filter2h && transtarIncidents.length > visibleTranstarIncidents.length && (
                <span className="normal-case tracking-normal text-[7px] text-[#4a5a72]">
                  ({transtarIncidents.length - visibleTranstarIncidents.length} older hidden)
                </span>
              )}
            </div>
            {visibleTranstarIncidents.length === 0 && transtarLaneClosures.length > 0 && !transtarLoading && (
              <div className="text-[8px] font-mono text-[#4a5a72] px-2 py-2 rounded border border-white/[0.05] bg-white/[0.02]">
                No incidents in the current map extent
              </div>
            )}
            {visibleTranstarIncidents.map(inc => (
              <button
                key={inc.id}
                type="button"
                onClick={() => onTranStarSelect(inc.id === selectedTranStarId ? null : inc.id)}
                className={[
                  'w-full text-left mb-1.5 p-2 rounded border transition-colors',
                  inc.id === selectedTranStarId
                    ? 'border-violet-400/50 bg-violet-500/10'
                    : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <span className="text-[11px] flex-shrink-0">{transtarEmoji(inc.desc)}</span>
                  <span className="text-[9px] font-medium text-[#c8d6e8] truncate">{inc.desc || 'Incident'}</span>
                  {inc.status && (
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-violet-500/20 text-violet-400 flex-shrink-0 ml-auto">
                      {inc.status}
                    </span>
                  )}
                </div>
                <div className="text-[8px] font-mono text-[#4a5a72] truncate">{inc.location}</div>
                {inc.time && (
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-0.5">{inc.time}</div>
                )}
              </button>
            ))}

            <div className="text-[8px] font-mono text-[#4a5a72] uppercase tracking-[0.12em] mt-2 mb-1 px-1">
              Lane Closures in Map · {transtarLaneClosures.length}
            </div>
            {transtarLaneClosures.length === 0 && visibleTranstarIncidents.length > 0 && !transtarLoading && (
              <div className="text-[8px] font-mono text-[#4a5a72] px-2 py-2 rounded border border-white/[0.05] bg-white/[0.02]">
                No lane closures in the current map extent
              </div>
            )}
            {transtarLaneClosures.map(lc => (
              <button
                key={lc.id}
                type="button"
                onClick={() => onTranStarSelect(lc.id === selectedTranStarId ? null : lc.id)}
                className={[
                  'w-full text-left mb-1.5 p-2 rounded border transition-colors',
                  lc.id === selectedTranStarId
                    ? 'border-amber-400/50 bg-amber-500/10'
                    : 'border-white/[0.05] bg-white/[0.02] hover:bg-white/[0.04]',
                ].join(' ')}
              >
                <div className="flex items-center gap-1 mb-0.5">
                  <LaneClosureIcon hotspot={lc.hotspot} selected={lc.id === selectedTranStarId} />
                  <span className="text-[9px] font-medium text-[#c8d6e8] truncate">{lc.roadway || lc.location}</span>
                  {lc.hotspot && (
                    <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0 ml-auto">
                      Hotspot
                    </span>
                  )}
                </div>
                <div className="text-[8px] font-mono text-[#4a5a72] truncate">{lc.location}</div>
                {(lc.lanes || lc.agency) && (
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-0.5">
                    {[lc.lanes, lc.agency].filter(Boolean).join(' · ')}
                  </div>
                )}
                {lc.endTime && (
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-0.5">Until {lc.endTime}</div>
                )}
              </button>
            ))}

            {transtarLastUpdated && (
              <div className="text-[7px] font-mono text-[#4a5a72] text-center pt-1">
                Updated {transtarLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
