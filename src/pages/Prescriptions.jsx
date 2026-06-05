import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { getPrescriptions } from '@/lib/api'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

const TABS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'dispensed', label: 'Dispensed' },
  { value: 'partial', label: 'Partial' },
  { value: 'cancelled', label: 'Cancelled' },
]

const STATUS_BADGE = {
  pending: 'warning',
  dispensed: 'success',
  partial: 'info',
  cancelled: 'muted'
}

function Prescriptions() {
  const [prescriptions, setPrescriptions] = useState([])
  const [tab, setTab] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => { load() }, [tab])

  const load = async () => {
    setLoading(true)
    try {
      const res = await getPrescriptions(tab)
      setPrescriptions(res.data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      key="prescriptions"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Prescriptions</h1>
          <p className="text-sm text-muted mt-0.5">Prescription management and dispensing</p>
        </div>
        <Button onClick={() => navigate('/prescriptions/new')}>
          <Plus size={14} /> New Prescription
        </Button>
      </div>

      <div className="flex gap-1">
        {TABS.map(t => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
              tab === t.value
                ? 'bg-accent text-black font-medium'
                : 'text-muted hover:text-text hover:bg-card'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      ) : prescriptions.length === 0 ? (
        <EmptyState message="No prescriptions" sub="Create a new prescription to get started" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">RX Number</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Patient</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Doctor</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Items</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Total</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Date</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {prescriptions.map(rx => (
                <tr
                  key={rx.id}
                  onClick={() => navigate(`/prescriptions/${rx.id}`)}
                  className="border-b border-border last:border-0 hover:bg-surface cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs text-accent">{rx.rx_number}</td>
                  <td className="px-4 py-3 text-text font-medium">{rx.patient_name}</td>
                  <td className="px-4 py-3 text-muted text-xs">{rx.doctor_name || '—'}</td>
                  <td className="px-4 py-3 text-muted">{rx.item_count}</td>
                  <td className="px-4 py-3 text-text">{rx.total_price?.toFixed(2)}₺</td>
                  <td className="px-4 py-3 text-muted text-xs">{rx.created_at?.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <Badge variant={STATUS_BADGE[rx.status] || 'muted'}>{rx.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  )
}

export default Prescriptions
