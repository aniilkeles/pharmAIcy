import { useState, useCallback, useRef } from 'react'
import { lookupBarcode } from '@/lib/api'
import { useStore } from '@/store/useStore'

export function useBarcode() {
  const [isScanning, setIsScanning] = useState(false)
  const [error, setError] = useState(null)
  const { lastScan, setLastScan } = useStore()
  const controlsRef = useRef(null)
  const setLastScanRef = useRef(setLastScan)
  setLastScanRef.current = setLastScan

  const handleBarcode = useCallback(async (barcode) => {
    if (!barcode) return
    try {
      const res = await lookupBarcode(barcode)
      setLastScanRef.current({ barcode, ...res.data, timestamp: Date.now() })
    } catch (e) {
      setLastScanRef.current({ barcode, found: false, message: 'Lookup failed', error: true, timestamp: Date.now() })
    }
  }, [])

  const initScanner = useCallback(async (videoElement) => {
    setError(null)
    try {
      // Explicitly request camera permission first so Electron's handler fires
      const stream = await navigator.mediaDevices.getUserMedia({ video: true })
      stream.getTracks().forEach(t => t.stop())

      const { BrowserMultiFormatReader } = await import('@zxing/browser')
      const reader = new BrowserMultiFormatReader()
      setIsScanning(true)
      const controls = await reader.decodeFromVideoDevice(
        null,
        videoElement,
        (result) => { if (result) handleBarcode(result.getText()) }
      )
      controlsRef.current = controls
    } catch (e) {
      if (e.name === 'NotAllowedError') {
        setError('Camera permission denied. Please allow camera access and try again.')
      } else {
        setError('Could not access camera. Please check permissions.')
      }
      setIsScanning(false)
    }
  }, [handleBarcode])

  const stopScanner = useCallback(() => {
    if (controlsRef.current) {
      try { controlsRef.current.stop() } catch (e) {}
      controlsRef.current = null
    }
    setIsScanning(false)
  }, [])

  const lookupManual = useCallback(async (barcode) => {
    await handleBarcode(barcode)
  }, [handleBarcode])

  return { isScanning, error, lastScan, initScanner, stopScanner, lookupManual }
}
