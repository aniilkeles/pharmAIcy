import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link2 } from 'lucide-react'
import { useAPI } from '@/hooks/useAPI'
import { useStore } from '@/store/useStore'
import CrossSellCards from '@/components/crosssell/CrossSellCards'
import EmptyState from '@/components/ui/EmptyState'

function CrossSell() {
  const { fetchCrossSell, loading } = useAPI()
  const { crossSellData } = useStore()

  useEffect(() => { fetchCrossSell() }, [])

  return (
    <motion.div
      key="crosssell"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div>
        <h1 className="text-lg font-semibold text-text">Cross-Sell Suggestions</h1>
        <p className="text-sm text-muted mt-0.5">Products frequently bought together (Apriori algorithm)</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : crossSellData.length === 0 ? (
        <EmptyState message="No cross-sell patterns found" sub="Upload more sales data to discover product associations" icon={Link2} />
      ) : (
        <CrossSellCards data={crossSellData} />
      )}
    </motion.div>
  )
}

export default CrossSell
