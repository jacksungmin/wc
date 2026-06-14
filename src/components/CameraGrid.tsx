import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, VideoOff } from 'lucide-react'
import type { TrafficCamera } from '@/types'
import { LiveCamera } from '@/components/LiveCamera'

const SNAPSHOT_REFRESH = 60 // seconds

// ── Snapshot feed (TranStar JPEG) ──────────────────────────────────────────
interface SnapshotFeedProps {
  camera: TrafficCamera
  selected: boolean
  onSelect: () => void
  refreshKey: number
  compact?: boolean
}

function SnapshotFeed({ camera, selected, onSelect, refreshKey, compact }: SnapshotFeedProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setError(false); setLoaded(false) }, [refreshKey])

  return (
    <button
      onClick={onSelect}
      className={[
        'relative overflow-hidden rounded border transition-all text-left w-full',
        selected ? 'border-red-500/50 ring-1 ring-red-500/25' : 'border-white/[0.06] hover:border-white/[0.14]',
      ].join(' ')}
    >
      <div className={`${compact ? 'aspect-video' : 'aspect-[16/10]'} bg-[#070c14] relative`}>
        {!error ? (
          <>
            <img
              src={`${camera.imageUrl}?t=${refreshKey}`}
              alt={camera.name}
              onLoad={() => setLoaded(true)}
              onError={() => setError(true)}
              className={`w-full h-full object-cover transition-opacity duration-500 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            />
            {!loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border border-[#4a5a72] border-t-[#7a8ba8] rounded-full animate-spin" />
              </div>
            )}
            {loaded && (
              <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/65 backdrop-blur-sm px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                <span className="text-[7px] font-mono text-green-400">LIVE</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <VideoOff size={14} className="text-[#4a5a72]" />
            <span className="text-[8px] font-mono text-[#4a5a72]">Feed unavailable</span>
            <a
              href="https://traffic.houstontranstar.org/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[8px] font-mono text-blue-500 hover:text-blue-400 underline"
            >
              TranStar ↗
            </a>
          </div>
        )}
      </div>
      <div className="px-1.5 py-1">
        <div className="text-[9px] font-medium text-[#c8d6e8] truncate">{camera.name}</div>
        <div className="text-[8px] font-mono text-[#4a5a72] truncate">{camera.direction}</div>
      </div>
    </button>
  )
}

// ── Camera cell dispatcher ─────────────────────────────────────────────────
function CameraCell({
  camera, selected, onSelect, refreshKey, compact,
}: {
  camera: TrafficCamera
  selected: boolean
  onSelect: () => void
  refreshKey: number
  compact?: boolean
}) {
  if (camera.streamUrl) {
    return (
      <LiveCamera
        camera={camera}
        selected={selected}
        compact={compact}
        onSelect={onSelect}
      />
    )
  }
  return (
    <SnapshotFeed
      camera={camera}
      selected={selected}
      onSelect={onSelect}
      refreshKey={refreshKey}
      compact={compact}
    />
  )
}

// ── Grid ───────────────────────────────────────────────────────────────────
interface CameraGridProps {
  cameras: TrafficCamera[]
  selectedId: string | null
  onSelect: (id: string) => void
}

export function CameraGrid({ cameras, selectedId, onSelect }: CameraGridProps) {
  const [refreshKey, setRefreshKey] = useState(Date.now())
  const [countdown, setCountdown] = useState(SNAPSHOT_REFRESH)

  const refresh = useCallback(() => {
    setRefreshKey(Date.now())
    setCountdown(SNAPSHOT_REFRESH)
  }, [])

  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown(n => {
        if (n <= 1) { refresh(); return SNAPSHOT_REFRESH }
        return n - 1
      })
    }, 1000)
    return () => clearInterval(tick)
  }, [refresh])

  const selectedCam = cameras.find(c => c.id === selectedId)
  const liveCount = cameras.filter(c => c.streamUrl).length
  const snapCount = cameras.filter(c => !c.streamUrl && c.imageUrl).length

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/[0.06] flex-shrink-0">
        <div>
          <div className="flex items-center gap-1.5">
            <div className="text-[10px] font-mono tracking-[0.15em] text-[#7a8ba8] uppercase">Traffic Cameras</div>
            {liveCount > 0 && (
              <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-red-500/15 text-red-400 border border-red-500/20">
                {liveCount} HLS LIVE
              </span>
            )}
          </div>
          <div className="text-[11px] text-[#e8edf5] font-medium">
            DriveTexas HLS live streams
          </div>
        </div>
        <div className="flex items-center gap-2">
          {snapCount > 0 && (
            <span className="text-[8px] font-mono text-[#4a5a72]">snap {countdown}s</span>
          )}
          <button onClick={refresh} className="text-[#4a5a72] hover:text-[#7a8ba8] transition-colors" title="Refresh snapshots">
            <RefreshCw size={10} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Selected camera — full expanded view */}
        {selectedCam && (
          <div className="p-2 border-b border-white/[0.06]">
            <div className="flex items-center justify-between px-0.5 mb-1.5">
              <span className="text-[10px] font-medium text-[#e8edf5]">{selectedCam.name}</span>
              <div className="flex items-center gap-1.5">
                {selectedCam.streamUrl && (
                  <span className="text-[7px] font-mono px-1 py-0.5 rounded bg-red-500/15 text-red-400">HLS</span>
                )}
                <span className="text-[8px] font-mono text-[#4a5a72]">{selectedCam.highway}</span>
              </div>
            </div>
            <CameraCell
              camera={selectedCam}
              selected
              onSelect={() => {}}
              refreshKey={refreshKey}
            />
          </div>
        )}

        {/* Camera grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-2 gap-2 p-2">
          {cameras.map(cam => (
            <CameraCell
              key={cam.id}
              camera={cam}
              selected={cam.id === selectedId}
              onSelect={() => onSelect(cam.id)}
              refreshKey={refreshKey}
              compact
            />
          ))}
        </div>

        <div className="pb-3 flex items-center justify-center gap-3">
          <a href="https://its.txdot.gov/its/District/HOU/cameras" target="_blank" rel="noopener noreferrer"
            className="text-[8px] font-mono text-[#4a5a72] hover:text-blue-400 transition-colors">
            TXDOT Cameras ↗
          </a>
          <span className="text-[#4a5a72]">·</span>
          <a href="https://traffic.houstontranstar.org/" target="_blank" rel="noopener noreferrer"
            className="text-[8px] font-mono text-[#4a5a72] hover:text-blue-400 transition-colors">
            TranStar ↗
          </a>
        </div>
      </div>
    </div>
  )
}
