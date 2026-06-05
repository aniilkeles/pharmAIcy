import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { motion } from 'framer-motion'

function SalesChart({ data = [] }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="bg-card border border-border rounded-xl p-5"
    >
      <p className="text-sm font-medium text-text mb-4">Revenue (30 days)</p>
      <ResponsiveContainer width="100%" height={160}>
        <AreaChart data={data}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#00C896" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#00C896" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="date"
            tick={{ fill: '#6B6B6B', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => v?.slice(5)}
          />
          <YAxis
            tick={{ fill: '#6B6B6B', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `${v}₺`}
          />
          <Tooltip
            contentStyle={{ background: '#1A1A1A', border: '1px solid #2E2E2E', borderRadius: 8, fontSize: 12 }}
            labelStyle={{ color: '#6B6B6B' }}
            itemStyle={{ color: '#00C896' }}
            formatter={v => [`${v.toFixed(2)}₺`, 'Revenue']}
          />
          <Area type="monotone" dataKey="revenue" stroke="#00C896" strokeWidth={2} fill="url(#revGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  )
}

export default SalesChart
