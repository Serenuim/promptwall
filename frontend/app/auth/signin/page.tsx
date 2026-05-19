'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Shield, Eye, EyeOff } from 'lucide-react'
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

export default function Signin() {
  const router = useRouter()
  const params = useSearchParams()
  const from = params.get('from') || '/Dashboard/home'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notVerified, setNotVerified] = useState(false)
  const [resendDone, setResendDone] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)

  const submit = async () => {
    setError(''); setNotVerified(false)
    if (!email.trim()) { setError('Please enter your email address.'); return }
    if (!password) { setError('Please enter your password.'); return }
    setLoading(true)
    try {
      await auth.login({ email: email.trim(), password })
      router.push(from)
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'NOT_VERIFIED' || e.status === 403) {
          setNotVerified(true)
        } else if (e.code === 'ACCOUNT_LOCKED' || e.status === 423) {
          setError(e.message)
        } else if (e.code === 'INVALID_CREDENTIALS' || e.status === 401) {
          setError('Incorrect email or password. Please try again.')
        } else if (e.code === 'NETWORK_ERROR') {
          setError('Cannot connect to the server. Make sure the backend is running on port 8000.')
        } else {
          setError(e.message || 'Sign in failed. Please try again.')
        }
      } else {
        setError('Something went wrong. Please check your connection and try again.')
      }
    } finally { setLoading(false) }
  }

  const resend = async () => {
    setResendLoading(true)
    try {
      await auth.resendVerify(email.trim())
      setResendDone(true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not resend. Try again later.')
    } finally { setResendLoading(false) }
  }

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at center, rgba(0,255,65,0.04) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-xl border border-accent/40 flex items-center justify-center glow-sm">
              <Shield size={20} className="text-accent" />
            </div>
            <span className="font-display text-3xl tracking-widest text-accent text-glow">PROMPTWALL</span>
          </Link>
          <p className="text-gray-500 font-mono text-xs tracking-wider">Sign in to your account</p>
        </div>

        <div className="card p-8 space-y-5">
          {/* Email not verified banner */}
          {notVerified && (
            <div className="p-4 rounded-xl space-y-3" style={{ background: 'rgba(139,92,246,0.10)', border: '1px solid rgba(139,92,246,0.3)' }}>
              <p className="text-xs font-mono text-purple-300 leading-relaxed">
                Your email address has not been verified yet. Check your inbox for the verification link.
              </p>
              {resendDone ? (
                <p className="text-xs font-mono text-accent">✓ New verification email sent! Check your inbox.</p>
              ) : (
                <button onClick={resend} disabled={resendLoading || !email.trim()}
                  className="flex items-center gap-2 text-xs font-mono text-purple-300 hover:text-white border border-purple-500/40 hover:border-purple-300/60 px-3 py-1.5 rounded-lg transition-all disabled:opacity-50">
                  {resendLoading ? <Spinner size={3} /> : null}
                  Resend Verification Email
                </button>
              )}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block tracking-wider">EMAIL</label>
            <input
              type="email" value={email}
              onChange={e => { setEmail(e.target.value); setError('') }}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="you@example.com"
              autoComplete="email"
              className="input-g" />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block tracking-wider">PASSWORD</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                onKeyDown={e => e.key === 'Enter' && submit()}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className="input-g pr-10" />
              <button type="button" onClick={() => setShowPw(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-accent transition-colors">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div className="flex justify-end -mt-2">
            <Link href="/auth/forgot-password" className="text-xs font-mono text-gray-500 hover:text-accent transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Error */}
          <ErrorBox msg={error} />

          {/* Submit */}
          <button onClick={submit} disabled={loading}
            className="w-full btn-p py-3 text-sm font-mono flex items-center justify-center gap-2">
            {loading ? <><Spinner size={4} /> Signing in...</> : 'Sign In'}
          </button>

          <p className="text-center text-xs font-mono text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="text-accent hover:underline">Sign up free</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
