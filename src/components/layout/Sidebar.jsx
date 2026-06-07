import React from 'react'
import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Package, Clock, TrendingUp,
  ScanBarcode, Bell, Settings, ClipboardList, Users, History
} from 'lucide-react'
import { useStore } from '@/store/useStore'

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/stock', icon: Package, label: 'Stock' },
  { to: '/expiry', icon: Clock, label: 'Expiry' },
  { to: '/prescriptions', icon: ClipboardList, label: 'Prescriptions' },
  { to: '/patients', icon: Users, label: 'Patients' },
  { to: '/predictions', icon: TrendingUp, label: 'Predictions' },
  { to: '/scanner', icon: ScanBarcode, label: 'Scanner' },
  { to: '/notifications', icon: Bell, label: 'Notifications' },
  { to: '/audit-log', icon: History, label: 'Audit Log' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

function Sidebar() {
  const { unreadCount } = useStore()

  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-1 border-r border-border bg-surface shrink-0">
      <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center mb-4">
        <span className="text-base leading-none">💊</span>
      </div>
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          className={({ isActive }) =>
            `relative w-10 h-10 flex items-center justify-center rounded-lg transition-colors
            ${isActive ? 'bg-card text-accent' : 'text-muted hover:text-text hover:bg-card'}`
          }
        >
          <Icon size={18} />
          {to === '/notifications' && unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-danger rounded-full text-white text-[9px] flex items-center justify-center font-bold"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </NavLink>
      ))}
    </aside>
  )
}

export default Sidebar
