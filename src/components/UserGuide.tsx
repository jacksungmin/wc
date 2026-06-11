import { X, ExternalLink } from 'lucide-react'

interface UserGuideProps {
  onClose: () => void
}

export function UserGuide({ onClose }: UserGuideProps) {
  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-5xl h-[92vh] flex flex-col bg-[#09101e] border border-white/[0.1] rounded-lg shadow-2xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.08] flex-shrink-0 bg-[#0b1220]">
          <div className="flex items-center gap-2.5">
            <span className="text-[10px] font-mono tracking-[0.15em] text-[#4a5a72] uppercase">User Guide</span>
            <span className="text-white/10">·</span>
            <span className="text-[10px] font-mono text-[#4a5a72]">World Cup 2026 Mobility Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/user-guide.html"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-[9px] font-mono text-[#4a5a72] hover:text-[#e8edf5] transition-colors px-2 py-1 rounded hover:bg-white/[0.04]"
              title="Open in new tab"
            >
              <ExternalLink size={11} />
              Open in tab
            </a>
            <div className="w-px h-3.5 bg-white/[0.08]" />
            <button
              onClick={onClose}
              className="w-6 h-6 rounded flex items-center justify-center text-[#4a5a72] hover:text-[#e8edf5] hover:bg-white/[0.06] transition-colors"
              aria-label="Close user guide"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* iframe */}
        <iframe
          src="/user-guide.html"
          className="flex-1 w-full border-none"
          title="User Guide"
        />
      </div>
    </div>
  )
}
