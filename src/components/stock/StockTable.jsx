import React from 'react'
import { motion } from 'framer-motion'
import Badge from '@/components/ui/Badge'

function StockTable({ data = [] }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left text-xs text-muted font-medium px-5 py-3">Product</th>
            <th className="text-right text-xs text-muted font-medium px-5 py-3">Stock</th>
            <th className="text-right text-xs text-muted font-medium px-5 py-3">Threshold</th>
            <th className="text-right text-xs text-muted font-medium px-5 py-3">Price</th>
            <th className="text-center text-xs text-muted font-medium px-5 py-3">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <motion.tr
              key={item.product_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2, ease: 'easeOut', delay: i * 0.03 }}
              className="border-b border-border last:border-0 hover:bg-surface transition-colors"
            >
              <td className="px-5 py-3">
                <span className="text-sm text-text">{item.name}</span>
              </td>
              <td className="px-5 py-3 text-right">
                <span className={`text-sm font-medium ${item.stock === 0 ? 'text-danger' : 'text-text'}`}>{item.stock}</span>
              </td>
              <td className="px-5 py-3 text-right">
                <span className="text-sm text-muted">{item.critical_stock}</span>
              </td>
              <td className="px-5 py-3 text-right">
                <span className="text-sm text-muted">{item.sale_price?.toFixed(2)}₺</span>
              </td>
              <td className="px-5 py-3 text-center">
                <Badge variant={item.status === 'critical' ? 'danger' : 'warning'}>
                  {item.status === 'critical' ? 'Critical' : 'Low'}
                </Badge>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default StockTable
