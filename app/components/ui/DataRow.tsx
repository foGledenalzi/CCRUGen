'use client'

import React from 'react'

interface DataRowProps {
  label: string
  value: string
  color?: string
}

export function DataRow({ label, value, color = '#10ff50' }: DataRowProps) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-mono">
      <span className="tracking-[0.12em] uppercase text-gray-600 flex-shrink-0" style={{ fontSize: 8 }}>{label}</span>
      <span className="ml-auto text-right" style={{ color: `${color}cc` }}>{value}</span>
    </div>
  )
}
