import { useState, useEffect, useCallback } from 'react'
import type { WeatherAlert, WeatherObservation } from '@/types'

// NRG Stadium coordinates
const NRG_LAT = 29.6847
const NRG_LNG = -95.4107
// Nearest NWS observation station: Houston Hobby Airport
const STATION = 'KHOU'
const NWS_HEADERS = { Accept: 'application/geo+json' }

interface WeatherState {
  observation: WeatherObservation | null
  alerts: WeatherAlert[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

function parseObservation(data: Record<string, unknown>): WeatherObservation | null {
  const p = data.properties as Record<string, { value?: number | null }> & { timestamp?: string; textDescription?: string }
  if (!p) return null
  // Require at least a temperature reading to consider the observation valid
  const temp = p.temperature?.value ?? null
  if (temp == null) return null
  return {
    stationId: STATION,
    stationName: 'Houston/Hobby Airport',
    timestamp: p.timestamp ?? '',
    temperature: temp,
    dewpoint: p.dewpoint?.value ?? null,
    windDirection: p.windDirection?.value ?? null,
    windSpeed: p.windSpeed?.value ?? null,
    relativeHumidity: p.relativeHumidity?.value ?? null,
    windChill: p.windChill?.value ?? null,
    heatIndex: p.heatIndex?.value ?? null,
    textDescription: p.textDescription ?? '',
  }
}

async function fetchObservation(): Promise<WeatherObservation | null> {
  // Try /latest first; fall back to ?limit=1 if it returns an error or empty data
  const endpoints = [
    `/weather-api/stations/${STATION}/observations/latest`,
    `/weather-api/stations/${STATION}/observations?limit=1`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, { headers: NWS_HEADERS })
      if (!res.ok) continue

      const data = await res.json()

      // /latest returns a single feature; ?limit=1 returns a FeatureCollection
      const feature = data.type === 'FeatureCollection'
        ? data.features?.[0]
        : data

      const obs = parseObservation(feature ?? {})
      if (obs) return obs
    } catch (e) {
      console.warn('[weather] observation fetch failed:', url, e)
    }
  }

  return null
}

async function fetchAlerts(): Promise<WeatherAlert[]> {
  try {
    const res = await fetch(
      `/weather-api/alerts/active?point=${NRG_LAT},${NRG_LNG}`,
      { headers: NWS_HEADERS }
    )
    if (!res.ok) return []
    const data = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data.features ?? []).map((f: any) => ({
      id: f.id,
      event: f.properties.event ?? 'Weather Alert',
      severity: f.properties.severity ?? 'Unknown',
      urgency: f.properties.urgency ?? 'Unknown',
      headline: f.properties.headline ?? f.properties.event ?? '',
      description: f.properties.description ?? '',
      instruction: f.properties.instruction ?? undefined,
      onset: f.properties.onset ?? '',
      expires: f.properties.expires ?? '',
      areaDesc: f.properties.areaDesc ?? '',
    }))
  } catch (e) {
    console.warn('[weather] alerts fetch failed:', e)
    return []
  }
}

export function useWeather() {
  const [state, setState] = useState<WeatherState>({
    observation: null,
    alerts: [],
    loading: true,
    error: null,
    lastUpdated: null,
  })

  const refresh = useCallback(async () => {
    setState(s => ({ ...s, loading: true, error: null }))
    const [observation, alerts] = await Promise.all([fetchObservation(), fetchAlerts()])
    setState(s => ({
      // Keep the last good observation if the new fetch returned nothing
      observation: observation ?? s.observation,
      alerts,
      loading: false,
      error: null,
      lastUpdated: new Date(),
    }))
  }, [])

  useEffect(() => {
    refresh()
    // Refresh every 10 minutes
    const interval = setInterval(refresh, 10 * 60 * 1000)
    return () => clearInterval(interval)
  }, [refresh])

  return { ...state, refresh }
}
