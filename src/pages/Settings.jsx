import React from 'react'
import { motion } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import { useStore } from '@/store/useStore'

function Settings() {
  const { user, logout } = useAuth()
  const { clearChat } = useStore()

  return (
    <motion.div
      key="settings"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6 max-w-xl"
    >
      <div>
        <h1 className="text-lg font-semibold text-text">Settings</h1>
        <p className="text-sm text-muted mt-0.5">Account and application settings</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text">Account</h2>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">Email</p>
          <p className="text-sm text-text">{user?.email}</p>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted">User ID</p>
          <p className="text-xs text-muted font-mono">{user?.id}</p>
        </div>
        <button
          onClick={logout}
          className="w-fit px-4 py-2 bg-danger/10 border border-danger/20 text-danger text-sm rounded-lg hover:bg-danger/20 transition-colors"
        >
          Sign Out
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
        <h2 className="text-sm font-medium text-text">Data</h2>
        <button
          onClick={clearChat}
          className="w-fit px-4 py-2 border border-border text-muted text-sm rounded-lg hover:text-text hover:border-muted transition-colors"
        >
          Clear Chat History
        </button>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h2 className="text-sm font-medium text-text mb-3">About</h2>
        <div className="flex flex-col gap-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted">Version</span>
            <span className="text-text">1.0.0</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Backend</span>
            <span className="text-text">FastAPI + Python</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">AI Model</span>
            <span className="text-text">claude-sonnet-4-20250514</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted">Database</span>
            <span className="text-text">SQLite</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default Settings
