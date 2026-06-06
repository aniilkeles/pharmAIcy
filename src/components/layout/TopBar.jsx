import React, { useState } from 'react'
import { Upload, Download, LogOut } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'
import NotificationBell from '@/components/notifications/NotificationBell'
import UploadModal from '@/components/upload/UploadModal'
import { exportData } from '@/lib/api'

function AgentDot({ label, status }) {
  return (
    <div title={label} className="flex items-center gap-1">
      <div className={`w-2 h-2 rounded-full ${status === 'ready' ? 'bg-accent' : 'bg-muted'}`} />
    </div>
  )
}

function WinControls() {
  const [hovered, setHovered] = useState(null)
  const buttons = [
    { id: 'min', label: '—', action: () => window.api?.minimize(), hoverBg: '#3a3a3a' },
    { id: 'max', label: '□', action: () => window.api?.maximize(), hoverBg: '#3a3a3a' },
    { id: 'cls', label: '✕', action: () => window.api?.close(),    hoverBg: '#e81123' },
  ]
  return (
    <div style={{ display: 'flex', marginLeft: 'auto', WebkitAppRegion: 'no-drag' }}>
      {buttons.map(b => (
        <button
          key={b.id}
          onClick={b.action}
          onMouseEnter={() => setHovered(b.id)}
          onMouseLeave={() => setHovered(null)}
          style={{
            width: 46, height: 32, border: 'none', borderRadius: 0,
            background: hovered === b.id ? b.hoverBg : 'transparent',
            color: '#ededec', fontSize: 12, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.1s',
          }}
        >
          {b.label}
        </button>
      ))}
    </div>
  )
}

function TopBar() {
  const { user, logout } = useAuth()
  const { setUploadModalOpen, agentStatus } = useStore()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportData()
      await window.api.saveFileDialog(res.data)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const agents = agentStatus?.agents || {}

  return (
    <header
      className="border-b border-border bg-surface shrink-0"
      style={{ height: 48, display: 'flex', alignItems: 'center', position: 'relative', WebkitAppRegion: 'drag' }}
    >
      {/* Drag region overlay (covers full bar, sits behind interactive elements) */}
      <div style={{ WebkitAppRegion: 'drag', position: 'absolute', top: 0, left: 0, right: 0, height: 48, zIndex: 0 }} />

      {/* Content row — sits above drag region */}
      <div style={{ display: 'flex', alignItems: 'center', width: '100%', paddingLeft: 16, paddingRight: 0, gap: 12, position: 'relative', zIndex: 1 }}>
        <span className="text-text font-semibold text-sm" style={{ WebkitAppRegion: 'drag' }}>PharmAIcy</span>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' }}>
          {/* Agent status dots */}
          <div className="flex items-center gap-1.5 mr-2">
            {['data', 'prediction', 'interaction', 'expiry', 'decision'].map(a => (
              <AgentDot key={a} label={`${a}_agent`} status={agents[`${a}_agent`] || 'idle'} />
            ))}
          </div>

          <button
            onClick={() => setUploadModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-accent text-black font-medium hover:bg-opacity-90 transition-colors"
          >
            <Upload size={13} />
            Upload
          </button>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md border border-border text-muted hover:text-text hover:border-muted transition-colors"
          >
            <Download size={13} />
            Export
          </button>

          <NotificationBell />

          <button
            onClick={logout}
            title="Logout"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-card text-muted hover:text-text transition-colors"
          >
            <LogOut size={13} />
          </button>
        </div>

        <WinControls />
      </div>

      <UploadModal />
    </header>
  )
}

export default TopBar
