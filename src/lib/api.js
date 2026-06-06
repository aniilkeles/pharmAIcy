import axios from 'axios'
import { supabase } from '@/lib/supabase'

const _port = (typeof window !== 'undefined' && window.api?.backendPort) || 8000
const BASE_URL = `http://127.0.0.1:${_port}`

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000
})

export async function refreshAuthHeader() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`
  } else {
    delete api.defaults.headers.common['Authorization']
  }
}

api.interceptors.request.use(async (config) => {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (token) {
    config.headers['Authorization'] = `Bearer ${token}`
  }
  return config
})

refreshAuthHeader()

// ─── Existing ──────────────────────────────────────────────────────────────────

export const uploadData = (csvBytes) =>
  api.post('/upload-data', { csv_bytes: csvBytes })

export const exportData = () =>
  api.get('/export-data')

export const analyzeSales = () =>
  api.post('/analyze-sales')

export const predictSales = () =>
  api.post('/predict-sales')

export const getLowStock = () =>
  api.get('/low-stock')

export const getExpiryProducts = () =>
  api.get('/expiry-products')

export const getCrossSell = () =>
  api.get('/cross-sell')

export const getDecisions = () =>
  api.get('/decisions')

export const sendChat = (message, context, history) =>
  api.post('/chat', { message, context, history })

export const getAgentStatus = () =>
  api.get('/agent-status')

export const getDashboardSummary = () =>
  api.get('/dashboard-summary')

export const getNotifications = () =>
  api.get('/notifications')

export const markNotificationRead = (id) =>
  api.post('/notifications/read', { id })

export const markAllNotificationsRead = () =>
  api.post('/notifications/read-all')

export const getUnreadCount = () =>
  api.get('/notifications/unread-count')

export const checkNotifications = () =>
  api.post('/notifications/check')

export const lookupBarcode = (barcode) =>
  api.post('/barcode-lookup', { barcode })

export const addProduct = (product) =>
  api.post('/products/add', product)

export const searchProducts = (q = '') =>
  api.get('/products/search', { params: { q } })

export const getProducts = (params = {}) =>
  api.get('/products', { params })

export const updateProduct = (productId, data) =>
  api.put(`/products/${productId}`, data)

export const deleteProduct = (productId) =>
  api.delete(`/products/${productId}`)

// ─── Patients ──────────────────────────────────────────────────────────────────

export const getPatients = (q = '') =>
  api.get('/patients', { params: { q } })

export const createPatient = (data) =>
  api.post('/patients', data)

export const getPatient = (id) =>
  api.get(`/patients/${id}`)

export const updatePatient = (id, data) =>
  api.put(`/patients/${id}`, data)

// ─── Doctors ───────────────────────────────────────────────────────────────────

export const getDoctors = (q = '') =>
  api.get('/doctors', { params: { q } })

export const createDoctor = (data) =>
  api.post('/doctors', data)

// ─── Prescriptions ─────────────────────────────────────────────────────────────

export const getPrescriptions = (status = '') =>
  api.get('/prescriptions', { params: { status } })

export const createPrescription = (data) =>
  api.post('/prescriptions', data)

export const getPrescription = (id) =>
  api.get(`/prescriptions/${id}`)

export const confirmPrescription = (id) =>
  api.post(`/prescriptions/${id}/confirm`)

export const cancelPrescription = (id) =>
  api.post(`/prescriptions/${id}/cancel`)

export const repeatPrescription = (id) =>
  api.post(`/prescriptions/${id}/repeat`)

// ─── Drug Interactions ─────────────────────────────────────────────────────────

export const checkDrugInteractions = (product_ids) =>
  api.post('/drug-interactions/check', { product_ids })

export const getPrescriptionSuggestions = (product_ids) =>
  api.post('/prescriptions/suggest', { product_ids })

export const seedDemoData = () =>
  api.get('/seed-demo-data')

export const getAuditLog = (params = {}) =>
  api.get('/audit-log', { params })

export default api
