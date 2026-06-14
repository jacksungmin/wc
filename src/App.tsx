import { useState, useEffect, useMemo, useCallback } from 'react'
import { MapView } from '@/components/MapView'
import { MatchSchedule } from '@/components/MatchSchedule'
import { CameraGrid } from '@/components/CameraGrid'
import { StatusTicker } from '@/components/StatusTicker'
import { IncidentList } from '@/components/IncidentList'
import { MetroTransitPanel, ROUTE_GROUPS } from '@/components/MetroTransitPanel'
import { RouteMonitor } from '@/components/RouteMonitor'
import { UserGuide } from '@/components/UserGuide'
import { useWeather } from '@/hooks/useWeather'
import { useInrix } from '@/hooks/useInrix'
import { useMetroTransit } from '@/hooks/useMetroTransit'
import { useTranStar } from '@/hooks/useTranStar'
import { NRG_MATCHES } from '@/data/matches'
import { ALL_CAMERAS, MAP_CAMERAS } from '@/data/cameras'
import { BusFront, CalendarDays, Cctv, Map as MapIcon, Route, TriangleAlert } from 'lucide-react'
import type { MapExtent } from '@/types'

function MapFlagBadge({ label, code }: { label: string; code?: string }) {
  return (
    <span className="w-6 h-6 rounded-full bg-[#101827] border border-white/[0.12] flex items-center justify-center overflow-hidden flex-shrink-0">
      {code ? (
        <img
          src={`https://flagcdn.com/w40/${code}.png`}
          alt={`${label} flag`}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="text-[7px] leading-none font-mono text-[#7a8ba8]">{label}</span>
      )}
    </span>
  )
}

type MobileTab = 'map' | 'schedule' | 'transit' | 'routes' | 'cameras' | 'traffic'
const DEFAULT_CAMERA_ID = 'TX_HOU_326'

