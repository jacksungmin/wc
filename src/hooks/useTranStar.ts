import { useState, useEffect, useCallback } from 'react'
import type { TranStarIncident, TranStarLaneClosure, TranStarFloodRisk, TranStarCorridor, TranStarSegmentDetail } from '@/types'

// Set VITE_TRANSTAR_LIVE=true once TranStar grants live feed access
const USE_LIVE = import.meta.env.VITE_TRANSTAR_LIVE === 'true'
const SUFFIX = USE_LIVE ? '' : '_sample'
const INCIDENTS_URL = `/transtar-api/incidents${SUFFIX}.json`
const CLOSURES_URL = `/transtar-api/laneclosures${SUFFIX}.json`
const SEGMENTS_URL = `/transtar-api/speedsegments${SUFFIX}.json`
const FLOOD_RISKS_URL = `/transtar-api/roadwayfloodwarning${SUFFIX}.json`
const REFRESH_MS = 60_000

// Key game-day corridors to NRG Stadium
const CORRIDOR_DEFS: { label: string; rd: string; dir: string; group: 'to' | 'from'; camHighway: string | null }[] = [
  { label: 'IH-610 S Loop', rd: 'IH-610 South Loop', dir: 'WB', group: 'to',   camHighway: 'I-610 South Loop' },
  { label: 'IH-610 W Loop', rd: 'IH-610 West Loop',  dir: 'SB', group: 'to',   camHighway: 'I-610 West Loop'  },
  { label: 'US-59 SW',      rd: 'US-59 Southwest',   dir: 'NB', group: 'to',   camHighway: null               },
  { label: 'IH-610 S Loop', rd: 'IH-610 South Loop', dir: 'EB', group: 'from', camHighway: 'I-610 South Loop' },
  { label: 'SH-288',        rd: 'SH-288',             dir: 'NB', group: 'from', camHighway: 'SH-288'           },
  { label: 'IH-45 Gulf',    rd: 'IH-45 Gulf',         dir: 'NB', group: 'from', camHighway: 'IH-45 Gulf'       },
]

// Bounding box ~10 miles around NRG Stadium (29.6847, -95.4107)
const nearNRG = (lat: number, lng: number) =>
  lat > 29.53 && lat < 29.85 && lng > -95.57 && lng < -95.26

