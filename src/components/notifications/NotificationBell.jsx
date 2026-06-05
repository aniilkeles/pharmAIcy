import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, X, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useNotifications } from '@/hooks/useNotifications'
import { useNavigate } from 'react-router-dom'

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const navigate = useNavigate()
  const { notifications, unreadCount } = useStore()
  const { markRead, markAllRead } = useNotifications()

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const recent = notifications.slice(0, 5)
  const typeColor = {
    stock_critical: 'text-danger',
    stock_warning: 'text-warning',
    expiry_urgent: 'text-danger',
    expiry_warning: 'text-warning'
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="relative w-8 h-8 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-card transition-colors"
      >
        <Bell size={16} />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger rounded-full text-white text-[9px] flex items-center justify-center font-bold"
              style={{ animation: 'pulse 2s infinite' }}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute right-0 top-10 w-80 bg-surface border border-border rounded-xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <span className="text-sm font-semibold text-text">Notifications</span>
              {unreadCount > 0 && (
                <button onClick={markAllRead} className="text-xs text-accent hover:underline">
                  Mark all read
                </button>
              )}
            </div>

            {recent.length === 0 ? (
              <div className="px-4 py-6 text-center text-muted text-sm">No notifications</div>
            ) : (
              <div className="divide-y divide-border">
                {recent.map(n => (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-card transition-colors ${!n.is_read ? 'bg-card/30' : ''}`}
                  >
                    <div className={`w-1.5 h-1.5 rounded-full mt-2 shrink-0 ${n.is_read ? 'bg-muted' : typeColor[n.type] || 'bg-accent'}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-text leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-xs text-muted mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.is_read && (
                      <button onClick={() => markRead(n.id)} className="text-muted hover:text-accent transition-colors mt-0.5">
                        <Check size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="px-4 py-2 border-t border-border">
              <button
                onClick={() => { navigate('/notifications'); setOpen(false) }}
                className="text-xs text-accent hover:underline w-full text-center"
              >
                View all notifications
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default NotificationBell
