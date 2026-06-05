import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, Bot, User } from 'lucide-react'
import { useChat } from '@/hooks/useChat'

function ChatPanel() {
  const { messages, send, sending } = useChat()
  const [input, setInput] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const msg = input.trim()
    if (!msg || sending) return
    setInput('')
    await send(msg)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  return (
    <div className="flex flex-col h-full bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Bot size={16} className="text-accent" />
        <span className="text-sm font-medium text-text">PharmAIcy Assistant</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center">
            <Bot size={32} className="text-muted" />
            <p className="text-sm text-muted">Ask me anything about your pharmacy data</p>
            <div className="flex flex-col gap-1 mt-2">
              {["Which products need restocking?", "What's my best selling product?", "Any products expiring soon?"].map(q => (
                <button key={q} onClick={() => { setInput(q) }}
                  className="text-xs text-accent hover:underline">
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot size={12} className="text-accent" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user' ? 'bg-accent text-black' : 'bg-surface border border-border text-text'
              }`}>
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
                  <User size={12} className="text-muted" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
              <Bot size={12} className="text-accent" />
            </div>
            <div className="bg-surface border border-border rounded-xl px-3 py-2">
              <div className="flex gap-1">
                {[0, 0.15, 0.3].map(d => (
                  <div key={d} className="w-1.5 h-1.5 bg-muted rounded-full animate-bounce" style={{ animationDelay: `${d}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="p-3 border-t border-border flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask about your pharmacy..."
          className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          className="w-9 h-9 bg-accent rounded-lg flex items-center justify-center text-black disabled:opacity-50 hover:bg-opacity-90 transition-colors"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  )
}

export default ChatPanel