interface TranStarState {
  incidents: TranStarIncident[]
  laneClosures: TranStarLaneClosure[]
  floodRisks: TranStarFloodRisk[]
  corridors: TranStarCorridor[]
  connected: boolean
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

function asBoolean(value: unknown): boolean {
  return value === true || String(value).toLowerCase() === 'true'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFloodRisk(raw: any, index: number): TranStarFloodRisk | null {
  const lat = Number(raw.Latitude ?? raw.latitude ?? raw.lat)
  const lng = Number(raw.Longitude ?? raw.longitude ?? raw.lng)
  if (!validCoords(lat, lng)) return null
  return {
    id: `ts-flood-${raw.SensorId ?? raw.sensorId ?? index}`,
    sensorName: String(raw.SensorName ?? raw.sensorName ?? `Flood sensor ${index + 1}`),
    timestamp: String(raw.Timestamp ?? raw.timestamp ?? ''),
    lat,
    lng,
    radiusMiles: Math.max(Number(raw.Radius ?? raw.radius) || 0.5, 0.1),
    precipitationInches: Number(raw.PrecipitationLatestValue ?? raw.precipitationLatestValue) || 0,
    streamElevation: Number(raw.StreamElevationLatestValue ?? raw.streamElevationLatestValue) || 0,
    precipitationAlert: asBoolean(raw.IsPrecipitationAlert ?? raw.isPrecipitationAlert),
    streamElevationAlert: asBoolean(raw.IsStreamElevationAlert ?? raw.isStreamElevationAlert),
    sensorUrl: String(raw.SensorUrl ?? raw.sensorUrl ?? ''),
    regionCode: String(raw.RegionCode ?? raw.regionCode ?? ''),
  }
}

// Houston is ~29°N, ~95°W. TranStar uses -1/-1 as "no location" sentinel.
function validCoords(lat: number, lng: number): boolean {
  return !Number.isNaN(lat) && !Number.isNaN(lng) && lat > 25 && lat < 32 && lng < -90 && lng > -100
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseIncident(raw: any, index: number): TranStarIncident | null {
  const lat = parseFloat(raw.lat)
  const lng = parseFloat(raw.lng)
  if (!validCoords(lat, lng)) return null
  return {
    id: String(raw.id ?? `ts-inc-${index}`),
    location: String(raw.location ?? ''),
    desc: String(raw.desc ?? raw.description ?? ''),
    vehicles: parseInt(String(raw.veh ?? '0'), 10) || 0,
    lanes: String(raw.lanes ?? ''),
    status: String(raw.status ?? 'Detected'),
    time: String(raw.time ?? ''),
    date: String(raw.date ?? 'today'),
    lat,
    lng,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseClosure(raw: any, index: number): TranStarLaneClosure | null {
  const lat = parseFloat(raw.lat)
  const lng = parseFloat(raw.lng)
  if (!validCoords(lat, lng)) return null
  return {
    id: String(raw.id ?? `ts-lc-${index}`),
    location: String(raw.location ?? ''),
    roadway: String(raw.roadway ?? ''),
    lanes: String(raw.lanes ?? ''),
    duration: String(raw.duration ?? ''),
    detour: String(raw.detour ?? ''),
    status: String(raw.status ?? ''),
    agency: String(raw.agency ?? ''),
    hotspot: raw.hotspot === 'Y' || raw.hotspot === true,
    project: String(raw.project ?? ''),
    lat,
    lng,
    startTime: String(raw.starttime ?? raw.startTime ?? ''),
    endTime: String(raw.endtime ?? raw.endTime ?? ''),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildCorridors(rawSegs: any[]): TranStarCorridor[] {
  return CORRIDOR_DEFS.map(def => {
    const segs = rawSegs.filter(s => {
      if (s.rd !== def.rd || s.dir !== def.dir) return false
      const c = s.coord?.[0]
      return c && nearNRG(Number(c.lat), Number(c.lon))
    })

    const validTT = segs.filter((s) => Number(s.tt) > 0)
    const validSP = segs.filter((s) => Number(s.sp) > 0)
    const totalTTSec = validTT.reduce((sum, s) => sum + Number(s.tt), 0)
    const totalDlySec = segs.reduce((sum, s) => {
      const d = Number(s.dly)
      return sum + (d > 0 ? d : 0)
    }, 0)
    const avgSpeed = validSP.length > 0
      ? validSP.reduce((sum, s) => sum + Number(s.sp), 0) / validSP.length
      : 0

    const segments: TranStarSegmentDetail[] = segs.map(s => ({
      ft: String(s.ft ?? ''),
      speedMph: Number(s.sp) > 0 ? Math.round(Number(s.sp)) : -1,
      travelSec: Number(s.tt) > 0 ? Math.round(Number(s.tt)) : -1,
      delaySec: Math.round(Number(s.dly) || 0),
      lengthMi: Number(s.len) || 0,
    }))

    return {
      label: def.label,
      rd: def.rd,
      dir: def.dir,
      group: def.group,
      travelMin: validTT.length > 0 ? Math.round(totalTTSec / 60) : -1,
      delayMin: Math.round(totalDlySec / 60),
      avgSpeed: Math.round(avgSpeed),
      segments,
      camHighway: def.camHighway,
    }
  })
}

export function useTranStar() {
  const [state, setState] = useState<TranStarState>({
    incidents: [],
    laneClosures: [],
    floodRisks: [],
    corridors: [],
    connected: false,
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const [incRes, closRes, segRes, floodRes] = await Promise.all([
        fetch(INCIDENTS_URL),
        fetch(CLOSURES_URL),
        fetch(SEGMENTS_URL),
        fetch(FLOOD_RISKS_URL),
      ])

      const [incData, closData, segData, floodData] = await Promise.all([
        incRes.ok ? incRes.json() : null,
        closRes.ok ? closRes.json() : null,
        segRes.ok ? segRes.json() : null,
        floodRes.ok ? floodRes.json() : null,
      ])

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawInc: any[] = incData?.result?.incidents ?? incData?.incidents ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawClos: any[] = closData?.result?.laneclosures ?? closData?.laneclosures ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawSegs: any[] = segData?.result?.seg ?? []
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rawFloodRisks: any[] = floodData?.result ?? floodData?.roadwayFloodWarnings ?? []

      const incidents = (Array.isArray(rawInc) ? rawInc : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any, i: number) => parseIncident(r, i))
        .filter(Boolean) as TranStarIncident[]

      const laneClosures = (Array.isArray(rawClos) ? rawClos : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any, i: number) => parseClosure(r, i))
        .filter(Boolean) as TranStarLaneClosure[]

      const corridors = buildCorridors(Array.isArray(rawSegs) ? rawSegs : [])
      const floodRisks = (Array.isArray(rawFloodRisks) ? rawFloodRisks : [])
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .map((r: any, i: number) => parseFloodRisk(r, i))
        .filter(Boolean) as TranStarFloodRisk[]

      setState({
        incidents,
        laneClosures,
        floodRisks,
        corridors,
        connected: true,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'TranStar unavailable'
      setState(s => ({ ...s, loading: false, connected: false, error: msg }))
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}
