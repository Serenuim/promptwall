'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Shield, Eye, EyeOff, CheckCircle, Mail } from 'lucide-react'
import { auth, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Shared'

function ErrorBox({ msg }: { msg: string }) {
  if (!msg) return null
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl text-xs font-mono leading-relaxed animate-up"
      style={{ background: 'rgba(255,59,59,0.10)', border: '1px solid rgba(255,59,59,0.3)', color: '#ff6b6b' }}>
      <span className="flex-shrink-0 mt-0.5">⚠</span>
      <span>{msg}</span>
    </div>
  )
}

// Password strength checker
function PasswordStrength({ password }: { password: string }) {
  if (!password) return null
  const checks = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', ok: /[a-z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
  ]
  const passed = checks.filter(c => c.ok).length
  return (
    <div className="space-y-1.5 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="flex-1 h-1 rounded-full transition-colors" style={{
            background: i < passed
              ? passed <= 1 ? '#ff3b3b' : passed <= 2 ? '#ffaa00' : passed <= 3 ? '#88ff00' : '#00ff41'
              : 'rgba(255,255,255,0.08)'
          }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {checks.map(c => (
          <span key={c.label} className={`text-[10px] font-mono flex items-center gap-1 ${c.ok ? 'text-accent' : 'text-gray-600'}`}>
            {c.ok ? '✓' : '○'} {c.label}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function Signup() {
  const [form, setForm] = useState({ name: '', email: '', password: '', policy: false })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [resendLoading, setResendLoading] = useState(false)
  const [resendDone, setResendDone] = useState(false)

  const submit = async () => {
    setError('')
    if (!form.name.trim()) { setError('Please enter your full name.'); return }
    if (!form.email.trim()) { setError('Please enter your email address.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (!/[A-Z]/.test(form.password)) { setError('Password must contain at least one uppercase letter.'); return }
    if (!/[a-z]/.test(form.password)) { setError('Password must contain at least one lowercase letter.'); return }
    if (!/\d/.test(form.password)) { setError('Password must contain at least one number.'); return }
    if (!form.policy) { setError('You must accept the privacy policy to create an account.'); return }

    setLoading(true)
    try {
      await auth.register({ name: form.name.trim(), email: form.email.trim(), password: form.password, accepted_policy: form.policy })
      setDone(true)
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'EMAIL_EXISTS' || e.status === 409) {
          setError('An account with this email already exists. Try signing in instead.')
        } else if (e.code === 'NETWORK_ERROR') {
          setError('Cannot connect to the server. Make sure the backend is running on port 8000.')
        } else if (e.code === 'VALIDATION_ERROR') {
          setError(e.message)
        } else {
          setError(e.message || 'Registration failed. Please try again.')
        }
      } else {
        setError('Something went wrong. Please check your connection and try again.')
      }
    } finally { setLoading(false) }
  }

  const resend = async () => {
    setResendLoading(true)
    try {
      await auth.resendVerify(form.email.trim())
      setResendDone(true)
    } catch { /* always show success to prevent enumeration */ setResendDone(true) }
    finally { setResendLoading(false) }
  }

  // Success screen
  if (done) return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl border border-accent/40 flex items-center justify-center glow-sm">
              <Shield size={20} className="text-accent" />
            </div>
            <span className="font-display text-3xl tracking-widest text-accent text-glow">PROMPTWALL</span>
          </Link>
        </div>
        <div className="card p-10 text-center space-y-5 animate-up">
          <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto">
            <Mail size={28} className="text-accent" />
          </div>
          <div>
            <h2 className="font-display text-3xl tracking-widest text-white mb-2">CHECK YOUR EMAIL</h2>
            <p className="text-sm font-mono text-gray-400 leading-relaxed">
              We sent a verification link to<br />
              <span className="text-accent font-semibold">{form.email}</span>
            </p>
            <p className="text-xs font-mono text-gray-600 mt-2">
              Click the link to activate your account, then sign in.
            </p>
          </div>

          {resendDone ? (
            <div className="flex items-center justify-center gap-2 text-xs font-mono text-accent">
              <CheckCircle size={14} />New link sent! Check your inbox.
            </div>
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-mono text-gray-600">Didn&apos;t receive it?</p>
              <button onClick={resend} disabled={resendLoading}
                className="btn-o px-5 py-2.5 text-sm font-mono flex items-center gap-2 mx-auto">
                {resendLoading ? <Spinner size={4} /> : null}
                Resend Verification Email
              </button>
            </div>
          )}

          <Link href="/auth/signin"
            className="block text-xs font-mono text-gray-600 hover:text-accent transition-colors">
            Already verified? Sign in →
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,65,0.04) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl border border-accent/40 flex items-center justify-center glow-sm">
              <Shield size={20} className="text-accent" />
            </div>
            <span className="font-display text-3xl tracking-widest text-accent text-glow">PROMPTWALL</span>
          </Link>
          <p className="text-gray-500 font-mono text-xs tracking-wider">Create your free account</p>
        </div>

        <div className="card p-8 space-y-5">
          {/* Name */}
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block tracking-wider">FULL NAME</label>
            <input
              value={form.name} onChange={e => { setForm(p => ({ ...p, name: e.target.value })); setError('') }}
              placeholder="Your Name" autoComplete="name"
              className="input-g" />
          </div>

          {/* Email */}
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block tracking-wider">EMAIL</label>
            <input
              type="email" value={form.email}
              onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setError('') }}
              placeholder="you@example.com" autoComplete="email"
              className="input-g" />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block tracking-wider">PASSWORD</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={form.password}
                onChange={e => { setForm(p => ({ ...p, password: e.target.value })); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="Min 8 chars, uppercase, number"
                autoComplete="new-password"
                className="input-g pr-10" />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-accent transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            <PasswordStrength password={form.password} />
          </div>

          {/* Policy checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group" onClick={() => setForm(p => ({ ...p, policy: !p.policy }))}>
            <div className={`w-4 h-4 rounded border flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${
              form.policy ? 'bg-accent border-accent' : 'border-gray-600 group-hover:border-accent/50'
            }`}>
              {form.policy && <CheckCircle size={10} className="text-bg" />}
            </div>
            <span className="text-xs font-mono text-gray-400 group-hover:text-gray-300 transition-colors leading-relaxed select-none">
              I agree to the{' '}
              <a href="#" onClick={e => e.stopPropagation()} className="text-accent hover:underline">Privacy Policy</a>
              {' '}and data processing terms
            </span>
          </label>

          {/* Error */}
          <ErrorBox msg={error} />

          {/* Submit */}
          <button onClick={submit} disabled={loading}
            className="w-full btn-p py-3 text-sm font-mono flex items-center justify-center gap-2">
            {loading ? <><Spinner size={4} /> Creating account...</> : 'Create Account'}
          </button>

          <p className="text-center text-xs font-mono text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/signin" className="text-accent hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
