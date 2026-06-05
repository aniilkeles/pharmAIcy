import React, { useState } from 'react'
import { motion } from 'framer-motion'
import LoginForm from '@/components/auth/LoginForm'
import RegisterForm from '@/components/auth/RegisterForm'
import { useAuth } from '@/hooks/useAuth'

function Auth() {
  const [tab, setTab] = useState('login')
  const { login, register } = useAuth()

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-sm"
      >
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center mx-auto mb-4">
            <span className="text-black font-bold text-lg">Hi</span>
          </div>
          <h1 className="text-xl font-semibold text-text">PharmAIcy</h1>
          <p className="text-muted text-sm mt-1">Intelligent pharmacy management</p>
        </div>

        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="flex border-b border-border">
            {['login', 'register'].map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-3 text-sm font-medium transition-colors
                  ${tab === t ? 'text-text border-b-2 border-accent -mb-px' : 'text-muted hover:text-text'}`}
              >
                {t === 'login' ? 'Sign In' : 'Register'}
              </button>
            ))}
          </div>
          <div className="p-6">
            {tab === 'login' ? <LoginForm onLogin={login} /> : <RegisterForm onRegister={register} />}
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default Auth
