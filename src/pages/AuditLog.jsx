import React, { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Search, Download, ChevronLeft, ChevronRight, History } from 'lucide-react'
import { getAuditLog } from '@/lib/api'

const ACTION_STYLES = {
  prescription_created:   'bg-blue-500/15 text-blue-400',
  prescription_dispensed: 'bg-green-500/15 text-green-400',
  prescription_cancelled: 'bg-red-500/15 text-red-400',
  repeat_prescription:    'bg-blue-500/15 text-blue-400',
  stock_deducted:         'bg-orange-500/15 text-orange-400',
  product_added:          'bg-teal-500/15 text-teal-400',
  product_updated:        'bg-yellow-500/15 text-yellow-400',
  sale_created:           'bg-green-500/15 text-green-400',
  csv_uploaded:           'bg-purple-500/15 text-purple-400',
  user_login:             'bg-gray-500/15 text-gray-400',
}

const ACTION_LABELS = {
  prescription_created:   'RX Created',
  prescription_dispensed: 'Dispensed',
  prescription_cancelled: 'Cancelled',
  repeat_prescription:    'RX Repeated',
  stock_deducted:         'Stock Deducted',
  product_added:          'Product Added',
  product_updated:        'Product Updated',
  sale_created:           'Sale Created',
  csv_uploaded:           'CSV Uploaded',
  user_login:             'User Login',
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS)

function relativeTime(iso) {
  if (!iso) return '—'
  const diff = Math.floor((Date.now() - new Date(iso)) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString()
}

function fullDatetime(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleString()
}

function parseDetails(action, detailsStr) {
  let d = {}
  try { d = JSON.parse(detailsStr || '{}') } catch {}

  switch (action) {
    case 'stock_deducted':
      if (d.product && d.from !== undefined)
        return `${d.product}: ${d.from} → ${d.to} (−${d.qty ?? d.from - d.to})`
      break
    case 'prescription_created':
      return [d.rx_number && `RX: ${d.rx_number}`, d.patient_id && `Patient #${d.patient_id}`].filter(Boolean).join(', ') || '—'
    case 'prescription_dispensed':
      return d.fulfillment_rate !== undefined ? `${d.fulfillment_rate}% fulfillment` : '—'
    case 'prescription_cancelled':
      return d.reason || '—'
    case 'repeat_prescription':
      return d.original_id ? `From #${d.original_id}` : '—'
    case 'csv_uploaded':
      return d.count ? `${d.count} products` : '—'
    case 'sale_created':
      return d.product ? `${d.product} ×${d.quantity ?? 1}` : '—'
    case 'product_added':
      return d.name || '—'
    case 'product_updated':
      return d.name || (d.product_id ? `Product #${d.product_id}` : '—')
    default:
      break
  }

  const entries = Object.entries(d).filter(([, v]) => v !== null && v !== undefined)
  if (!entries.length) return '—'
  return entries.slice(0, 3).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${v}`).join(' · ')
}

function exportCSV(rows) {
  const header = ['ID', 'Time', 'Action', 'Entity Type', 'Entity ID', 'Details']
  const lines = rows.map(r => [
    r.id,
    r.created_at ? new Date(r.created_at).toISOString() : '',
    r.action,
    r.entity_type || '',
    r.entity_id || '',
    (r.details || '').replace(/"/g, '""')
  ].map(v => `"${v}"`).join(','))
  const blob = new Blob([header.join(',') + '\n' + lines.join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

const PER_PAGE = 20

function AuditLog() {
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)

  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo, setFilterTo] = useState('')
  const [filterSearch, setFilterSearch] = useState('')

  const fetch = useCallback(async (pg = 1) => {
    setLoading(true)
    try {
      const res = await getAuditLog({
        action: filterAction, from_date: filterFrom, to_date: filterTo,
        search: filterSearch, page: pg, per_page: PER_PAGE
      })
      setItems(res.data.items || [])
      setTotal(res.data.total || 0)
      setPage(pg)
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filterAction, filterFrom, filterTo, filterSearch])

  useEffect(() => { fetch(1) }, [fetch])

  const handleExport = async () => {
    try {
      const res = await getAuditLog({
        action: filterAction, from_date: filterFrom, to_date: filterTo,
        search: filterSearch, page: 1, per_page: 10000
      })
      exportCSV(res.data.items || [])
    } catch {}
  }

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE))

  const inputCls = 'bg-surface border border-border rounded-lg px-3 py-1.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors'

  return (
    <motion.div
      key="audit-log"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-5"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Audit Log</h1>
          <p className="text-sm text-muted mt-0.5">Full history of all account actions</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border text-muted hover:text-text hover:border-muted transition-colors"
        >
          <Download size={13} />
          Export CSV
        </button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            placeholder="Search entity..."
            className={`${inputCls} pl-8 w-44`}
          />
        </div>

        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className={`${inputCls} pr-8`}
        >
          <option value="">All actions</option>
          {ALL_ACTIONS.map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]}</option>
          ))}
        </select>

        <input
          type="date" value={filterFrom}
          onChange={e => setFilterFrom(e.target.value)}
          className={inputCls}
          title="From date"
        />
        <span className="text-xs text-muted">to</span>
        <input
          type="date" value={filterTo}
          onChange={e => setFilterTo(e.target.value)}
          className={inputCls}
          title="To date"
        />

        {(filterAction || filterFrom || filterTo || filterSearch) && (
          <button
            onClick={() => { setFilterAction(''); setFilterFrom(''); setFilterTo(''); setFilterSearch('') }}
            className="text-xs text-muted hover:text-text transition-colors"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <History size={32} className="text-muted" />
            <p className="text-sm text-muted">No audit history yet</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs text-muted font-medium px-4 py-3 w-36">Time</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3 w-40">Action</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3 w-32">Entity</th>
                <th className="text-left text-xs text-muted font-medium px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((row, i) => (
                <motion.tr
                  key={row.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.1, delay: i * 0.02 }}
                  className="border-b border-border last:border-0 hover:bg-surface transition-colors"
                >
                  <td className="px-4 py-3">
                    <span
                      title={fullDatetime(row.created_at)}
                      className="text-xs text-muted cursor-default"
                    >
                      {relativeTime(row.created_at)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium ${ACTION_STYLES[row.action] ?? 'bg-surface text-muted'}`}>
                      {ACTION_LABELS[row.action] ?? row.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-muted">
                      {row.entity_type ? `${row.entity_type}${row.entity_id ? ` #${row.entity_id}` : ''}` : '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs text-text">{parseDetails(row.action, row.details)}</span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {total > PER_PAGE && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">
            {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, total)} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              disabled={page <= 1}
              onClick={() => fetch(page - 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text disabled:opacity-40 transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const p = totalPages <= 7 ? i + 1 : page <= 4 ? i + 1 : page >= totalPages - 3 ? totalPages - 6 + i : page - 3 + i
              return (
                <button
                  key={p}
                  onClick={() => fetch(p)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs transition-colors ${
                    p === page ? 'bg-accent text-black font-medium' : 'border border-border text-muted hover:text-text'
                  }`}
                >
                  {p}
                </button>
              )
            })}
            <button
              disabled={page >= totalPages}
              onClick={() => fetch(page + 1)}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-border text-muted hover:text-text disabled:opacity-40 transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default AuditLog
