import type { InrixIncident, MetroTripUpdate, WeatherAlert, WorldCupMatch } from '@/types'

interface StatusTickerProps {
  alerts: WeatherAlert[]
  incidents: InrixIncident[]
  metroUpdates: MetroTripUpdate[]
  liveFeeds: number
  nextMatch: WorldCupMatch | null
}

export function StatusTicker({
  alerts,
  incidents,
  metroUpdates,
  liveFeeds,
  nextMatch,
}: StatusTickerProps) {
  const metroRouteCount = new Set(metroUpdates.map(update => update.routeId).filter(Boolean)).size
  const positionedMetroCount = metroUpdates.filter(update => update.lat && update.lng).length
  const majorIncidentCount = incidents.filter(incident => incident.severity >= 3).length

  const items = [
    alerts.length > 0
      ? `${alerts.length} active weather alert${alerts.length !== 1 ? 's' : ''}: ${alerts.map(a => a.event).join(', ')}`
      : 'No active weather alerts for Houston',
    `${incidents.length} INRIX incident${incidents.length !== 1 ? 's' : ''} in the 2-hour traffic window${majorIncidentCount > 0 ? ` (${majorIncidentCount} major+)` : ''}`,
    `METRO bus (live): ${metroRouteCount} route${metroRouteCount !== 1 ? 's' : ''} / ${metroUpdates.filter(u => !u.isScheduled).length} trips · Rail (scheduled): ${metroUpdates.filter(u => u.isScheduled).length} upcoming departures · ${positionedMetroCount} mapped`,
    `${liveFeeds} live traffic camera feeds available · selected camera marker shown on map · METRO layer on by default`,
    `Map POIs: NRG Stadium ⚽ · Fan Festival Entrance 🎪`,
    nextMatch
      ? `Next NRG match: ${nextMatch.homeTeam} vs ${nextMatch.awayTeam} on ${new Date(nextMatch.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${nextMatch.kickoff}`
      : 'NRG Stadium World Cup schedule loaded',
    'Default map: Satellite with Google traffic overlay · Switch basemap or toggle layers in Map details panel',
  ]

  const text = items.join('     -     ')

  return (
    <div className="flex items-center h-7 bg-[#060a12] border-t border-white/[0.06] overflow-hidden flex-shrink-0">
      <div className="flex-shrink-0 px-2.5 border-r border-white/[0.06]">
        <span className="text-[8px] font-mono tracking-[0.15em] text-[#4a5a72] uppercase">
          {alerts.length > 0 || majorIncidentCount > 0 ? 'LIVE ALERTS' : 'STATUS'}
        </span>
      </div>

      <div className="flex-1 overflow-hidden relative">
        <div className="flex whitespace-nowrap ticker-track">
          <span className="text-[9px] font-mono text-[#6a7d98] px-6">{text}</span>
          <span className="text-[9px] font-mono text-[#6a7d98] px-6">{text}</span>
        </div>
      </div>

    </div>
  )
}
