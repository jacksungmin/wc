import { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import { VideoOff } from 'lucide-react'
import type { TrafficCamera } from '@/types'

// DriveTexas / SkyVDN live HLS stream
// Playlist URL: https://s73.us-east-1.skyvdn.com/rtplive/{cameraId}/playlist.m3u8
// CORS: access-control-allow-origin: * — no proxy needed
const CDN = 'https://s73.us-east-1.skyvdn.com/rtplive'

export function streamUrl(cameraId: string) {
  return `${CDN}/${cameraId}/playlist.m3u8`
}

interface LiveCameraProps {
  camera: TrafficCamera
  selected?: boolean
  compact?: boolean
  onSelect?: () => void
}

export function LiveCamera({ camera, selected, compact, onSelect }: LiveCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [status, setStatus] = useState<'loading' | 'live' | 'error'>('loading')

  useEffect(() => {
    const video = videoRef.current
    if (!video || !camera.streamUrl) return

    setStatus('loading')
    hlsRef.current?.destroy()

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        maxBufferLength: 10,
        maxMaxBufferLength: 20,
        backBufferLength: 0,
      })
      hlsRef.current = hls
      hls.loadSource(camera.streamUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {})
      })
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) setStatus('error')
      })
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS support
      video.src = camera.streamUrl
      video.load()
      video.play().catch(() => {})
    } else {
      setStatus('error')
    }

    return () => {
      hlsRef.current?.destroy()
      hlsRef.current = null
    }
  }, [camera.streamUrl])

  return (
    <button
      onClick={onSelect}
      className={[
        'relative overflow-hidden rounded border transition-all text-left w-full',
        selected
          ? 'border-red-500/50 ring-1 ring-red-500/25'
          : 'border-white/[0.06] hover:border-white/[0.14]',
      ].join(' ')}
    >
      <div className={`${compact ? 'aspect-video' : 'aspect-[16/10]'} bg-[#070c14] relative`}>
        {status !== 'error' ? (
          <>
            <video
              ref={videoRef}
              className={`w-full h-full object-cover transition-opacity duration-500 ${
                status === 'live' ? 'opacity-100' : 'opacity-0'
              }`}
              muted
              playsInline
              autoPlay
              onCanPlay={() => setStatus('live')}
              onError={() => setStatus('error')}
            />
            {status === 'loading' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-4 h-4 border border-[#4a5a72] border-t-[#7a8ba8] rounded-full animate-spin" />
              </div>
            )}
            {status === 'live' && (
              <div className="absolute top-1 right-1 flex items-center gap-1 bg-black/65 backdrop-blur-sm px-1.5 py-0.5 rounded">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                <span className="text-[7px] font-mono text-red-400 font-semibold">LIVE</span>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <VideoOff size={14} className="text-[#4a5a72]" />
            <span className="text-[8px] font-mono text-[#4a5a72]">Stream unavailable</span>
            <a
              href="https://drivetexas.org/"
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[8px] font-mono text-blue-500 hover:text-blue-400 underline"
            >
              DriveTexas ↗
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
