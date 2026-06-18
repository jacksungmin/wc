import type { InrixIncident, MetroTripUpdate, TranStarCorridor, TranStarIncident, TranStarLaneClosure, TranStarFloodRisk, WeatherAlert, WorldCupMatch } from '@/types'

function transtarIncidentEmoji(desc: string): string {
  if (/accident|crash/i.test(desc)) return '💥'
  if (/fire/i.test(desc)) return '🔥'
  if (/stall/i.test(desc)) return '🚗'
  if (/debris/i.test(desc)) return '⚠️'
  if (/flood/i.test(desc)) return '🌊'
  return '🟣'
}

interface StatusTickerProps {
  alerts: WeatherAlert[]
  incidents: InrixIncident[]
  metroUpdates: MetroTripUpdate[]
  liveFeeds: number
  nextMatch: WorldCupMatch | null
  transtarIncidents: TranStarIncident[]
  transtarLaneClosures: TranStarLaneClosure[]
  transtarFloodRisks: TranStarFloodRisk[]
  transtarCorridors: TranStarCorridor[]
}

export function StatusTicker({
  alerts,
  incidents,
  metroUpdates,
  liveFeeds,
  nextMatch,
  transtarIncidents,
  transtarLaneClosures,
  transtarFloodRisks,
  transtarCorridors,
}: StatusTickerProps) {
  const metroRouteCount = new Set(metroUpdates.map(update => update.routeId).filter(Boolean)).size
  const positionedMetroCount = metroUpdates.filter(update => update.lat && update.lng).length
  const majorIncidentCount = incidents.filter(incident => incident.severity >= 3).length

  const busTrips = metroUpdates.filter(u => !u.isScheduled).length
  const railDepartures = metroUpdates.filter(u => u.isScheduled).length

  const hotspotClosures = transtarLaneClosures.filter(lc => lc.hotspot)
  const activeFloodRisks = transtarFloodRisks.filter(risk =>
    risk.precipitationAlert || risk.streamElevationAlert
  )

  const liveCorridors = transtarCorridors.filter(c => c.travelMin > 0)
  const routeAlertCorridors = liveCorridors.filter(c =>
    c.delayMin > 1 || c.status === 'warn' || c.status === 'bad' || (c.avgSpeed > 0 && c.avgSpeed < 25)
  )
  const toStadiumCorridors = liveCorridors.filter(c => c.group === 'to')
  const fromStadiumCorridors = liveCorridors.filter(c => c.group === 'from')
  const travelChartCount = liveCorridors.filter(c => c.chartRoute).length
  const volumeChartCount = liveCorridors.filter(c => c.volumeSensors?.length).length
  const routeUpdated = liveCorridors.find(c => c.sourceUpdated)?.sourceUpdated

  const routeStatusLabel = (c: TranStarCorridor) => {
    if (c.status === 'bad') return 'heavy'
    if (c.status === 'warn') return 'slow'
    if (c.delayMin > 1) return `+${c.delayMin}m delay`
    if (c.avgSpeed > 0 && c.avgSpeed < 25) return `${c.avgSpeed} mph`
    return 'normal'
  }

  const corridorSummary = liveCorridors.length > 0
    ? `NRG Route Monitor - ${toStadiumCorridors.length} to stadium / ${fromStadiumCorridors.length} from stadium live${routeUpdated ? ` - updated ${routeUpdated}` : ''} - charts ${travelChartCount} travel / ${volumeChartCount} volume`
    : 'NRG Route Monitor - No live corridor data'

  const corridorItems: string[] = [
    corridorSummary,
    ...(routeAlertCorridors.length > 0
      ? routeAlertCorridors.slice(0, 4).map(c =>
        `Route Monitor Alert: ${c.group === 'to' ? 'To stadium' : 'From stadium'} - ${c.label} ${c.dir} - ${c.travelMin}m - ${routeStatusLabel(c)} - avg ${c.avgSpeed} mph`
      )
      : liveCorridors.slice(0, 3).map(c =>
        `Route Monitor: ${c.group === 'to' ? 'To stadium' : 'From stadium'} - ${c.label} ${c.dir} - ${c.travelMin}m - normal - avg ${c.avgSpeed} mph`
      )
    ),
  ]

  const transtarItems: string[] = [
    transtarIncidents.length > 0 || transtarLaneClosures.length > 0
      ? `TranStar Live — ${transtarIncidents.length} active incident${transtarIncidents.length !== 1 ? 's' : ''} · ${transtarLaneClosures.length} lane closure${transtarLaneClosures.length !== 1 ? 's' : ''}${hotspotClosures.length > 0 ? ` · ${hotspotClosures.length} hotspot${hotspotClosures.length !== 1 ? 's' : ''}` : ''}`
      : 'TranStar Live — No active incidents or closures',
    ...transtarIncidents.map(inc =>
      `${transtarIncidentEmoji(inc.desc)} TranStar: ${inc.desc || 'Incident'} — ${inc.location}${inc.status ? ` (${inc.status})` : ''}${inc.time ? ` · ${inc.time}` : ''}`
    ),
    ...hotspotClosures.map(lc =>
      `🚧 Hotspot Closure: ${lc.roadway || lc.location}${lc.lanes ? ` · ${lc.lanes}` : ''}${lc.agency ? ` · ${lc.agency}` : ''}${lc.endTime ? ` · Until ${lc.endTime}` : ''}`
    ),
  ]

  const items = [
    alerts.length > 0
      ? `${alerts.length} active weather alert${alerts.length !== 1 ? 's' : ''}: ${alerts.map(a => a.event).join(', ')}`
      : 'No active weather alerts for Houston',
    `INRIX — ${incidents.length} traffic incident${incidents.length !== 1 ? 's' : ''} in the 2-hour window${majorIncidentCount > 0 ? ` · ${majorIncidentCount} high severity` : ''}`,
    ...transtarItems,
    `Roadway Flood Risk — ${transtarFloodRisks.length} TranStar warning area${transtarFloodRisks.length !== 1 ? 's' : ''}`,
    ...transtarFloodRisks.map(risk =>
      `Roadway Flood Risk: ${risk.sensorName} · ${risk.radiusMiles} mi warning area · rain ${risk.precipitationInches.toFixed(2)} in · stream ${risk.streamElevation.toFixed(2)} ft${risk.precipitationAlert ? ' · rainfall alert' : ''}${risk.streamElevationAlert ? ' · stream elevation alert' : ''}`
    ),
    ...corridorItems,
    `METRO Live Transit — ${metroRouteCount} active route${metroRouteCount !== 1 ? 's' : ''} · ${busTrips} live bus trip${busTrips !== 1 ? 's' : ''} · ${railDepartures} scheduled rail departure${railDepartures !== 1 ? 's' : ''} · ${positionedMetroCount} mapped`,
    `METRO panel: 6 route groups (METROrail · NRG Stadium · Fan Festival · Airport · Park & Ride · Local) · use eye icon to show or hide each group on the map`,
    `${liveFeeds} live camera feed${liveFeeds !== 1 ? 's' : ''} available · enable Cameras layer in Map Details to show all pins on the map`,
    `Map POIs: NRG Stadium ⚽ · Fan Festival 🎪 · FIFA Volunteer Center 🤝`,
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
          {alerts.length > 0 || majorIncidentCount > 0 || transtarIncidents.length > 0 || activeFloodRisks.length > 0 || routeAlertCorridors.length > 0 ? 'LIVE ALERTS' : 'STATUS'}
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
