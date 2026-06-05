import axios from 'axios'

const BASE_URL = 'http://127.0.0.1:8000'

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 60000
})

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

export const sendChat = (message, context) =>
  api.post('/chat', { message, context })

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

export default api
