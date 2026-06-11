import { RefreshCw } from 'lucide-react'
import type { InrixIncident } from '@/types'

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
}

export function IncidentList({ incidents, selectedId, connected, loading, error, lastUpdated, onSelect, onRefresh }: IncidentListProps) {
  const sorted = [...incidents].sort((a, b) => b.severity - a.severity)

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full inline-block ${connected ? 'bg-green-400' : loading ? 'bg-amber-400 animate-pulse' : 'bg-red-500'}`}
            />
            <span className="text-[9px] font-mono tracking-[0.12em] text-[#7a8ba8] uppercase">INRIX Traffic (2 Hours)</span>
          </div>
          {incidents.length > 0 && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
              {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="text-[#4a5a72] hover:text-[#7a8ba8] transition-colors"
          title="Refresh traffic"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2">
        {error && !connected && (
          <div className="text-[9px] font-mono text-red-400/80 bg-red-950/20 border border-red-500/20 rounded p-2 mb-2">
            {error}
          </div>
        )}

        {loading && incidents.length === 0 && (
          <div className="text-[9px] font-mono text-[#4a5a72] text-center py-3">
            Connecting to INRIX…
          </div>
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
      </div>
    </div>
  )
}
