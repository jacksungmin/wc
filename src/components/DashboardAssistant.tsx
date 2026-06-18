import { Bot, Loader2, Send, Sparkles, X } from 'lucide-react'
import { useMemo, useState } from 'react'

export interface DashboardAssistantContext {
  timestamp: string
  mapExtentAvailable: boolean
  mapExtent: {
    north: number
    south: number
    east: number
    west: number
  } | null
  recordLimits: {
    metroTrips: number
    inrixSegments: number
    note: string
  }
  dataStatus: {
    inrixConnected: boolean
    inrixLoading: boolean
    inrixError: string | null
    transtarConnected: boolean
    transtarLoading: boolean
    transtarError: string | null
    metroLoading: boolean
    metroError: string | null
  }
  selections: {
    cameraId: string | null
    inrixIncidentId: string | null
    metroTripId: string | null
    transtarItemId: string | null
  }
  weather: {
    description: string | null
    temperatureF: number | null
    feelsLikeF: number | null
    windMph: number | null
    humidity: number | null
  }
  alerts: Array<{ event: string; severity: string; headline: string }>
  traffic: {
    inrixIncidentsTotal: number
    inrixIncidentsVisible: number
    inrixSegmentsTotal: number
    inrixSegmentsVisible: number
    transtarIncidentsTotal: number
    transtarIncidentsVisible: number
    transtarLaneClosuresTotal: number
    transtarLaneClosuresVisible: number
    transtarFloodRisksTotal: number
    transtarFloodRisksVisible: number
    inrixIncidents: Array<{ id: string; type: string; subType: string; severity: number; description: string; fullDescription: string; startTime: string; lat: number; lng: number; visibleInMap: boolean }>
    inrixSegments: Array<{ code: string; speed: number; averageSpeed: number; travelTime: number; startLat: number; startLng: number; endLat: number; endLng: number; visibleInMap: boolean }>
    transtarIncidents: Array<{ id: string; desc: string; location: string; lanes: string; status: string; time: string; date: string; vehicles: number; lat: number; lng: number; visibleInMap: boolean }>
    laneClosures: Array<{ id: string; roadway: string; location: string; lanes: string; duration: string; status: string; agency: string; detour: string; hotspot: boolean; startTime: string; endTime: string; lat: number; lng: number; visibleInMap: boolean }>
    floodRisks: Array<{ id: string; sensorName: string; radiusMiles: number; alert: string; precipitationInches: number; streamElevation: number; timestamp: string; lat: number; lng: number; visibleInMap: boolean }>
    corridors: Array<{
      label: string
      direction: string
      group: string
      status: string | null
      sourceUpdated: string | null
      distanceMiles: number | null
      travelChartAvailable: boolean
      volumeChartAvailable: boolean
      volumeSensors: Array<{ id: string; direction: string; source: string }>
      travelMin: number
      delayMin: number
      avgSpeed: number
      segmentCount: number
      slowSegments: number
      segmentDetails: Array<{
        fromTo: string
        speedMph: number
        travelMinutes: number | null
        delayMinutes: number
        lengthMiles: number
      }>
    }>
  }
  transit: {
    totalTrips: number
    mapVisibleTrips: number
    selectedTripId: string | null
    routeGroupsVisible: string[]
    routeGroups: Array<{ id: string; label: string; enabledOnMap: boolean; trips: number; delayedTrips: number; maxDelayMinutes: number | null }>
    trips: Array<{ id: string; route: string; routeLongName: string | null; routeType: number | null; tripId: string; direction: string | null; delayMinutes: number | null; arrivalTime: string | null; nextStopId: string | null; vehicleId: string | null; positionSource: string | null; isScheduled: boolean; lat: number | null; lng: number | null; visibleOnMap: boolean }>
    busToNrg: {
      trips: number
      delayedTrips: number
      maxDelayMinutes: number | null
      nextTrips: Array<{
        route: string
        delayMinutes: number | null
        arrivalTime: string | null
        direction: string | null
      }>
    }
  }
  cameras: {
    total: number
    liveFeeds: number
    mapLayerEnabled: boolean
    selectedCameraId: string | null
    selectedCamera: { id: string; name: string; highway: string; direction: string; lat: number; lng: number; hasLiveFeed: boolean } | null
  }
  nextMatch: {
    label: string
    date: string
    kickoff: string
    stage: string
    daysUntil: number | null
  } | null
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface DashboardAssistantProps {
  context: DashboardAssistantContext
}

function renderMessageText(text: string) {
  return text.split('\n').map((line, lineIndex) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g).map((part, partIndex) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={partIndex} className="font-semibold text-[#e8edf5]">{part.slice(2, -2)}</strong>
      }
      return <span key={partIndex}>{part}</span>
    })

    return (
      <span key={lineIndex}>
        {parts}
        {lineIndex < text.split('\n').length - 1 && <br />}
      </span>
    )
  })
}

