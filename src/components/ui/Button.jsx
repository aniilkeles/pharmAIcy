import React from 'react'
import { motion } from 'framer-motion'

function Button({ children, variant = 'primary', size = 'md', disabled, onClick, className = '', ...props }) {
  const base = 'inline-flex items-center gap-2 font-medium rounded-lg transition-colors focus:outline-none'
  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base'
  }
  const variants = {
    primary: 'bg-accent text-black hover:bg-opacity-90',
    secondary: 'bg-card text-text border border-border hover:border-muted',
    danger: 'bg-danger text-white hover:bg-opacity-90',
    ghost: 'text-muted hover:text-text hover:bg-card'
  }

  return (
    <motion.button
      whileTap={disabled ? {} : { scale: 0.97 }}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${sizes[size]} ${variants[variant]} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'} ${className}`}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export default Button
