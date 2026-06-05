import axios from 'axios'
import { useStore } from '@/store/useStore'

const BASE_URL = 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000
})

api.interceptors.request.use((config) => {
  const user = useStore.getState().user
  if (user?.id) {
    config.headers['X-User-ID'] = user.id
  }
  return config
})

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

export default api
