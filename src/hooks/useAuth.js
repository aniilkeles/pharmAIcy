import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useStore } from '@/store/useStore'
import { refreshAuthHeader } from '@/lib/api'

export function useAuth() {
  const { user, setUser } = useStore()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const checkSavedSession = useCallback(async () => {
    try {
      const token = await window.api.getSavedSession()
      if (!token) return false

      const parsed = JSON.parse(token)
      const { data, error } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token
      })

      if (error || !data.session) {
        await window.api.clearSession()
        return false
      }

      setUser(data.session.user)
      await refreshAuthHeader()
      return true
    } catch (e) {
      await window.api.clearSession()
      return false
    }
  }, [setUser])

  useEffect(() => {
    checkSavedSession().finally(() => setLoading(false))
  }, [checkSavedSession])

  const login = async (email, password) => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      const sessionStr = JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token
      })
      await window.api.saveSession(sessionStr)
      setUser(data.user)
      await refreshAuthHeader()
      return { success: true }
    } catch (e) {
      setError(e.message)
      return { success: false, error: e.message }
    } finally {
      setLoading(false)
    }
  }

  const register = async (email, password, name) => {
    setError(null)
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } }
      })
      if (error) throw error

      if (data.session) {
        const sessionStr = JSON.stringify({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token
        })
        await window.api.saveSession(sessionStr)
        setUser(data.user)
        await refreshAuthHeader()
      }
      return { success: true }
    } catch (e) {
      setError(e.message)
      return { success: false, error: e.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = async () => {
    await supabase.auth.signOut()
    await window.api.clearSession()
    setUser(null)
    await refreshAuthHeader()
  }

  return { user, loading, error, login, register, logout, checkSavedSession }
}
