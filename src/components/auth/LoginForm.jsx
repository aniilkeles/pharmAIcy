import React, { useState } from 'react'
import { Eye, EyeOff, LogIn } from 'lucide-react'

function LoginForm({ onLogin }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await onLogin(email, password)
    if (!result.success) setError(result.error)
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-muted mb-1 block">Email</label>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
          placeholder="pharmacist@example.com"
        />
      </div>
      <div>
        <label className="text-xs text-muted mb-1 block">Password</label>
        <div className="relative">
          <input
            type={showPw ? 'text' : 'password'}
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full bg-card border border-border rounded-lg px-3 py-2.5 pr-10 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
            placeholder="••••••••"
          />
          <button type="button" onClick={() => setShowPw(s => !s)} className="absolute right-3 top-3 text-muted hover:text-text">
            {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-black font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors disabled:opacity-60"
      >
        {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <LogIn size={15} />}
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  )
}

export default LoginForm
