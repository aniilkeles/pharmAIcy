import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { CheckCircle, AlertCircle, Plus } from 'lucide-react'
import Badge from '@/components/ui/Badge'
import { addProduct } from '@/lib/api'

const STATUS_BADGE = {
  ok:       { variant: 'success', label: 'In Stock' },
  low:      { variant: 'warning', label: 'Low Stock' },
  critical: { variant: 'danger',  label: 'Critical Stock' },
}

function BarcodeResult({ scan }) {
  const [addForm, setAddForm]     = useState(false)
  const [adding, setAdding]       = useState(false)
  const [addSuccess, setAddSuccess] = useState(false)
  const [form, setForm] = useState({
    name: '',
    barcode: scan?.barcode || '',
    cost_price: '',
    sale_price: '',
    stock: '',
    critical_stock: '20',
    expiry_date: ''
  })

  if (!scan) return null

  const handleAdd = async (e) => {
    e.preventDefault()
    setAdding(true)
    try {
      await addProduct({
        ...form,
        cost_price: parseFloat(form.cost_price),
        sale_price: parseFloat(form.sale_price),
        stock: parseInt(form.stock),
        critical_stock: parseInt(form.critical_stock)
      })
      setAddSuccess(true)
    } catch (err) {
      console.error('Add failed:', err)
    } finally {
      setAdding(false)
    }
  }

  const badge = STATUS_BADGE[scan.stock_status] || STATUS_BADGE.ok

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className="bg-card border border-border rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-border">
        <span className="text-xs text-muted font-mono">{scan.barcode}</span>
      </div>

      <div className="p-4">
        {scan.found ? (
          <div className="flex items-start gap-3">
            <CheckCircle size={20} className="text-accent shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-text">{scan.product_name}</p>
              <p className="text-xs text-accent mt-0.5">Found in your inventory</p>
              <div className="grid grid-cols-3 gap-3 mt-3">
                <div>
                  <p className="text-[10px] text-muted">Stock</p>
                  <p className="text-sm font-medium text-text">{scan.stock}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Sale Price</p>
                  <p className="text-sm font-medium text-text">{scan.sale_price?.toFixed(2)}₺</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted">Expiry</p>
                  <p className="text-sm font-medium text-text">{scan.expiry_date || 'N/A'}</p>
                </div>
              </div>
              <div className="mt-2">
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-start gap-3 mb-4">
              <AlertCircle size={20} className="text-muted shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-text">Product not found in inventory</p>
                <p className="text-xs text-muted mt-0.5">{scan.barcode}</p>
              </div>
            </div>

            {!addForm && !addSuccess && (
              <button
                onClick={() => setAddForm(true)}
                className="w-full py-2 bg-surface border border-border rounded-lg text-sm text-muted hover:text-text hover:border-muted transition-colors flex items-center justify-center gap-2"
              >
                <Plus size={14} />
                Add Product
              </button>
            )}

            {addSuccess && (
              <div className="flex items-center gap-2 text-accent text-sm">
                <CheckCircle size={15} />
                Product added to inventory
              </div>
            )}

            {addForm && !addSuccess && (
              <form onSubmit={handleAdd} className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-[10px] text-muted block mb-1">Product Name</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    required
                    placeholder="Enter product name"
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Cost Price (₺)</label>
                  <input
                    type="number" step="0.01"
                    value={form.cost_price}
                    onChange={e => setForm(f => ({ ...f, cost_price: e.target.value }))}
                    required
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Sale Price (₺)</label>
                  <input
                    type="number" step="0.01"
                    value={form.sale_price}
                    onChange={e => setForm(f => ({ ...f, sale_price: e.target.value }))}
                    required
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Stock</label>
                  <input
                    type="number"
                    value={form.stock}
                    onChange={e => setForm(f => ({ ...f, stock: e.target.value }))}
                    required
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-muted block mb-1">Expiry Date</label>
                  <input
                    type="date"
                    value={form.expiry_date}
                    onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-xs text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div className="col-span-2 flex gap-2">
                  <button
                    type="submit" disabled={adding}
                    className="flex-1 py-2 bg-accent text-black text-xs font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-60"
                  >
                    {adding ? 'Adding...' : 'Add Product'}
                  </button>
                  <button
                    type="button" onClick={() => setAddForm(false)}
                    className="px-3 py-2 border border-border text-muted text-xs rounded-lg hover:text-text"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default BarcodeResult