const SUGGESTIONS = [
  'Summarize current traffic near NRG',
  'How are routes to and from the stadium moving?',
  'Which route segments have travel or volume charts?',
  'Are Bus to NRG Stadium trips delayed?',
  'What are the biggest risks right now?',
  'Are there lane closures in the current map view?',
  'Give me a match-day mobility briefing',
]

export function DashboardAssistant({ context }: DashboardAssistantProps) {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasTraffic = useMemo(() => {
    const t = context.traffic
    return t.inrixIncidentsVisible + t.transtarIncidentsVisible + t.transtarLaneClosuresVisible + t.transtarFloodRisksVisible > 0
  }, [context])

  async function ask(question: string) {
    const trimmed = question.trim()
    if (!trimmed || loading) return

    setOpen(true)
    setInput('')
    setError(null)
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: trimmed }])

    try {
      const res = await fetch('/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: trimmed, context }),
      })

      const data = await res.json().catch(() => null) as { answer?: string; error?: string } | null
      if (!res.ok) throw new Error(data?.error ?? 'Assistant request failed')

      setMessages(prev => [...prev, { role: 'assistant', content: data?.answer ?? 'No answer returned.' }])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Assistant request failed'
      setError(message)
      setMessages(prev => [...prev, { role: 'assistant', content: 'I could not generate a briefing right now. Check the assistant API configuration and try again.' }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="absolute bottom-[4.75rem] left-2 right-2 md:bottom-[6.25rem] md:left-3 md:right-auto z-[1002] pointer-events-auto">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-1.5 rounded border border-cyan-500/25 bg-[#09101e]/92 px-2.5 py-2 text-[9px] font-mono text-cyan-200 shadow-[0_8px_20px_rgba(0,0,0,0.35)] backdrop-blur-sm transition-colors hover:border-cyan-400/45 hover:text-cyan-100"
          title="Ask Dashboard"
        >
          <Bot size={13} />
          <span className="hidden sm:inline">Ask Dashboard</span>
          {hasTraffic && <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" />}
        </button>
      )}

      {open && (
        <div className="flex h-[min(460px,calc(100dvh-8rem))] w-[min(370px,calc(100vw-1rem))] flex-col rounded border border-cyan-500/25 bg-[#09101e]/96 shadow-2xl backdrop-blur-md">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-3 py-2.5">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles size={13} className="text-cyan-300 flex-shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] font-mono uppercase tracking-[0.14em] text-cyan-200">Ask Dashboard</div>
                <div className="truncate text-[8px] font-mono text-[#4a5a72]">Read-only operations briefing</div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex h-6 w-6 items-center justify-center rounded text-[#4a5a72] transition-colors hover:bg-white/[0.06] hover:text-[#e8edf5]"
              aria-label="Close assistant"
            >
              <X size={13} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-2.5">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="text-[10px] leading-relaxed text-[#7a8ba8]">
                  Ask for a short briefing based on the current map view, traffic feeds, weather, transit, and the next NRG match.
                </p>
                <div className="grid gap-1.5">
                  {SUGGESTIONS.map(suggestion => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => ask(suggestion)}
                      className="rounded border border-white/[0.06] bg-white/[0.02] px-2 py-1.5 text-left text-[9px] font-mono text-[#c8d6e8] transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/10"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={[
                  'mb-2 whitespace-pre-line rounded border px-2.5 py-2 text-[10px] leading-relaxed',
                  message.role === 'user'
                    ? 'ml-6 border-cyan-500/20 bg-cyan-500/10 text-cyan-100'
                    : 'mr-6 border-white/[0.06] bg-white/[0.03] text-[#c8d6e8]',
                ].join(' ')}
              >
                {renderMessageText(message.content)}
              </div>
            ))}

            {loading && (
              <div className="mr-6 flex items-center gap-2 rounded border border-white/[0.06] bg-white/[0.03] px-2.5 py-2 text-[10px] font-mono text-[#7a8ba8]">
                <Loader2 size={12} className="animate-spin" />
                Generating briefing
              </div>
            )}
            {error && (
              <div className="mt-2 rounded border border-red-500/20 bg-red-950/20 px-2 py-1.5 text-[9px] font-mono text-red-300">
                {error}
              </div>
            )}
          </div>

          <form
            className="flex gap-2 border-t border-white/[0.08] p-2.5"
            onSubmit={(event) => {
              event.preventDefault()
              ask(input)
            }}
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ask about traffic, transit, or risks..."
              className="min-w-0 flex-1 rounded border border-white/[0.08] bg-[#070c15] px-2 py-1.5 text-[10px] text-[#e8edf5] outline-none placeholder:text-[#4a5a72] focus:border-cyan-500/40"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              className="flex h-8 w-8 items-center justify-center rounded border border-cyan-500/25 bg-cyan-500/10 text-cyan-200 transition-colors hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send question"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
