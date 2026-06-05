import React, { useState } from 'react'
import { Upload, CheckCircle, AlertCircle } from 'lucide-react'
import * as XLSX from 'xlsx'
import Modal from '@/components/ui/Modal'
import { useStore } from '@/store/useStore'
import { uploadData, checkNotifications } from '@/lib/api'

const ACCEPTED = ['.csv', '.xls', '.xlsx']

// Encode arbitrary bytes to base64
function bufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

// XLS/XLSX → CSV string → UTF-8 bytes → base64
function xlsxBytesToBase64(arrayBuffer) {
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' })
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const csv = XLSX.utils.sheet_to_csv(sheet)
  const utf8 = new TextEncoder().encode(csv)
  return bufferToBase64(utf8.buffer)
}

function UploadModal() {
  const { uploadModalOpen, setUploadModalOpen, setHasData } = useStore()
  const [state, setState] = useState('idle') // idle | uploading | success | error
  const [message, setMessage] = useState('')
  const [dragging, setDragging] = useState(false)

  const submit = async (base64Bytes) => {
    setState('uploading')
    setMessage('')
    try {
      const res = await uploadData(base64Bytes)
      await checkNotifications()
      setState('success')
      setMessage(res.data.message)
      setHasData(true)
      setTimeout(() => { setUploadModalOpen(false); setState('idle') }, 2000)
    } catch (e) {
      setState('error')
      setMessage(e.response?.data?.detail || 'Upload failed. Check your file format.')
    }
  }

  const handleFile = (file) => {
    if (!file) return
    const ext = '.' + file.name.split('.').pop().toLowerCase()
    if (!ACCEPTED.includes(ext)) {
      setState('error')
      setMessage('Please select a CSV, XLS, or XLSX file')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      if (ext === '.csv') {
        submit(bufferToBase64(e.target.result))
      } else {
        submit(xlsxBytesToBase64(e.target.result))
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const handleBrowse = async () => {
    const result = await window.api.openFileDialog()
    if (!result) return
    // IPC always returns base64 now
    if (result.ext === '.csv') {
      submit(result.content)
    } else {
      // Decode base64 → ArrayBuffer → SheetJS → CSV bytes → base64
      const binary = atob(result.content)
      const bytes = new Uint8Array(binary.length)
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
      submit(xlsxBytesToBase64(bytes.buffer))
    }
  }

  return (
    <Modal open={uploadModalOpen} onClose={() => { setUploadModalOpen(false); setState('idle') }} title="Upload Pharmacy Data">
      {state === 'idle' && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={handleBrowse}
          className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors
            ${dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-muted'}`}
        >
          <Upload size={32} className="text-muted" />
          <div className="text-center">
            <p className="text-text font-medium">Drop file here or click to browse</p>
            <p className="text-muted text-xs mt-1">CSV, XLS, or XLSX — columns: name, cost_price, sale_price, stock, barcode, critical_stock, expiry_date</p>
          </div>
        </div>
      )}

      {state === 'uploading' && (
        <div className="flex flex-col items-center gap-4 py-8">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Uploading and analyzing data...</p>
        </div>
      )}

      {state === 'success' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <CheckCircle size={40} className="text-accent" />
          <p className="text-text font-medium">{message}</p>
          <p className="text-muted text-sm">Redirecting to dashboard...</p>
        </div>
      )}

      {state === 'error' && (
        <div className="flex flex-col items-center gap-3 py-6">
          <AlertCircle size={40} className="text-danger" />
          <p className="text-text font-medium">Upload Failed</p>
          <p className="text-muted text-sm text-center">{message}</p>
          <button onClick={() => setState('idle')} className="px-4 py-2 bg-card border border-border rounded-lg text-sm text-muted hover:text-text transition-colors">
            Try Again
          </button>
        </div>
      )}
    </Modal>
  )
}

export default UploadModal
