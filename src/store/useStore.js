import { create } from 'zustand'

export const useStore = create((set, get) => ({
  // Auth
  user: null,
  setUser: (user) => set({ user }),

  // Data
  dashboardData: null,
  setDashboardData: (data) => set({ dashboardData: data }),

  stockData: [],
  setStockData: (data) => set({ stockData: data }),

  expiryData: [],
  setExpiryData: (data) => set({ expiryData: data }),

  crossSellData: [],
  setCrossSellData: (data) => set({ crossSellData: data }),

  predictionsData: null,
  setPredictionsData: (data) => set({ predictionsData: data }),

  decisionsData: [],
  setDecisionsData: (data) => set({ decisionsData: data }),

  agentStatus: {},
  setAgentStatus: (status) => set({ agentStatus: status }),

  // Notifications
  notifications: [],
  setNotifications: (notifications) => set({ notifications }),

  unreadCount: 0,
  setUnreadCount: (count) => set({ unreadCount: count }),

  addNotifications: (newNotifs) => set((state) => ({
    notifications: [...newNotifs, ...state.notifications.filter(
      n => !newNotifs.find(nn => nn.id === n.id)
    )]
  })),

  // Upload state
  hasData: false,
  setHasData: (hasData) => set({ hasData }),

  isUploading: false,
  setIsUploading: (uploading) => set({ isUploading: uploading }),

  // Chat
  chatMessages: [],
  addChatMessage: (msg) => set((state) => ({
    chatMessages: [...state.chatMessages, msg]
  })),
  clearChat: () => set({ chatMessages: [] }),

  // Barcode
  lastScan: null,
  setLastScan: (scan) => set({ lastScan: scan }),

  // UI
  uploadModalOpen: false,
  setUploadModalOpen: (open) => set({ uploadModalOpen: open })
}))
