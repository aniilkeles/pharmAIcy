import React from 'react'
import { motion } from 'framer-motion'

function KPICard({ title, value, sub, icon: Icon, color = 'accent', delay = 0 }) {
  const colors = {
    accent: 'text-accent bg-accent/10',
    warning: 'text-warning bg-warning/10',
    danger: 'text-danger bg-danger/10',
    blue: 'text-blue bg-blue/10'
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut', delay }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-muted text-xs font-medium uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-semibold text-text mt-1">{value}</p>
          {sub && <p className="text-muted text-xs mt-1">{sub}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colors[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  )
}

export default KPICard
