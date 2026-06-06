import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Pencil, Check, X } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { updateProduct } from '@/lib/api'

const INPUT_STYLE = {
  background: '#2a2a2a',
  border: '1px solid #3a3a3a',
  color: '#ededec',
  borderRadius: 6,
  padding: '4px 8px',
  fontSize: 13,
  width: 72,
  outline: 'none',
}

function StockTable({ data = [], onRefresh }) {
  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')

  const startEdit = (item) => {
    setEditingId(item.product_id)
    setEditValues({
      stock: item.stock,
      critical_stock: item.critical_stock,
      sale_price: item.sale_price,
      cost_price: item.cost_price ?? '',
    })
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValues({})
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const saveEdit = async (productId) => {
    setSaving(true)
    try {
      await updateProduct(productId, {
        stock: Number(editValues.stock),
        critical_stock: Number(editValues.critical_stock),
        sale_price: Number(editValues.sale_price),
        cost_price: editValues.cost_price !== '' ? Number(editValues.cost_price) : undefined,
      })
      setEditingId(null)
      setEditValues({})
      showToast('Saved')
      onRefresh?.()
    } catch (e) {
      console.error('updateProduct failed:', e)
      showToast('Save failed: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="relative">
      {toast && (
        <div
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
            background: toast.startsWith('Save failed') ? '#7f1d1d' : '#1a3a1a',
            border: `1px solid ${toast.startsWith('Save failed') ? '#ef4444' : '#4ade80'}`,
            color: '#ededec', borderRadius: 8, padding: '8px 16px', fontSize: 13,
          }}
        >
          {toast}
        </div>
      )}

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left text-xs text-muted font-medium px-5 py-3">Product</th>
              <th className="text-right text-xs text-muted font-medium px-5 py-3">Stock</th>
              <th className="text-right text-xs text-muted font-medium px-5 py-3">Threshold</th>
              <th className="text-right text-xs text-muted font-medium px-5 py-3">Sale Price</th>
              <th className="text-right text-xs text-muted font-medium px-5 py-3">Cost Price</th>
              <th className="text-center text-xs text-muted font-medium px-5 py-3">Status</th>
              <th className="text-center text-xs text-muted font-medium px-5 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {data.map((item, i) => {
              const isEditing = editingId === item.product_id
              return (
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
                    {isEditing ? (
                      <input
                        type="number" min="0" style={INPUT_STYLE}
                        value={editValues.stock}
                        onChange={e => setEditValues(v => ({ ...v, stock: e.target.value }))}
                      />
                    ) : (
                      <span className={`text-sm font-medium ${item.stock === 0 ? 'text-danger' : 'text-text'}`}>{item.stock}</span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" min="0" style={INPUT_STYLE}
                        value={editValues.critical_stock}
                        onChange={e => setEditValues(v => ({ ...v, critical_stock: e.target.value }))}
                      />
                    ) : (
                      <span className="text-sm text-muted">{item.critical_stock}</span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" min="0" step="0.01" style={INPUT_STYLE}
                        value={editValues.sale_price}
                        onChange={e => setEditValues(v => ({ ...v, sale_price: e.target.value }))}
                      />
                    ) : (
                      <span className="text-sm text-muted">{item.sale_price?.toFixed(2)}₺</span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-right">
                    {isEditing ? (
                      <input
                        type="number" min="0" step="0.01" style={INPUT_STYLE}
                        value={editValues.cost_price}
                        onChange={e => setEditValues(v => ({ ...v, cost_price: e.target.value }))}
                      />
                    ) : (
                      <span className="text-sm text-muted">{item.cost_price != null ? `${item.cost_price.toFixed(2)}₺` : '—'}</span>
                    )}
                  </td>

                  <td className="px-5 py-3 text-center">
                    <Badge variant={item.status === 'critical' ? 'danger' : 'warning'}>
                      {item.status === 'critical' ? 'Critical' : 'Low'}
                    </Badge>
                  </td>

                  <td className="px-5 py-3 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => saveEdit(item.product_id)}
                          disabled={saving}
                          title="Save"
                          className="w-6 h-6 flex items-center justify-center rounded text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50"
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={cancelEdit}
                          title="Cancel"
                          className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-text transition-colors"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(item)}
                        title="Edit"
                        className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-text transition-colors mx-auto"
                      >
                        <Pencil size={13} />
                      </button>
                    )}
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default StockTable
