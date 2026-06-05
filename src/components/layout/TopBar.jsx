import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, Download, LogOut, User } from 'lucide-react'
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

function TopBar() {
  const { user, logout } = useAuth()
  const { setUploadModalOpen } = useStore()
  const { agentStatus } = useStore()
  const [exporting, setExporting] = useState(false)

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportData()
      const csvData = res.data
      await window.api.saveFileDialog(csvData)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setExporting(false)
    }
  }

  const agents = agentStatus?.agents || {}

  return (
    <header className="h-12 flex items-center px-4 gap-3 border-b border-border bg-surface shrink-0" style={{ WebkitAppRegion: 'drag' }}>
      <span className="text-text font-semibold text-sm flex-1">PharmAIcy</span>

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

      <UploadModal />
    </header>
  )
}

export default TopBar
