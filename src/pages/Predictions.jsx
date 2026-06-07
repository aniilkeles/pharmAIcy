import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { RefreshCw, TrendingUp } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { predictSales } from '@/lib/api'

const FEATURE_LABELS = {
  sales_last_7_days:  'Sales last 7d',
  sales_last_30_days: 'Sales last 30d',
  sales_last_90_days: 'Sales last 90d',
  avg_daily_sales:    'Avg daily sales',
  day_of_week:        'Day of week',
  month:              'Month',
  current_stock:      'Current stock',
  stock_ratio:        'Stock ratio',
  is_low_stock:       'Low stock flag',
  is_expiry_pressure: 'Expiry pressure',
}

const REC_STYLE = {
  restock: 'bg-red-500/20 text-red-400',
  ok:      'bg-green-500/20 text-green-400',
  surplus: 'bg-blue-500/20 text-blue-400',
}

const CONF_DOT = {
  high:   'bg-green-500',
  medium: 'bg-yellow-500',
  low:    'bg-gray-500',
}

function Predictions() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchError, setFetchError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const res = await predictSales()
      setData(res.data)
    } catch (e) {
      setFetchError(e.message || 'Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const predictions   = data?.predictions || []
  const metrics       = data?.metrics || null
  const isInsufficient = data?.error === 'insufficient_data'

  const featureData = metrics
    ? Object.entries(metrics.feature_importance || {})
        .map(([k, v]) => ({ feature: FEATURE_LABELS[k] || k, importance: v }))
        .sort((a, b) => b.importance - a.importance)
    : []

  return (
    <motion.div
      key="predictions"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Sales Predictions</h1>
          <p className="text-sm text-muted mt-0.5">7-day demand forecast · Random Forest</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted border border-border rounded-lg hover:text-text hover:border-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Fetch error */}
      {!loading && fetchError && (
        <div className="bg-card border border-border rounded-xl p-6 text-center">
          <p className="text-sm text-danger">{fetchError}</p>
        </div>
      )}

      {/* Insufficient data */}
      {!loading && !fetchError && isInsufficient && (
        <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center gap-3 text-center">
          <TrendingUp size={36} className="text-muted" />
          <p className="text-sm font-medium text-text">Need more sales data for predictions.</p>
          <p className="text-xs text-muted">
            Current: <span className="text-text font-medium">{data.current}</span> sales. Minimum:{' '}
            <span className="text-text font-medium">{data.need}</span> sales.
          </p>
          <p className="text-xs text-muted">Create prescriptions to generate sales data.</p>
        </div>
      )}

      {/* Results */}
      {!loading && !fetchError && !isInsufficient && predictions.length > 0 && metrics && (
        <>
          {/* Model performance cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'MAE',  value: metrics.mae,  sub: 'units' },
              { label: 'RMSE', value: metrics.rmse, sub: 'units' },
              { label: 'R²',   value: metrics.r2,   sub: 'accuracy' },
            ].map(({ label, value, sub }) => (
              <div key={label} className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted mb-1">{label}</p>
                <p className="text-2xl font-bold text-text">{value}</p>
                <p className="text-xs text-muted mt-0.5">{sub}</p>
              </div>
            ))}
          </div>

          {/* Feature importance */}
          {featureData.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-sm font-medium text-text mb-4">Feature Importance</p>
              <ResponsiveContainer width="100%" height={featureData.length * 28 + 8}>
                <BarChart data={featureData} layout="vertical" margin={{ left: 0, right: 48, top: 0, bottom: 0 }}>
                  <XAxis
                    type="number"
                    domain={[0, 'auto']}
                    tick={{ fill: '#6B6B6B', fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={v => v.toFixed(2)}
                  />
                  <YAxis
                    type="category"
                    dataKey="feature"
                    width={120}
                    tick={{ fill: '#9B9B9B', fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 6, fontSize: 11 }}
                    formatter={v => [v.toFixed(4), 'Importance']}
                    cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                  />
                  <Bar dataKey="importance" fill="#5B8DEF" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Predictions table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs text-muted font-medium">Product</th>
                  <th className="px-4 py-3 text-left text-xs text-muted font-medium">Current Stock</th>
                  <th className="px-4 py-3 text-left text-xs text-muted font-medium">7-Day Forecast</th>
                  <th className="px-4 py-3 text-left text-xs text-muted font-medium">Recommendation</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((p, i) => (
                  <motion.tr
                    key={p.product_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 text-text font-medium">{p.product_name}</td>
                    <td className="px-4 py-3 text-muted">{p.current_stock} units</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-text font-medium">{p.predicted_demand_7d} units</span>
                        <span
                          className={`w-2 h-2 rounded-full shrink-0 ${CONF_DOT[p.confidence] || CONF_DOT.low}`}
                          title={`Confidence: ${p.confidence}`}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${REC_STYLE[p.recommendation] || ''}`}>
                        {p.recommendation}
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </motion.div>
  )
}

export default Predictions
