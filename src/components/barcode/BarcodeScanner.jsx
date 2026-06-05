import React, { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Camera, CameraOff } from 'lucide-react'

function BarcodeScanner({ isScanning, onInit, onStop, error }) {
  const videoRef = useRef(null)

  useEffect(() => {
    return () => { onStop() }
  }, [])

  const start = () => {
    if (videoRef.current) onInit(videoRef.current)
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Camera size={15} className="text-accent" />
          <span className="text-sm font-medium text-text">Webcam Scanner</span>
        </div>
        {isScanning && (
          <span className="flex items-center gap-1.5 text-xs text-accent">
            <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
            Scanning
          </span>
        )}
      </div>

      <div className="relative aspect-video bg-black flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          style={{ display: isScanning ? 'block' : 'none' }}
          autoPlay
          muted
          playsInline
        />

        {isScanning && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
            <div className="w-48 h-48 border-2 border-accent rounded-lg opacity-70">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-accent rounded-tl-lg -translate-x-0.5 -translate-y-0.5" />
              <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-accent rounded-tr-lg translate-x-0.5 -translate-y-0.5" />
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-accent rounded-bl-lg -translate-x-0.5 translate-y-0.5" />
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-accent rounded-br-lg translate-x-0.5 translate-y-0.5" />
            </div>
            <span className="text-xs text-white/70 bg-black/40 px-2 py-1 rounded">
              Point camera at barcode
            </span>
          </div>
        )}

        {!isScanning && (
          <div className="flex flex-col items-center gap-4">
            <CameraOff size={32} className="text-muted" />
            {error ? (
              <p className="text-danger text-sm text-center px-4">{error}</p>
            ) : (
              <button
                onClick={start}
                className="px-4 py-2 bg-accent text-black text-sm font-medium rounded-lg hover:bg-opacity-90 transition-colors"
              >
                Start Camera
              </button>
            )}
          </div>
        )}
      </div>

      {isScanning && (
        <div className="p-3 flex justify-center">
          <button
            onClick={onStop}
            className="px-4 py-2 text-sm border border-border text-muted rounded-lg hover:text-text hover:border-muted transition-colors"
          >
            Stop Camera
          </button>
        </div>
      )}
    </div>
  )
}

export default BarcodeScanner
