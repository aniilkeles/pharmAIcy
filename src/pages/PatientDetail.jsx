import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, ClipboardList } from 'lucide-react'
import { getPatient, updatePatient } from '@/lib/api'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

const STATUS_BADGE = {
  pending: 'warning',
  dispensed: 'success',
  partial: 'info',
  cancelled: 'muted'
}

function PatientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [patient, setPatient] = useState(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [id])

  const load = async () => {
    try {
      const res = await getPatient(id)
      setPatient(res.data)
      setForm({
        first_name: res.data.first_name,
        last_name: res.data.last_name,
        tc_no: res.data.tc_no || '',
        phone: res.data.phone || '',
        birthdate: res.data.birthdate || '',
        notes: res.data.notes || ''
      })
    } catch (e) {
      console.error(e)
    }
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await updatePatient(id, form)
      setEditing(false)
      load()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <motion.div
      key="patient-detail"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-6"
    >
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/patients')} className="text-muted hover:text-text transition-colors">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold text-text">{patient.first_name} {patient.last_name}</h1>
          {patient.tc_no && <p className="text-xs text-muted font-mono">{patient.tc_no}</p>}
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          )}
          <Button size="sm" onClick={() => navigate(`/prescriptions/new?patient_id=${id}`)}>
            <Plus size={13} /> New Prescription
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="text-sm font-medium text-text mb-4">Patient Info</h2>
          {editing ? (
            <form onSubmit={handleSave} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">First Name</label>
                  <input
                    value={form.first_name}
                    onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Last Name</label>
                  <input
                    value={form.last_name}
                    onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted block mb-1">TC No</label>
                  <input
                    value={form.tc_no}
                    onChange={e => setForm(f => ({ ...f, tc_no: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted block mb-1">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Birth Date</label>
                <input
                  type="date" value={form.birthdate}
                  onChange={e => setForm(f => ({ ...f, birthdate: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
                />
              </div>
              <div>
                <label className="text-xs text-muted block mb-1">Notes</label>
                <textarea
                  rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent resize-none"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  type="button" onClick={() => setEditing(false)}
                  className="px-3 py-1.5 border border-border text-muted text-xs rounded-lg hover:text-text transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit" disabled={saving}
                  className="px-3 py-1.5 bg-accent text-black text-xs font-medium rounded-lg disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          ) : (
            <div className="flex flex-col gap-3">
              {[
                ['Phone', patient.phone],
                ['Birth Date', patient.birthdate],
                ['TC No', patient.tc_no],
                ['Notes', patient.notes],
              ].map(([label, value]) => value ? (
                <div key={label}>
                  <p className="text-xs text-muted">{label}</p>
                  <p className="text-sm text-text mt-0.5">{value}</p>
                </div>
              ) : null)}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-text">Prescription History</h2>
            <span className="text-xs text-muted">{patient.prescriptions?.length ?? 0} total</span>
          </div>
          {patient.prescriptions?.length === 0 ? (
            <p className="text-sm text-muted">No prescriptions yet</p>
          ) : (
            <div className="flex flex-col gap-2">
              {patient.prescriptions?.map(rx => (
                <button
                  key={rx.id}
                  onClick={() => navigate(`/prescriptions/${rx.id}`)}
                  className="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-border transition-colors text-left"
                >
                  <div className="flex items-center gap-2">
                    <ClipboardList size={14} className="text-muted" />
                    <div>
                      <p className="text-xs font-mono text-text">{rx.rx_number}</p>
                      <p className="text-[10px] text-muted">{rx.created_at?.slice(0, 10)} · {rx.item_count} items</p>
                    </div>
                  </div>
                  <Badge variant={STATUS_BADGE[rx.status] || 'muted'}>{rx.status}</Badge>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default PatientDetail
