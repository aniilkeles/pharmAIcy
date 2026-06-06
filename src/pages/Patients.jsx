import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { getPatients, createPatient } from '@/lib/api'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'

const EMPTY_FORM = { first_name: '', last_name: '', tc_no: '', phone: '', birthdate: '', notes: '' }

function Patients() {
  const [patients, setPatients] = useState([])
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [createError, setCreateError] = useState('')
  const navigate = useNavigate()

  useEffect(() => { load() }, [])

  const load = async () => {
    try {
      const res = await getPatients()
      setPatients(res.data)
    } catch (e) {
      console.error(e)
    }
  }

  const handleCreate = async () => {
    console.log('[Patients] handleCreate called', form)
    if (!form.first_name.trim() || !form.last_name.trim()) return
    setSaving(true)
    setCreateError('')
    try {
      await createPatient(form)
      setModalOpen(false)
      setForm(EMPTY_FORM)
      load()
    } catch (e) {
      console.error('[Patients] createPatient failed:', e)
      setCreateError(e.response?.data?.detail || e.message || 'Failed to save patient')
    } finally {
      setSaving(false)
    }
  }

  const filtered = patients.filter(p =>
    `${p.first_name} ${p.last_name} ${p.tc_no || ''} ${p.phone || ''}`.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <motion.div
      key="patients"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text">Patients</h1>
          <p className="text-sm text-muted mt-0.5">Manage patient records</p>
        </div>
        <Button onClick={() => setModalOpen(true)}>
          <Plus size={14} /> New Patient
        </Button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, TC no, phone..."
          className="w-full bg-card border border-border rounded-lg pl-9 pr-4 py-2 text-sm text-text focus:outline-none focus:border-accent"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No patients yet" sub="Add a patient to get started" />
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Name</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">TC No</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Phone</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Last Visit</th>
                <th className="px-4 py-3 text-left text-xs text-muted font-medium">Prescriptions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <tr
                  key={p.id}
                  onClick={() => navigate(`/patients/${p.id}`)}
                  className="border-b border-border last:border-0 hover:bg-surface cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-text font-medium">{p.first_name} {p.last_name}</td>
                  <td className="px-4 py-3 text-muted font-mono text-xs">{p.tc_no || '—'}</td>
                  <td className="px-4 py-3 text-muted">{p.phone || '—'}</td>
                  <td className="px-4 py-3 text-muted text-xs">{p.last_visit || '—'}</td>
                  <td className="px-4 py-3 text-muted">{p.prescription_count ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setCreateError('') }} title="New Patient">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted block mb-1">First Name *</label>
              <input
                required value={form.first_name}
                onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">Last Name *</label>
              <input
                required value={form.last_name}
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
                maxLength={11}
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
          {createError && <p className="text-xs text-red-400">{createError}</p>}
          <div className="flex gap-2 justify-end mt-2">
            <button
              type="button" onClick={() => { setModalOpen(false); setCreateError('') }}
              className="px-4 py-2 border border-border text-muted text-sm rounded-lg hover:text-text transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={saving || !form.first_name.trim() || !form.last_name.trim()}
              className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:bg-opacity-90 disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>
    </motion.div>
  )
}

export default Patients
