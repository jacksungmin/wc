import { RefreshCw, Wind, Droplets, Thermometer, AlertTriangle } from 'lucide-react'
import type { WeatherAlert, WeatherObservation } from '@/types'

function cToF(c: number) { return Math.round(c * 9 / 5 + 32) }
function mpsToMph(v: number) { return Math.round(v * 2.237) }
function degToCompass(d: number): string {
  const dirs = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
  return dirs[Math.round(d / 22.5) % 16]
}

function severityStyle(severity: string) {
  switch (severity) {
    case 'Extreme': return { ring: 'border-red-500/40 bg-red-950/25', badge: 'bg-red-500/20 text-red-400' }
    case 'Severe':  return { ring: 'border-orange-500/35 bg-orange-950/20', badge: 'bg-orange-500/20 text-orange-400' }
    case 'Moderate': return { ring: 'border-yellow-500/30 bg-yellow-950/15', badge: 'bg-yellow-500/20 text-yellow-400' }
    default:        return { ring: 'border-blue-500/20 bg-blue-950/15', badge: 'bg-blue-500/20 text-blue-400' }
  }
}

interface WeatherPanelProps {
  observation: WeatherObservation | null
  alerts: WeatherAlert[]
  loading: boolean
  onRefresh: () => void
}

export function WeatherPanel({ observation, alerts, loading, onRefresh }: WeatherPanelProps) {
  const tempF = observation?.temperature != null ? cToF(observation.temperature) : null
  const heatF = observation?.heatIndex != null ? cToF(observation.heatIndex) : null
  const windCF = observation?.windChill != null ? cToF(observation.windChill) : null
  const feelsF = heatF ?? windCF
  const windMph = observation?.windSpeed != null ? mpsToMph(observation.windSpeed) : null
  const windDir = observation?.windDirection != null ? degToCompass(observation.windDirection) : null
  const humidity = observation?.relativeHumidity != null ? Math.round(observation.relativeHumidity) : null

  return (
    <div className="p-2.5 flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono tracking-[0.15em] text-[#7a8ba8] uppercase">
          Weather · Houston
        </span>
        <button
          onClick={onRefresh}
          className="text-[#4a5a72] hover:text-[#7a8ba8] transition-colors"
          title="Refresh weather"
        >
          <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Current conditions */}
      {observation ? (
        <div className="bg-white/[0.03] rounded border border-white/[0.06] p-1.5">
          <div className="flex items-start justify-between mb-1.5">
            <div>
              <span className="text-[23px] font-mono font-bold text-[#e8edf5] leading-none">
                {tempF != null ? `${tempF}°` : '--°'}
              </span>
              <span className="text-[9px] font-mono text-[#7a8ba8] ml-0.5">F</span>
            </div>
            <div className="text-right pt-0.5">
              <div className="text-[9px] text-[#c8d6e8]">{observation.textDescription || 'Clear'}</div>
              <div className="text-[7px] font-mono text-[#4a5a72]">{observation.stationName}</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-white/[0.05]">
            <div className="flex items-center gap-1">
              <Thermometer size={9} className="text-[#7a8ba8] flex-shrink-0" />
              <div>
                <div className="text-[6px] text-[#4a5a72]">Feels</div>
                <div className="text-[8px] font-mono text-[#e8edf5]">
                  {feelsF != null ? `${feelsF}°F` : '--'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Droplets size={9} className="text-[#7a8ba8] flex-shrink-0" />
              <div>
                <div className="text-[6px] text-[#4a5a72]">Humidity</div>
                <div className="text-[8px] font-mono text-[#e8edf5]">
                  {humidity != null ? `${humidity}%` : '--'}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Wind size={9} className="text-[#7a8ba8] flex-shrink-0" />
              <div>
                <div className="text-[6px] text-[#4a5a72]">Wind</div>
                <div className="text-[8px] font-mono text-[#e8edf5]">
                  {windMph != null ? `${windMph} ${windDir ?? ''}` : '--'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white/[0.02] rounded border border-white/[0.04] p-4 text-center">
          <div className="text-[9px] font-mono text-[#4a5a72]">
            {loading ? 'Loading weather…' : 'Weather unavailable'}
          </div>
        </div>
      )}

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle size={9} className="text-amber-400" />
            <span className="text-[9px] font-mono tracking-[0.1em] text-amber-400 uppercase">
              {alerts.length} Active Alert{alerts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="space-y-2">
            {alerts.slice(0, 3).map(alert => {
              const s = severityStyle(alert.severity)
              return (
                <div key={alert.id} className={`rounded border p-2 ${s.ring}`}>
                  <div className="flex items-start justify-between gap-1.5 mb-0.5">
                    <span className="text-[10px] font-medium text-[#e8edf5] leading-tight">{alert.event}</span>
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded flex-shrink-0 ${s.badge}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-[9px] text-[#7a8ba8] leading-relaxed line-clamp-2">{alert.headline}</p>
                </div>
              )
            })}
            {alerts.length > 3 && (
              <div className="text-[8px] font-mono text-[#4a5a72] text-center">
                +{alerts.length - 3} more alerts
              </div>
            )}
          </div>
        </div>
      )}

      {alerts.length === 0 && observation && (
        <div className="flex items-center gap-1.5 text-[9px] font-mono text-emerald-500">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
          No active weather alerts
        </div>
      )}
    </div>
  )
}
