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

  const busTrips = metroUpdates.filter(u => !u.isScheduled).length
  const railDepartures = metroUpdates.filter(u => u.isScheduled).length

  const items = [
    alerts.length > 0
      ? `${alerts.length} active weather alert${alerts.length !== 1 ? 's' : ''}: ${alerts.map(a => a.event).join(', ')}`
      : 'No active weather alerts for Houston',
    `${incidents.length} traffic incident${incidents.length !== 1 ? 's' : ''} in the 2-hour window${majorIncidentCount > 0 ? ` · ${majorIncidentCount} high severity` : ''}`,
    `METRO Live Transit — ${metroRouteCount} active route${metroRouteCount !== 1 ? 's' : ''} · ${busTrips} live bus trip${busTrips !== 1 ? 's' : ''} · ${railDepartures} scheduled rail departure${railDepartures !== 1 ? 's' : ''} · ${positionedMetroCount} mapped`,
    `METRO panel: 6 route groups (METROrail · NRG Stadium · Fan Festival · Airport · Park & Ride · Local) · use eye icon to show or hide each group on the map`,
    `${liveFeeds} live camera feed${liveFeeds !== 1 ? 's' : ''} available · enable Cameras layer in Map Details to show all pins on the map`,
    `Map POIs: NRG Stadium ⚽ · Fan Festival Entrance 🎪`,
    nextMatch
      ? `Next NRG match: ${nextMatch.homeTeam} vs ${nextMatch.awayTeam} · ${new Date(nextMatch.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${nextMatch.kickoff}`
      : 'NRG Stadium World Cup 2026 schedule loaded',
    'Map style: Satellite · real-time traffic on · switch map style or turn layers on/off in the Map Details panel',
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
