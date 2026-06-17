import type { WorldCupMatch } from '@/types'

const MATCH_DISPLAY_WINDOW_MS = 4 * 60 * 60 * 1000

export function matchKickoffDate(match: WorldCupMatch): Date {
  const parsed = match.kickoff.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i)
  if (!parsed) return new Date(`${match.date}T12:00:00-05:00`)

  const [, rawHour, rawMinute, meridiem] = parsed
  let hour = parseInt(rawHour, 10)
  const minute = parseInt(rawMinute, 10)
  if (meridiem.toUpperCase() === 'PM' && hour !== 12) hour += 12
  if (meridiem.toUpperCase() === 'AM' && hour === 12) hour = 0

  return new Date(`${match.date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00-05:00`)
}

export function isMatchDisplayable(match: WorldCupMatch, now = new Date()): boolean {
  if (match.status === 'completed') return false
  return matchKickoffDate(match).getTime() + MATCH_DISPLAY_WINDOW_MS >= now.getTime()
}

export function findNextNrgMatch(matches: WorldCupMatch[], now = new Date()): WorldCupMatch | null {
  const candidates = matches
    .filter(match => isMatchDisplayable(match, now))
    .sort((a, b) => matchKickoffDate(a).getTime() - matchKickoffDate(b).getTime())

  return candidates[0] ?? null
}

export const NRG_MATCHES: WorldCupMatch[] = [
  {
    id: 'm1',
    date: '2026-06-14',
    kickoff: '12:00 PM CDT',
    homeTeam: 'Germany',
    awayTeam: 'Curacao',
    homeFlag: 'DE',
    awayFlag: 'CW',
    homeFlagCode: 'de',
    awayFlagCode: 'cw',
    group: 'Group E',
    stage: 'Match 10 - Group Stage',
    status: 'completed',
    homeScore: 7,
    awayScore: 1,
  },
  {
    id: 'm2',
    date: '2026-06-17',
    kickoff: '12:00 PM CDT',
    homeTeam: 'Portugal',
    awayTeam: 'Congo-Kinshasa',
    homeFlag: 'PT',
    awayFlag: 'CD',
    homeFlagCode: 'pt',
    awayFlagCode: 'cd',
    group: 'Group K',
    stage: 'Match 23 - Group Stage',
    status: 'upcoming',
  },
  {
    id: 'm3',
    date: '2026-06-20',
    kickoff: '12:00 PM CDT',
    homeTeam: 'Netherlands',
    awayTeam: 'Sweden',
    homeFlag: 'NL',
    awayFlag: 'SE',
    homeFlagCode: 'nl',
    awayFlagCode: 'se',
    group: 'Group F',
    stage: 'Match 35 - Group Stage',
    status: 'upcoming',
  },
  {
    id: 'm4',
    date: '2026-06-23',
    kickoff: '12:00 PM CDT',
    homeTeam: 'Portugal',
    awayTeam: 'Uzbekistan',
    homeFlag: 'PT',
    awayFlag: 'UZ',
    homeFlagCode: 'pt',
    awayFlagCode: 'uz',
    group: 'Group K',
    stage: 'Match 47 - Group Stage',
    status: 'upcoming',
  },
  {
    id: 'm5',
    date: '2026-06-26',
    kickoff: '7:00 PM CDT',
    homeTeam: 'Cape Verde',
    awayTeam: 'Saudi Arabia',
    homeFlag: 'CV',
    awayFlag: 'SA',
    homeFlagCode: 'cv',
    awayFlagCode: 'sa',
    group: 'Group H',
    stage: 'Match 65 - Group Stage',
    status: 'upcoming',
  },
  {
    id: 'm6',
    date: '2026-06-29',
    kickoff: '12:00 PM CDT',
    homeTeam: 'TBD',
    awayTeam: 'TBD',
    homeFlag: 'TBD',
    awayFlag: 'TBD',
    group: '',
    stage: 'Match 76 - Round of 32',
    status: 'upcoming',
  },
  {
    id: 'm7',
    date: '2026-07-04',
    kickoff: '12:00 PM CDT',
    homeTeam: 'TBD',
    awayTeam: 'TBD',
    homeFlag: 'TBD',
    awayFlag: 'TBD',
    group: '',
    stage: 'Match 90 - Round of 16',
    status: 'upcoming',
  },
]
