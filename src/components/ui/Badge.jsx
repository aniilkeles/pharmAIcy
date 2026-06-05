import React from 'react'

const variants = {
  success: 'bg-accent/10 text-accent border border-accent/20',
  warning: 'bg-warning/10 text-warning border border-warning/20',
  danger: 'bg-danger/10 text-danger border border-danger/20',
  info: 'bg-blue/10 text-blue border border-blue/20',
  muted: 'bg-card text-muted border border-border'
}

function Badge({ children, variant = 'muted', className = '' }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}

export default Badge
