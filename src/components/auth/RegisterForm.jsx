import React, { useState } from 'react'
import { UserPlus } from 'lucide-react'

function RegisterForm({ onRegister }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await onRegister(email, password, name)
    if (!result.success) setError(result.error)
    else setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <p className="text-accent font-medium">Account created!</p>
        <p className="text-muted text-sm mt-1">Check your email to confirm, then sign in.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="text-xs text-muted mb-1 block">Full Name</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          required
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
          placeholder="Your name"
        />
      </div>
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
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          minLength={6}
          className="w-full bg-card border border-border rounded-lg px-3 py-2.5 text-sm text-text placeholder-muted focus:outline-none focus:border-accent transition-colors"
          placeholder="••••••••"
        />
      </div>
      {error && <p className="text-danger text-xs">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full bg-accent text-black font-medium py-2.5 rounded-lg text-sm flex items-center justify-center gap-2 hover:bg-opacity-90 transition-colors disabled:opacity-60"
      >
        {loading ? <div className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" /> : <UserPlus size={15} />}
        {loading ? 'Creating account...' : 'Create Account'}
      </button>
    </form>
  )
}

export default RegisterForm
