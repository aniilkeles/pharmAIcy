import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useAPI } from '@/hooks/useAPI'
import { useStore } from '@/store/useStore'
import EmptyState from '@/components/ui/EmptyState'

function Predictions() {
  const { fetchPredictions, loading } = useAPI()
  const { predictionsData } = useStore()

  useEffect(() => { fetchPredictions() }, [])

  const predictions = predictionsData?.predictions || []

  return (
    <motion.div
      key="predictions"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div>
        <h1 className="text-lg font-semibold text-text">Sales Predictions</h1>
        <p className="text-sm text-muted mt-0.5">7-day forecast (Random Forest model)</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : predictions.length === 0 ? (
        <EmptyState message="No predictions available" sub="Upload sales data to generate forecasts" icon={TrendingUp} />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {predictions.slice(0, 6).map((p, i) => (
            <motion.div
              key={p.product_id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.04 }}
              className="bg-card border border-border rounded-xl p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-medium text-text truncate flex-1">{p.product_name}</p>
                <span className="text-xs text-accent font-medium ml-2">{p.total_forecast.toFixed(0)} units</span>
              </div>
              <ResponsiveContainer width="100%" height={80}>
                <BarChart data={p.forecast}>
                  <XAxis dataKey="date" tick={{ fill: '#6B6B6B', fontSize: 9 }} tickLine={false} axisLine={false} tickFormatter={v => v?.slice(8)} />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 6, fontSize: 11 }}
                    labelStyle={{ color: '#6B6B6B' }}
                    itemStyle={{ color: '#5B8DEF' }}
                    formatter={v => [v.toFixed(1), 'Units']}
                  />
                  <Bar dataKey="quantity" fill="#5B8DEF" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  )
}

export default Predictions
