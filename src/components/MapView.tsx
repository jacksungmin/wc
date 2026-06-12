import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import { Bus, Camera, Car, CloudSun, Home, Layers, Map as MapIcon, Mountain, Satellite, TrainFront, X } from 'lucide-react'
import 'leaflet/dist/leaflet.css'
import type { TrafficCamera, InrixIncident, InrixSegment, MetroTripUpdate } from '@/types'

interface MapViewProps {
  cameras: TrafficCamera[]
  selectedCameraId: string | null
  onCameraSelect: (id: string | null) => void
  camerasEnabled: boolean
  onCamerasEnabledChange: (val: boolean) => void
  incidents: InrixIncident[]
  selectedIncidentId: string | null
  onIncidentSelect: (id: string | null) => void
  segments: InrixSegment[]
  metroUpdates: MetroTripUpdate[]
  selectedMetroId: string | null
  onMetroSelect: (id: string | null) => void
}

const NRG_CENTER: [number, number] = [29.6847, -95.4107]
const DEFAULT_CENTER: [number, number] = [29.724, -95.405]
const DEFAULT_ZOOM = 13
type BaseMapType = 'standard' | 'roadmap' | 'satellite' | 'hybrid' | 'terrain'

const BASE_MAP_TYPES: Array<{
  id: BaseMapType
  label: string
  layer?: string
  icon: typeof MapIcon
}> = [
  { id: 'standard', label: 'Command Dark', icon: MapIcon },
  { id: 'roadmap', label: 'Google', layer: 'm', icon: MapIcon },
  { id: 'satellite', label: 'Satellite', layer: 's', icon: Satellite },
  { id: 'hybrid', label: 'Hybrid', layer: 'y', icon: Layers },
  { id: 'terrain', label: 'Terrain', layer: 'p', icon: Mountain },
]

function standardTileLayer() {
  return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
    subdomains: ['a', 'b', 'c', 'd'],
    maxZoom: 20,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  })
}

function baseTileLayer(type: BaseMapType) {
  if (type === 'standard') return standardTileLayer()

  const config = BASE_MAP_TYPES.find(t => t.id === type && t.layer) ?? BASE_MAP_TYPES[1]
  return L.tileLayer(`https://mt{s}.google.com/vt/lyrs=${config.layer}&x={x}&y={y}&z={z}`, {
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 21,
    attribution: 'Map data © Google',
  })
}

function googleTrafficLayer() {
  return L.tileLayer('https://mt{s}.google.com/vt/lyrs=h,traffic&x={x}&y={y}&z={z}', {
    subdomains: ['0', '1', '2', '3'],
    maxZoom: 21,
    opacity: 0.82,
    attribution: 'Traffic data © Google',
  })
}

function goesSatelliteLayer() {
  return L.tileLayer('https://earthlive.maptiles.arcgis.com/arcgis/rest/services/GOES/GOES31D/MapServer/tile/{z}/{y}/{x}', {
    maxNativeZoom: 6,
    maxZoom: 21,
    opacity: 0.48,
    attribution: 'GOES imagery © NOAA / Esri',
  })
}

function segmentColor(speed: number, avg: number): string {
  const ratio = avg > 0 ? speed / avg : 1
  if (ratio >= 0.85) return '#22c55e'
  if (ratio >= 0.65) return '#eab308'
  if (ratio >= 0.40) return '#f97316'
  return '#ef4444'
}

function segmentWeight(speed: number, avg: number): number {
  const ratio = avg > 0 ? speed / avg : 1
  return ratio < 0.5 ? 4 : 3
}

function incidentIcon(type: string, severity: number, selected = false) {
  const bg =
    selected ? '#2563eb' :
    severity === 4 ? '#dc2626' :
    severity === 3 ? '#ea580c' :
    severity === 2 ? '#ca8a04' : '#6b7280'
  const label =
    /accident|crash/i.test(type) ? 'C' :
    /clos/i.test(type) ? 'X' :
    /construct|work/i.test(type) ? 'W' :
    /hazard|condition/i.test(type) ? 'H' :
    /weather/i.test(type) ? 'Wx' :
    /event/i.test(type) ? 'E' : ''
  const size = selected ? 16 : severity >= 3 ? 12 : 9
  const ring = selected ? 5 : severity >= 3 ? 3 : 2
  const fontSize = label.length > 1 ? 5 : 6
  return L.divIcon({
    html: `<div style="width:${size}px;height:${size}px;background:${bg};border:1.5px solid rgba(255,255,255,.92);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font:700 ${fontSize}px/1 Inter,Arial,sans-serif;box-shadow:0 0 0 ${ring}px ${bg}24,0 2px 7px rgba(0,0,0,.28);cursor:pointer">${label}</div>`,
    className: '',
    iconSize: [size + ring * 2, size + ring * 2],
    iconAnchor: [size / 2 + ring, size / 2 + ring],
  })
}

