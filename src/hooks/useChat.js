import { useState, useCallback } from 'react'
import { useStore } from '@/store/useStore'
import { sendChat } from '@/lib/api'

export function useChat() {
  const { chatMessages, addChatMessage, clearChat } = useStore()
  const [sending, setSending] = useState(false)
  const [chatHistory, setChatHistory] = useState([])

  const send = useCallback(async (message) => {
    addChatMessage({ role: 'user', content: message, ts: Date.now() })
    const newHistory = [...chatHistory, { role: 'user', content: message }]
    setSending(true)
    try {
      const res = await sendChat(message, null, newHistory)
      const reply = res.data.response
      addChatMessage({ role: 'assistant', content: reply, ts: Date.now() })
      const updated = [...newHistory, { role: 'assistant', content: reply }]
      setChatHistory(updated.slice(-10))
    } catch (e) {
      addChatMessage({ role: 'assistant', content: 'Sorry, I had trouble connecting. Please try again.', ts: Date.now() })
    } finally {
      setSending(false)
    }
  }, [addChatMessage, chatHistory])

  const clear = useCallback(() => {
    clearChat()
    setChatHistory([])
  }, [clearChat])

  return { messages: chatMessages, send, sending, clear }
}
