import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, AlertTriangle, Clock, CheckCheck, Trash2 } from 'lucide-react'
import { useNotifications } from '@/hooks/useNotifications'
import { useStore } from '@/store/useStore'
import Badge from '@/components/ui/Badge'
import EmptyState from '@/components/ui/EmptyState'
import { markAllNotificationsRead } from '@/lib/api'

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

const typeConfig = {
  stock_critical: { label: 'Critical Stock', variant: 'danger', icon: AlertTriangle },
  stock_warning: { label: 'Low Stock', variant: 'warning', icon: AlertTriangle },
  expiry_urgent: { label: 'Expiry Urgent', variant: 'danger', icon: Clock },
  expiry_warning: { label: 'Expiry Warning', variant: 'warning', icon: Clock }
}

function Notifications() {
  const [filter, setFilter] = useState('all')
  const { fetchNotifications, markRead, markAllRead } = useNotifications()
  const { notifications } = useStore()

  useEffect(() => { fetchNotifications() }, [])

  const filtered = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'stock') return n.type.startsWith('stock')
    if (filter === 'expiry') return n.type.startsWith('expiry')
    return true
  })

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'unread', label: 'Unread' },
    { key: 'stock', label: 'Stock' },
    { key: 'expiry', label: 'Expiry' }
  ]

  return (
    <motion.div
      key="notifications"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Notifications</h1>
          <p className="text-sm text-muted mt-0.5">{notifications.filter(n => !n.is_read).length} unread</p>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-2 px-3 py-1.5 border border-border rounded-lg text-xs text-muted hover:text-text hover:border-muted transition-colors"
        >
          <CheckCheck size={13} />
          Mark all read
        </button>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            className={`px-4 py-2 text-sm transition-colors border-b-2 -mb-px
              ${filter === t.key ? 'text-text border-accent' : 'text-muted border-transparent hover:text-text'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No notifications" sub="All clear!" icon={Bell} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((n, i) => {
            const cfg = typeConfig[n.type] || { label: n.type, variant: 'muted', icon: Bell }
            const Icon = cfg.icon

            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15, ease: 'easeOut', delay: i * 0.02 }}
                className={`flex items-start gap-4 p-4 bg-card border rounded-xl transition-colors
                  ${n.is_read ? 'border-border opacity-60' : 'border-border'}`}
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: n.type.includes('critical') || n.type.includes('urgent') ? '#EF4444' : '#F59E0B'
                }}
              >
                <Icon size={16} className={n.type.includes('critical') || n.type.includes('urgent') ? 'text-danger mt-0.5' : 'text-warning mt-0.5'} />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge variant={cfg.variant}>{cfg.label}</Badge>
                    {!n.is_read && <span className="w-1.5 h-1.5 bg-accent rounded-full" />}
                  </div>
                  <p className="text-sm text-text">{n.message}</p>
                  <p className="text-xs text-muted mt-1">{n.product_name} · {timeAgo(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <button onClick={() => markRead(n.id)} className="text-muted hover:text-accent transition-colors shrink-0 mt-0.5">
                    <CheckCheck size={15} />
                  </button>
                )}
              </motion.div>
            )
          })}
        </div>
      )}
    </motion.div>
  )
}

export default Notifications
