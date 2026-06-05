import { useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { sendChat } from '@/lib/api'

export function useChat() {
  const { chatMessages, addChatMessage } = useStore()
  const [sending, setSending] = useState(false)

  const send = useCallback(async (message) => {
    addChatMessage({ role: 'user', content: message, ts: Date.now() })
    setSending(true)
    try {
      const res = await sendChat(message)
      addChatMessage({ role: 'assistant', content: res.data.response, ts: Date.now() })
    } catch (e) {
      addChatMessage({ role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.', ts: Date.now() })
    } finally {
      setSending(false)
    }
  }, [addChatMessage])

  return { messages: chatMessages, send, sending }
}
