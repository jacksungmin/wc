import { useEffect, useMemo, useState } from 'react'
import { X } from 'lucide-react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import Papa from 'papaparse'
import type { TranStarCorridor } from '@/types'
import { ALL_CAMERAS } from '@/data/cameras'

type DetailTab = 'segments' | 'travelChart' | 'volumeChart' | 'cameras'

interface TravelChartPoint {
  time: string
  timestamp: number
  travelMin: number | null
}

interface VolumeChartPoint {
  time: string
  timestamp: number
  volume: number | null
  histVolume: number | null
  desc: string
}

interface Props {
  corridor: TranStarCorridor
  onClose: () => void
  onCameraSelect: (id: string) => void
}

function fmtSecs(s: number): string {
  if (s < 0) return '-'
  const m = Math.floor(s / 60)
  const sec = s % 60
  return sec === 0 ? `${m}m` : `${m}m ${sec}s`
}

function delayColor(d: number): string {
  if (d <= 60)  return 'text-emerald-400'
  if (d <= 120) return 'text-yellow-400'
  if (d <= 300) return 'text-orange-400'
  return 'text-red-400'
}

function dirFull(dir: string): string {
  const map: Record<string, string> = { WB: 'Westbound', EB: 'Eastbound', NB: 'Northbound', SB: 'Southbound' }
  return map[dir] ?? dir
}

function todayIso(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function transtarDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  if (!y || !m || !d) return new Date().toLocaleDateString('en-US')
  return `${m}/${d}/${y}`
}

function timeLabel(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function parseTravelCsv(csv: string): TravelChartPoint[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  return parsed.data
    .map(row => {
      const timestamp = new Date(row.Timestamp).getTime()
      const seconds = Number(row.TravelTime)
      if (Number.isNaN(timestamp)) return null
      return {
        time: timeLabel(row.Timestamp),
        timestamp,
        travelMin: seconds > 0 ? Math.round((seconds / 60) * 10) / 10 : null,
      }
    })
    .filter(Boolean) as TravelChartPoint[]
}

function parseVolumeCsv(csv: string): VolumeChartPoint[] {
  const parsed = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true })
  return parsed.data
    .map(row => {
      const timestamp = new Date(row.Timestamp).getTime()
      if (Number.isNaN(timestamp)) return null
      const volume = Number(row.Volume)
      const histVolume = Number(row.HistVolume)
      return {
        time: timeLabel(row.Timestamp),
        timestamp,
        volume: volume > 0 ? volume : null,
        histVolume: histVolume > 0 ? histVolume : null,
        desc: row.Desc || 'Volume sensor',
      }
    })
    .filter(Boolean) as VolumeChartPoint[]
}

function ChartEmpty({ children }: { children: string }) {
  return (
    <div className="h-[220px] flex items-center justify-center text-[9px] font-mono text-[#4a5a72] text-center px-6">
      {children}
    </div>
  )
}