function stadiumIcon() {
  return L.divIcon({
    html: `
      <div class="stadium-marker">
        <span class="stadium-marker__ring"></span>
        <span class="stadium-marker__ball">⚽</span>
      </div>
    `,
    className: '',
    iconSize: [38, 38],
    iconAnchor: [19, 19],
  })
}

function fanFestivalIcon() {
  return L.divIcon({
    html: `
      <div class="festival-marker">
        <span class="festival-marker__ring"></span>
        <span class="festival-marker__ring2"></span>
        <span class="festival-marker__icon">🎪</span>
      </div>
    `,
    className: '',
    iconSize: [42, 42],
    iconAnchor: [21, 21],
  })
}

function cameraIcon(selected: boolean, hasFeed: boolean) {
  const bg = selected ? '#c8102e' : hasFeed ? '#1a4fbf' : '#0f766e'
  const border = '#2563eb'
  const size = selected ? 22 : hasFeed ? 20 : 16
  const iconSize = selected ? 12 : hasFeed ? 11 : 9
  return L.divIcon({
    html: `
      <div style="width:${size}px;height:${size}px;background:${bg};border:2px solid ${border};border-radius:50%;display:flex;align-items:center;justify-content:center;box-shadow:0 0 8px ${bg}60;cursor:pointer">
        <svg viewBox="0 0 24 24" width="${iconSize}" height="${iconSize}" aria-hidden="true" fill="none" stroke="#ffffff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14.5 4.5 16 7h3a2 2 0 0 1 2 2v8.5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-2.5h5Z" />
          <circle cx="12" cy="13" r="3.25" />
        </svg>
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function isRailRoute(update: MetroTripUpdate) {
  return update.routeType === 0 || update.routeType === 1 || update.routeType === 2
}

// Houston METRO official line colors
function railLineColor(update: MetroTripUpdate): { bg: string; label: string } {
  const long = (update.routeLongName ?? '').toLowerCase()
  const id   = (update.routeShortName ?? update.routeId ?? '').toLowerCase()
  if (long.includes('red')    || id.includes('red'))    return { bg: '#CC1030', label: 'Red' }
  if (long.includes('green')  || id.includes('green'))  return { bg: '#007A33', label: 'Grn' }
  if (long.includes('purple') || id.includes('purple')) return { bg: '#5C2882', label: 'Pur' }
  return { bg: '#6b21a8', label: (update.routeShortName ?? update.routeId ?? '???').slice(0, 3) }
}

// Outbound (0) = teal, Inbound (1) = amber; unknown = slate
function busDirectionStyle(directionId: number | undefined): { bg: string; arrow: string; dirLabel: string } {
  if (directionId === 0) return { bg: '#0e7490', arrow: '▲', dirLabel: 'Outbound' }
  if (directionId === 1) return { bg: '#b45309', arrow: '▼', dirLabel: 'Inbound' }
  return { bg: '#374151', arrow: '', dirLabel: '' }
}

function metroIcon(update: MetroTripUpdate, selected: boolean) {
  const rail = isRailRoute(update)

  // Bus: pill badge showing route number only
  if (!rail) {
    const dir = busDirectionStyle(update.directionId)
    const bg = selected ? '#0891b2' : dir.bg
    const busLabel = (update.routeShortName ?? update.routeId ?? '').slice(0, 3)
    const arrow = dir.arrow
    const chars = busLabel.length + (arrow ? 1 : 0)
    const w = selected ? (chars <= 1 ? 23 : chars <= 2 ? 29 : chars <= 3 ? 34 : 40) : (chars <= 1 ? 20 : chars <= 2 ? 25 : chars <= 3 ? 31 : 36)
    const h = selected ? 20 : 16
    const fontSize = selected ? 10 : 8
    return L.divIcon({
      html: `
        <div style="width:${w}px;height:${h}px;background:${bg};border:1px solid rgba(255,255,255,0.9);border-radius:50px;display:flex;align-items:center;justify-content:center;gap:1px;color:#fff;font:800 ${fontSize}px/1 Inter,Arial,sans-serif;box-shadow:0 0 6px ${bg}80,0 1px 4px rgba(0,0,0,0.3);cursor:pointer;letter-spacing:0.03em">
          <span>${busLabel}</span>${arrow ? `<span style="font-size:${fontSize - 1}px;opacity:0.9">${arrow}</span>` : ''}
        </div>
      `,
      className: '',
      iconSize: [w, h],
      iconAnchor: [w / 2, h / 2],
    })
  }

  // Rail: circle with SVG icon + line label
  const size = selected ? 28 : 22
  const line = railLineColor(update)
  const bg = line.bg
  const label = line.label
  let cornerBadge = ''
  if (update.directionId === 0) {
    cornerBadge = `<span style="position:absolute;top:1px;right:2px;font-size:6px;line-height:1;opacity:0.95;color:#fff">▲</span>`
  } else if (update.directionId === 1) {
    cornerBadge = `<span style="position:absolute;top:1px;right:2px;font-size:6px;line-height:1;opacity:0.95;color:#fff">▼</span>`
  }
  const shape = `<path d="M7 4.5h10a2 2 0 0 1 2 2v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a2 2 0 0 1 2-2Z" /><path d="M8 8h8" /><path d="M8.5 13h.01" /><path d="M15.5 13h.01" /><path d="m9 19-2 2" /><path d="m15 19 2 2" />`
  return L.divIcon({
    html: `
      <div style="position:relative;width:${size}px;height:${size}px;background:${bg};border:1px solid #ffffff;border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#fff;font:800 7px/1 Inter,Arial,sans-serif;box-shadow:0 0 8px ${bg}90;cursor:pointer">
        <svg viewBox="0 0 24 24" width="${selected ? 14 : 12}" height="${selected ? 14 : 12}" aria-hidden="true" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${shape}</svg>
        <span>${label}</span>
        ${cornerBadge}
      </div>
    `,
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

function metroRouteLabel(update: MetroTripUpdate) {
  const shortName = update.routeShortName || update.routeId
  return update.routeLongName ? `${shortName} - ${update.routeLongName}` : `Route ${shortName}`
}

export function MapView({ cameras, selectedCameraId, onCameraSelect, camerasEnabled, onCamerasEnabledChange, incidents, selectedIncidentId, onIncidentSelect, segments, metroUpdates, selectedMetroId, onMetroSelect }: MapViewProps) {
  const [mapType, setMapType] = useState<BaseMapType>('satellite')
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [trafficEnabled, setTrafficEnabled] = useState(true)
  const [goesEnabled, setGoesEnabled] = useState(false)
  const [metroEnabled, setMetroEnabled] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const baseLayerRef = useRef<L.Layer | null>(null)
  const goesLayerRef = useRef<L.TileLayer | null>(null)
  const trafficLayerRef = useRef<L.TileLayer | null>(null)
  const cameraMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const hadFocusedSelectionRef = useRef(false)
  const segmentLayerRef = useRef<L.LayerGroup | null>(null)
  const incidentLayerRef = useRef<L.LayerGroup | null>(null)
  const incidentMarkersRef = useRef<Map<string, L.Marker>>(new Map())
  const metroLayerRef = useRef<L.LayerGroup | null>(null)
  const metroMarkersRef = useRef<Map<string, L.Marker>>(new Map())

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    const map = L.map(containerRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: false,
      attributionControl: false,
    })
    mapRef.current = map

    L.control.zoom({ position: 'bottomright' }).addTo(map)
    L.control.attribution({
      position: 'bottomleft',
      prefix: 'Google Maps · INRIX',
    }).addTo(map)

    // Static route guides (replaced by INRIX colored segments once loaded)
    L.polyline(
      [[29.7185, -95.3979], [29.7182, -95.4100], [29.7177, -95.4218], [29.7155, -95.4420]],
      { color: '#ffffff', weight: 2, opacity: 0.08, dashArray: '4 6' }
    ).addTo(map).bindTooltip('I-610 South Loop', { sticky: true, className: 'map-tooltip' })

    L.polyline(
      [[29.7400, -95.4390], [29.7320, -95.4218], [29.7253, -95.4449], [29.7185, -95.4600]],
      { color: '#ffffff', weight: 2, opacity: 0.08, dashArray: '4 6' }
    ).addTo(map).bindTooltip('US-59 SW Freeway', { sticky: true, className: 'map-tooltip' })

    // Layer groups for dynamic INRIX data
    segmentLayerRef.current = L.layerGroup().addTo(map)
    incidentLayerRef.current = L.layerGroup().addTo(map)
    metroLayerRef.current = L.layerGroup().addTo(map)

    L.marker(NRG_CENTER, { icon: stadiumIcon(), zIndexOffset: 900 })
      .addTo(map)
      .bindTooltip('NRG Stadium', {
        direction: 'top',
        offset: [0, -15],
        className: 'map-tooltip',
      })

    L.marker([29.750842, -95.353352], { icon: fanFestivalIcon(), zIndexOffset: 850 })
      .addTo(map)
      .bindTooltip('Fan Festival', {
        direction: 'top',
        offset: [0, -17],
        className: 'map-tooltip',
      })

    return () => {
      baseLayerRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (baseLayerRef.current) {
      map.removeLayer(baseLayerRef.current)
    }

    const nextLayer = baseTileLayer(mapType)
    nextLayer.addTo(map)
    baseLayerRef.current = nextLayer
  }, [mapType])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (goesLayerRef.current) {
      map.removeLayer(goesLayerRef.current)
      goesLayerRef.current = null
    }

    if (!goesEnabled) return

    const layer = goesSatelliteLayer()
    layer.addTo(map)
    goesLayerRef.current = layer
  }, [goesEnabled, mapType])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (trafficLayerRef.current) {
      map.removeLayer(trafficLayerRef.current)
      trafficLayerRef.current = null
    }

    if (!trafficEnabled) return

    const layer = googleTrafficLayer()
    layer.addTo(map)
    layer.bringToFront()
    trafficLayerRef.current = layer
  }, [trafficEnabled, mapType])

  // Update INRIX segment speed polylines
  useEffect(() => {
    const layer = segmentLayerRef.current
    if (!layer) return
    layer.clearLayers()
    segments.forEach(seg => {
      if (!seg.startLat || !seg.startLng || !seg.endLat || !seg.endLng) return
      const color = segmentColor(seg.speed, seg.averageSpeed)
      const weight = segmentWeight(seg.speed, seg.averageSpeed)
      const ratio = seg.averageSpeed > 0 ? (seg.speed / seg.averageSpeed * 100).toFixed(0) : '?'
      L.polyline(
        [[seg.startLat, seg.startLng], [seg.endLat, seg.endLng]],
        { color, weight, opacity: 0.8 }
      )
        .addTo(layer)
        .bindTooltip(
          `<b style="color:${color}">${seg.speed} mph</b> (${ratio}% of free flow)`,
          { sticky: true, className: 'map-tooltip' }
        )
    })
  }, [segments])

  // Update INRIX incident markers
  useEffect(() => {
    const layer = incidentLayerRef.current
    if (!layer) return
    layer.clearLayers()
    incidentMarkersRef.current.clear()
    incidents.forEach(inc => {
      if (!inc.lat || !inc.lng) return
      const timeStr = inc.startTime
        ? new Date(inc.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
        : ''
      const marker = L.marker([inc.lat, inc.lng], { icon: incidentIcon(inc.type, inc.severity, inc.id === selectedIncidentId) })
        .addTo(layer)
        .bindPopup(
          `<div style="font-family:monospace;font-size:11px;color:#e8edf5;min-width:180px">` +
          `<b style="color:#f97316">${inc.type}${inc.subType ? ` · ${inc.subType}` : ''}</b><br>` +
          `<span style="color:#c8d6e8">${inc.shortDesc}</span>` +
          `${inc.fullDesc && inc.fullDesc !== inc.shortDesc ? `<br><span style="color:#7a8ba8;font-size:10px">${inc.fullDesc}</span>` : ''}` +
          `${timeStr ? `<br><span style="color:#4a5a72">${timeStr}</span>` : ''}` +
          `</div>`,
          { className: 'nrg-popup', closeOnClick: false, autoClose: false }
        )
      marker.on('click', () => onIncidentSelect(inc.id === selectedIncidentId ? null : inc.id))
      incidentMarkersRef.current.set(inc.id, marker)
      if (inc.id === selectedIncidentId) {
        marker.openPopup()
      }
    })
  }, [incidents, selectedIncidentId, onIncidentSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedIncidentId) return

    const incident = incidents.find(inc => inc.id === selectedIncidentId)
    if (!incident || !incident.lat || !incident.lng) return

    incidentMarkersRef.current.get(selectedIncidentId)?.openPopup()

    map.flyTo([incident.lat, incident.lng], Math.max(map.getZoom(), 16), {
      animate: true,
      duration: 0.6,
    })

    window.setTimeout(() => {
      incidentMarkersRef.current.get(selectedIncidentId)?.openPopup()
    }, 650)
    hadFocusedSelectionRef.current = true
  }, [incidents, selectedIncidentId])

  useEffect(() => {
    const layer = metroLayerRef.current
    if (!layer) return

    layer.clearLayers()
    metroMarkersRef.current.clear()

    const visibleMetroUpdates = selectedMetroId
      ? metroUpdates.filter(update => update.id === selectedMetroId)
      : metroEnabled ? metroUpdates : []

    visibleMetroUpdates.forEach(update => {
      if (!update.lat || !update.lng) return
      const selected = update.id === selectedMetroId
      const marker = L.marker([update.lat, update.lng], { icon: metroIcon(update, selected) })
        .addTo(layer)
        .bindPopup(
          (() => {
            const rail = isRailRoute(update)
            const dirLabel = update.directionId === 0 ? 'Outbound' : update.directionId === 1 ? 'Inbound' : null
            const dirArrow = update.directionId === 0 ? '▲' : update.directionId === 1 ? '▼' : ''
            const dirColor = rail
              ? railLineColor(update).bg
              : (busDirectionStyle(update.directionId).bg)
            const dirLine = dirLabel
              ? `<span style="color:${dirColor};font-weight:bold">${dirArrow} ${dirLabel}</span><br>`
              : ''
            const srcLine = update.isScheduled
              ? `<span style="color:#7a8ba8">Scheduled · Stop ${update.nextStopId ?? '--'}</span>`
              : `<span style="color:#7a8ba8">${update.positionSource === 'vehicle' ? 'Vehicle position' : 'Next stop location'} · Stop ${update.nextStopId ?? '--'}${update.vehicleId ? ` · Vehicle ${update.vehicleId}` : ''}</span>`
            return `<div style="font-family:monospace;font-size:11px;color:#e8edf5;min-width:180px">` +
              `<b style="color:#67e8f9">METRO ${metroRouteLabel(update)}</b><br>` +
              dirLine +
              `<span style="color:#c8d6e8">Trip ${update.tripId}</span><br>` +
              srcLine +
              `</div>`
          })(),
          { className: 'nrg-popup' }
        )
      marker.on('click', () => onMetroSelect(update.id === selectedMetroId ? null : update.id))
      metroMarkersRef.current.set(update.id, marker)
    })
  }, [metroUpdates, selectedMetroId, onMetroSelect, metroEnabled])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !selectedMetroId) return

    const update = metroUpdates.find(item => item.id === selectedMetroId)
    if (!update?.lat || !update.lng) return

    map.flyTo([update.lat, update.lng], Math.max(map.getZoom(), 16), {
      animate: true,
      duration: 0.6,
    })

    window.setTimeout(() => {
      metroMarkersRef.current.get(selectedMetroId)?.openPopup()
    }, 650)
    hadFocusedSelectionRef.current = true
  }, [metroUpdates, selectedMetroId])

  useEffect(() => {
    const map = mapRef.current
    if (!map || selectedIncidentId || selectedMetroId || !hadFocusedSelectionRef.current) return

    map.closePopup()
    map.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, {
      animate: true,
      duration: 0.6,
    })
    hadFocusedSelectionRef.current = false
  }, [selectedIncidentId, selectedMetroId])


  // Update camera markers
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    cameraMarkersRef.current.forEach(m => m.remove())
    cameraMarkersRef.current.clear()

    const visibleCams = camerasEnabled
      ? cameras.filter(cam => cam.streamUrl || cam.imageUrl)
      : selectedCameraId
        ? cameras.filter(cam => cam.id === selectedCameraId && (cam.streamUrl || cam.imageUrl))
        : []

    visibleCams.forEach(cam => {
      const hasFeed = true
      const marker = L.marker([cam.lat, cam.lng], { icon: cameraIcon(cam.id === selectedCameraId, hasFeed) })
        .addTo(map)
        .bindTooltip(
          `${cam.name}<br><span style="color:#7a8ba8">${cam.highway} · ${cam.direction}</span>`,
          {
          direction: 'top',
          offset: [0, -13],
          className: 'map-tooltip',
          }
        )
      if (hasFeed) {
        marker.on('click', () => onCameraSelect(cam.id))
      } else {
        marker.bindPopup(
          `<div style="font-family:monospace;font-size:11px;color:#e8edf5;min-width:190px">` +
          `<b style="color:#2dd4bf">${cam.name}</b><br>` +
          `<span style="color:#94a3b8">${cam.highway} · ${cam.direction}</span><br>` +
          `<span style="color:#64748b">No live stream URL is available for this inventory location.</span>` +
          `</div>`,
          { className: 'nrg-popup' }
        )
      }
      cameraMarkersRef.current.set(cam.id, marker)
    })
  }, [cameras, selectedCameraId, onCameraSelect, camerasEnabled])

  const selectedType = BASE_MAP_TYPES.find(t => t.id === mapType) ?? BASE_MAP_TYPES[0]

  return (
    <div className="relative size-full">
      <div ref={containerRef} className="size-full" />

      <div className="absolute top-3 right-3 z-[1000] flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            mapRef.current?.flyTo(DEFAULT_CENTER, DEFAULT_ZOOM, { animate: true, duration: 0.7 })
          }}
          className="w-9 h-9 rounded bg-white text-[#202124] shadow-lg border border-black/10 flex items-center justify-center hover:bg-[#f8fafd] transition-colors"
          title="Reset view"
          aria-label="Reset map to default view"
        >
          <Home size={17} />
        </button>
        <button
          type="button"
          onClick={() => setSwitcherOpen(true)}
          className="w-9 h-9 rounded bg-white text-[#202124] shadow-lg border border-black/10 flex items-center justify-center hover:bg-[#f8fafd] transition-colors"
          title="Map layers"
          aria-label="Open map layer switcher"
        >
          <Layers size={18} />
        </button>
      </div>

      {switcherOpen && (
        <div className="absolute top-14 right-3 z-[1001] w-[276px] rounded bg-white text-[#202124] shadow-2xl border border-black/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-black/10">
            <div>
              <div className="text-[15px] font-semibold leading-tight">Map details</div>
              <div className="text-[11px] text-[#5f6368] mt-0.5">{selectedType.label} map</div>
            </div>
            <button
              type="button"
              onClick={() => setSwitcherOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-black/[0.06]"
              title="Close"
              aria-label="Close map layer switcher"
            >
              <X size={18} />
            </button>
          </div>

          <div className="px-4 py-3 border-b border-black/10">
            <div className="text-[13px] font-semibold mb-3">Map details</div>
            <button
              type="button"
              onClick={() => setTrafficEnabled(v => !v)}
              className="w-full flex items-center justify-between rounded-md px-2 py-2 hover:bg-black/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2">
                <span
                  className={[
                    'w-10 h-10 rounded-md border flex items-center justify-center',
                    trafficEnabled ? 'border-[#00838f] bg-[#e5f5f7] text-[#00838f]' : 'border-black/10 bg-[#f1f3f4] text-[#5f6368]',
                  ].join(' ')}
                >
                  <Car size={19} />
                </span>
                <span className={`text-[13px] ${trafficEnabled ? 'text-[#00838f] font-medium' : 'text-[#3c4043]'}`}>
                  Traffic
                </span>
              </span>
              <span
                className={[
                  'w-9 h-5 rounded-full p-0.5 transition-colors',
                  trafficEnabled ? 'bg-[#00838f]' : 'bg-[#dadce0]',
                ].join(' ')}
              >
                <span
                  className={[
                    'block w-4 h-4 rounded-full bg-white shadow transition-transform',
                    trafficEnabled ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
            <button
              type="button"
              onClick={() => onCamerasEnabledChange(!camerasEnabled)}
              className="w-full flex items-center justify-between rounded-md px-2 py-2 hover:bg-black/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2">
                <span
                  className={[
                    'w-10 h-10 rounded-md border flex items-center justify-center',
                    camerasEnabled ? 'border-[#00838f] bg-[#e5f5f7] text-[#00838f]' : 'border-black/10 bg-[#f1f3f4] text-[#5f6368]',
                  ].join(' ')}
                >
                  <Camera size={19} />
                </span>
                <span className={`text-[13px] ${camerasEnabled ? 'text-[#00838f] font-medium' : 'text-[#3c4043]'}`}>
                  Cameras
                </span>
              </span>
              <span
                className={[
                  'w-9 h-5 rounded-full p-0.5 transition-colors',
                  camerasEnabled ? 'bg-[#00838f]' : 'bg-[#dadce0]',
                ].join(' ')}
              >
                <span
                  className={[
                    'block w-4 h-4 rounded-full bg-white shadow transition-transform',
                    camerasEnabled ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMetroEnabled(v => !v)}
              className="w-full flex items-center justify-between rounded-md px-2 py-2 hover:bg-black/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2">
                <span
                  className={[
                    'w-10 h-10 rounded-md border flex items-center justify-center',
                    metroEnabled ? 'border-[#00838f] bg-[#e5f5f7] text-[#00838f]' : 'border-black/10 bg-[#f1f3f4] text-[#5f6368]',
                  ].join(' ')}
                >
                  <span className="flex items-center gap-0.5">
                    <Bus size={16} />
                    <TrainFront size={16} />
                  </span>
                </span>
                <span className={`text-[13px] ${metroEnabled ? 'text-[#00838f] font-medium' : 'text-[#3c4043]'}`}>
                  METRO Transit
                </span>
              </span>
              <span
                className={[
                  'w-9 h-5 rounded-full p-0.5 transition-colors',
                  metroEnabled ? 'bg-[#00838f]' : 'bg-[#dadce0]',
                ].join(' ')}
              >
                <span
                  className={[
                    'block w-4 h-4 rounded-full bg-white shadow transition-transform',
                    metroEnabled ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
            <button
              type="button"
              onClick={() => setGoesEnabled(v => !v)}
              className="w-full flex items-center justify-between rounded-md px-2 py-2 hover:bg-black/[0.04] transition-colors"
            >
              <span className="flex items-center gap-2">
                <span
                  className={[
                    'w-10 h-10 rounded-md border flex items-center justify-center',
                    goesEnabled ? 'border-[#00838f] bg-[#e5f5f7] text-[#00838f]' : 'border-black/10 bg-[#f1f3f4] text-[#5f6368]',
                  ].join(' ')}
                >
                  <CloudSun size={19} />
                </span>
                <span>
                  <span className={`block text-[13px] ${goesEnabled ? 'text-[#00838f] font-medium' : 'text-[#3c4043]'}`}>
                    GOES Satellite
                  </span>
                  <span className="block text-[10px] text-[#70757a] leading-tight">
                    Colorized clouds
                  </span>
                </span>
              </span>
              <span
                className={[
                  'w-9 h-5 rounded-full p-0.5 transition-colors',
                  goesEnabled ? 'bg-[#00838f]' : 'bg-[#dadce0]',
                ].join(' ')}
              >
                <span
                  className={[
                    'block w-4 h-4 rounded-full bg-white shadow transition-transform',
                    goesEnabled ? 'translate-x-4' : 'translate-x-0',
                  ].join(' ')}
                />
              </span>
            </button>
          </div>

          <div className="px-4 py-3">
            <div className="text-[13px] font-semibold mb-3">Map type</div>
            <div className="grid grid-cols-2 gap-3">
              {BASE_MAP_TYPES.map(({ id, label, icon: Icon }) => {
                const active = mapType === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setMapType(id)
                      setSwitcherOpen(false)
                    }}
                    className="text-left group"
                  >
                    <div
                      className={[
                        'h-16 rounded-md border overflow-hidden flex items-center justify-center transition-all',
                        active ? 'border-[#00838f] ring-2 ring-[#00838f]' : 'border-black/10 group-hover:border-black/30',
                        id === 'standard' ? 'bg-[#eef1ea]' : '',
                        id === 'roadmap' ? 'bg-[#dbe8dc]' : '',
                        id === 'satellite' ? 'bg-[#68706d]' : '',
                        id === 'hybrid' ? 'bg-[#737a76]' : '',
                        id === 'terrain' ? 'bg-[#cfd9c8]' : '',
                      ].join(' ')}
                    >
                      <Icon
                        size={24}
                        className={id === 'satellite' || id === 'hybrid' ? 'text-white' : 'text-[#3c4043]'}
                      />
                    </div>
                    <div className={`text-[12px] mt-1.5 text-center ${active ? 'text-[#00838f] font-medium' : 'text-[#5f6368]'}`}>
                      {label}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
