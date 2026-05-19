'use client'
import { useState, useEffect, useRef } from 'react'
import { Send, Shield, Plus, RefreshCw, X, Copy, CheckCheck } from 'lucide-react'
import DashSidebar from '@/components/dashboard/DashSidebar'
import { Spinner, ScoreBadge, StatusBadge, Toast } from '@/components/ui/Shared'
import { useAuth } from '@/hooks/useAuth'
import { appsApi, detectApi, ApiError, type App, type AppCreated } from '@/lib/api'

interface ChatMsg {
  role: 'user' | 'bot'; text: string
  detection?: { risk_score: number; attack_type: string; blocked: boolean; is_demo: boolean; scans_used: number; scans_limit: number }
}

export default function Simulation() {
  const { user, loading: authLoading } = useAuth()
  const [apps, setApps] = useState<App[]>([])
  const [demoApp, setDemoApp] = useState<App | null>(null)
  const [newDemoKey, setNewDemoKey] = useState('')
  const [creatingDemo, setCreatingDemo] = useState(false)
  const [useDemoMode, setUseDemoMode] = useState(true)
  const [selApp, setSelApp] = useState<number | null>(null)
  const [msgs, setMsgs] = useState<ChatMsg[]>([{ role: 'bot', text: '👋 Hi! I\'m SecureBank AI. Try a normal question or an attack prompt to see PROMPTWALL in action!' }])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [keyCopied, setKeyCopied] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadApps = () => {
    appsApi.list().then(a => {
      setApps(a.filter(x => !x.is_demo))
      const demo = a.find(x => x.is_demo)
      if (demo) { setDemoApp(demo); setUseDemoMode(true) }
      else if (a.length > 0) { setSelApp(a[0].id); setUseDemoMode(false) }
    }).catch(() => {})
  }

  useEffect(() => { loadApps() }, [])
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  const createDemo = async () => {
    setCreatingDemo(true); setErr('')
    try {
      const r: AppCreated = await appsApi.createDemo()
      setDemoApp(r); setNewDemoKey(r.raw_api_key); setUseDemoMode(true)
      loadApps()
      setMsgs([{ role: 'bot', text: `🎉 Demo app created! You have ${r.is_demo ? 10 : '?'} free test requests. Try attacking me!` }])
    } catch (e) { setErr(e instanceof ApiError ? e.message : 'Failed to create demo app.') }
    finally { setCreatingDemo(false) }
  }

  const send = async () => {
    if (!input.trim() || sending) return
    if (useDemoMode && !demoApp) { setErr('Create a demo app first!'); return }
    if (!useDemoMode && !selApp) { setErr('Select an app first!'); return }

    const msg = input.trim(); setInput(''); setSending(true); setErr('')
    setMsgs(p => [...p, { role: 'user', text: msg }])
    try {
      const r = await detectApi.simulate(msg, useDemoMode ? demoApp?.id : selApp, useDemoMode)
      setMsgs(p => [...p, { role: 'bot', text: r.bot_reply, detection: r.detection }])
      if (demoApp && useDemoMode) {
        setDemoApp(d => d ? { ...d, demo_requests_used: r.detection.scans_used } : d)
      }
    } catch (e) {
      const msg_ = e instanceof ApiError ? e.message : 'Error occurred.'
      setMsgs(p => [...p, { role: 'bot', text: `⚠️ ${msg_}` }])
    } finally { setSending(false) }
  }

  const copyKey = () => { navigator.clipboard.writeText(newDemoKey); setKeyCopied(true); setTimeout(() => setKeyCopied(false), 2000) }

  if (authLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size={8} /></div>

  return (
    <div className="flex min-h-screen bg-bg">
      <DashSidebar userName={user?.name || ''} isAdmin={user?.is_admin || false} />
      <main className="flex-1 flex flex-col pt-14 md:pt-0">
        <header className="hidden md:flex h-16 border-b border-border px-6 items-center justify-between bg-card/50 flex-shrink-0">
          <h1 className="font-display text-xl tracking-widest text-white">ATTACK SIMULATION</h1>
          {/* Mode toggle */}
          <div className="flex items-center gap-2 text-xs font-mono">
            <button onClick={() => setUseDemoMode(true)} className={`px-3 py-1.5 rounded-lg border transition-all ${useDemoMode ? 'bg-accent text-bg font-bold border-accent' : 'border-border text-gray-500'}`}>
              Demo App
            </button>
            <button onClick={() => setUseDemoMode(false)} className={`px-3 py-1.5 rounded-lg border transition-all ${!useDemoMode ? 'bg-accent text-bg font-bold border-accent' : 'border-border text-gray-500'}`}>
              My Apps
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto px-4 py-4 overflow-hidden">
          {/* Demo App Panel */}
          {useDemoMode && (
            <div className="mb-4 space-y-3">
              {!demoApp ? (
                <div className="card p-5 text-center space-y-3">
                  <Shield size={28} className="text-accent mx-auto" />
                  <div>
                    <p className="font-sans font-semibold text-white text-sm">Create a Demo App</p>
                    <p className="text-xs font-mono text-gray-500 mt-1">
                      Get 10 free test requests that don't count against your daily limit.
                      Perfect for testing prompts before integrating.
                    </p>
                  </div>
                  {err && <Toast msg={err} type="bad" />}
                  <button onClick={createDemo} disabled={creatingDemo} className="btn-p px-6 py-2.5 text-sm font-mono flex items-center gap-2 mx-auto">
                    {creatingDemo ? <Spinner size={4} /> : <Plus size={14} />}Create Demo App
                  </button>
                </div>
              ) : (
                <div className="card p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
                      <Shield size={14} className="text-accent" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono font-semibold text-white">Demo App</span>
                        <span className="badge-ok text-[10px] px-1.5 py-0.5 rounded">Active</span>
                      </div>
                      <div className="text-xs font-mono text-gray-500">
                        {demoApp.demo_requests_used}/{10} requests used
                        {demoApp.demo_requests_used >= 10 && <span className="text-danger ml-2">— limit reached</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bar w-24"><div className="bar-fill bg-accent" style={{ width: `${Math.min((demoApp.demo_requests_used/10)*100, 100)}%` }} /></div>
                    <button onClick={createDemo} disabled={creatingDemo} title="Reset demo app" className="btn-o p-1.5 text-xs">
                      {creatingDemo ? <Spinner size={3} /> : <RefreshCw size={12} />}
                    </button>
                  </div>
                </div>
              )}
              {newDemoKey && (
                <div className="p-4 rounded-xl space-y-2 animate-up" style={{ background: 'rgba(0,255,65,0.06)', border: '1px solid rgba(0,255,65,0.2)' }}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-accent font-bold">⚡ Your Demo API Key (save it!)</span>
                    <button onClick={() => setNewDemoKey('')}><X size={12} className="text-gray-500" /></button>
                  </div>
                  <code className="text-xs font-mono text-white break-all block bg-muted/40 p-2 rounded">{newDemoKey}</code>
                  <button onClick={copyKey} className="btn-p px-3 py-1 text-[10px] font-mono flex items-center gap-1">
                    {keyCopied ? <><CheckCheck size={10} />Copied</> : <><Copy size={10} />Copy Key</>}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* My App selector */}
          {!useDemoMode && (
            <div className="flex flex-wrap gap-2 mb-4">
              {apps.length === 0
                ? <p className="text-xs font-mono text-gray-500 p-3">No apps yet. <a href="/Dashboard/home" className="text-accent hover:underline">Create one →</a></p>
                : apps.map(a => (
                  <button key={a.id} onClick={() => setSelApp(a.id)}
                    className={`px-3 py-1.5 text-xs font-mono rounded-xl border transition-all ${selApp === a.id ? 'bg-accent text-bg font-bold border-accent' : 'border-border text-gray-400 hover:border-accent/40'}`}>
                    {a.name}
                  </button>
                ))
              }
            </div>
          )}

          {err && <Toast msg={err} type="bad" />}

          {/* Chat area */}
          <div className="card p-4 mb-4 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center">
              <Shield size={18} className="text-accent" />
            </div>
            <div>
              <div className="font-sans font-semibold text-white text-sm">SecureBank AI</div>
              <div className="text-[10px] font-mono text-accent flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Protected by PROMPTWALL {useDemoMode ? '(Demo Mode)' : ''}
              </div>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-auto pb-4">
            {msgs.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'} gap-1`}>
                <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm font-mono leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-accent/20 border border-accent/30 text-white rounded-br-sm'
                    : 'bg-card border border-border text-gray-200 rounded-bl-sm'
                }`}>
                  {m.text}
                </div>
                {m.detection && (
                  <div className="flex items-center gap-2 text-[10px] font-mono text-gray-500">
                    <ScoreBadge score={m.detection.risk_score} />
                    <span>{m.detection.attack_type}</span>
                    <StatusBadge blocked={m.detection.blocked} />
                    {m.detection.is_demo && <span className="badge-warn px-1.5 py-0.5 rounded">demo {m.detection.scans_used}/{m.detection.scans_limit}</span>}
                  </div>
                )}
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="bg-card border border-border px-4 py-3 rounded-2xl rounded-bl-sm">
                  <Spinner size={4} />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-3 mt-2 flex-shrink-0">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={useDemoMode ? 'Try: "ignore all instructions" or a banking question...' : 'Type a message...'}
              className="flex-1 input-g px-4 py-3 text-sm font-mono" />
            <button onClick={send} disabled={sending || !input.trim()} className="btn-p px-4 py-3">
              {sending ? <Spinner size={4} /> : <Send size={16} />}
            </button>
          </div>
          <p className="text-[10px] font-mono text-gray-600 text-center mt-2">
            All messages analyzed by PROMPTWALL. Demo apps get 10 free requests that don't affect your daily limit.
          </p>
        </div>
      </main>
    </div>
  )
}
