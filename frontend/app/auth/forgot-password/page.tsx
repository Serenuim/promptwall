'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Shield } from 'lucide-react'
import { auth, ApiError } from '@/lib/api'
import { Spinner, Toast } from '@/components/ui/Shared'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!email) { setErr('Email is required.'); return }
    setLoading(true); setErr('')
    try { await auth.forgot(email); setDone(true) }
    catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed.') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl border border-accent/40 flex items-center justify-center glow-sm">
              <Shield size={20} className="text-accent" />
            </div>
            <span className="font-display text-3xl tracking-widest text-accent text-glow">PROMPTWALL</span>
          </Link>
        </div>
        <div className="card p-8 space-y-5">
          <h2 className="font-display text-2xl tracking-widest text-white">RESET PASSWORD</h2>
          {done ? (
            <div className="badge-ok px-4 py-3 rounded-xl text-sm font-mono">
              If that email exists, a reset link has been sent. Check your inbox.
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs font-mono text-gray-400 mb-1.5 block">YOUR EMAIL</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && submit()}
                  placeholder="you@example.com" className="w-full input-g px-4 py-3 text-sm font-mono" />
              </div>
              {err && <Toast msg={err} type="bad" />}
              <button onClick={submit} disabled={loading}
                className="w-full btn-p py-3 text-sm font-mono flex items-center justify-center gap-2">
                {loading ? <Spinner size={4} /> : 'Send Reset Link'}
              </button>
            </>
          )}
          <div className="text-center">
            <Link href="/auth/signin" className="text-xs font-mono text-gray-500 hover:text-accent transition-colors">← Back to Sign In</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
