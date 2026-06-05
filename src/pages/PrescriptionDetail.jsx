import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, RefreshCw, XCircle, CheckCircle } from 'lucide-react'
import {
  getPrescription, confirmPrescription, cancelPrescription, repeatPrescription
} from '@/lib/api'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

const STATUS_BADGE = {
  pending: 'warning',
  dispensed: 'success',
  partial: 'info',
  cancelled: 'muted'
}

const ITEM_STATUS_BADGE = {
  pending: 'warning',
  dispensed: 'success',
  partial: 'info',
  out_of_stock: 'danger'
}

const SEVERITY_COLOR = {
  severe: 'text-danger',
  moderate: 'text-warning',
  mild: 'text-blue'
}

function PrescriptionDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [rx, setRx] = useState(null)
  const [acting, setActing] = useState(false)

  useEffect(() => { load() }, [id])

  const load = async () => {
    try {
      const res = await getPrescription(id)
      setRx(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleConfirm = async () => {
    setActing(true)
    try {
      await confirmPrescription(id)
      load()
    } catch (e) {
      console.error(e)
    } finally {
      setActing(false)
    }
  }

  const handleCancel = async () => {
    if (!confirm('Cancel this prescription?')) return
    setActing(true)
    try {
      await cancelPrescription(id)
      load()
    } catch (e) {
      console.error(e)
    } finally {
      setActing(false)
    }
  }

  const handleRepeat = async () => {
    setActing(true)
    try {
      const res = await repeatPrescription(id)
      navigate(`/prescriptions/${res.data.id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setActing(false)
    }
  }

  if (!rx) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const canConfirm = rx.status === 'pending'
  const canCancel = rx.status === 'pending'

  return (
    <motion.div
      key="rx-detail"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/prescriptions')} className="text-muted hover:text-text transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-text font-mono">{rx.rx_number}</h1>
            <Badge variant={STATUS_BADGE[rx.status] || 'muted'}>{rx.status}</Badge>
          </div>
          <p className="text-xs text-muted">{rx.created_at?.slice(0, 10)}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" disabled={acting} onClick={handleRepeat}>
            <RefreshCw size={13} /> Repeat
          </Button>
          {canCancel && (
            <Button variant="danger" size="sm" disabled={acting} onClick={handleCancel}>
              <XCircle size={13} /> Cancel
            </Button>
          )}
          {canConfirm && (
            <Button size="sm" disabled={acting} onClick={handleConfirm}>
              <CheckCircle size={13} /> {acting ? 'Processing...' : 'Confirm & Dispense'}
            </Button>
          )}
        </div>
      </div>

      {/* Warnings */}
      {rx.interactions?.length > 0 && (
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-danger text-sm font-medium">
            <AlertTriangle size={15} />
            Drug Interaction Warning ({rx.interactions.length})
          </div>
          {rx.interactions.map((inter, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`font-medium ${SEVERITY_COLOR[inter.severity] || 'text-warning'} shrink-0`}>
                [{inter.severity?.toUpperCase()}]
              </span>
              <span className="text-muted">
                {inter.drug_a} + {inter.drug_b}
                {inter.description && ` — ${inter.description}`}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 flex flex-col gap-4">
          {/* Patient & Doctor */}
          <div className="grid grid-cols-2 gap-4">
            {rx.patient && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted mb-1">Patient</p>
                <button
                  onClick={() => navigate(`/patients/${rx.patient.id}`)}
                  className="text-sm font-medium text-text hover:text-accent transition-colors"
                >
                  {rx.patient.name}
                </button>
                {rx.patient.tc_no && <p className="text-xs text-muted font-mono mt-0.5">{rx.patient.tc_no}</p>}
              </div>
            )}
            {rx.doctor && (
              <div className="bg-card border border-border rounded-xl p-4">
                <p className="text-xs text-muted mb-1">Doctor</p>
                <p className="text-sm font-medium text-text">{rx.doctor.name}</p>
                {rx.doctor.specialty && <p className="text-xs text-muted mt-0.5">{rx.doctor.specialty}</p>}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <h2 className="text-sm font-medium text-text">Medications</h2>
              <p className="text-sm font-semibold text-text">{rx.total_price?.toFixed(2)}₺</p>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs text-muted font-medium">Product</th>
                  <th className="px-4 py-2 text-left text-xs text-muted font-medium">Dosage</th>
                  <th className="px-4 py-2 text-left text-xs text-muted font-medium">Qty Req.</th>
                  <th className="px-4 py-2 text-left text-xs text-muted font-medium">Qty Disp.</th>
                  <th className="px-4 py-2 text-left text-xs text-muted font-medium">Stock</th>
                  <th className="px-4 py-2 text-left text-xs text-muted font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rx.items?.map(item => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3 text-text font-medium">{item.product_name}</td>
                    <td className="px-4 py-3 text-muted text-xs">
                      {[item.dosage, item.duration].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-muted">{item.quantity_requested}</td>
                    <td className="px-4 py-3 text-muted">{item.quantity_dispensed}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${
                        item.stock_available === 0 ? 'text-danger'
                        : item.stock_available <= 10 ? 'text-warning'
                        : 'text-accent'
                      }`}>
                        {item.stock_available}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={ITEM_STATUS_BADGE[item.status] || 'muted'}>{item.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rx.notes && (
            <div className="bg-card border border-border rounded-xl p-4">
              <p className="text-xs text-muted mb-1">Notes</p>
              <p className="text-sm text-text">{rx.notes}</p>
            </div>
          )}
        </div>

        {/* Cross-sell */}
        {rx.cross_sell?.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="text-sm font-medium text-text mb-3">Complementary Products</h2>
            <div className="flex flex-col gap-2">
              {rx.cross_sell.map((s, i) => (
                <div key={i} className="p-2 bg-surface rounded-lg">
                  <p className="text-xs text-text font-medium">{s.product}</p>
                  <p className="text-[10px] text-muted mt-0.5">{s.reason}</p>
                  <p className="text-[10px] text-accent mt-0.5">{(s.confidence * 100).toFixed(0)}% confidence</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  )
}

export default PrescriptionDetail