export function CorridorDetail({ corridor, onClose, onCameraSelect }: Props) {
  const [tab, setTab] = useState<DetailTab>('segments')
  const [chartDate, setChartDate] = useState(todayIso)
  const [travelData, setTravelData] = useState<TravelChartPoint[]>([])
  const [volumeData, setVolumeData] = useState<VolumeChartPoint[]>([])
  const [travelLoading, setTravelLoading] = useState(false)
  const [volumeLoading, setVolumeLoading] = useState(false)
  const [travelError, setTravelError] = useState<string | null>(null)
  const [volumeError, setVolumeError] = useState<string | null>(null)

  const cameras = corridor.camHighway
    ? ALL_CAMERAS.filter(c => c.highway === corridor.camHighway)
    : []

  const volumeSensors = corridor.volumeSensors ?? []
  const hasTravelChart = Boolean(corridor.chartRoute)
  const hasVolumeChart = volumeSensors.length > 0

  const tabs: { id: DetailTab; label: string; disabled?: boolean }[] = [
    { id: 'segments', label: 'Segments' },
    { id: 'travelChart', label: 'Travel Chart', disabled: !hasTravelChart },
    { id: 'volumeChart', label: 'Volume', disabled: !hasVolumeChart },
    { id: 'cameras', label: `Cameras (${cameras.length})` },
  ]

  useEffect(() => {
    if (tab !== 'travelChart' || !corridor.chartRoute) return
    const controller = new AbortController()
    setTravelLoading(true)
    setTravelError(null)
    fetch(`/transtar-fifa/GetfifaRouteComparison.ashx?action=GetfifaRouteHistoricalData&date=${encodeURIComponent(transtarDate(chartDate))}&route=${encodeURIComponent(corridor.chartRoute)}`, {
      signal: controller.signal,
    })
      .then(res => {
        if (!res.ok) throw new Error(`TranStar returned ${res.status}`)
        return res.text()
      })
      .then(csv => setTravelData(parseTravelCsv(csv)))
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setTravelError(err instanceof Error ? err.message : 'Travel chart unavailable')
        setTravelData([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setTravelLoading(false)
      })
    return () => controller.abort()
  }, [chartDate, corridor.chartRoute, tab])

  useEffect(() => {
    if (tab !== 'volumeChart' || volumeSensors.length === 0) return
    const controller = new AbortController()
    setVolumeLoading(true)
    setVolumeError(null)
    Promise.all(volumeSensors.map(sensor =>
      fetch(`/transtar-fifa/GetFifaVolumes.ashx?action=GetRadarVolumeData&date=${encodeURIComponent(transtarDate(chartDate))}&id=${encodeURIComponent(sensor.id)}&dir=${encodeURIComponent(sensor.dir)}&source=${encodeURIComponent(sensor.source)}`, {
        signal: controller.signal,
      }).then(res => {
        if (!res.ok) throw new Error(`TranStar returned ${res.status}`)
        return res.text()
      })
    ))
      .then(csvs => {
        const points = csvs.flatMap(parseVolumeCsv).sort((a, b) => a.timestamp - b.timestamp)
        setVolumeData(points)
      })
      .catch(err => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setVolumeError(err instanceof Error ? err.message : 'Volume chart unavailable')
        setVolumeData([])
      })
      .finally(() => {
        if (!controller.signal.aborted) setVolumeLoading(false)
      })
    return () => controller.abort()
  }, [chartDate, tab, volumeSensors])

  const volumeTitle = useMemo(() => {
    const desc = volumeData.find(p => p.desc)?.desc
    return desc || volumeSensors.map(s => `${s.id} ${s.dir}`).join(', ')
  }, [volumeData, volumeSensors])

  return (
    <div
      className="fixed inset-0 z-[2000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative bg-[#09101e] border border-white/[0.12] rounded-lg shadow-2xl w-full max-w-[680px] max-h-[78vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08] flex-shrink-0">
          <div>
            <div className="text-[12px] font-semibold text-[#e8edf5] tracking-wide">
              {corridor.label}
              <span className="text-[#4a5a72] font-normal mx-1.5">.</span>
              {dirFull(corridor.dir)}
            </div>
            <div className="text-[9px] font-mono text-[#4a5a72] mt-0.5 flex items-center gap-2 flex-wrap">
              {corridor.travelMin > 0 && <span>{corridor.travelMin} min total</span>}
              {corridor.avgSpeed > 0 && (
                <><span className="text-white/20">.</span><span>avg {corridor.avgSpeed} mph</span></>
              )}
              {corridor.delayMin > 0 && (
                <><span className="text-white/20">.</span><span className="text-orange-400">+{corridor.delayMin}m delay</span></>
              )}
              {corridor.sourceUpdated && (
                <><span className="text-white/20">.</span><span>TranStar {corridor.sourceUpdated}</span></>
              )}
              {corridor.travelMin < 0 && <span>No live data</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#4a5a72] hover:text-[#e8edf5] transition-colors p-1 rounded ml-3 flex-shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex border-b border-white/[0.06] flex-shrink-0">
          {tabs.map(t => (
            <button
              key={t.id}
              type="button"
              disabled={t.disabled}
              onClick={() => setTab(t.id)}
              className={[
                'flex-1 py-2 text-[7.5px] font-mono tracking-[0.08em] uppercase transition-colors',
                t.disabled ? 'text-[#2f3a4c] cursor-not-allowed' :
                tab === t.id
                  ? 'text-violet-400 border-b-2 border-violet-400 -mb-px'
                  : 'text-[#4a5a72] hover:text-[#7a8ba8]',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(tab === 'travelChart' || tab === 'volumeChart') && (
          <div className="px-3 py-2 border-b border-white/[0.05] flex items-center justify-between gap-3">
            <span className="text-[8px] font-mono uppercase tracking-[0.1em] text-[#4a5a72]">
              {tab === 'travelChart' ? 'Historical travel time' : 'Traffic volume'}
            </span>
            <input
              type="date"
              value={chartDate}
              max={todayIso()}
              onChange={e => setChartDate(e.target.value)}
              className="bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-[9px] font-mono text-[#c8d6e8] outline-none"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {tab === 'segments' && (
            <div className="p-3">
              {corridor.segments.length === 0 ? (
                <ChartEmpty>No segment data available for this corridor</ChartEmpty>
              ) : (
                <>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/[0.06]">
                        <th className="text-left text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2 pr-2">Segment</th>
                        <th className="text-right text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2 pr-2">Speed</th>
                        <th className="text-right text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2 pr-2">Travel</th>
                        <th className="text-right text-[7px] font-mono text-[#4a5a72] uppercase tracking-[0.1em] pb-2">Delay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {corridor.segments.map((seg, i) => (
                        <tr key={i} className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors">
                          <td className="py-1.5 pr-3 text-[9px] text-[#c8d6e8] leading-tight">{seg.ft}</td>
                          <td className="py-1.5 pr-2 text-right text-[9px] font-mono text-[#7a8ba8] tabular-nums whitespace-nowrap">
                            {seg.speedMph > 0 ? `${seg.speedMph} mph` : '-'}
                          </td>
                          <td className="py-1.5 pr-2 text-right text-[9px] font-mono text-[#c8d6e8] tabular-nums whitespace-nowrap">
                            {fmtSecs(seg.travelSec)}
                          </td>
                          <td className={`py-1.5 text-right text-[9px] font-mono tabular-nums whitespace-nowrap ${delayColor(seg.delaySec)}`}>
                            {seg.delaySec > 60 ? `+${fmtSecs(seg.delaySec)}` : 'on time'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-3 pt-2 border-t border-white/[0.04]">
                    TranStar Travel Time Monitoring System . refreshes every 60s
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'travelChart' && (
            <div className="p-3">
              {travelLoading ? (
                <ChartEmpty>Loading TranStar travel-time history...</ChartEmpty>
              ) : travelError ? (
                <ChartEmpty>{travelError}</ChartEmpty>
              ) : travelData.length === 0 ? (
                <ChartEmpty>No travel-time chart data returned for this route and date</ChartEmpty>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={travelData} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="time" minTickGap={24} tick={{ fill: '#7a8ba8', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#7a8ba8', fontSize: 9 }} axisLine={false} tickLine={false} unit="m" />
                      <Tooltip
                        contentStyle={{ background: '#09101e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e8edf5', fontSize: 11 }}
                        labelStyle={{ color: '#7a8ba8' }}
                        formatter={(value) => [`${value} min`, 'Travel time']}
                      />
                      <Line type="monotone" dataKey="travelMin" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {tab === 'volumeChart' && (
            <div className="p-3">
              <div className="text-[8px] font-mono text-[#4a5a72] mb-2 truncate">{volumeTitle}</div>
              {volumeLoading ? (
                <ChartEmpty>Loading TranStar traffic-volume history...</ChartEmpty>
              ) : volumeError ? (
                <ChartEmpty>{volumeError}</ChartEmpty>
              ) : volumeData.length === 0 ? (
                <ChartEmpty>No volume data returned for this sensor and date</ChartEmpty>
              ) : (
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={volumeData} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}>
                      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                      <XAxis dataKey="time" minTickGap={24} tick={{ fill: '#7a8ba8', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: '#7a8ba8', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <Tooltip
                        contentStyle={{ background: '#09101e', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, color: '#e8edf5', fontSize: 11 }}
                        labelStyle={{ color: '#7a8ba8' }}
                      />
                      <Line type="monotone" dataKey="volume" name="Live volume" stroke="#22c55e" strokeWidth={2} dot={false} connectNulls />
                      <Line type="monotone" dataKey="histVolume" name="Historical avg" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" dot={false} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {tab === 'cameras' && (
            <div className="p-3">
              {cameras.length === 0 ? (
                <ChartEmpty>No cameras available for this corridor</ChartEmpty>
              ) : (
                <>
                  <div className="flex flex-col gap-1.5">
                    {cameras.map(cam => (
                      <button
                        key={cam.id}
                        type="button"
                        onClick={() => { onCameraSelect(cam.id); onClose() }}
                        className="w-full text-left flex items-center gap-3 p-2.5 rounded border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/30 transition-colors group"
                      >
                        <span className="text-[10px] text-[#7a8ba8] flex-shrink-0">CAM</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-[9px] font-medium text-[#c8d6e8] truncate">{cam.name}</div>
                          <div className="text-[8px] font-mono text-[#4a5a72] mt-0.5">
                            {cam.direction} . {cam.highway}
                          </div>
                        </div>
                        <span className="text-[8px] font-mono text-[#4a5a72] group-hover:text-violet-400 transition-colors flex-shrink-0">
                          View
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="text-[7px] font-mono text-[#4a5a72] mt-3 pt-2 border-t border-white/[0.04]">
                    Click a camera to open its live feed in the main panel
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
