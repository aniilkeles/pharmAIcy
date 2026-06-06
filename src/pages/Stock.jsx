import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, Search, ArrowUpDown, ArrowUp, ArrowDown,
  Pencil, Check, X, Trash2, Package
} from 'lucide-react'
import { getProducts, updateProduct, deleteProduct, addProduct } from '@/lib/api'

const STATUS_CFG = {
  ok:           { label: 'OK',           cls: 'bg-green-500/15 text-green-400' },
  low:          { label: 'Low',          cls: 'bg-warning/15 text-warning' },
  critical:     { label: 'Critical',     cls: 'bg-danger/15 text-danger' },
  out_of_stock: { label: 'Out of Stock', cls: 'bg-red-900/30 text-red-400' },
}

const FILTERS = ['all', 'low', 'critical', 'out_of_stock']
const FILTER_LABELS = { all: 'All', low: 'Low Stock', critical: 'Critical', out_of_stock: 'Out of Stock' }

const SORT_OPTIONS = [
  { value: 'name',        label: 'Name' },
  { value: 'stock',       label: 'Stock' },
  { value: 'sale_price',  label: 'Sale Price' },
  { value: 'expiry_date', label: 'Expiry Date' },
]

const INPUT_STYLE = {
  background: '#2a2a2a', border: '1px solid #3a3a3a', color: '#ededec',
  borderRadius: 6, padding: '4px 8px', fontSize: 13, width: 72, outline: 'none',
}

function Toast({ msg }) {
  if (!msg) return null
  const isErr = msg.startsWith('Error') || msg.startsWith('Failed')
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: isErr ? '#7f1d1d' : '#1a3a1a',
      border: `1px solid ${isErr ? '#ef4444' : '#4ade80'}`,
      color: '#ededec', borderRadius: 8, padding: '8px 16px', fontSize: 13,
    }}>
      {msg}
    </div>
  )
}

function ExpiryCell({ dateStr }) {
  if (!dateStr) return <span className="text-xs text-muted">—</span>
  const days = Math.ceil((new Date(dateStr) - Date.now()) / 86400000)
  const cls = days < 30 ? 'text-danger' : days < 90 ? 'text-warning' : 'text-muted'
  return <span className={`text-xs ${cls}`}>{dateStr}</span>
}

function StockBar({ stock, critical }) {
  const max = Math.max(critical * 2, stock, 1)
  const pct = Math.min(100, (stock / max) * 100)
  const color = stock === 0 ? '#991b1b' : stock * 2 <= critical ? '#ef4444' : stock <= critical ? '#f59e0b' : '#4ade80'
  return (
    <div style={{ height: 3, background: '#2a2a2a', borderRadius: 2, width: 60, display: 'inline-block', verticalAlign: 'middle', marginLeft: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 2 }} />
    </div>
  )
}

const EMPTY_ADD = { name: '', barcode: '', cost_price: '', sale_price: '', stock: '0', critical_stock: '20', expiry_date: '' }

function AddModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_ADD)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = async () => {
    if (!form.name.trim()) { setErr('Product name is required'); return }
    setSaving(true); setErr('')
    try {
      await addProduct({
        name: form.name.trim(),
        barcode: form.barcode.trim() || null,
        cost_price: Number(form.cost_price) || 0,
        sale_price: Number(form.sale_price) || 0,
        stock: Number(form.stock) || 0,
        critical_stock: Number(form.critical_stock) || 20,
        expiry_date: form.expiry_date || null,
      })
      onSaved()
      onClose()
    } catch (e) {
      setErr(e.response?.data?.detail || e.message || 'Failed to add product')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl p-6 w-[480px] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-text">Add Product</h2>
          <button onClick={onClose} className="text-muted hover:text-text"><X size={16} /></button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-muted block mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Parol 500mg" />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted block mb-1">Barcode</label>
            <input value={form.barcode} onChange={e => set('barcode', e.target.value)} className={inputCls} placeholder="8699..." />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Sale Price (₺)</label>
            <input type="number" min="0" step="0.01" value={form.sale_price} onChange={e => set('sale_price', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Cost Price (₺)</label>
            <input type="number" min="0" step="0.01" value={form.cost_price} onChange={e => set('cost_price', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Stock</label>
            <input type="number" min="0" value={form.stock} onChange={e => set('stock', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Critical Level</label>
            <input type="number" min="0" value={form.critical_stock} onChange={e => set('critical_stock', e.target.value)} className={inputCls} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-muted block mb-1">Expiry Date</label>
            <input type="date" value={form.expiry_date} onChange={e => set('expiry_date', e.target.value)} className={inputCls} />
          </div>
        </div>
        {err && <p className="text-xs text-danger">{err}</p>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
          <button
            onClick={handleSubmit} disabled={saving}
            className="px-4 py-2 text-sm bg-accent text-black font-medium rounded-lg disabled:opacity-50 hover:bg-opacity-90 transition-colors"
          >
            {saving ? 'Saving...' : 'Add Product'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function DeleteDialog({ product, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const handleDelete = async () => {
    setDeleting(true)
    try {
      await deleteProduct(product.product_id)
      onDeleted(product.product_id)
      onClose()
    } catch (e) {
      console.error('delete failed', e)
    } finally {
      setDeleting(false)
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
        className="bg-card border border-border rounded-xl p-6 w-[380px] flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-sm font-semibold text-text">Delete Product</h2>
        <p className="text-sm text-muted">Delete <span className="text-text font-medium">{product.name}</span>? This cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted border border-border rounded-lg hover:text-text transition-colors">Cancel</button>
          <button
            onClick={handleDelete} disabled={deleting}
            className="px-4 py-2 text-sm bg-danger text-white font-medium rounded-lg disabled:opacity-50 hover:bg-opacity-90 transition-colors"
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

const PER_PAGE = 50

function Stock() {
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [sortBy, setSortBy] = useState('name')
  const [sortOrder, setSortOrder] = useState('asc')
  const [page, setPage] = useState(1)

  const [result, setResult] = useState({ items: [], total: 0, page: 1, counts: { all: 0, low: 0, critical: 0, out_of_stock: 0 } })
  const [loading, setLoading] = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editValues, setEditValues] = useState({})
  const [saving, setSaving] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [toast, setToast] = useState('')

  const searchTimer = useRef(null)
  const handleSearchInput = (val) => {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => { setSearch(val); setPage(1) }, 300)
  }

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getProducts({ filter, search, sort_by: sortBy, sort_order: sortOrder, page, per_page: PER_PAGE })
      setResult(res.data)
    } catch {
      setResult(r => ({ ...r, items: [] }))
    } finally {
      setLoading(false)
    }
  }, [filter, search, sortBy, sortOrder, page])

  useEffect(() => { fetchData() }, [fetchData])

  const startEdit = (item) => {
    setEditingId(item.product_id)
    setEditValues({ stock: item.stock, critical_stock: item.critical_stock, sale_price: item.sale_price, cost_price: item.cost_price ?? '' })
  }

  const cancelEdit = () => { setEditingId(null); setEditValues({}) }

  const saveEdit = async (productId) => {
    setSaving(true)
    try {
      await updateProduct(productId, {
        stock: Number(editValues.stock),
        critical_stock: Number(editValues.critical_stock),
        sale_price: Number(editValues.sale_price),
        cost_price: editValues.cost_price !== '' ? Number(editValues.cost_price) : undefined,
      })
      setEditingId(null); setEditValues({})
      showToast('Saved')
      fetchData()
    } catch (e) {
      showToast('Error: ' + (e.response?.data?.detail || e.message))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleted = (id) => {
    setResult(r => ({ ...r, items: r.items.filter(i => i.product_id !== id), total: r.total - 1 }))
    showToast('Product deleted')
  }

  const totalPages = Math.max(1, Math.ceil(result.total / PER_PAGE))
  const { counts } = result

  const inputCls = 'bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors'

  return (
    <motion.div
      key="stock"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-4"
    >
      <Toast msg={toast} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Products</h1>
          <p className="text-sm text-muted mt-0.5">Manage your inventory</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-black text-sm font-medium rounded-lg hover:bg-opacity-90 transition-colors"
        >
          <Plus size={14} />
          Add Product
        </button>
      </div>

      {/* Search + Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchInput}
            onChange={e => handleSearchInput(e.target.value)}
            placeholder="Search by name or barcode..."
            className={`${inputCls} pl-9 w-full`}
          />
        </div>
        <select
          value={sortBy}
          onChange={e => { setSortBy(e.target.value); setPage(1) }}
          className={inputCls}
        >
          {SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          onClick={() => { setSortOrder(o => o === 'asc' ? 'desc' : 'asc'); setPage(1) }}
          className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text transition-colors"
          title={sortOrder === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sortOrder === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors -mb-px ${
              filter === f
                ? 'border-accent text-accent'
                : 'border-transparent text-muted hover:text-text'
            }`}
          >
            {FILTER_LABELS[f]}
            <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[10px] ${filter === f ? 'bg-accent/15' : 'bg-surface'}`}>
              {counts[f] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : result.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <Package size={32} className="text-muted" />
            <p className="text-sm text-muted">No products found</p>
            <p className="text-xs text-muted">Upload a CSV file or add products manually</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Product</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Barcode</th>
                <th className="text-right text-xs text-muted font-medium px-4 py-3">Sale ₺</th>
                <th className="text-right text-xs text-muted font-medium px-4 py-3">Cost ₺</th>
                <th className="text-right text-xs text-muted font-medium px-4 py-3">Stock</th>
                <th className="text-right text-xs text-muted font-medium px-4 py-3">Critical</th>
                <th className="text-center text-xs text-muted font-medium px-4 py-3">Expiry</th>
                <th className="text-center text-xs text-muted font-medium px-4 py-3">Status</th>
                <th className="text-center text-xs text-muted font-medium px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item, i) => {
                const isEditing = editingId === item.product_id
                const sc = STATUS_CFG[item.stock_status] ?? STATUS_CFG.ok
                return (
                  <motion.tr
                    key={item.product_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.1, delay: i * 0.015 }}
                    className="border-b border-border last:border-0 hover:bg-surface transition-colors"
                  >
                    <td className="px-4 py-2.5">
                      <span className="text-sm text-text">{item.name}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-xs text-muted font-mono">{item.barcode || '—'}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <input type="number" min="0" step="0.01" style={INPUT_STYLE}
                          value={editValues.sale_price}
                          onChange={e => setEditValues(v => ({ ...v, sale_price: e.target.value }))} />
                      ) : (
                        <span className="text-sm text-muted">{item.sale_price?.toFixed(2)}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <input type="number" min="0" step="0.01" style={INPUT_STYLE}
                          value={editValues.cost_price}
                          onChange={e => setEditValues(v => ({ ...v, cost_price: e.target.value }))} />
                      ) : (
                        <span className="text-sm text-muted">{item.cost_price != null ? item.cost_price.toFixed(2) : '—'}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <input type="number" min="0" style={INPUT_STYLE}
                          value={editValues.stock}
                          onChange={e => setEditValues(v => ({ ...v, stock: e.target.value }))} />
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <span className={`text-sm font-medium ${item.stock === 0 ? 'text-danger' : 'text-text'}`}>{item.stock}</span>
                          <StockBar stock={item.stock} critical={item.critical_stock} />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <input type="number" min="0" style={INPUT_STYLE}
                          value={editValues.critical_stock}
                          onChange={e => setEditValues(v => ({ ...v, critical_stock: e.target.value }))} />
                      ) : (
                        <span className="text-sm text-muted">{item.critical_stock}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <ExpiryCell dateStr={item.expiry_date} />
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${sc.cls}`}>
                        {sc.label}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => saveEdit(item.product_id)} disabled={saving} title="Save"
                            className="w-6 h-6 flex items-center justify-center rounded text-green-400 hover:bg-green-400/10 transition-colors disabled:opacity-50">
                            <Check size={13} />
                          </button>
                          <button onClick={cancelEdit} title="Cancel"
                            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-text transition-colors">
                            <X size={13} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => startEdit(item)} title="Edit"
                            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-text transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => setDeleteTarget(item)} title="Delete"
                            className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-danger transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </td>
                  </motion.tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {result.total > PER_PAGE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, result.total)} of {result.total} products
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1} onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 text-xs border border-border text-muted rounded-lg hover:text-text disabled:opacity-40 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-muted px-2">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 text-xs border border-border text-muted rounded-lg hover:text-text disabled:opacity-40 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modals */}
      <AnimatePresence>
        {showAdd && <AddModal onClose={() => setShowAdd(false)} onSaved={fetchData} />}
        {deleteTarget && (
          <DeleteDialog
            product={deleteTarget}
            onClose={() => setDeleteTarget(null)}
            onDeleted={handleDeleted}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export default Stock
