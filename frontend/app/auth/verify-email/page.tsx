'use client'
import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, CheckCircle, XCircle } from 'lucide-react'
import { auth, setToken, ApiError } from '@/lib/api'
import { Spinner } from '@/components/ui/Shared'

export default function VerifyEmail() {
  const params = useSearchParams()
  const router = useRouter()
  const [status, setStatus] = useState<'loading'|'success'|'error'>('loading')
  const [msg, setMsg] = useState('')
  const [email, setEmail] = useState('')

  useEffect(() => {
    const token = params.get('token')
    if (!token) { setStatus('error'); setMsg('No token found in URL.'); return }
    auth.verifyEmail(token)
      .then(r => {
        setToken(r.access_token)
        setStatus('success')
        setTimeout(() => router.push('/Dashboard/home'), 2000)
      })
      .catch(e => {
        setStatus('error')
        setMsg(e instanceof ApiError ? e.message : 'Verification failed.')
      })
  }, [params, router])

  return (
    <div className="min-h-screen bg-grid flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="card p-10 space-y-6">
          <div className="w-12 h-12 rounded-full border border-accent/30 flex items-center justify-center mx-auto">
            <Shield size={22} className="text-accent" />
          </div>
          {status === 'loading' && (
            <><Spinner size={8} /><p className="font-mono text-sm text-gray-400">Verifying your email...</p></>
          )}
          {status === 'success' && (
            <>
              <CheckCircle size={40} className="text-accent mx-auto" />
              <div>
                <p className="font-mono text-sm text-accent font-bold">Email Verified!</p>
                <p className="font-mono text-xs text-gray-500 mt-1">Redirecting to your dashboard...</p>
              </div>
            </>
          )}
          {status === 'error' && (
            <>
              <XCircle size={40} className="text-danger mx-auto" />
              <p className="font-mono text-sm text-danger">{msg}</p>
              <div className="space-y-3">
                {email && (
                  <button onClick={async () => { await auth.resendVerify(email); setMsg('New link sent! Check your inbox.') }}
                    className="btn-o px-6 py-2 text-xs font-mono w-full">
                    Resend Verification
                  </button>
                )}
                <Link href="/auth/signin" className="block text-xs font-mono text-gray-500 hover:text-accent transition-colors">
                  Back to Sign In
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
