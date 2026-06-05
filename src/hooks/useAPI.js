import { useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import {
  getDashboardSummary, analyzeSales, predictSales,
  getLowStock, getExpiryProducts, getCrossSell,
  getDecisions, getAgentStatus
} from '@/lib/api'

export function useAPI() {
  const {
    setDashboardData, setStockData, setExpiryData,
    setCrossSellData, setPredictionsData, setDecisionsData,
    setAgentStatus, setHasData
  } = useStore()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await getDashboardSummary()
      setDashboardData(res.data)
      setHasData(res.data.has_data)
      return res.data
    } catch (e) {
      console.error('Dashboard fetch failed:', e)
      return null
    }
  }, [setDashboardData, setHasData])

  const fetchStock = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getLowStock()
      setStockData(res.data)
    } catch (e) {
      setError('Failed to load stock data')
    } finally {
      setLoading(false)
    }
  }, [setStockData])

  const fetchExpiry = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getExpiryProducts()
      setExpiryData(res.data)
    } catch (e) {
      setError('Failed to load expiry data')
    } finally {
      setLoading(false)
    }
  }, [setExpiryData])

  const fetchCrossSell = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCrossSell()
      setCrossSellData(res.data)
    } catch (e) {
      setError('Failed to load cross-sell data')
    } finally {
      setLoading(false)
    }
  }, [setCrossSellData])

  const fetchPredictions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await predictSales()
      setPredictionsData(res.data)
    } catch (e) {
      setError('Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }, [setPredictionsData])

  const fetchDecisions = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getDecisions()
      setDecisionsData(res.data.decisions || [])
    } catch (e) {
      setError('Failed to load decisions')
    } finally {
      setLoading(false)
    }
  }, [setDecisionsData])

  const fetchAgentStatus = useCallback(async () => {
    try {
      const res = await getAgentStatus()
      setAgentStatus(res.data)
    } catch (e) {}
  }, [setAgentStatus])

  return {
    loading, error,
    fetchDashboard, fetchStock, fetchExpiry,
    fetchCrossSell, fetchPredictions, fetchDecisions, fetchAgentStatus
  }
}
