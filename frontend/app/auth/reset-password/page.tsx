'use client'
import { useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Shield, Eye, EyeOff } from 'lucide-react'
import { auth, ApiError } from '@/lib/api'
import { Spinner, Toast } from '@/components/ui/Shared'

export default function ResetPassword() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') || ''
  const [f, setF] = useState({ password: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    setErr('')
    if (!f.password || !f.confirm) { setErr('Both fields are required.'); return }
    if (f.password !== f.confirm) { setErr('Passwords do not match.'); return }
    if (!token) { setErr('Invalid reset link.'); return }
    setLoading(true)
    try {
      await auth.reset(token, f.password)
      router.push('/auth/signin?reset=1')
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Reset failed.')
    } finally { setLoading(false) }
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
          <h2 className="font-display text-2xl tracking-widest text-white">NEW PASSWORD</h2>
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block">NEW PASSWORD</label>
            <div className="relative">
              <input type={showPw ? 'text' : 'password'} value={f.password}
                onChange={e => setF(p=>({...p,password:e.target.value}))}
                placeholder="8+ chars, uppercase, number"
                className="w-full input-g px-4 py-3 pr-10 text-sm font-mono" />
              <button onClick={()=>setShowPw(s=>!s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-accent">
                {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-mono text-gray-400 mb-1.5 block">CONFIRM PASSWORD</label>
            <input type="password" value={f.confirm} onChange={e => setF(p=>({...p,confirm:e.target.value}))}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••••••" className="w-full input-g px-4 py-3 text-sm font-mono" />
          </div>
          {err && <Toast msg={err} type="bad" />}
          <button onClick={submit} disabled={loading}
            className="w-full btn-p py-3 text-sm font-mono flex items-center justify-center gap-2">
            {loading ? <Spinner size={4} /> : 'Set New Password'}
          </button>
        </div>
      </div>
    </div>
  )
}
