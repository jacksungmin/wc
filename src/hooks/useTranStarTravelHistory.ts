import { useEffect, useMemo, useState } from 'react'
import type { TranStarCorridor, WorldCupMatch } from '@/types'
import {
  parseTravelHistoryCsv,
  summarizeRouteTravelHistory,
  summarizeTravelHistoryDate,
  transtarDate,
  type TravelHistoryDateSummary,
  type RouteTravelHistorySummary,
} from '@/lib/transtarTravelHistory'

const MAX_HISTORY_MATCHES = 5

interface TravelHistoryState {
  summaries: RouteTravelHistorySummary[]
  loading: boolean
  error: string | null
  lastUpdated: Date | null
}

function historyKey(corridors: TranStarCorridor[], matches: WorldCupMatch[]): string {
  const routes = corridors
    .map(corridor => corridor.chartRoute)
    .filter(Boolean)
    .sort()
    .join('|')
  const dates = matches.map(match => match.date).join('|')
  return `${routes}::${dates}`
}

function hasDateSummary(summary: TravelHistoryDateSummary | null): summary is TravelHistoryDateSummary {
  return summary != null
}

async function fetchRouteDateSummary(route: TranStarCorridor, match: WorldCupMatch, signal: AbortSignal) {
  if (!route.chartRoute) return null
  const url = `/transtar-fifa/GetfifaRouteComparison.ashx?action=GetfifaRouteHistoricalData&date=${encodeURIComponent(transtarDate(match.date))}&route=${encodeURIComponent(route.chartRoute)}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`TranStar chart returned ${res.status}`)
  const csv = await res.text()
  const points = parseTravelHistoryCsv(csv)
  return summarizeTravelHistoryDate(match, points)
}

export function useTranStarTravelHistory(corridors: TranStarCorridor[], matches: WorldCupMatch[]) {
  const completedMatches = useMemo(() =>
    matches
      .filter(match => match.status === 'completed')
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, MAX_HISTORY_MATCHES)
      .reverse(),
  [matches])

  const routes = useMemo(() =>
    corridors.filter((corridor): corridor is TranStarCorridor & { chartRoute: string } => Boolean(corridor.chartRoute)),
  [corridors])

  const key = useMemo(() => historyKey(routes, completedMatches), [routes, completedMatches])

  const [state, setState] = useState<TravelHistoryState>({
    summaries: [],
    loading: false,
    error: null,
    lastUpdated: null,
  })

  useEffect(() => {
    if (routes.length === 0 || completedMatches.length === 0) {
      setState({ summaries: [], loading: false, error: null, lastUpdated: null })
      return
    }

    const controller = new AbortController()
    setState(previous => ({ ...previous, loading: true, error: null }))

    async function load() {
      const summaries = await Promise.all(routes.map(async route => {
        const dateResults = await Promise.all(completedMatches.map(async match => {
          try {
            return {
              match,
              summary: await fetchRouteDateSummary(route, match, controller.signal),
              error: null,
            }
          } catch (error) {
            if (controller.signal.aborted) throw error
            return {
              match,
              summary: null,
              error: error instanceof Error ? error.message : 'Chart unavailable',
            }
          }
        }))

        const dateSummaries = dateResults
          .map(result => result.summary)
          .filter(hasDateSummary)
        const noDataDates = dateResults
          .filter(result => !result.summary)
          .map(result => result.match.date)

        return summarizeRouteTravelHistory(route, dateSummaries, noDataDates)
      }))

      if (!controller.signal.aborted) {
        setState({
          summaries,
          loading: false,
          error: null,
          lastUpdated: new Date(),
        })
      }
    }

    load().catch(error => {
      if (controller.signal.aborted) return
      setState(previous => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : 'Travel history unavailable',
      }))
    })

    return () => controller.abort()
  }, [key])

  return state
}
