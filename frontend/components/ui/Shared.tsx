'use client'
import React from 'react'

export function Spinner({ size = 6, color = 'accent' }: { size?: number; color?: string }) {
  const dim = `w-${size} h-${size}`
  const cls = color === 'danger'
    ? 'border-danger/20 border-t-danger'
    : 'border-accent/20 border-t-accent'
  return <div className={`${dim} border-2 ${cls} rounded-full spin flex-shrink-0`} />
}

export function Toast({ msg, type = 'ok', onClose }: {
  msg: string
  type?: 'ok' | 'bad'
  onClose?: () => void
}) {
  if (!msg) return null
  return (
    <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs font-mono leading-relaxed animate-up ${
      type === 'ok' ? 'badge-ok' : 'badge-bad'
    }`}>
      <span className="flex-shrink-0 mt-0.5">{type === 'ok' ? '✓' : '⚠'}</span>
      <span className="flex-1">{msg}</span>
      {onClose && (
        <button onClick={onClose} className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity">✕</button>
      )}
    </div>
  )
}

export function Badge({ type, children }: { type: 'ok' | 'bad' | 'warn'; children: React.ReactNode }) {
  const cls = { ok: 'badge-ok', bad: 'badge-bad', warn: 'badge-warn' }[type]
  return <span className={`${cls} text-[10px] font-mono px-2 py-0.5`}>{children}</span>
}

export function ScoreBadge({ score }: { score: number }) {
  const color = score >= 70 ? '#ff3b3b' : score >= 40 ? '#ffaa00' : '#00ff41'
  return (
    <span className="font-mono text-xs font-bold" style={{ color }}>
      {score}
    </span>
  )
}

export function StatusBadge({ blocked }: { blocked: boolean }) {
  return blocked
    ? <span className="badge-bad text-[10px] font-mono px-2 py-0.5 rounded font-bold">🚫 BLOCKED</span>
    : <span className="badge-ok text-[10px] font-mono px-2 py-0.5 rounded font-bold">✅ ALLOWED</span>
}
