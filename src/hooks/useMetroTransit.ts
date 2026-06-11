import { useCallback, useEffect, useState } from 'react'
import { transit_realtime } from 'gtfs-realtime-bindings'
import JSZip from 'jszip'
import Papa from 'papaparse'
import type { MetroTripUpdate } from '@/types'

interface MetroTransitState {
  updates: MetroTripUpdate[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

type GtfsNumber = number | { toNumber: () => number }


interface MetroStop {
  stopId: string
  lat: number
  lng: number
}

interface MetroRoute {
  routeId: string
  shortName: string | null
  longName: string | null
  routeType: number | null
}

interface RailStopTimeEntry {
  tripId: string
  routeId: string
  directionId: number | null
  headsign: string | null
  stopId: string
  stopSequence: number
  arrivalSecs: number
}

interface MetroStaticData {
  stopsById: Map<string, MetroStop>
  routesById: Map<string, MetroRoute>
  railStopTimes: RailStopTimeEntry[]
}

let staticDataPromise: Promise<MetroStaticData> | null = null

function toDateString(seconds: GtfsNumber | null | undefined): string | null {
  if (seconds == null) return null
  const value = typeof seconds === 'number' ? seconds : seconds.toNumber()
  if (!Number.isFinite(value) || value <= 0) return null
  return new Date(value * 1000).toISOString()
}

function toDelaySeconds(delay: GtfsNumber | null | undefined): number | null {
  if (delay == null) return null
  return typeof delay === 'number' ? delay : delay.toNumber()
}

function gtfsTimeToSeconds(t: string): number {
  const parts = t.split(':').map(Number)
  if (parts.length !== 3 || parts.some(isNaN)) return -1
  return parts[0] * 3600 + parts[1] * 60 + parts[2]
}

function parseActiveServiceIds(
  calendarText: string | undefined,
  calendarDatesText: string | undefined,
  date: Date
): Set<string> {
  const dayCol = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()]
  const pad = (n: number) => String(n).padStart(2, '0')
  const dateStr = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`

  const active = new Set<string>()
  if (calendarText) {
    Papa.parse<Record<string, string>>(calendarText, { header: true, skipEmptyLines: true })
      .data.forEach(row => {
        if (row[dayCol] === '1' && dateStr >= row.start_date && dateStr <= row.end_date)
          active.add(row.service_id)
      })
  }
  if (calendarDatesText) {
    Papa.parse<Record<string, string>>(calendarDatesText, { header: true, skipEmptyLines: true })
      .data.forEach(row => {
        if (row.date !== dateStr) return
        if (row.exception_type === '1') active.add(row.service_id)
        if (row.exception_type === '2') active.delete(row.service_id)
      })
  }
  return active
}

function normalizeTripUpdate(entity: transit_realtime.IFeedEntity): MetroTripUpdate | null {
  const update = entity.tripUpdate
  const trip = update?.trip
  if (!update || !trip?.tripId) return null

  const firstStop = update.stopTimeUpdate?.find(stop => stop.arrival?.time || stop.departure?.time)
  const delay = firstStop?.arrival?.delay ?? firstStop?.departure?.delay ?? null
  const time = firstStop?.arrival?.time ?? firstStop?.departure?.time ?? null

  return {
    id: entity.id ?? trip.tripId,
    routeId: trip.routeId ?? 'Route',
    tripId: trip.tripId,
    directionId: trip.directionId ?? undefined,
    delaySeconds: toDelaySeconds(delay),
    nextStopId: firstStop?.stopId ?? null,
    nextStopSequence: firstStop?.stopSequence ?? null,
    arrivalTime: toDateString(time),
    stopUpdates: update.stopTimeUpdate?.length ?? 0,
  }
}


async function fetchStaticData(): Promise<MetroStaticData> {
  if (staticDataPromise) return staticDataPromise

  staticDataPromise = (async () => {
    const res = await fetch('/metro-static/google_transit.zip')
    if (!res.ok) return { stopsById: new Map(), routesById: new Map(), railStopTimes: [] }

    const zip = await JSZip.loadAsync(await res.arrayBuffer())
    const [stopsText, routesText, calendarText, calendarDatesText, tripsText, stopTimesText] =
      await Promise.all([
        zip.file('stops.txt')?.async('string'),
        zip.file('routes.txt')?.async('string'),
        zip.file('calendar.txt')?.async('string'),
        zip.file('calendar_dates.txt')?.async('string'),
        zip.file('trips.txt')?.async('string'),
        zip.file('stop_times.txt')?.async('string'),
      ])

    const stopsById = new Map<string, MetroStop>()
    const routesById = new Map<string, MetroRoute>()

    if (stopsText) {
      Papa.parse<Record<string, string>>(stopsText, { header: true, skipEmptyLines: true })
        .data.forEach(row => {
          const lat = Number(row.stop_lat)
          const lng = Number(row.stop_lon)
          if (!row.stop_id || !Number.isFinite(lat) || !Number.isFinite(lng)) return
          stopsById.set(row.stop_id, { stopId: row.stop_id, lat, lng })
        })
    }

    if (routesText) {
      Papa.parse<Record<string, string>>(routesText, { header: true, skipEmptyLines: true })
        .data.forEach(row => {
          if (!row.route_id) return
          routesById.set(row.route_id, {
            routeId: row.route_id,
            shortName: row.route_short_name || null,
            longName: row.route_long_name || null,
            routeType: row.route_type ? Number(row.route_type) : null,
          })
        })
    }

    // Build rail schedule from static GTFS files
    const railStopTimes: RailStopTimeEntry[] = []

    const railRouteIds = new Set(
      [...routesById.values()]
        .filter(r => r.routeType === 0 || r.routeType === 1 || r.routeType === 2)
        .map(r => r.routeId)
    )

    if (railRouteIds.size > 0 && tripsText && stopTimesText) {
      const today = new Date()
      const activeServiceIds = parseActiveServiceIds(calendarText, calendarDatesText, today)

      interface TripMeta { routeId: string; directionId: number | null; headsign: string | null }
      const railTripMeta = new Map<string, TripMeta>()

      Papa.parse<Record<string, string>>(tripsText, { header: true, skipEmptyLines: true })
        .data.forEach(row => {
          if (!railRouteIds.has(row.route_id)) return
          if (!activeServiceIds.has(row.service_id)) return
          if (!row.trip_id) return
          railTripMeta.set(row.trip_id, {
            routeId: row.route_id,
            directionId: row.direction_id != null && row.direction_id !== '' ? Number(row.direction_id) : null,
            headsign: row.trip_headsign || null,
          })
        })

      if (railTripMeta.size > 0) {
        Papa.parse<Record<string, string>>(stopTimesText, { header: true, skipEmptyLines: true })
          .data.forEach(row => {
            const meta = railTripMeta.get(row.trip_id)
            if (!meta) return
            const arrSecs = gtfsTimeToSeconds(row.arrival_time || row.departure_time)
            if (arrSecs < 0) return
            railStopTimes.push({
              tripId: row.trip_id,
              routeId: meta.routeId,
              directionId: meta.directionId,
              headsign: meta.headsign,
              stopId: row.stop_id,
              stopSequence: Number(row.stop_sequence),
              arrivalSecs: arrSecs,
            })
          })
      }
    }

    return { stopsById, routesById, railStopTimes }
  })()

  return staticDataPromise
}

function getScheduledRailUpdates(staticData: MetroStaticData, now: Date): MetroTripUpdate[] {
  const { railStopTimes, routesById, stopsById } = staticData
  if (railStopTimes.length === 0) return []

  const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds()
  const windowSecs = 90 * 60

  // Find the next upcoming stop per trip within the window
  const nextByTrip = new Map<string, RailStopTimeEntry>()
  for (const entry of railStopTimes) {
    if (entry.arrivalSecs < nowSecs || entry.arrivalSecs > nowSecs + windowSecs) continue
    const existing = nextByTrip.get(entry.tripId)
    if (!existing || entry.arrivalSecs < existing.arrivalSecs) {
      nextByTrip.set(entry.tripId, entry)
    }
  }

  if (nextByTrip.size === 0) return []

  const todayMidnight = new Date(now)
  todayMidnight.setHours(0, 0, 0, 0)

  // Build update objects grouped by route+direction, capped at 3 per group
  const groups = new Map<string, MetroTripUpdate[]>()
  for (const entry of nextByTrip.values()) {
    const route = routesById.get(entry.routeId)
    const stop = stopsById.get(entry.stopId)
    const arrivalDate = new Date(todayMidnight.getTime() + entry.arrivalSecs * 1000)

    const update: MetroTripUpdate = {
      id: `sched-${entry.tripId}`,
      routeId: entry.routeId,
      routeShortName: route?.shortName ?? null,
      routeLongName: route?.longName ?? null,
      routeType: route?.routeType ?? null,
      tripId: entry.tripId,
      directionId: entry.directionId ?? undefined,
      delaySeconds: null,
      nextStopId: entry.stopId,
      nextStopSequence: entry.stopSequence,
      arrivalTime: arrivalDate.toISOString(),
      stopUpdates: 0,
      lat: stop?.lat,
      lng: stop?.lng,
      positionSource: stop ? 'stop' : undefined,
      isScheduled: true,
    }

    const key = `${entry.routeId}-${entry.directionId ?? 0}`
    const group = groups.get(key) ?? []
    group.push(update)
    groups.set(key, group)
  }

  const result: MetroTripUpdate[] = []
  for (const group of groups.values()) {
    group.sort((a, b) => {
      const aT = a.arrivalTime ? new Date(a.arrivalTime).getTime() : Infinity
      const bT = b.arrivalTime ? new Date(b.arrivalTime).getTime() : Infinity
      return aT - bT
    })
    result.push(...group.slice(0, 3))
  }
  return result
}

export function useMetroTransit() {
  const [state, setState] = useState<MetroTransitState>({
    updates: [],
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const [tripRes, staticData] = await Promise.all([
        fetch('/metro-api/GtfsRealtime/TripUpdates'),
        fetchStaticData(),
      ])
      if (!tripRes.ok) throw new Error(`METRO TripUpdates failed (${tripRes.status})`)

      const tripBuffer = await tripRes.arrayBuffer()
      const tripFeed = transit_realtime.FeedMessage.decode(new Uint8Array(tripBuffer))
      const updates = tripFeed.entity
        .map(normalizeTripUpdate)
        .filter(Boolean) as MetroTripUpdate[]

      const updatesWithPositions = updates.map(update => {
        const route = staticData.routesById.get(update.routeId)
        const namedUpdate = route
          ? { ...update, routeShortName: route.shortName, routeLongName: route.longName, routeType: route.routeType }
          : update

        const stop = update.nextStopId ? staticData.stopsById.get(update.nextStopId) : null
        return stop ? { ...namedUpdate, lat: stop.lat, lng: stop.lng, positionSource: 'stop' as const } : namedUpdate
      })

      const scheduledRail = getScheduledRailUpdates(staticData, new Date())

      setState({
        updates: [...updatesWithPositions, ...scheduledRail],
        loading: false,
        error: null,
        lastUpdated: new Date(),
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'METRO transit unavailable'
      setState(s => ({ ...s, loading: false, error: msg }))
    }
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}
