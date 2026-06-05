import { useEffect, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import {
  getNotifications, getUnreadCount,
  markNotificationRead, markAllNotificationsRead
} from '@/lib/api'

export function useNotifications() {
  const { setNotifications, setUnreadCount, notifications } = useStore()

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await getNotifications()
      setNotifications(res.data)
    } catch (e) {}
  }, [setNotifications])

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await getUnreadCount()
      setUnreadCount(res.data.count)
    } catch (e) {}
  }, [setUnreadCount])

  const markRead = useCallback(async (id) => {
    try {
      await markNotificationRead(id)
      setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n))
      fetchUnreadCount()
    } catch (e) {}
  }, [notifications, setNotifications, fetchUnreadCount])

  const markAllRead = useCallback(async () => {
    try {
      await markAllNotificationsRead()
      setNotifications(notifications.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    } catch (e) {}
  }, [notifications, setNotifications, setUnreadCount])

  useEffect(() => {
    fetchNotifications()
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 60000)
    return () => clearInterval(interval)
  }, [])

  return { fetchNotifications, fetchUnreadCount, markRead, markAllRead }
}
