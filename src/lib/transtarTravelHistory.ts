import Papa from 'papaparse'
import type { WorldCupMatch } from '@/types'
import { matchKickoffDate } from '@/data/matches'

export interface TravelHistoryPoint {
  timestamp: number
  travelMin: number
}

export interface TravelHistoryWindowSummary {
  avgTravelMin: number | null
  peakTravelMin: number | null
  peakTime: string | null
}

export interface TravelHistoryCongestionWindow {
  startTime: string
  endTime: string
  peakTravelMin: number
  avgTravelMin: number
  minutesFromKickoffStart: number | null
  minutesFromKickoffEnd: number | null
}

export interface TravelHistoryDateSummary {
  date: string
  match: string
  kickoff: string
  samples: number
  baselineTravelMin: number | null
  typicalTravelMin: number | null
  peakTravelMin: number | null
  peakTime: string | null
  preGame: TravelHistoryWindowSummary
  postGame: TravelHistoryWindowSummary
  congestionWindows: TravelHistoryCongestionWindow[]
}

export interface RouteTravelHistorySummary {
  label: string
  direction: string
  group: string
  chartRoute: string
  sampleDates: number
  noDataDates: string[]
  typicalTravelMin: number | null
  peakTravelMin: number | null
  peakTime: string | null
  preGamePeakTravelMin: number | null
  preGamePeakTime: string | null
  postGamePeakTravelMin: number | null
  postGamePeakTime: string | null
  dateSummaries: TravelHistoryDateSummary[]
}

export function transtarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return new Date().toLocaleDateString('en-US')
  return `${m}/${d}/${y}`
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return rounded(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)))
  return rounded(sorted[index])
}

function clockLabel(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function bestPoint(points: TravelHistoryPoint[]): TravelHistoryPoint | null {
  return points.reduce<TravelHistoryPoint | null>((best, point) => {
    if (!best || point.travelMin > best.travelMin) return point
    return best
  }, null)
}

function summarizeWindow(points: TravelHistoryPoint[]): TravelHistoryWindowSummary {
  const peak = bestPoint(points)
  return {
    avgTravelMin: avg(points.map(point => point.travelMin)),
    peakTravelMin: peak ? rounded(peak.travelMin) : null,
    peakTime: peak ? clockLabel(peak.timestamp) : null,
  }
}

function compactCongestionWindows(
  points: TravelHistoryPoint[],
  threshold: number,
  kickoffTime: number,
): TravelHistoryCongestionWindow[] {
  const windows: TravelHistoryPoint[][] = []
  let current: TravelHistoryPoint[] = []

  for (const point of points) {
    if (point.travelMin >= threshold) {
      current.push(point)
    } else if (current.length > 0) {
      windows.push(current)
      current = []
    }
  }
  if (current.length > 0) windows.push(current)

  return windows
    .filter(window => window.length >= 2)
    .map(window => {
      const peak = bestPoint(window)!
      const start = window[0]
      const end = window[window.length - 1]
      return {
        startTime: clockLabel(start.timestamp),
        endTime: clockLabel(end.timestamp),
        peakTravelMin: rounded(peak.travelMin),
        avgTravelMin: avg(window.map(point => point.travelMin)) ?? rounded(peak.travelMin),
        minutesFromKickoffStart: Math.round((start.timestamp - kickoffTime) / 60_000),
        minutesFromKickoffEnd: Math.round((end.timestamp - kickoffTime) / 60_000),
      }
    })
    .sort((a, b) => b.peakTravelMin - a.peakTravelMin)
    .slice(0, 3)
}

export function parseTravelHistoryCsv(csv: string): TravelHistoryPoint[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  return parsed.data
    .map(row => {
      const timestamp = new Date(row.Timestamp).getTime()
      const seconds = Number(row.TravelTime)
      if (Number.isNaN(timestamp) || !(seconds > 0)) return null
      return {
        timestamp,
        travelMin: rounded(seconds / 60),
      }
    })
    .filter(Boolean) as TravelHistoryPoint[]
}

export function summarizeTravelHistoryDate(match: WorldCupMatch, points: TravelHistoryPoint[]): TravelHistoryDateSummary | null {
  if (points.length === 0) return null

  const kickoff = matchKickoffDate(match).getTime()
  const preStart = kickoff - 4 * 60 * 60 * 1000
  const postStart = kickoff + 105 * 60 * 1000
  const postEnd = kickoff + 5 * 60 * 60 * 1000
  const values = points.map(point => point.travelMin)
  const baseline = percentile(values, 0.2)
  const threshold = baseline == null ? Number.POSITIVE_INFINITY : Math.max(baseline + 3, baseline * 1.35)
  const peak = bestPoint(points)

  return {
    date: match.date,
    match: `${match.homeTeam} vs ${match.awayTeam}`,
    kickoff: match.kickoff,
    samples: points.length,
    baselineTravelMin: baseline,
    typicalTravelMin: percentile(values, 0.5),
    peakTravelMin: peak ? rounded(peak.travelMin) : null,
    peakTime: peak ? clockLabel(peak.timestamp) : null,
    preGame: summarizeWindow(points.filter(point => point.timestamp >= preStart && point.timestamp <= kickoff)),
    postGame: summarizeWindow(points.filter(point => point.timestamp >= postStart && point.timestamp <= postEnd)),
    congestionWindows: compactCongestionWindows(points, threshold, kickoff),
  }
}

export function summarizeRouteTravelHistory(
  route: { label: string; dir: string; group: string; chartRoute: string },
  dateSummaries: TravelHistoryDateSummary[],
  noDataDates: string[],
): RouteTravelHistorySummary {
  const allTypical = dateSummaries
    .map(summary => summary.typicalTravelMin)
    .filter((value): value is number => value != null)
  const allPeaks = dateSummaries
    .map(summary => summary.peakTravelMin)
    .filter((value): value is number => value != null)
  const peakSummary = dateSummaries.reduce<TravelHistoryDateSummary | null>((best, summary) => {
    if (summary.peakTravelMin == null) return best
    if (!best || best.peakTravelMin == null || summary.peakTravelMin > best.peakTravelMin) return summary
    return best
  }, null)
  const prePeak = dateSummaries.reduce<TravelHistoryDateSummary | null>((best, summary) => {
    if (summary.preGame.peakTravelMin == null) return best
    if (!best || best.preGame.peakTravelMin == null || summary.preGame.peakTravelMin > best.preGame.peakTravelMin) return summary
    return best
  }, null)
  const postPeak = dateSummaries.reduce<TravelHistoryDateSummary | null>((best, summary) => {
    if (summary.postGame.peakTravelMin == null) return best
    if (!best || best.postGame.peakTravelMin == null || summary.postGame.peakTravelMin > best.postGame.peakTravelMin) return summary
    return best
  }, null)

  return {
    label: route.label,
    direction: route.dir,
    group: route.group,
    chartRoute: route.chartRoute,
    sampleDates: dateSummaries.length,
    noDataDates,
    typicalTravelMin: avg(allTypical),
    peakTravelMin: allPeaks.length > 0 ? Math.max(...allPeaks) : null,
    peakTime: peakSummary?.peakTime ?? null,
    preGamePeakTravelMin: prePeak?.preGame.peakTravelMin ?? null,
    preGamePeakTime: prePeak?.preGame.peakTime ?? null,
    postGamePeakTravelMin: postPeak?.postGame.peakTravelMin ?? null,
    postGamePeakTime: postPeak?.postGame.peakTime ?? null,
    dateSummaries,
  }
}
