import type { WorldCupMatch } from '@/types'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const matchDay = new Date(dateStr + 'T00:00:00')
  return Math.ceil((matchDay.getTime() - today.getTime()) / 86_400_000)
}

function stageColor(stage: string): string {
  if (stage.includes('Group')) return '#1a56db'
  if (stage.includes('32')) return '#7c3aed'
  if (stage.includes('Quarter')) return '#d97706'
  if (stage.includes('Semi')) return '#c8102e'
  if (stage.includes('Final')) return '#d4950a'
  return '#4a5a72'
}

function FlagBadge({ label, code }: { label: string; code?: string }) {
  return (
    <span className="w-5 h-5 rounded-full bg-[#101827] border border-white/[0.10] flex items-center justify-center overflow-hidden flex-shrink-0">
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

function MatchCard({ match }: { match: WorldCupMatch }) {
  const days = daysUntil(match.date)
  const isToday = days === 0
  const isTbd = match.homeTeam === 'TBD'
  const color = stageColor(match.stage)

  let statusLabel: string
  let statusClass: string
  if (match.status === 'live') {
    statusLabel = 'LIVE'
    statusClass = 'text-red-400'
  } else if (days < 0) {
    statusLabel = 'FT'
    statusClass = 'text-[#4a5a72]'
  } else if (isToday) {
    statusLabel = 'TODAY'
    statusClass = 'text-amber-400'
  } else {
    statusLabel = `${days}d`
    statusClass = 'text-[#4a5a72]'
  }

  return (
    <div
      className={[
        'p-2.5 rounded border mb-2 transition-colors',
        match.status === 'live'
          ? 'border-red-500/40 bg-red-950/20'
          : isToday
            ? 'border-amber-500/30 bg-amber-950/10'
            : 'border-white/[0.06] bg-white/[0.02]',
      ].join(' ')}
    >
      {/* Stage + status */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[9px] font-mono tracking-[0.1em] uppercase px-1.5 py-0.5 rounded"
          style={{ background: color + '25', color, border: `1px solid ${color}35` }}
        >
          {match.group || match.stage}
        </span>
        <span className={`text-[9px] font-mono flex items-center gap-1 ${statusClass}`}>
          {match.status === 'live' && (
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse inline-block" />
          )}
          {statusLabel}
        </span>
      </div>

      {/* Teams */}
      {match.status !== 'upcoming' ? (
        /* Score layout for live/completed */
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <FlagBadge label={match.homeFlag} code={match.homeFlagCode} />
            <span className="text-[11px] text-[#e8edf5] font-medium truncate">{match.homeTeam}</span>
          </div>
          <div className="flex items-center gap-1 mx-2 flex-shrink-0">
            <span className="text-[16px] font-mono font-bold text-white">{match.homeScore ?? 0}</span>
            <span className="text-[10px] font-mono text-[#4a5a72]">–</span>
            <span className="text-[16px] font-mono font-bold text-white">{match.awayScore ?? 0}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-1 min-w-0 justify-end">
            <span className="text-[11px] text-[#e8edf5] font-medium truncate">{match.awayTeam}</span>
            <FlagBadge label={match.awayFlag} code={match.awayFlagCode} />
          </div>
        </div>
      ) : (
        /* Upcoming layout */
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <FlagBadge label={match.homeFlag} code={match.homeFlagCode} />
            <span className="text-[11px] text-[#e8edf5] truncate">
              {isTbd ? 'TBD' : match.homeTeam}
            </span>
          </div>
          <div className="text-center flex-shrink-0">
            <div className="text-[8px] font-mono text-[#7a8ba8]">{formatDate(match.date)}</div>
            <div className="text-[8px] font-mono text-[#4a5a72]">{match.kickoff}</div>
          </div>
          <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
            <span className="text-[11px] text-[#e8edf5] truncate">
              {isTbd ? 'TBD' : match.awayTeam}
            </span>
            <FlagBadge label={match.awayFlag} code={match.awayFlagCode} />
          </div>
        </div>
      )}
    </div>
  )
}

export function MatchSchedule({ matches }: { matches: WorldCupMatch[] }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-lg leading-none">⚽</span>
          <div>
            <div className="text-[10px] font-mono tracking-[0.15em] text-[#7a8ba8] uppercase">
              FIFA World Cup 2026
            </div>
            <div className="text-[11px] text-[#e8edf5] font-medium">NRG Stadium</div>
          </div>
        </div>
        <span className="text-[9px] font-mono text-[#4a5a72]">{matches.length} matches</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {matches.map(m => (
          <MatchCard key={m.id} match={m} />
        ))}
        <p className="text-[8px] font-mono text-[#4a5a72] text-center mt-1 leading-relaxed">
          Verify schedule at fifa.com
        </p>
      </div>
    </div>
  )
}
