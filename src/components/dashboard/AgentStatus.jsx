import React from 'react'

const AGENTS = [
  { key: 'data_agent', label: 'Data' },
  { key: 'prediction_agent', label: 'Predict' },
  { key: 'interaction_agent', label: 'Cross-sell' },
  { key: 'expiry_agent', label: 'Expiry' },
  { key: 'decision_agent', label: 'AI' }
]

function AgentStatus({ agents = {} }) {
  return (
    <div className="flex items-center gap-3">
      {AGENTS.map(({ key, label }) => (
        <div key={key} className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${agents[key] === 'ready' ? 'bg-accent' : 'bg-muted'}`} />
          <span className="text-xs text-muted">{label}</span>
        </div>
      ))}
    </div>
  )
}

export default AgentStatus
