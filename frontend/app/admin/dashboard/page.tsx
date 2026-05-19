'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Shield, Users, FileText, BarChart2, Settings,
  LogOut, Search, Download, Ban, Trash2, Unlock,
  Lock, ChevronLeft, CheckCircle, XCircle, Minus,
} from 'lucide-react'
import { Spinner, Toast } from '@/components/ui/Shared'
import { userApi, adminApi, adminFeedbackApi, auth, ApiError, type AdminUser, type AdminLog } from '@/lib/api'

type Tab = 'stats' | 'users' | 'logs' | 'feedback'

// ─── Admin Sidebar ────────────────────────────────────────────────
function AdminSidebar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const router = useRouter()
  const ITEMS: [Tab, string, typeof BarChart2][] = [
    ['stats', 'Overview', BarChart2],
    ['users', 'Users', Users],
    ['logs', 'Logs', FileText],
    ['feedback', 'Feedback', CheckCircle],
  ]
  return (
    <aside className="hidden md:flex flex-col w-64 min-h-screen border-r border-border flex-shrink-0" style={{ background: '#070000' }}>
      <div className="h-16 flex items-center px-5 border-b border-border">
        <Shield size={18} className="text-danger mr-2" />
        <span className="font-display text-xl tracking-widest text-white">PROMPTWALL</span>
      </div>
      <div className="px-4 py-2 border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{ background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.2)' }}>
          <Lock size={11} className="text-danger" />
          <span className="text-xs font-mono text-danger tracking-widest">ADMIN PANEL</span>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {ITEMS.map(([id, label, Icon]) => (
          <button key={id} onClick={() => setTab(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-mono transition-all ${
              tab === id
                ? 'bg-red-950/40 border-l-2 border-danger text-danger'
                : 'text-gray-500 hover:text-gray-200 hover:bg-muted/30'
            }`}>
            <Icon size={15} />{label}
          </button>
        ))}
      </nav>
      <div className="px-3 py-4 border-t border-border space-y-1">
        <Link href="/Dashboard/home" className="flex items-center gap-2 px-3 py-2 text-xs font-mono text-gray-500 hover:text-accent rounded-lg transition-colors">
          <ChevronLeft size={13} />User Dashboard
        </Link>
        <button onClick={() => { auth.logout(); router.push('/auth/signin') }}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-mono text-gray-500 hover:text-danger rounded-lg transition-colors">
          <LogOut size={13} />Sign Out
        </button>
      </div>
    </aside>
  )
}

// ─── Stats ────────────────────────────────────────────────────────
function StatsTab() {
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => { adminApi.stats().then(s => setStats(s as Record<string, number>)).catch(() => {}).finally(() => setLoading(false)) }, [])
  if (loading) return <div className="flex justify-center py-20"><Spinner size={8} color="danger" /></div>
  if (!stats) return <div className="card p-8 text-center font-mono text-sm text-gray-500">Failed to load stats.</div>
  return (
    <div className="space-y-6">
      <h2 className="font-display text-2xl tracking-widest text-white">PLATFORM OVERVIEW</h2>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', val: stats.total_users, color: '#00ff41' },
          { label: 'Total Apps', val: stats.total_apps, color: '#00ff88' },
          { label: 'Total Scans', val: stats.total_scans, color: '#ffaa00' },
          { label: 'Total Blocked', val: stats.total_blocked, color: '#ff3b3b' },
          { label: 'Block Rate', val: `${stats.block_rate}%`, color: stats.block_rate > 30 ? '#ff3b3b' : '#ffaa00' },
          { label: 'Total Feedback', val: stats.total_feedback, color: '#00ff41' },
        ].map(s => (
          <div key={s.label} className="card p-4 card-hover">
            <div className="text-[10px] font-mono text-gray-500 mb-2">{s.label.toUpperCase()}</div>
            <div className="font-display text-3xl tracking-wider" style={{ color: s.color }}>{String(s.val)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Users ────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  const load = useCallback((q = '') => {
    setLoading(true)
    adminApi.users(q).then(setUsers).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const act = async (id: string, action: string, email: string) => {
    if (action === 'delete' && !confirm(`Delete ${email}?`)) return
    try {
      const r = await adminApi.userAction(id, action)
      setMsg(r.message); load(search); setTimeout(() => setMsg(''), 3000)
    } catch (e) { setMsg(e instanceof ApiError ? e.message : 'Failed.') }
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl tracking-widest text-white">USERS</h2>
      {msg && <Toast msg={msg} type="ok" />}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
            placeholder="Search by name or email..." className="w-full input-g pl-9 py-2.5 text-sm" />
        </div>
        <button onClick={() => load(search)} className="btn-o px-4 py-2.5 text-xs font-mono">Search</button>
      </div>
      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner size={6} color="danger" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-border bg-muted/20">
                {['User', 'Verified', 'Admin', 'Apps', 'Scans', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-gray-500 font-normal">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} className="border-b border-border/50 hover:bg-muted/10 group">
                    <td className="py-2.5 px-3">
                      <div className="text-white">{u.name}</div>
                      <div className="text-gray-500 text-[10px]">{u.email}</div>
                    </td>
                    <td className="py-2.5 px-3">{u.is_verified ? <span className="text-accent">✓</span> : <span className="text-warning">✗</span>}</td>
                    <td className="py-2.5 px-3">{u.is_admin ? <span className="text-danger">✓</span> : '—'}</td>
                    <td className="py-2.5 px-3 text-gray-300">{u.apps}</td>
                    <td className="py-2.5 px-3 text-gray-300">{u.scans}</td>
                    <td className="py-2.5 px-3"><span className={u.is_active ? 'text-accent' : 'text-danger'}>{u.is_active ? 'active' : 'suspended'}</span></td>
                    <td className="py-2.5 px-3">
                      <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => act(u.id, u.is_active ? 'suspend' : 'unsuspend', u.email)} title={u.is_active ? 'Suspend' : 'Unsuspend'}
                          className={`hover:scale-110 transition-transform ${u.is_active ? 'text-warning' : 'text-accent'}`}>
                          {u.is_active ? <Ban size={13} /> : <Unlock size={13} />}
                        </button>
                        <button onClick={() => act(u.id, u.is_admin ? 'remove-admin' : 'make-admin', u.email)} className="text-yellow-500 hover:scale-110 transition-transform">
                          <Shield size={13} />
                        </button>
                        <button onClick={() => act(u.id, 'delete', u.email)} className="text-danger/60 hover:text-danger hover:scale-110 transition-transform">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-500">No users found.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Logs ─────────────────────────────────────────────────────────
function LogsTab() {
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  const load = useCallback((q = '') => {
    setLoading(true)
    adminApi.logs(q).then(setLogs).catch(() => {}).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-2xl tracking-widest text-white">ALL LOGS</h2>
        <a href={`${BASE}/api/admin/export-csv`} target="_blank" rel="noopener noreferrer"
          className="btn-o px-4 py-2 text-xs font-mono flex items-center gap-2">
          <Download size={12} />Export CSV
        </a>
      </div>
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && load(search)}
            placeholder="Search prompts or attack types..." className="w-full input-g pl-9 py-2.5 text-sm" />
        </div>
        <button onClick={() => load(search)} className="btn-o px-4 py-2.5 text-xs font-mono">Search</button>
      </div>
      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner size={6} color="danger" /></div> : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-border bg-muted/20">
                {['Time', 'User', 'App', 'Prompt', 'Score', 'Attack', 'Status'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-gray-500 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {logs.map(l => (
                  <tr key={l.id} className={`border-b border-border/50 hover:bg-muted/10 ${l.blocked ? 'row-blocked' : ''}`}>
                    <td className="py-2 px-3 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="py-2 px-3 text-gray-400 text-[10px] whitespace-nowrap">{l.user_id?.slice(0, 8)}</td>
                    <td className="py-2 px-3 text-gray-400">{l.app_id || '—'}</td>
                    <td className="py-2 px-3 text-gray-300 max-w-[180px] truncate" title={l.prompt}>{l.prompt.slice(0, 45)}{l.prompt.length > 45 && '…'}</td>
                    <td className="py-2 px-3"><span style={{ color: l.risk_score >= 70 ? '#ff3b3b' : l.risk_score >= 40 ? '#ffaa00' : '#00ff41' }} className="font-bold">{l.risk_score}</span></td>
                    <td className="py-2 px-3 text-gray-400">{l.attack_type || 'None'}</td>
                    <td className="py-2 px-3"><span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${l.blocked ? 'badge-bad' : 'badge-ok'}`}>{l.blocked ? 'BLOCKED' : 'ALLOWED'}</span></td>
                  </tr>
                ))}
                {logs.length === 0 && <tr><td colSpan={7} className="text-center py-10 text-gray-500">No logs.</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Feedback ─────────────────────────────────────────────────────
function FeedbackTab() {
  const [feedback, setFeedback] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

  useEffect(() => {
    adminFeedbackApi.list().then(setFeedback).catch(() => {}).finally(() => setLoading(false))
  }, [])

  const accepts = feedback.filter(f => f.verdict === 'accept').length
  const rejects = feedback.filter(f => f.verdict === 'reject').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="font-display text-2xl tracking-widest text-white">USER FEEDBACK</h2>
        <a href={`${BASE}/api/admin/export-feedback-csv`} target="_blank" rel="noopener noreferrer"
          className="btn-o px-4 py-2 text-xs font-mono flex items-center gap-2">
          <Download size={12} />Export CSV for Retraining
        </a>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4 text-center"><div className="font-display text-3xl text-white">{feedback.length}</div><div className="text-xs font-mono text-gray-500 mt-1">Total Feedback</div></div>
        <div className="card p-4 text-center"><div className="font-display text-3xl text-accent">{accepts}</div><div className="text-xs font-mono text-gray-500 mt-1">Accepted (safe)</div></div>
        <div className="card p-4 text-center"><div className="font-display text-3xl text-danger">{rejects}</div><div className="text-xs font-mono text-gray-500 mt-1">Flagged (should block)</div></div>
      </div>

      <div className="card p-4 text-xs font-mono text-gray-500 leading-relaxed">
        <p className="text-gray-300 font-semibold mb-1">What is this?</p>
        When users click Accept or Flag on scan results in the Detection page, those verdicts appear here.
        Export as CSV to use as labeled training data to fine-tune your DeBERTa model for better accuracy.
        <br /><br />
        <span className="text-accent">Accept</span> = user says the prompt was safe (model may have false-positived).
        <span className="text-danger ml-2">Flag</span> = user says it should have been blocked (model missed it).
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="flex justify-center py-12"><Spinner size={6} /></div> : feedback.length === 0 ? (
          <div className="text-center py-12 font-mono text-sm text-gray-500">
            No feedback yet. Users submit feedback from Dashboard → Detection.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs font-mono">
              <thead><tr className="border-b border-border bg-muted/20">
                {['Time', 'Verdict', 'Prompt', 'Score', 'Attack Type', 'Model Said', 'Note'].map(h => (
                  <th key={h} className="text-left py-3 px-3 text-gray-500 font-normal whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {feedback.map((f: any) => (
                  <tr key={f.feedback_id} className={`border-b border-border/50 hover:bg-muted/10 ${f.verdict === 'reject' ? 'row-blocked' : ''}`}>
                    <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{new Date(f.feedback_at).toLocaleDateString()}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {f.verdict === 'accept'
                        ? <span className="flex items-center gap-1 text-accent"><CheckCircle size={11} />Accept</span>
                        : <span className="flex items-center gap-1 text-danger"><XCircle size={11} />Flag</span>
                      }
                    </td>
                    <td className="py-2.5 px-3 text-gray-300 max-w-[200px] truncate" title={f.prompt}>
                      {f.prompt.slice(0, 50)}{f.prompt.length > 50 && '…'}
                    </td>
                    <td className="py-2.5 px-3"><span style={{ color: f.risk_score >= 70 ? '#ff3b3b' : '#ffaa00' }} className="font-bold">{f.risk_score}</span></td>
                    <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap">{f.attack_type || 'None'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${f.model_said_blocked ? 'badge-bad' : 'badge-ok'}`}>
                        {f.model_said_blocked ? 'BLOCKED' : 'ALLOWED'}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">{f.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('stats')
  const [userName, setUserName] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    userApi.profile().then(u => {
      if (!u.is_admin) { router.push('/Dashboard/home'); return }
      setUserName(u.name)
      setChecking(false)
    }).catch(() => router.push('/auth/signin'))
  }, [router])

  if (checking) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size={8} color="danger" /></div>

  return (
    <div className="flex min-h-screen bg-bg">
      <AdminSidebar tab={tab} setTab={setTab} />
      <main className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        {/* Mobile top bar */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b border-border" style={{ background: '#070000' }}>
          <div className="flex items-center gap-2">
            <Shield size={15} className="text-danger" />
            <span className="font-display text-lg tracking-widest text-white">ADMIN</span>
          </div>
          <div className="flex gap-2">
            {(['stats','users','logs','feedback'] as Tab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-2 py-1 text-[10px] font-mono rounded capitalize transition-all ${tab === t ? 'bg-danger/20 text-danger' : 'text-gray-500'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>
        {/* Desktop header */}
        <header className="hidden md:flex h-16 border-b border-border px-6 items-center justify-between flex-shrink-0" style={{ background: '#070000' }}>
          <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
            <span>/</span><span className="text-danger">admin</span><span>/</span><span className="text-white capitalize">{tab}</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono" style={{ background: 'rgba(255,59,59,0.08)', border: '1px solid rgba(255,59,59,0.2)', color: '#ff3b3b' }}>
            <Lock size={9} />SUPER ADMIN · {userName}
          </div>
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          {tab === 'stats'    && <StatsTab />}
          {tab === 'users'    && <UsersTab />}
          {tab === 'logs'     && <LogsTab />}
          {tab === 'feedback' && <FeedbackTab />}
        </div>
      </main>
    </div>
  )
}