export default function App() {
  const [showGuide, setShowGuide] = useState(false)
  const [mobileTab, setMobileTab] = useState<MobileTab>('map')
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(DEFAULT_CAMERA_ID)
  const [camerasEnabled, setCamerasEnabled] = useState(false)
  const [enabledMetroGroups, setEnabledMetroGroups] = useState<Set<string>>(
    () => new Set(ROUTE_GROUPS.map(g => g.id))
  )
  const toggleMetroGroup = useCallback((id: string) => {
    setEnabledMetroGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [selectedMetroId, setSelectedMetroId] = useState<string | null>(null)
  const [selectedTranStarId, setSelectedTranStarId] = useState<string | null>(null)
  const [mapExtent, setMapExtent] = useState<MapExtent | null>(null)

  const handleCameraSelect = useCallback((id: string | null) => {
    setSelectedCameraId(id)
  }, [])
  const handleMapExtentChange = useCallback((extent: MapExtent) => {
    setMapExtent(extent)
  }, [])
  const [clock, setClock] = useState(new Date())

  const NRG_LAT = 29.6847
  const NRG_LNG = -95.4107
  const sortedCameras = useMemo(() =>
    [...ALL_CAMERAS].sort((a, b) => {
      if (a.id === DEFAULT_CAMERA_ID) return -1
      if (b.id === DEFAULT_CAMERA_ID) return 1
      const distA = (a.lat - NRG_LAT) ** 2 + (a.lng - NRG_LNG) ** 2
      const distB = (b.lat - NRG_LAT) ** 2 + (b.lng - NRG_LNG) ** 2
      return distA - distB
    }),
  [])

  const { observation, alerts, loading: wxLoading } = useWeather()
  const { incidents, segments, connected, loading: inrixLoading, error: inrixError, lastUpdated: inrixUpdated, refresh: inrixRefresh } = useInrix()
  const { updates: metroUpdates, loading: metroLoading, error: metroError, lastUpdated: metroUpdated, refresh: metroRefresh } = useMetroTransit()
  const { incidents: transtarIncidents, laneClosures: transtarLaneClosures, corridors: transtarCorridors, connected: transtarConnected, loading: transtarLoading, error: transtarError, lastUpdated: transtarUpdated, refresh: transtarRefresh } = useTranStar()

  const visibleTranStarLaneClosures = useMemo(() => {
    if (!mapExtent) return transtarLaneClosures
    return transtarLaneClosures.filter(closure =>
      closure.lat <= mapExtent.north &&
      closure.lat >= mapExtent.south &&
      closure.lng <= mapExtent.east &&
      closure.lng >= mapExtent.west
    )
  }, [transtarLaneClosures, mapExtent])

  const visibleTranStarIncidents = useMemo(() => {
    if (!mapExtent) return transtarIncidents
    return transtarIncidents.filter(incident =>
      incident.lat <= mapExtent.north &&
      incident.lat >= mapExtent.south &&
      incident.lng <= mapExtent.east &&
      incident.lng >= mapExtent.west
    )
  }, [transtarIncidents, mapExtent])

  const filteredMetroUpdates = useMemo(() => {
    const ALLOWED_ROUTES = new Set([
      '8', '11', '14', '60', '73', '84', '87', '211',
      '20', '40', '41', '54', '82', '85',
      '102', '108', '137', '151',
      '209', '219', '229', '249', '259', '269',
      '500',
    ])
    return metroUpdates.filter(update => {
      if (!update.routeId || !update.tripId) return false
      // Rail routes (scheduled from static GTFS) — always include
      if (update.routeType === 0 || update.routeType === 1 || update.routeType === 2) return true
      // Bus: strip leading zeros ("008" → "8") then check allowlist
      const rawId = update.routeShortName ?? update.routeId
      const normalized = String(parseInt(rawId, 10))
      return ALLOWED_ROUTES.has(normalized)
    })
  }, [metroUpdates])

  const mapMetroUpdates = useMemo(() => {
    return filteredMetroUpdates.filter(update => {
      for (const group of ROUTE_GROUPS) {
        if (!enabledMetroGroups.has(group.id)) continue
        const rail = update.routeType === 0 || update.routeType === 1 || update.routeType === 2
        if (group.routes === null) {
          if (rail) return true
        } else {
          const num = String(update.routeShortName ?? update.routeId ?? '').replace(/^0+/, '')
          if (!rail && group.routes.has(num)) return true
        }
      }
      return false
    })
  }, [filteredMetroUpdates, enabledMetroGroups])

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const criticalIncidents = incidents.filter(i => i.severity >= 3)

  const nextMatch = NRG_MATCHES.find(m => m.status === 'upcoming' || m.status === 'live')
  const nextDays = nextMatch
    ? (() => {
        const today = new Date(); today.setHours(0, 0, 0, 0)
        return Math.ceil((new Date(nextMatch.date + 'T00:00:00').getTime() - today.getTime()) / 86_400_000)
      })()
    : null

  return (
    <div className="h-full min-h-0 min-w-0 flex flex-col bg-[#070c15] font-sans overflow-hidden relative">
      {/* ── Header ── */}
      <header className="app-header flex items-center px-2.5 py-2 bg-[#09101e] border-b border-white/[0.06] flex-shrink-0 gap-2 md:gap-3 md:px-4">
        {/* Left: Logo + Title */}
        <div className="app-brand flex items-center gap-2 md:gap-3 flex-shrink-0 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 flex-shrink-0 flex items-center justify-center overflow-hidden rounded-sm border border-white/30">
              <img src="/HGAC_logo.png" alt="H-GAC" className="w-full h-full object-contain" />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] md:text-[12px] font-semibold text-[#e8edf5] leading-tight tracking-wide truncate">
                <span className="hidden sm:inline">World Cup 2026 Mobility Dashboard</span>
                <span className="sm:hidden">WC2026 Dashboard</span>
              </div>
              <div className="text-[9px] font-mono tracking-[0.2em] text-[#4a5a72] uppercase">Houston, TX</div>
            </div>
          </div>
          <button
            onClick={() => setShowGuide(true)}
            className="w-5 h-5 rounded-full border border-white/[0.15] flex items-center justify-center text-[#4a5a72] hover:text-[#e8edf5] hover:border-white/30 transition-colors flex-shrink-0"
            title="User Guide"
            aria-label="Open user guide"
          >
            <span className="text-[10px] font-mono font-bold leading-none">?</span>
          </button>
        </div>

        {/* Center: Weather + Alerts (hidden on mobile) */}
        <div className="app-weather hidden md:flex flex-1 items-center justify-center gap-3 min-w-0">
          {/* Weather strip */}
          <div className="flex items-center gap-2 text-[10px] font-mono flex-shrink-0">
            {observation ? (
              <>
                {observation.textDescription && (
                  <span className="hidden lg:inline text-[#c8d6e8]">{observation.textDescription}</span>
                )}
                {observation.temperature != null && (
                  <>
                    <span className="hidden lg:inline text-white/20">·</span>
                    <span className="text-[#e8edf5] font-bold">
                      {Math.round(observation.temperature * 9 / 5 + 32)}°F
                    </span>
                  </>
                )}
                {(observation.heatIndex ?? observation.windChill) != null && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="text-[#7a8ba8]">
                      Feels {Math.round(((observation.heatIndex ?? observation.windChill)! * 9 / 5 + 32))}°F
                    </span>
                  </>
                )}
                {observation.windSpeed != null && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="hidden lg:inline text-[#7a8ba8]">
                      {observation.windDirection != null
                        ? ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'][Math.round(observation.windDirection / 22.5) % 16] + ' '
                        : ''}
                      {Math.round(observation.windSpeed * 2.237)} mph
                    </span>
                  </>
                )}
                {observation.relativeHumidity != null && (
                  <>
                    <span className="hidden lg:inline text-white/20">·</span>
                    <span className="hidden lg:inline text-[#7a8ba8]">{Math.round(observation.relativeHumidity)}% RH</span>
                  </>
                )}
              </>
            ) : (
              <span className="text-[#4a5a72]">{wxLoading ? 'Loading weather…' : 'Weather unavailable'}</span>
            )}
          </div>

          {/* Alert badges */}
          {alerts.length > 0 && (
            <>
              <div className="w-px h-4 bg-white/[0.08] flex-shrink-0" />
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                {alerts.map(alert => {
                  const color =
                    alert.severity === 'Extreme' ? { dot: 'bg-red-400',    text: 'text-red-400',    border: 'border-red-500/30',    bg: 'bg-red-950/30'    } :
                    alert.severity === 'Severe'  ? { dot: 'bg-orange-400', text: 'text-orange-400', border: 'border-orange-500/30', bg: 'bg-orange-950/30' } :
                    alert.severity === 'Moderate'? { dot: 'bg-yellow-400', text: 'text-yellow-400', border: 'border-yellow-500/30', bg: 'bg-yellow-950/20' } :
                                                   { dot: 'bg-blue-400',   text: 'text-blue-400',   border: 'border-blue-500/30',   bg: 'bg-blue-950/20'   }
                  return (
                    <div
                      key={alert.id}
                      title={alert.headline}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded border flex-shrink-0 ${color.bg} ${color.border}`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse ${color.dot}`} />
                      <span className={`text-[9px] font-mono ${color.text}`}>{alert.event}</span>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>

        {/* Mobile weather temp pill (only on mobile) */}
        {observation?.temperature != null && (
          <div className="md:hidden flex items-center gap-1.5 flex-1 justify-center">
            <span className="text-[11px] font-mono font-bold text-[#e8edf5]">
              {Math.round(observation.temperature * 9 / 5 + 32)}°F
            </span>
            {alerts.length > 0 && (
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
            )}
          </div>
        )}

        {/* Right: Incidents + Clock */}
        <div className="app-clock flex items-center gap-2 md:gap-2.5 flex-shrink-0">
          {criticalIncidents.length > 0 && (
            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded bg-orange-500/10 border border-orange-500/20">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse inline-block" />
              <span className="text-[9px] font-mono text-orange-400">
                {criticalIncidents.length} Critical Incident{criticalIncidents.length > 1 ? 's' : ''}
              </span>
            </div>
          )}

          <div className="hidden sm:block w-px h-5 bg-white/[0.08]" />

          <div className="text-right">
            <div className="text-[11px] md:text-[13px] font-mono font-bold text-[#e8edf5] tabular-nums">
              {clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              <span className="text-[9px] text-[#4a5a72] font-normal ml-1">CDT</span>
            </div>
            <div className="hidden sm:block text-[9px] font-mono text-[#4a5a72]">
              {clock.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="flex flex-1 min-h-0 min-w-0 overflow-hidden">

        {/* Left panel: Match schedule + METRO + Route Monitor (desktop only) */}
        <div className="hidden xl:flex xl:w-[340px] 2xl:w-[388px] flex-shrink-0 flex-col border-r border-white/[0.06] overflow-hidden">
          <div className="overflow-hidden border-b border-white/[0.06]" style={{ height: '28%' }}>
            <MatchSchedule matches={NRG_MATCHES} />
          </div>
          <div className="overflow-hidden border-b border-white/[0.06]" style={{ height: '48%' }}>
            <MetroTransitPanel
              updates={filteredMetroUpdates}
              selectedId={selectedMetroId}
              loading={metroLoading}
              error={metroError}
              lastUpdated={metroUpdated}
              onSelect={id => {
                setSelectedMetroId(id)
                if (id) setSelectedIncidentId(null)
              }}
              onRefresh={metroRefresh}
              enabledGroups={enabledMetroGroups}
              onToggleGroup={toggleMetroGroup}
            />
          </div>
          <div className="overflow-hidden" style={{ height: '28%' }}>
            <RouteMonitor
              corridors={transtarCorridors}
              loading={transtarLoading}
              onCameraSelect={handleCameraSelect}
            />
          </div>
        </div>

        {/* Center: Map (always rendered; mobile panels overlay on top) */}
        <div className="flex-1 min-w-0 relative overflow-hidden">
          <MapView
            cameras={MAP_CAMERAS}
            selectedCameraId={selectedCameraId}
            onCameraSelect={handleCameraSelect}
            camerasEnabled={camerasEnabled}
            onCamerasEnabledChange={setCamerasEnabled}
            incidents={incidents}
            selectedIncidentId={selectedIncidentId}
            onIncidentSelect={id => {
              setSelectedIncidentId(id)
              if (id) setSelectedMetroId(null)
            }}
            segments={segments}
            metroUpdates={mapMetroUpdates}
            selectedMetroId={selectedMetroId}
            onMetroSelect={id => {
              setSelectedMetroId(id)
              if (id) setSelectedIncidentId(null)
            }}
            transtarIncidents={transtarIncidents}
            transtarLaneClosures={transtarLaneClosures}
            selectedTranStarId={selectedTranStarId}
            onTranStarSelect={id => {
              setSelectedTranStarId(id)
              if (id) { setSelectedIncidentId(null); setSelectedMetroId(null) }
            }}
            onMapExtentChange={handleMapExtentChange}
          />

          {/* Next match overlay */}
          {nextMatch && (
            <div className="absolute top-2 left-2 md:top-3 md:left-3 z-[1000] bg-[#09101e]/95 backdrop-blur-sm border border-white/[0.10] rounded p-2.5 md:p-3 w-[min(230px,calc(100%-5rem))]">
              <div className="text-[8px] font-mono tracking-[0.12em] text-[#4a5a72] uppercase mb-1.5">
                Next at NRG · {nextMatch.stage}
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <MapFlagBadge label={nextMatch.homeFlag} code={nextMatch.homeFlagCode} />
                  <span className="text-[11px] text-[#e8edf5] font-medium truncate">{nextMatch.homeTeam}</span>
                </div>
                <span className="text-[9px] font-mono text-[#4a5a72] flex-shrink-0">vs</span>
                <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
                  <span className="text-[11px] text-[#e8edf5] font-medium truncate">{nextMatch.awayTeam}</span>
                  <MapFlagBadge label={nextMatch.awayFlag} code={nextMatch.awayFlagCode} />
                </div>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[9px] font-mono text-[#7a8ba8]">
                <span>
                  {new Date(nextMatch.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span className="text-[#4a5a72]">·</span>
                <span>{nextMatch.kickoff}</span>
                {nextDays === 0 && <span className="text-amber-400 font-medium">TODAY</span>}
                {nextDays !== null && nextDays > 0 && <span className="text-[#c8102e]">In {nextDays}d</span>}
              </div>
            </div>
          )}

          <div className="hidden sm:flex absolute top-3 right-14 z-[1000] flex-col items-end gap-2">
            {/* Bus direction legend */}
            {filteredMetroUpdates.length > 0 && (
              <div className="bg-[#09101e]/90 backdrop-blur-sm border border-white/[0.08] rounded px-2.5 py-2">
              <div className="text-[8px] font-mono tracking-[0.1em] text-[#4a5a72] uppercase mb-1.5">Bus Direction</div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold flex-shrink-0" style={{ background: '#0e7490', color: '#fff' }}>▲</span>
                <span className="text-[8px] font-mono text-[#7a8ba8]">Outbound</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded flex items-center justify-center text-[7px] font-bold flex-shrink-0" style={{ background: '#b45309', color: '#fff' }}>▼</span>
                <span className="text-[8px] font-mono text-[#7a8ba8]">Inbound</span>
              </div>
              </div>
            )}

            {/* Traffic legend overlay */}
            {segments.length > 0 && (
              <div className="bg-[#09101e]/90 backdrop-blur-sm border border-white/[0.08] rounded px-2.5 py-2">
              <div className="text-[8px] font-mono tracking-[0.1em] text-[#4a5a72] uppercase mb-1.5">Traffic</div>
              {[
                { color: '#22c55e', label: 'Free flow' },
                { color: '#eab308', label: 'Slow' },
                { color: '#f97316', label: 'Heavy' },
                { color: '#ef4444', label: 'Stop & go' },
              ].map(({ color, label }) => (
                <div key={color} className="flex items-center gap-1.5 mb-0.5">
                  <span className="w-4 h-1.5 rounded-full inline-block flex-shrink-0" style={{ background: color }} />
                  <span className="text-[8px] font-mono text-[#7a8ba8]">{label}</span>
                </div>
              ))}
              <div className="text-[7px] font-mono text-[#4a5a72] mt-1 pt-1 border-t border-white/[0.05]">
                {segments.length} segments · INRIX
              </div>
              </div>
            )}
          </div>

          {/* Camera count + incident mini badges */}
          <div className="map-summary absolute bottom-2 left-2 right-2 md:bottom-8 md:left-3 md:right-auto z-[1000] flex flex-wrap items-center gap-1.5 md:gap-2 pointer-events-none">
            <div className="bg-[#09101e]/80 backdrop-blur-sm border border-white/[0.07] rounded px-2 md:px-2.5 py-1 md:py-1.5">
              <span className="text-[8px] font-mono text-[#4a5a72]">
                📷 {ALL_CAMERAS.length} live feeds
              </span>
            </div>
            {incidents.length > 0 && (
              <div className="bg-[#09101e]/80 backdrop-blur-sm border border-orange-500/20 rounded px-2 md:px-2.5 py-1 md:py-1.5">
                <span className="text-[8px] font-mono text-orange-400">
                  💥 {incidents.length} incident{incidents.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}
          </div>

          {/* ── Mobile/tablet panel overlays (hidden on xl+) ── */}
          <div className={`xl:hidden absolute inset-0 z-[1001] bg-[#070c15] overflow-hidden ${mobileTab === 'schedule' ? 'flex flex-col' : 'hidden'}`}>
            <MatchSchedule matches={NRG_MATCHES} />
          </div>
          <div className={`xl:hidden absolute inset-0 z-[1001] bg-[#070c15] overflow-hidden ${mobileTab === 'transit' ? 'flex flex-col' : 'hidden'}`}>
            <MetroTransitPanel
              updates={filteredMetroUpdates}
              selectedId={selectedMetroId}
              loading={metroLoading}
              error={metroError}
              lastUpdated={metroUpdated}
              onSelect={id => {
                setSelectedMetroId(id)
                if (id) setSelectedIncidentId(null)
              }}
              onRefresh={metroRefresh}
              enabledGroups={enabledMetroGroups}
              onToggleGroup={toggleMetroGroup}
            />
          </div>
          <div className={`xl:hidden absolute inset-0 z-[1001] bg-[#070c15] overflow-hidden ${mobileTab === 'routes' ? 'flex flex-col' : 'hidden'}`}>
            <RouteMonitor
              corridors={transtarCorridors}
              loading={transtarLoading}
              onCameraSelect={handleCameraSelect}
            />
          </div>
          <div className={`xl:hidden absolute inset-0 z-[1001] bg-[#070c15] overflow-hidden ${mobileTab === 'cameras' ? 'flex flex-col' : 'hidden'}`}>
            <CameraGrid
              cameras={sortedCameras}
              selectedId={selectedCameraId}
              onSelect={handleCameraSelect}
            />
          </div>
          <div className={`xl:hidden absolute inset-0 z-[1001] bg-[#070c15] overflow-hidden ${mobileTab === 'traffic' ? 'flex flex-col' : 'hidden'}`}>
            <IncidentList
              incidents={incidents}
              selectedId={selectedIncidentId}
              connected={connected}
              loading={inrixLoading}
              error={inrixError}
              lastUpdated={inrixUpdated}
              onSelect={id => {
                setSelectedIncidentId(id)
                if (id) setSelectedMetroId(null)
              }}
              onRefresh={inrixRefresh}
              transtarIncidents={visibleTranStarIncidents}
              transtarLaneClosures={visibleTranStarLaneClosures}
              transtarConnected={transtarConnected}
              transtarLoading={transtarLoading}
              transtarError={transtarError}
              transtarLastUpdated={transtarUpdated}
              selectedTranStarId={selectedTranStarId}
              onTranStarSelect={id => {
                setSelectedTranStarId(id)
                if (id) { setSelectedIncidentId(null); setSelectedMetroId(null) }
              }}
              onTranStarRefresh={transtarRefresh}
            />
          </div>
        </div>

        {/* Right: Camera grid + INRIX traffic (desktop only) */}
        <div className="hidden xl:flex xl:w-[280px] 2xl:w-80 flex-shrink-0 border-l border-white/[0.06] overflow-hidden flex-col">
          <div className="overflow-hidden border-b border-white/[0.06]" style={{ height: '58%' }}>
            <CameraGrid
              cameras={sortedCameras}
              selectedId={selectedCameraId}
              onSelect={handleCameraSelect}
            />
          </div>
          <div className="overflow-hidden" style={{ height: '42%' }}>
            <IncidentList
              incidents={incidents}
              selectedId={selectedIncidentId}
              connected={connected}
              loading={inrixLoading}
              error={inrixError}
              lastUpdated={inrixUpdated}
              onSelect={id => {
                setSelectedIncidentId(id)
                if (id) setSelectedMetroId(null)
              }}
              onRefresh={inrixRefresh}
              transtarIncidents={visibleTranStarIncidents}
              transtarLaneClosures={visibleTranStarLaneClosures}
              transtarConnected={transtarConnected}
              transtarLoading={transtarLoading}
              transtarError={transtarError}
              transtarLastUpdated={transtarUpdated}
              selectedTranStarId={selectedTranStarId}
              onTranStarSelect={id => {
                setSelectedTranStarId(id)
                if (id) { setSelectedIncidentId(null); setSelectedMetroId(null) }
              }}
              onTranStarRefresh={transtarRefresh}
            />
          </div>
        </div>
      </div>

      {/* ── Mobile/tablet bottom tab bar (hidden on xl+) ── */}
      <nav className="mobile-tabs xl:hidden flex items-stretch bg-[#09101e] border-t border-white/[0.08] flex-shrink-0" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }} aria-label="Dashboard sections">
        {([
          { id: 'map',      label: 'Map',      icon: MapIcon },
          { id: 'schedule', label: 'Schedule', icon: CalendarDays },
          { id: 'transit',  label: 'Transit',  icon: BusFront },
          { id: 'routes',   label: 'Routes',   icon: Route },
          { id: 'cameras',  label: 'Cameras',  icon: Cctv },
          { id: 'traffic',  label: 'Traffic',  icon: TriangleAlert },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMobileTab(id)}
            className={[
              'flex-1 min-h-12 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors min-w-0',
              mobileTab === id
                ? 'text-[#c8102e] border-t-2 border-[#c8102e] -mt-px'
                : 'text-[#4a5a72] border-t-2 border-transparent -mt-px hover:text-[#7a8ba8]',
            ].join(' ')}
          >
            <span className="text-base leading-none">
              <Icon size={18} strokeWidth={1.8} />
            </span>
            <span className="text-[9px] font-mono leading-none">{label}</span>
          </button>
        ))}
      </nav>

      {/* ── Bottom ticker (desktop only) ── */}
      <div className="hidden xl:block">
        <StatusTicker
          alerts={alerts}
          incidents={incidents}
          metroUpdates={filteredMetroUpdates}
          liveFeeds={ALL_CAMERAS.length}
          nextMatch={nextMatch ?? null}
          transtarIncidents={transtarIncidents}
          transtarLaneClosures={transtarLaneClosures}
          transtarCorridors={transtarCorridors}
        />
      </div>

      {showGuide && <UserGuide onClose={() => setShowGuide(false)} />}
    </div>
  )
}
