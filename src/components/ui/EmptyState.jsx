import React from 'react'
import { Upload } from 'lucide-react'
import { motion } from 'framer-motion'
import { useStore } from '@/store/useStore'

function EmptyState({ message = 'No data yet', sub = 'Upload a CSV file to get started', icon: Icon = Upload }) {
  const { setUploadModalOpen } = useStore()

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center h-64 gap-4"
    >
      <div className="w-14 h-14 rounded-2xl bg-card border border-border flex items-center justify-center text-muted">
        <Icon size={24} />
      </div>
      <div className="text-center">
        <p className="text-text font-medium">{message}</p>
        <p className="text-muted text-sm mt-1">{sub}</p>
      </div>
      <button
        onClick={() => setUploadModalOpen(true)}
        className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:bg-opacity-90 transition-colors"
      >
        Upload CSV
      </button>
    </motion.div>
  )
}

export default EmptyState
