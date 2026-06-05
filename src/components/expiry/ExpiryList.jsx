import React from 'react'
import { motion } from 'framer-motion'
import Badge from '@/components/ui/Badge'
import { Clock } from 'lucide-react'

function ExpiryList({ data = [] }) {
  return (
    <div className="flex flex-col gap-2">
      {data.map((item, i) => (
        <motion.div
          key={item.product_id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.04 }}
          className={`flex items-center gap-4 p-4 bg-card border rounded-xl ${
            item.category === 'urgent' || item.category === 'expired' ? 'border-danger/30' : 'border-warning/30'
          }`}
        >
          <div className={`w-1 h-12 rounded-full ${
            item.category === 'expired' ? 'bg-danger' :
            item.category === 'urgent' ? 'bg-danger' : 'bg-warning'
          }`} />
          <Clock size={16} className={item.category === 'urgent' || item.category === 'expired' ? 'text-danger' : 'text-warning'} />
          <div className="flex-1">
            <p className="text-sm font-medium text-text">{item.name}</p>
            <p className="text-xs text-muted">
              Expires: {item.expiry_date} · Stock: {item.stock}
            </p>
          </div>
          <div className="text-right">
            <Badge variant={item.category === 'urgent' || item.category === 'expired' ? 'danger' : 'warning'}>
              {item.category === 'expired' ? 'Expired' :
               item.category === 'urgent' ? `${item.days_until_expiry}d left` : `${item.days_until_expiry}d left`}
            </Badge>
          </div>
        </motion.div>
      ))}
    </div>
  )
}

export default ExpiryList
