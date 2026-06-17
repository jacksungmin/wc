import { useState, useEffect, useRef, useCallback } from 'react'
import type { InrixIncident, InrixSegment } from '@/types'

const INRIX_ENABLED = import.meta.env.VITE_ENABLE_INRIX === 'true'
const APP_ID = import.meta.env.VITE_INRIX_APP_ID as string | undefined
const HASH_TOKEN = import.meta.env.VITE_INRIX_HASH_TOKEN as string | undefined

// Bounding box ~4 miles around NRG Stadium.
const NW = '29.750|-95.460'
const SE = '29.640|-95.360'
const BOX = `${NW},${SE}`
const STALE_RESTRICTION_DAYS = 7
const INCIDENT_LOOKAHEAD_HOURS = 2

interface InrixState {
  token: string | null
  incidents: InrixIncident[]
  segments: InrixSegment[]
  connected: boolean
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

async function getAppToken(): Promise<{ token: string; expiry: string }> {
  if (!APP_ID || !HASH_TOKEN) throw new Error('INRIX credentials not configured')
  const res = await fetch(`/inrix-uas/v1/appToken?appId=${APP_ID}&hashToken=${HASH_TOKEN}`)
  if (!res.ok) throw new Error(`INRIX auth failed (${res.status})`)
  const data = await res.json()
  const r = data.result ?? data
  if (!r?.token) throw new Error('No token in INRIX response')
  return { token: r.token, expiry: r.expiry ?? r.TokenExpiry ?? '' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseIncident(inc: any): InrixIncident | null {
  const coords = inc.geometry?.coordinates
  const lat = inc.startPoint?.lat ?? inc.coordinates?.latitude ?? inc.lat ?? coords?.[1] ?? 0
  const lng = inc.startPoint?.lng ?? inc.coordinates?.longitude ?? inc.lng ?? coords?.[0] ?? 0
  if (!lat || !lng) return null
  const shortDesc =
    inc.shortDesc ??
    inc.description ??
    inc.eventDescription ??
    inc.descriptions?.find?.((d: { type?: string }) => d.type?.toLowerCase() === 'short')?.desc ??
    inc.descriptions?.[0]?.desc ??
    'Traffic incident'
  const fullDesc =
    inc.fullDesc ??
    inc.descriptions?.find?.((d: { type?: string }) => d.type?.toLowerCase() === 'long')?.desc ??
    inc.description ??
    ''
  return {
    id: String(inc.id ?? inc.incidentId ?? Math.random()),
    type: inc.type ?? inc.eventType ?? 'Incident',
    subType: inc.subType ?? inc.incidentType ?? '',
    shortDesc,
    fullDesc,
    lat: Number(lat),
    lng: Number(lng),
    severity: Math.max(1, Math.min(4, Number(inc.severity ?? inc.severityLevel ?? 3))) as 1 | 2 | 3 | 4,
    startTime: inc.startTime ?? inc.eventDateTime ?? inc.schedule?.occurrenceStartTime ?? '',
    endTime: inc.endTime ?? inc.eventExpireDateTime ?? inc.schedule?.occurrenceEndTime ?? undefined,
  }
}

function isStaleStaticRestriction(inc: InrixIncident): boolean {
  const started = inc.startTime ? new Date(inc.startTime).getTime() : 0
  if (!started || Number.isNaN(started)) return false

  const ageDays = (Date.now() - started) / 86_400_000
  if (ageDays <= STALE_RESTRICTION_DAYS) return false

  const text = `${inc.shortDesc} ${inc.fullDesc} ${inc.type} ${inc.subType}`.toLowerCase()
  return /height limit|width limit|weight limit|clearance|restriction/.test(text)
}

function isWithinIncidentWindow(inc: InrixIncident): boolean {
  const now = Date.now()
  const windowEnd = now + INCIDENT_LOOKAHEAD_HOURS * 60 * 60 * 1000
  const start = inc.startTime ? new Date(inc.startTime).getTime() : 0

  if (start && !Number.isNaN(start)) {
    const staleCutoff = now - INCIDENT_LOOKAHEAD_HOURS * 60 * 60 * 1000
    return start >= staleCutoff && start <= windowEnd
  }

  const end = inc.endTime ? new Date(inc.endTime).getTime() : 0
  return Boolean(end && !Number.isNaN(end) && end >= now && end <= windowEnd)
}

async function fetchIncidents(token: string): Promise<InrixIncident[]> {
  const params = new URLSearchParams({
    box: BOX,
    incidentType: 'Incidents,Flow,Construction,Events',
    incidentoutputfields: 'all',
    locale: 'en-US',
  })
  const res = await fetch(`/inrix-incident-api/v1/incidents?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()

  const raw: unknown =
    data?.result?.incidents ??
    data?.result?.XDIncidents ??
    data?.result?.GetIncidentsResult?.incidents ??
    data?.incidents ??
    data?.result ??
    []
  const list = Array.isArray(raw) ? raw : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (list.map((i: any) => parseIncident(i)).filter(Boolean) as InrixIncident[])
    .filter(isWithinIncidentWindow)
    .filter(inc => !isStaleStaticRestriction(inc))
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSegment(seg: any): InrixSegment | null {
  const sLat = seg.startPoint?.lat ?? seg.startLat ?? 0
  const sLng = seg.startPoint?.lng ?? seg.startLng ?? 0
  const eLat = seg.endPoint?.lat ?? seg.endLat ?? sLat
  const eLng = seg.endPoint?.lng ?? seg.endLng ?? sLng
  const speed = Number(seg.speed ?? seg.currentSpeed ?? 0)
  const avg = Number(seg.averageSpeed ?? seg.average ?? seg.freeFlowSpeed ?? seg.referenceSpeed ?? seg.reference ?? 60)
  return {
    code: String(seg.code ?? seg.segmentId ?? ''),
    speed,
    averageSpeed: avg || 60,
    travelTime: Number(seg.travelTime ?? seg.travelTimeMinutes ?? 0),
    startLat: Number(sLat),
    startLng: Number(sLng),
    endLat: Number(eLat),
    endLng: Number(eLng),
  }
}

async function fetchSegments(token: string): Promise<InrixSegment[]> {
  const params = new URLSearchParams({
    box: BOX,
    units: '1',
    SpeedOutputFields: 'All',
    FRCLevel: '1,2,3',
  })
  const res = await fetch(`/inrix-segment-api/v1/segments/speed?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return []
  const data = await res.json()

  const raw: unknown =
    data?.result?.segmentSpeeds?.[0]?.segments ??
    data?.result?.segmentspeeds?.[0]?.segments ??
    data?.result?.segments ??
    data?.result ??
    data?.segments ??
    data
  const list = Array.isArray(raw) ? raw : []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return list.map((s: any) => parseSegment(s)).filter(Boolean) as InrixSegment[]
}

export function useInrix() {
  const [state, setState] = useState<InrixState>({
    token: null,
    incidents: [],
    segments: [],
    connected: false,
    loading: INRIX_ENABLED,
    error: null,
    lastUpdated: null,
  })
  const tokenRef = useRef<string | null>(null)
  const expiryRef = useRef<Date | null>(null)

  const ensureToken = useCallback(async (): Promise<string> => {
    const buffer = 2 * 60 * 1000 // refresh 2 min before expiry
    if (
      tokenRef.current &&
      expiryRef.current &&
      expiryRef.current.getTime() - Date.now() > buffer
    ) {
      return tokenRef.current
    }
    const { token, expiry } = await getAppToken()
    tokenRef.current = token
    expiryRef.current = expiry ? new Date(expiry) : new Date(Date.now() + 55 * 60 * 1000)
    return token
  }, [])

  const refresh = useCallback(async () => {
    if (!INRIX_ENABLED) {
      setState({
        token: null,
        incidents: [],
        segments: [],
        connected: false,
        loading: false,
        error: null,
        lastUpdated: null,
      })
      return
    }

    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const token = await ensureToken()
      const [incidents, segments] = await Promise.all([
        fetchIncidents(token),
        fetchSegments(token),
      ])
      setState({
        token,
        incidents,
        segments,
        connected: true,
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'INRIX unavailable'
      setState(s => ({ ...s, loading: false, connected: false, error: msg }))
    }
  }, [ensureToken])

  useEffect(() => {
    if (!INRIX_ENABLED) return
    refresh()
    const interval = setInterval(refresh, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}
