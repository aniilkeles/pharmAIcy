import React, { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ScanBarcode, Keyboard, Search } from 'lucide-react'
import BarcodeScanner from '@/components/barcode/BarcodeScanner'
import BarcodeResult from '@/components/barcode/BarcodeResult'
import { useBarcode } from '@/hooks/useBarcode'

function Scanner() {
  const { isScanning, error, lastScan, initScanner, stopScanner, lookupManual } = useBarcode()
  const [usbInput, setUsbInput] = useState('')
  const usbRef = useRef(null)

  useEffect(() => {
    usbRef.current?.focus()
    return () => stopScanner()
  }, [])

  const handleUsbKey = async (e) => {
    if (e.key === 'Enter') {
      const barcode = usbInput.trim()
      if (barcode) {
        await lookupManual(barcode)
        setUsbInput('')
      }
    }
  }

  const handleManualSearch = async () => {
    const barcode = usbInput.trim()
    if (barcode) {
      await lookupManual(barcode)
      setUsbInput('')
    }
  }

  return (
    <motion.div
      key="scanner"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="flex flex-col gap-6"
    >
      <div>
        <h1 className="text-lg font-semibold text-text">Barcode Scanner</h1>
        <p className="text-sm text-muted mt-0.5">Scan with webcam or USB barcode scanner</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <BarcodeScanner
          isScanning={isScanning}
          onInit={initScanner}
          onStop={stopScanner}
          error={error}
        />

        <div className="flex flex-col gap-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Keyboard size={15} className="text-blue" />
              <span className="text-sm font-medium text-text">USB Scanner / Manual</span>
            </div>
            <p className="text-xs text-muted mb-3">
              USB scanners type barcode automatically. Or enter barcode manually:
            </p>
            <div className="flex gap-2">
              <input
                ref={usbRef}
                value={usbInput}
                onChange={e => setUsbInput(e.target.value)}
                onKeyDown={handleUsbKey}
                placeholder="Scan or type barcode..."
                className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors font-mono"
                autoFocus
              />
              <button
                onClick={handleManualSearch}
                className="px-3 py-2 bg-accent text-black rounded-lg hover:bg-opacity-90 transition-colors"
              >
                <Search size={15} />
              </button>
            </div>
            {lastScan && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted">Last scanned: <span className="text-text font-mono">{lastScan.barcode}</span></p>
              </div>
            )}
          </div>
        </div>
      </div>

      {lastScan && (
        <BarcodeResult scan={lastScan} key={lastScan.timestamp} />
      )}
    </motion.div>
  )
}

export default Scanner
