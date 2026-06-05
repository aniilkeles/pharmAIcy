import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Search } from 'lucide-react'
import {
  getPatients, createPatient, getDoctors, createDoctor,
  searchProducts, createPrescription
} from '@/lib/api'
import Button from '@/components/ui/Button'

const STEPS = ['Patient', 'Doctor', 'Medications', 'Review']

function CreatePrescription() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)

  const [patients, setPatients] = useState([])
  const [patientSearch, setPatientSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [showNewPatient, setShowNewPatient] = useState(false)
  const [newPatient, setNewPatient] = useState({ first_name: '', last_name: '', tc_no: '', phone: '' })

  const [doctors, setDoctors] = useState([])
  const [doctorSearch, setDoctorSearch] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState(null)
  const [showNewDoctor, setShowNewDoctor] = useState(false)
  const [newDoctor, setNewDoctor] = useState({ first_name: '', last_name: '', specialty: '', hospital: '' })

  const [productSearch, setProductSearch] = useState('')
  const [productResults, setProductResults] = useState([])
  const [items, setItems] = useState([])

  const [notes, setNotes] = useState('')

  useEffect(() => {
    loadPatients()
    loadDoctors()
    const pid = searchParams.get('patient_id')
    if (pid) preselectPatient(pid)
  }, [])

  const preselectPatient = async (pid) => {
    try {
      const res = await getPatients()
      const found = res.data.find(p => String(p.id) === pid)
      if (found) setSelectedPatient(found)
    } catch (e) {}
  }

  const loadPatients = async () => {
    try {
      const res = await getPatients()
      setPatients(res.data)
    } catch (e) {}
  }

  const loadDoctors = async () => {
    try {
      const res = await getDoctors()
      setDoctors(res.data)
    } catch (e) {}
  }

  const handleProductSearch = async (q) => {
    setProductSearch(q)
    if (!q) { setProductResults([]); return }
    try {
      const res = await searchProducts(q)
      setProductResults(res.data)
    } catch (e) {}
  }

  const addItem = (product) => {
    if (items.find(i => i.product_id === product.product_id)) return
    setItems(prev => [...prev, {
      product_id: product.product_id,
      name: product.name,
      sale_price: product.sale_price,
      stock: product.stock,
      quantity_requested: 1,
      dosage: '',
      duration: '',
      instructions: ''
    }])
    setProductSearch('')
    setProductResults([])
  }

  const removeItem = (product_id) => {
    setItems(prev => prev.filter(i => i.product_id !== product_id))
  }

  const updateItem = (product_id, field, value) => {
    setItems(prev => prev.map(i => i.product_id === product_id ? { ...i, [field]: value } : i))
  }

  const handleAddNewPatient = async (e) => {
    e.preventDefault()
    try {
      const res = await createPatient(newPatient)
      setSelectedPatient({ ...newPatient, id: res.data.id })
      setShowNewPatient(false)
      setNewPatient({ first_name: '', last_name: '', tc_no: '', phone: '' })
    } catch (e) {}
  }

  const handleAddNewDoctor = async (e) => {
    e.preventDefault()
    try {
      const res = await createDoctor(newDoctor)
      setSelectedDoctor({ ...newDoctor, id: res.data.id })
      setShowNewDoctor(false)
      setNewDoctor({ first_name: '', last_name: '', specialty: '', hospital: '' })
    } catch (e) {}
  }

  const handleSubmit = async (confirm = false) => {
    setSaving(true)
    try {
      const payload = {
        patient_id: selectedPatient.id,
        doctor_id: selectedDoctor?.id || null,
        notes,
        confirm_immediately: confirm,
        items: items.map(i => ({
          product_id: i.product_id,
          quantity_requested: parseInt(i.quantity_requested),
          dosage: i.dosage || null,
          duration: i.duration || null,
          instructions: i.instructions || null
        }))
      }
      const res = await createPrescription(payload)
      navigate(`/prescriptions/${res.data.id}`)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  const filteredPatients = patients.filter(p =>
    `${p.first_name} ${p.last_name} ${p.tc_no || ''}`.toLowerCase().includes(patientSearch.toLowerCase())
  )

  const filteredDoctors = doctors.filter(d =>
    `${d.first_name} ${d.last_name} ${d.specialty || ''}`.toLowerCase().includes(doctorSearch.toLowerCase())
  )

  const totalPrice = items.reduce((sum, i) => sum + (i.sale_price * i.quantity_requested), 0)

  const inputCls = "w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent"

  return (
    <motion.div
      key="create-rx"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="flex flex-col gap-6 max-w-3xl"
    >
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/prescriptions')} className="text-muted hover:text-text transition-colors">
          <ArrowLeft size={18} />
        </button>
        <h1 className="text-lg font-semibold text-text">New Prescription</h1>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => (
          <React.Fragment key={label}>
            <div className={`flex items-center gap-1.5 ${i <= step ? 'text-accent' : 'text-muted'}`}>
              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
                i < step ? 'bg-accent text-black' : i === step ? 'border-2 border-accent text-accent' : 'border border-border text-muted'
              }`}>
                {i < step ? '✓' : i + 1}
              </div>
              <span className="text-xs">{label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-accent' : 'bg-border'}`} />}
          </React.Fragment>
        ))}
      </div>

      {/* Step 0: Patient */}
      {step === 0 && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-text">Select Patient</h2>
          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <div>
                <p className="text-sm font-medium text-text">{selectedPatient.first_name} {selectedPatient.last_name}</p>
                {selectedPatient.tc_no && <p className="text-xs text-muted font-mono">{selectedPatient.tc_no}</p>}
              </div>
              <button onClick={() => setSelectedPatient(null)} className="text-muted hover:text-text text-xs">Change</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  placeholder="Search patient..."
                  className={`${inputCls} pl-9`}
                />
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {filteredPatients.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedPatient(p)}
                    className="text-left px-3 py-2 rounded-lg hover:bg-surface transition-colors"
                  >
                    <p className="text-sm text-text">{p.first_name} {p.last_name}</p>
                    {p.tc_no && <p className="text-xs text-muted font-mono">{p.tc_no}</p>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowNewPatient(v => !v)}
                className="text-xs text-accent hover:underline text-left"
              >
                + Add new patient
              </button>
              {showNewPatient && (
                <form onSubmit={handleAddNewPatient} className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <label className="text-xs text-muted block mb-1">First Name *</label>
                    <input required value={newPatient.first_name} onChange={e => setNewPatient(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Last Name *</label>
                    <input required value={newPatient.last_name} onChange={e => setNewPatient(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">TC No</label>
                    <input value={newPatient.tc_no} onChange={e => setNewPatient(f => ({ ...f, tc_no: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Phone</label>
                    <input value={newPatient.phone} onChange={e => setNewPatient(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button type="submit" className="px-4 py-2 bg-accent text-black text-xs font-medium rounded-lg">Save & Select</button>
                  </div>
                </form>
              )}
            </>
          )}
          <div className="flex justify-end">
            <Button disabled={!selectedPatient} onClick={() => setStep(1)}>Next</Button>
          </div>
        </div>
      )}

      {/* Step 1: Doctor */}
      {step === 1 && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-text">Select Doctor <span className="text-muted font-normal">(optional)</span></h2>
          {selectedDoctor ? (
            <div className="flex items-center justify-between p-3 bg-accent/10 border border-accent/20 rounded-lg">
              <div>
                <p className="text-sm font-medium text-text">{selectedDoctor.first_name} {selectedDoctor.last_name}</p>
                {selectedDoctor.specialty && <p className="text-xs text-muted">{selectedDoctor.specialty}</p>}
              </div>
              <button onClick={() => setSelectedDoctor(null)} className="text-muted hover:text-text text-xs">Change</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  value={doctorSearch}
                  onChange={e => setDoctorSearch(e.target.value)}
                  placeholder="Search doctor..."
                  className={`${inputCls} pl-9`}
                />
              </div>
              <div className="max-h-48 overflow-y-auto flex flex-col gap-1">
                {filteredDoctors.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDoctor(d)}
                    className="text-left px-3 py-2 rounded-lg hover:bg-surface transition-colors"
                  >
                    <p className="text-sm text-text">{d.first_name} {d.last_name}</p>
                    {d.specialty && <p className="text-xs text-muted">{d.specialty} · {d.hospital}</p>}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowNewDoctor(v => !v)}
                className="text-xs text-accent hover:underline text-left"
              >
                + Add new doctor
              </button>
              {showNewDoctor && (
                <form onSubmit={handleAddNewDoctor} className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <label className="text-xs text-muted block mb-1">First Name *</label>
                    <input required value={newDoctor.first_name} onChange={e => setNewDoctor(f => ({ ...f, first_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Last Name *</label>
                    <input required value={newDoctor.last_name} onChange={e => setNewDoctor(f => ({ ...f, last_name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Specialty</label>
                    <input value={newDoctor.specialty} onChange={e => setNewDoctor(f => ({ ...f, specialty: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="text-xs text-muted block mb-1">Hospital</label>
                    <input value={newDoctor.hospital} onChange={e => setNewDoctor(f => ({ ...f, hospital: e.target.value }))} className={inputCls} />
                  </div>
                  <div className="col-span-2 flex justify-end">
                    <button type="submit" className="px-4 py-2 bg-accent text-black text-xs font-medium rounded-lg">Save & Select</button>
                  </div>
                </form>
              )}
            </>
          )}
          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(0)}>Back</Button>
            <Button onClick={() => setStep(2)}>Next</Button>
          </div>
        </div>
      )}

      {/* Step 2: Medications */}
      {step === 2 && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-4">
          <h2 className="text-sm font-medium text-text">Add Medications</h2>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={productSearch}
              onChange={e => handleProductSearch(e.target.value)}
              placeholder="Search medication..."
              className={`${inputCls} pl-9`}
            />
            {productResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-10 max-h-48 overflow-y-auto">
                {productResults.map(p => (
                  <button
                    key={p.product_id}
                    onClick={() => addItem(p)}
                    className="w-full text-left px-3 py-2 hover:bg-card transition-colors"
                  >
                    <p className="text-sm text-text">{p.name}</p>
                    <p className="text-xs text-muted">Stock: {p.stock} · {p.sale_price?.toFixed(2)}₺</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {items.length > 0 && (
            <div className="flex flex-col gap-3">
              {items.map(item => (
                <div key={item.product_id} className="bg-surface rounded-lg p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-text">{item.name}</p>
                    <button onClick={() => removeItem(item.product_id)} className="text-muted hover:text-danger transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Qty</label>
                      <input
                        type="number" min={1} value={item.quantity_requested}
                        onChange={e => updateItem(item.product_id, 'quantity_requested', e.target.value)}
                        className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Dosage</label>
                      <input
                        value={item.dosage}
                        onChange={e => updateItem(item.product_id, 'dosage', e.target.value)}
                        placeholder="e.g. 1x1"
                        className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Duration</label>
                      <input
                        value={item.duration}
                        onChange={e => updateItem(item.product_id, 'duration', e.target.value)}
                        placeholder="e.g. 7 days"
                        className="w-full bg-card border border-border rounded px-2 py-1 text-xs text-text focus:outline-none focus:border-accent"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">Stock</label>
                      <p className={`text-xs mt-1 font-medium ${item.stock === 0 ? 'text-danger' : item.stock <= 10 ? 'text-warning' : 'text-accent'}`}>
                        {item.stock} units
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {items.length === 0 && (
            <p className="text-sm text-muted text-center py-4">Search and add medications above</p>
          )}

          <div>
            <label className="text-xs text-muted block mb-1">Notes</label>
            <textarea
              rows={2} value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text focus:outline-none focus:border-accent resize-none"
            />
          </div>

          <div className="flex justify-between">
            <Button variant="secondary" onClick={() => setStep(1)}>Back</Button>
            <Button disabled={items.length === 0} onClick={() => setStep(3)}>Review</Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="bg-card border border-border rounded-xl p-5 flex flex-col gap-5">
          <h2 className="text-sm font-medium text-text">Review & Confirm</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted">Patient</p>
              <p className="text-sm text-text font-medium mt-0.5">{selectedPatient?.first_name} {selectedPatient?.last_name}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Doctor</p>
              <p className="text-sm text-text mt-0.5">{selectedDoctor ? `${selectedDoctor.first_name} ${selectedDoctor.last_name}` : '—'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs text-muted mb-2">Medications ({items.length})</p>
            <div className="flex flex-col gap-2">
              {items.map(item => (
                <div key={item.product_id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm text-text">{item.name}</p>
                    <p className="text-xs text-muted">{item.dosage && `Dosage: ${item.dosage}`}{item.duration && ` · ${item.duration}`}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-text">×{item.quantity_requested}</p>
                    <p className="text-xs text-muted">{(item.sale_price * item.quantity_requested).toFixed(2)}₺</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between pt-2 mt-2 border-t border-border">
              <p className="text-sm text-muted">Total</p>
              <p className="text-sm font-semibold text-text">{totalPrice.toFixed(2)}₺</p>
            </div>
          </div>

          <div className="flex justify-between gap-3">
            <Button variant="secondary" onClick={() => setStep(2)}>Back</Button>
            <div className="flex gap-2">
              <Button variant="secondary" disabled={saving} onClick={() => handleSubmit(false)}>
                Save as Pending
              </Button>
              <Button disabled={saving} onClick={() => handleSubmit(true)}>
                {saving ? 'Processing...' : 'Confirm & Dispense'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  )
}

export default CreatePrescription
