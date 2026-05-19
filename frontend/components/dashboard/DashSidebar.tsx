'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Shield, LayoutDashboard, Zap, MessageSquare,
  BarChart2, Settings, BookOpen, LogOut, Menu, X,
} from 'lucide-react'
import { auth } from '@/lib/api'

const NAV = [
  { href: '/Dashboard/home',                 label: 'Apps',       icon: LayoutDashboard },
  { href: '/Dashboard/customized-detection', label: 'Detection',  icon: Zap },
  { href: '/Dashboard/simulation',           label: 'Simulation', icon: MessageSquare },
  { href: '/Dashboard/analysis',             label: 'Analysis',   icon: BarChart2 },
  { href: '/Dashboard/settings',             label: 'Settings',   icon: Settings },
  { href: '/Dashboard/docs',                 label: 'API Docs',   icon: BookOpen },
]

interface Props {
  userName: string
  isAdmin: boolean
}

export default function DashSidebar({ userName, isAdmin }: Props) {
  const path     = usePathname()
  const router   = useRouter()
  const [open, setOpen] = useState(false)
  const initials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U'

  // Close sidebar whenever the route changes (mobile nav tap)
  useEffect(() => { setOpen(false) }, [path])

  // Lock body scroll when sidebar open on mobile
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else       document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  const handleLogout = () => {
    auth.logout()
    router.push('/auth/signin')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full" style={{ background: '#000d00' }}>
      {/* Logo row */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-border flex-shrink-0">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg border border-accent/40 flex items-center justify-center">
            <Shield size={14} className="text-accent" />
          </div>
          <span className="font-display text-xl tracking-widest text-accent text-glow">PROMPTWALL</span>
        </Link>
        {/* Close button — mobile only */}
        <button
          onClick={() => setOpen(false)}
          className="md:hidden text-gray-500 hover:text-white transition-colors p-1"
        >
          <X size={20} />
        </button>
      </div>

      {/* Nav links */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(n => {
          const active = path === n.href
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-mono transition-all ${
                active
                  ? 'sidebar-active'
                  : 'text-gray-500 hover:text-gray-200 hover:bg-muted/40'
              }`}
            >
              <n.icon size={16} />
              {n.label}
            </Link>
          )
        })}
        {isAdmin && (
          <Link
            href="/admin/dashboard"
            className="flex items-center gap-3 px-3 py-3 md:py-2.5 rounded-lg text-sm font-mono text-danger/70 hover:text-danger hover:bg-red-950/20 transition-all mt-2"
          >
            <Shield size={16} />Admin Panel
          </Link>
        )}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-border flex-shrink-0">
        <div className="flex items-center gap-3 px-3 py-2 mb-1">
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent flex-shrink-0">
            {initials}
          </div>
          <span className="text-xs font-mono text-gray-300 truncate">{userName}</span>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-gray-500 hover:text-danger hover:bg-muted/30 rounded-lg transition-all"
        >
          <LogOut size={13} />Sign Out
        </button>
      </div>
    </div>
  )

  return (
    <>
      {/* ── Desktop sidebar (always visible ≥ md) ─────────────── */}
      <aside className="hidden md:flex flex-col w-64 min-h-screen border-r border-border flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* ── Mobile top bar ────────────────────────────────────── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border" style={{ background: '#000d00' }}>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg border border-accent/40 flex items-center justify-center">
            <Shield size={13} className="text-accent" />
          </div>
          <span className="font-display text-lg tracking-widest text-accent text-glow">PROMPTWALL</span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Current page label */}
          <span className="text-xs font-mono text-gray-500 capitalize">
            {NAV.find(n => n.href === path)?.label || 'Dashboard'}
          </span>
          <button
            onClick={() => setOpen(true)}
            className="w-9 h-9 flex items-center justify-center rounded-lg border border-border text-gray-400 hover:text-accent hover:border-accent/40 transition-all"
          >
            <Menu size={18} />
          </button>
        </div>
      </div>

      {/* ── Mobile slide-in overlay ───────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Slide-in panel */}
          <div className="md:hidden fixed top-0 left-0 bottom-0 z-50 w-72 shadow-2xl"
            style={{ animation: 'slideInLeft 0.25s ease' }}>
            <SidebarContent />
          </div>
        </>
      )}

      {/* Slide animation */}
      <style>{`
        @keyframes slideInLeft {
          from { transform: translateX(-100%); opacity: 0.8; }
          to   { transform: translateX(0);     opacity: 1; }
        }
      `}</style>
    </>
  )
}
