import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
import Layout from '@/components/layout/Layout'
import Auth from '@/pages/Auth'
import Dashboard from '@/pages/Dashboard'
import Stock from '@/pages/Stock'
import Expiry from '@/pages/Expiry'
import CrossSell from '@/pages/CrossSell'
import Predictions from '@/pages/Predictions'
import Scanner from '@/pages/Scanner'
import Notifications from '@/pages/Notifications'
import Settings from '@/pages/Settings'
import Patients from '@/pages/Patients'
import PatientDetail from '@/pages/PatientDetail'
import Prescriptions from '@/pages/Prescriptions'
import CreatePrescription from '@/pages/CreatePrescription'
import PrescriptionDetail from '@/pages/PrescriptionDetail'

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Starting PharmAIcy...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Auth />
  }

  return (
    <Layout>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/stock" element={<Stock />} />
          <Route path="/expiry" element={<Expiry />} />
          <Route path="/crosssell" element={<CrossSell />} />
          <Route path="/predictions" element={<Predictions />} />
          <Route path="/scanner" element={<Scanner />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientDetail />} />
          <Route path="/prescriptions" element={<Prescriptions />} />
          <Route path="/prescriptions/new" element={<CreatePrescription />} />
          <Route path="/prescriptions/:id" element={<PrescriptionDetail />} />
        </Routes>
      </AnimatePresence>
    </Layout>
  )
}

export default App
