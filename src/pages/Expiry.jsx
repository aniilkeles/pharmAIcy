import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Clock } from 'lucide-react'
import { useAPI } from '@/hooks/useAPI'
import { useStore } from '@/store/useStore'
import ExpiryList from '@/components/expiry/ExpiryList'
import EmptyState from '@/components/ui/EmptyState'

function Expiry() {
  const { fetchExpiry, loading } = useAPI()
  const { expiryData } = useStore()

  useEffect(() => { fetchExpiry() }, [])

  const urgent = expiryData.filter(p => p.category === 'urgent' || p.category === 'expired')
  const warning = expiryData.filter(p => p.category === 'warning')

  return (
    <motion.div
      key="expiry"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div>
        <h1 className="text-lg font-semibold text-text">Expiry Tracking</h1>
        <p className="text-sm text-muted mt-0.5">Products expiring within 90 days</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expiryData.length === 0 ? (
        <EmptyState message="No products expiring soon" sub="All products have expiry dates beyond 90 days" icon={Clock} />
      ) : (
        <>
          {urgent.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-danger mb-3 flex items-center gap-2">
                <Clock size={14} /> Urgent ({urgent.length})
              </h2>
              <ExpiryList data={urgent} />
            </div>
          )}
          {warning.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-warning mb-3 flex items-center gap-2">
                <Clock size={14} /> Warning ({warning.length})
              </h2>
              <ExpiryList data={warning} />
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}

export default Expiry
