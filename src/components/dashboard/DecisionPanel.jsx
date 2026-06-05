import React from 'react'
import { motion } from 'framer-motion'
import { Zap, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react'
import Badge from '@/components/ui/Badge'

const priorityVariant = { high: 'danger', medium: 'warning', low: 'muted' }

function DecisionPanel({ decisions = [] }) {
  if (!decisions.length) return null

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Zap size={15} className="text-accent" />
        <p className="text-sm font-medium text-text">AI Recommendations</p>
      </div>
      <div className="flex flex-col gap-3">
        {decisions.slice(0, 5).map((d, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.04 }}
            className="flex items-start gap-3 p-3 bg-surface rounded-lg border border-border"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-text">{d.title}</span>
                <Badge variant={priorityVariant[d.priority] || 'muted'}>{d.priority}</Badge>
              </div>
              <p className="text-xs text-muted">{d.action}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

export default DecisionPanel
