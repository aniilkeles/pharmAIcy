import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Package, AlertTriangle } from 'lucide-react'
import { useAPI } from '@/hooks/useAPI'
import { useStore } from '@/store/useStore'
import StockTable from '@/components/stock/StockTable'
import EmptyState from '@/components/ui/EmptyState'

function Stock() {
  const { fetchStock, loading } = useAPI()
  const { stockData } = useStore()

  useEffect(() => { fetchStock() }, [])

  return (
    <motion.div
      key="stock"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Stock Monitor</h1>
          <p className="text-sm text-muted mt-0.5">Products below critical stock threshold</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-warning/10 border border-warning/20 rounded-lg">
          <AlertTriangle size={13} className="text-warning" />
          <span className="text-xs text-warning">{stockData.length} alerts</span>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : stockData.length === 0 ? (
        <EmptyState message="All stock levels OK" sub="No products are below their critical threshold" icon={Package} />
      ) : (
        <StockTable data={stockData} />
      )}
    </motion.div>
  )
}

export default Stock
