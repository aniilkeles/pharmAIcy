import React from 'react'
import { motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'

function CrossSellCards({ data = [] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {data.map((rule, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.04 }}
          className="bg-card border border-border rounded-xl p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1">
              <div className="flex flex-wrap gap-1">
                {rule.antecedents.map((a, ai) => (
                  <span key={ai} className="px-2 py-0.5 bg-blue/10 text-blue text-xs rounded border border-blue/20">{a}</span>
                ))}
              </div>
            </div>
            <ArrowRight size={14} className="text-muted shrink-0" />
            <div className="flex-1">
              <div className="flex flex-wrap gap-1">
                {rule.consequents.map((c, ci) => (
                  <span key={ci} className="px-2 py-0.5 bg-accent/10 text-accent text-xs rounded border border-accent/20">{c}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex gap-4">
            <div>
              <p className="text-[10px] text-muted">Confidence</p>
              <p className="text-sm font-medium text-text">{(rule.confidence * 100).toFixed(0)}%</p>
            </div>
            <div>
              <p className="text-[10px] text-muted">Lift</p>
              <p className="text-sm font-medium text-text">{rule.lift.toFixed(2)}x</p>
            </div>
            <div>
              <p className="text-[10px] text-muted">Support</p>
              <p className="text-sm font-medium text-text">{(rule.support * 100).toFixed(1)}%</p>
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default CrossSellCards
