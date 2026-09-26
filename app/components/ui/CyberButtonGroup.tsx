'use client'

import React from 'react'

type CyberButtonGroupProps = {
  children: React.ReactNode
  className?: string
}

export function CyberButtonGroup({
  children,
  className = '',
}: CyberButtonGroupProps) {
  return (
    <div className={`inline-flex border border-white/10 ${className}`}>
      {children}
    </div>
  )
}
