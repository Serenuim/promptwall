'use client'
import { useState } from 'react'
import DashSidebar from '@/components/dashboard/DashSidebar'
import { Spinner, Toast } from '@/components/ui/Shared'
import { useAuth } from '@/hooks/useAuth'
import { userApi, ApiError } from '@/lib/api'

export default function Settings() {
  const { user, loading: authLoading, setUser } = useAuth()
  const [name, setName] = useState('')
  const [pw, setPw] = useState({ current: '', new_: '', confirm: '' })
  const [saving, setSaving] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  if (authLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size={8} /></div>
  if (!name && user?.name) setName(user.name)

  const saveProfile = async () => {
    setSaving(true); setMsg(''); setErr('')
    try { const u = await userApi.update(name); setUser(u); setMsg('Profile updated.') }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed.') }
    finally { setSaving(false) }
  }

  const changePw = async () => {
    setMsg(''); setErr('')
    if (!pw.current || !pw.new_ || !pw.confirm) { setErr('All fields required.'); return }
    if (pw.new_ !== pw.confirm) { setErr('Passwords do not match.'); return }
    setPwSaving(true)
    try { await userApi.changePw(pw.current, pw.new_); setMsg('Password changed.'); setPw({ current:'', new_:'', confirm:'' }) }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed.') }
    finally { setPwSaving(false) }
  }

  return (
    <div className="flex min-h-screen bg-bg">
      <DashSidebar userName={user?.name || ''} isAdmin={user?.is_admin || false} />
      <main className="flex-1 flex flex-col pt-14 md:pt-0">
        <header className="hidden md:flex h-16 border-b border-border px-6 items-center bg-card/50 flex-shrink-0">
          <h1 className="font-display text-xl tracking-widest text-white">SETTINGS</h1>
        </header>
        <div className="flex-1 p-4 md:p-6 overflow-auto">
          <div className="max-w-xl space-y-6">
            {msg && <Toast msg={msg} type="ok" />}
            {err && <Toast msg={err} type="bad" />}

            {/* Profile */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-sans font-semibold text-white border-b border-border pb-3">Profile</h2>
              <div>
                <label className="text-xs font-mono text-gray-400 mb-1.5 block">FULL NAME</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  className="w-full input-g px-4 py-2.5 text-sm font-mono" />
              </div>
              <div>
                <label className="text-xs font-mono text-gray-400 mb-1.5 block">EMAIL (cannot change)</label>
                <input value={user?.email || ''} disabled className="w-full input-g px-4 py-2.5 text-sm font-mono opacity-40 cursor-not-allowed" />
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-gray-500">Email verified:</span>
                <span className={user?.is_verified ? 'text-accent' : 'text-warning'}>{user?.is_verified ? '✓ Yes' : '✗ No'}</span>
              </div>
              <button onClick={saveProfile} disabled={saving} className="btn-p px-6 py-2.5 text-sm font-mono flex items-center gap-2">
                {saving ? <Spinner size={4} /> : null}Save Profile
              </button>
            </div>

            {/* Change password */}
            <div className="card p-5 space-y-4">
              <h2 className="text-sm font-sans font-semibold text-white border-b border-border pb-3">Change Password</h2>
              {[
                { label: 'CURRENT PASSWORD', key: 'current', val: pw.current },
                { label: 'NEW PASSWORD', key: 'new_', val: pw.new_ },
                { label: 'CONFIRM NEW PASSWORD', key: 'confirm', val: pw.confirm },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-xs font-mono text-gray-400 mb-1.5 block">{f.label}</label>
                  <input type="password" value={f.val} onChange={e => setPw(p => ({...p,[f.key]:e.target.value}))}
                    className="w-full input-g px-4 py-2.5 text-sm font-mono" />
                </div>
              ))}
              <p className="text-[10px] font-mono text-gray-600">8+ chars · uppercase · number required</p>
              <button onClick={changePw} disabled={pwSaving} className="btn-p px-6 py-2.5 text-sm font-mono flex items-center gap-2">
                {pwSaving ? <Spinner size={4} /> : null}Change Password
              </button>
            </div>

            {/* Plan & Usage */}
            <div className="card p-5 space-y-3">
              <h2 className="text-sm font-sans font-semibold text-white border-b border-border pb-3">Plan & Usage</h2>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-500">Current Plan</span>
                <span className="badge-warn px-2 py-0.5 rounded">Free</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-500">Daily Scans Used</span>
                <span className="text-white">{user?.daily_scans || 0} / 40</span>
              </div>
              <div className="bar">
                <div className="bar-fill bg-accent" style={{ width: `${Math.min(((user?.daily_scans || 0) / 40) * 100, 100)}%` }} />
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-500">Member Since</span>
                <span className="text-gray-300">{user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-gray-500">Last Login</span>
                <span className="text-gray-300">{user?.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
