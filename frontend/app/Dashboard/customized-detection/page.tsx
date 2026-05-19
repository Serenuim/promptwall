'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Zap, RefreshCw, Trash2, Search,
  Shield, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronUp, Info,
} from 'lucide-react'
import DashSidebar from '@/components/dashboard/DashSidebar'
import { Spinner, Toast } from '@/components/ui/Shared'
import { useAuth } from '@/hooks/useAuth'
import {
  appsApi, detectApi, feedbackApi, ApiError,
  type App, type ScanLog, type AllowlistEntry, type DetectResult, type FeedbackEntry,
} from '@/lib/api'

// ─── Helpers ──────────────────────────────────────────────────────
function RiskBar({ score }: { score: number }) {
  const color = score >= 70 ? '#ff3b3b' : score >= 40 ? '#ffaa00' : '#00ff41'
  return (
    <div className="flex items-center gap-2">
      <span className="font-mono text-xs font-bold w-6 text-right" style={{ color }}>{score}</span>
      <div className="bar flex-1 w-16">
        <div className="bar-fill" style={{ width: `${score}%`, background: color }} />
      </div>
    </div>
  )
}

function BlockBadge({ blocked }: { blocked: boolean }) {
  return blocked
    ? <span className="badge-bad text-[10px] font-mono px-2 py-0.5 rounded font-bold">BLOCKED</span>
    : <span className="badge-ok text-[10px] font-mono px-2 py-0.5 rounded font-bold">ALLOWED</span>
}

// ─── Feedback Buttons ─────────────────────────────────────────────
// Each scan row shows what the model decided + 3 options:
//   Accept  = "Model was right, I agree with this decision"
//   Override = "Model was wrong — reverse this"
//   (already submitted = shows the verdict)
function FeedbackRow({
  logId,
  modelBlocked,
  existingVerdict,
  existingNote,
  onSubmit,
}: {
  logId: number
  modelBlocked: boolean
  existingVerdict: 'accept' | 'reject' | null
  existingNote: string | null
  onSubmit: (verdict: 'accept' | 'reject', note: string) => Promise<void>
}) {
  const [loading, setLoading] = useState<'accept' | 'reject' | null>(null)
  const [showNoteBox, setShowNoteBox] = useState(false)
  const [note, setNote] = useState('')
  const [pendingVerdict, setPendingVerdict] = useState<'accept' | 'reject' | null>(null)

  const doSubmit = async (verdict: 'accept' | 'reject', noteText: string) => {
    setLoading(verdict)
    try {
      await onSubmit(verdict, noteText)
    } finally {
      setLoading(null)
      setShowNoteBox(false)
      setNote('')
      setPendingVerdict(null)
    }
  }

  const clickVerdict = (verdict: 'accept' | 'reject') => {
    setPendingVerdict(verdict)
    setShowNoteBox(true)
  }

  // Already submitted
  if (existingVerdict) {
    return (
      <div className="space-y-1">
        <div className={`flex items-center gap-1.5 text-[10px] font-mono ${existingVerdict === 'accept' ? 'text-accent' : 'text-danger'}`}>
          {existingVerdict === 'accept'
            ? <><CheckCircle size={11} />You accepted this decision</>
            : <><XCircle size={11} />You flagged this decision</>
          }
        </div>
        {existingNote && <p className="text-[10px] font-mono text-gray-600 ml-4">{existingNote}</p>}
        <button onClick={() => { setShowNoteBox(true); setPendingVerdict(null) }} className="text-[10px] font-mono text-gray-600 hover:text-gray-400 ml-4 underline">
          Change
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {/* Explanation */}
      <p className="text-[10px] font-mono text-gray-600 leading-relaxed">
        Model said: <span className={modelBlocked ? 'text-danger font-bold' : 'text-accent font-bold'}>{modelBlocked ? 'BLOCK' : 'ALLOW'}</span>.
        {' '}Do you agree?
      </p>

      {!showNoteBox ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => clickVerdict('accept')}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border border-accent/30 text-accent/80 hover:bg-accent/10 hover:border-accent/60 transition-all disabled:opacity-40"
          >
            {loading === 'accept' ? <Spinner size={2} /> : <CheckCircle size={10} />}
            Accept decision
          </button>
          <button
            onClick={() => clickVerdict('reject')}
            disabled={!!loading}
            className="flex items-center gap-1.5 text-[10px] font-mono px-3 py-1.5 rounded-lg border border-danger/30 text-danger/80 hover:bg-danger/10 hover:border-danger/60 transition-all disabled:opacity-40"
          >
            {loading === 'reject' ? <Spinner size={2} /> : <XCircle size={10} />}
            Override decision
          </button>
        </div>
      ) : (
        <div className="space-y-2 p-3 rounded-xl border border-border bg-muted/20 animate-up">
          <p className="text-[10px] font-mono text-gray-400">
            {pendingVerdict === 'accept'
              ? '✓ Accepting — add a note (optional):'
              : '✗ Overriding — why was the model wrong? (optional):'}
          </p>
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && pendingVerdict && doSubmit(pendingVerdict, note)}
            placeholder="Add a note for training context..."
            className="w-full input-g py-1.5 px-3 text-xs"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              onClick={() => pendingVerdict && doSubmit(pendingVerdict, note)}
              disabled={!!loading}
              className={`flex-1 py-1.5 text-xs font-mono rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                pendingVerdict === 'accept'
                  ? 'btn-p'
                  : 'bg-danger text-white hover:bg-red-400'
              }`}
            >
              {loading ? <Spinner size={3} /> : null}
              {pendingVerdict === 'accept' ? 'Confirm Accept' : 'Confirm Override'}
            </button>
            <button
              onClick={() => { setShowNoteBox(false); setPendingVerdict(null); setNote('') }}
              className="px-4 py-1.5 text-xs font-mono text-gray-500 hover:text-white border border-border rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Expandable log row ───────────────────────────────────────────
function LogRow({
  log,
  existingFeedback,
  onFeedback,
  onWhitelist,
}: {
  log: ScanLog
  existingFeedback: FeedbackEntry | null
  onFeedback: (logId: number, verdict: 'accept' | 'reject', note: string) => Promise<void>
  onWhitelist: (log: ScanLog) => void
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <>
      {/* Summary row */}
      <tr
        className={`border-b border-border/50 hover:bg-muted/10 transition-colors cursor-pointer ${log.blocked ? 'row-blocked' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap text-[11px]">
          {new Date(log.created_at).toLocaleString()}
        </td>
        <td className="py-2.5 px-3 text-gray-300 max-w-[180px] md:max-w-[280px]">
          <span className="truncate block text-xs">{log.prompt.slice(0, 60)}{log.prompt.length > 60 && '…'}</span>
        </td>
        <td className="py-2.5 px-3 whitespace-nowrap">
          <RiskBar score={log.risk_score} />
        </td>
        <td className="py-2.5 px-3 text-gray-400 whitespace-nowrap text-[11px]">
          {log.attack_type || 'None'}
        </td>
        <td className="py-2.5 px-3 whitespace-nowrap">
          <BlockBadge blocked={log.blocked} />
        </td>
        <td className="py-2.5 px-3 whitespace-nowrap">
          {existingFeedback ? (
            <span className={`flex items-center gap-1 text-[10px] font-mono ${existingFeedback.verdict === 'accept' ? 'text-accent' : 'text-danger'}`}>
              {existingFeedback.verdict === 'accept'
                ? <><CheckCircle size={10} />Accepted</>
                : <><XCircle size={10} />Overridden</>
              }
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[10px] font-mono text-gray-600">
              <Clock size={10} />Pending
            </span>
          )}
        </td>
        <td className="py-2.5 px-3">
          {expanded ? <ChevronUp size={13} className="text-gray-500" /> : <ChevronDown size={13} className="text-gray-500" />}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className={`border-b border-border ${log.blocked ? 'row-blocked' : ''}`}>
          <td colSpan={7} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Left: full prompt + model details */}
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] font-mono text-gray-500 mb-1 tracking-wider">FULL PROMPT</p>
                  <div className="code-block p-3 text-xs font-mono text-gray-300 leading-relaxed whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                    {log.prompt}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-mono text-gray-500 mb-1">MODEL DECISION</p>
                    <BlockBadge blocked={log.blocked} />
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-mono text-gray-500 mb-1">ATTACK TYPE</p>
                    <p className="text-xs font-mono text-white">{log.attack_type || 'None'}</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-mono text-gray-500 mb-1">RISK SCORE</p>
                    <p className="font-display text-2xl" style={{ color: log.risk_score >= 70 ? '#ff3b3b' : log.risk_score >= 40 ? '#ffaa00' : '#00ff41' }}>
                      {log.risk_score}<span className="text-sm text-gray-500">/100</span>
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-3 border border-border">
                    <p className="text-[10px] font-mono text-gray-500 mb-1">SOURCE</p>
                    <p className="text-xs font-mono text-gray-300 capitalize">{log.endpoint}</p>
                  </div>
                </div>
                {log.allowlist_override && (
                  <div className="badge-warn text-[10px] font-mono px-3 py-1.5 rounded-lg">
                    ✓ Allowlist override was applied
                  </div>
                )}
                {log.blocked && !log.allowlist_override && (
                  <button onClick={() => onWhitelist(log)}
                    className="text-[10px] font-mono badge-warn px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity">
                    + Add to allowlist for this app
                  </button>
                )}
              </div>

              {/* Right: feedback / audit */}
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                  <div className="flex items-center gap-2">
                    <Info size={13} className="text-accent flex-shrink-0" />
                    <p className="text-xs font-sans font-semibold text-white">Your Audit Decision</p>
                  </div>
                  <p className="text-[11px] font-mono text-gray-500 leading-relaxed">
                    Different apps have different rules. Tell the model whether its decision
                    was correct for <em>your</em> use case. This gets collected and exported
                    for retraining so the model learns your app&apos;s specific requirements.
                  </p>
                  <FeedbackRow
                    logId={log.id}
                    modelBlocked={log.blocked}
                    existingVerdict={existingFeedback?.verdict ?? null}
                    existingNote={existingFeedback?.note ?? null}
                    onSubmit={(verdict, note) => onFeedback(log.id, verdict, note)}
                  />
                </div>

                {existingFeedback && (
                  <div className="text-[10px] font-mono text-gray-600 space-y-0.5">
                    <p>Feedback submitted: {new Date(existingFeedback.feedback_at).toLocaleString()}</p>
                    {existingFeedback.note && <p>Note: {existingFeedback.note}</p>}
                  </div>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ─── Main Page ────────────────────────────────────────────────────
export default function CustomizedDetection() {
  const { user, loading: authLoading } = useAuth()
  const params = useSearchParams()

  const [apps, setApps] = useState<App[]>([])
  const [selApp, setSelApp] = useState<number | null>(null)
  const [tab, setTab] = useState<'scan' | 'audit' | 'allowlist'>('scan')

  // Scan state
  const [prompt, setPrompt] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState<DetectResult | null>(null)
  const [scanFbDone, setScanFbDone] = useState<'accept' | 'reject' | null>(null)

  // Audit state
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [feedbackMap, setFeedbackMap] = useState<Record<number, FeedbackEntry>>({})
  const [logSearch, setLogSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'accepted' | 'overridden'>('all')
  const [loadingLogs, setLoadingLogs] = useState(false)

  // Allowlist state
  const [allowlist, setAllowlist] = useState<AllowlistEntry[]>([])

  const [toast, setToast] = useState({ msg: '', type: 'ok' as 'ok' | 'bad' })
  const showToast = (msg: string, type: 'ok' | 'bad' = 'ok') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg: '', type: 'ok' }), 4000)
  }

  // Load apps
  useEffect(() => {
    appsApi.list().then(a => {
      const real = a.filter(x => !x.is_demo)
      setApps(real)
      const qId = params.get('app_id')
      if (qId) setSelApp(Number(qId))
      else if (real.length > 0) setSelApp(real[0].id)
    }).catch(() => {})
  }, [params])

  // Load logs + feedback + allowlist whenever app changes
  const loadData = useCallback(async () => {
    if (!selApp) return
    setLoadingLogs(true)
    const [l, al, fb] = await Promise.all([
      detectApi.logs(selApp, 200).catch(() => [] as ScanLog[]),
      detectApi.allowlist(selApp).catch(() => [] as AllowlistEntry[]),
      feedbackApi.list(selApp).catch(() => [] as FeedbackEntry[]),
    ])
    setLogs(l)
    setAllowlist(al)
    // Build map: scan_log_id -> FeedbackEntry
    const fm: Record<number, FeedbackEntry> = {}
    fb.forEach(f => { fm[f.scan_log_id] = f })
    setFeedbackMap(fm)
    setLoadingLogs(false)
  }, [selApp])

  useEffect(() => { loadData() }, [loadData])

  // Submit scan
  const scan = async () => {
    if (!prompt.trim() || !selApp) return
    setScanning(true)
    setScanResult(null)
    setScanFbDone(null)
    try {
      const r = await detectApi.scan(prompt, selApp)
      setScanResult(r)
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : 'Scan failed. Is the backend running?', 'bad')
    } finally { setScanning(false) }
  }

  // Submit feedback
  const submitFeedback = async (logId: number, verdict: 'accept' | 'reject', note: string) => {
    await feedbackApi.submit(logId, verdict, note || undefined)
    setFeedbackMap(p => ({
      ...p,
      [logId]: {
        feedback_id: Date.now(),
        scan_log_id: logId,
        verdict,
        note: note || null,
        feedback_at: new Date().toISOString(),
        prompt: '',
        risk_score: 0,
        attack_type: null,
        blocked: false,
      },
    }))
    showToast(verdict === 'accept' ? '✓ Decision accepted — logged for training.' : '✓ Override recorded — logged for training.', 'ok')
  }

  // Whitelist a blocked prompt
  const whitelistLog = async (log: ScanLog) => {
    if (!selApp) return
    const pattern = log.prompt.slice(0, 80)
    await detectApi.addAllow(selApp, pattern, `Whitelisted from audit log #${log.id}`)
    showToast('Pattern added to allowlist.')
    loadData()
  }

  // Filter logic
  const filteredLogs = logs.filter(l => {
    const matchSearch =
      l.prompt.toLowerCase().includes(logSearch.toLowerCase()) ||
      (l.attack_type || '').toLowerCase().includes(logSearch.toLowerCase())
    if (!matchSearch) return false
    if (filterStatus === 'pending') return !feedbackMap[l.id]
    if (filterStatus === 'accepted') return feedbackMap[l.id]?.verdict === 'accept'
    if (filterStatus === 'overridden') return feedbackMap[l.id]?.verdict === 'reject'
    return true
  })

  const pendingCount = logs.filter(l => !feedbackMap[l.id]).length
  const acceptedCount = Object.values(feedbackMap).filter(f => f.verdict === 'accept').length
  const overriddenCount = Object.values(feedbackMap).filter(f => f.verdict === 'reject').length

  if (authLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size={8} /></div>

  return (
    <div className="flex min-h-screen bg-bg">
      <DashSidebar userName={user?.name || ''} isAdmin={user?.is_admin || false} />

      <main className="flex-1 flex flex-col min-w-0 pt-14 md:pt-0">
        <header className="hidden md:flex h-16 border-b border-border px-6 items-center bg-card/50 flex-shrink-0">
          <h1 className="font-display text-xl tracking-widest text-white">DETECTION & AUDIT</h1>
        </header>

        <div className="flex-1 p-4 md:p-6 space-y-5 overflow-auto">

          {/* No apps */}
          {apps.length === 0 ? (
            <div className="card p-10 text-center space-y-3">
              <Shield size={32} className="text-gray-600 mx-auto" />
              <p className="font-mono text-sm text-gray-500">No apps yet.</p>
              <a href="/Dashboard/home" className="text-accent text-xs font-mono hover:underline">Create an app first →</a>
            </div>
          ) : (
            <>
              {/* App selector */}
              <div className="flex flex-wrap gap-2">
                {apps.map(a => (
                  <button key={a.id} onClick={() => setSelApp(a.id)}
                    className={`px-4 py-2 text-xs font-mono rounded-xl border transition-all ${
                      selApp === a.id
                        ? 'bg-accent text-bg font-bold border-accent'
                        : 'border-border text-gray-400 hover:border-accent/40 hover:text-white'
                    }`}>
                    {a.name}
                    {!a.is_active && <span className="ml-1 opacity-50">(revoked)</span>}
                  </button>
                ))}
              </div>

              {/* Tabs */}
              <div className="flex gap-0.5 bg-muted/30 p-1 rounded-xl w-fit">
                {([
                  ['scan', 'Manual Scan'],
                  ['audit', `Audit Log ${logs.length > 0 ? `(${pendingCount} pending)` : ''}`],
                  ['allowlist', `Allowlist (${allowlist.length})`],
                ] as [typeof tab, string][]).map(([t, label]) => (
                  <button key={t} onClick={() => setTab(t)}
                    className={`px-4 py-2 text-xs font-mono rounded-lg transition-all whitespace-nowrap ${
                      tab === t ? 'bg-accent text-bg font-bold' : 'text-gray-500 hover:text-gray-200'
                    }`}>
                    {label}
                  </button>
                ))}
              </div>

              {toast.msg && <Toast msg={toast.msg} type={toast.type} />}

              {/* ── MANUAL SCAN TAB ─────────────────────────── */}
              {tab === 'scan' && (
                <div className="grid lg:grid-cols-2 gap-5">
                  <div className="space-y-3">
                    <p className="text-xs font-mono text-gray-400">
                      Manually scan a prompt against your app&apos;s detection rules.
                    </p>
                    <textarea
                      value={prompt}
                      onChange={e => setPrompt(e.target.value)}
                      onKeyDown={e => { if (e.ctrlKey && e.key === 'Enter') scan() }}
                      placeholder="Type or paste a prompt to test... (Ctrl+Enter to scan)"
                      rows={7}
                      className="w-full input-g px-4 py-3 text-sm font-mono resize-none"
                    />
                    <button onClick={scan} disabled={scanning || !prompt.trim()}
                      className="w-full btn-p py-3 text-sm font-mono flex items-center justify-center gap-2">
                      {scanning ? <><Spinner size={4} />Analyzing...</> : <><Zap size={14} />Scan Prompt</>}
                    </button>
                  </div>

                  {scanResult && (
                    <div className="card p-5 space-y-4 animate-up">
                      {/* Result header */}
                      <div className={`flex items-center gap-3 p-4 rounded-xl ${
                        scanResult.blocked
                          ? 'bg-red-950/30 border border-red-800/25'
                          : 'bg-green-950/20 border border-green-800/20'
                      }`}>
                        <span className="text-3xl">{scanResult.blocked ? '🚫' : '✅'}</span>
                        <div>
                          <div className={`font-display text-2xl tracking-widest ${scanResult.blocked ? 'text-danger' : 'text-accent'}`}>
                            {scanResult.blocked ? 'BLOCKED' : 'ALLOWED'}
                          </div>
                          <div className="text-xs font-mono text-gray-500">{scanResult.attack_type}</div>
                        </div>
                      </div>

                      {/* Metrics */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-muted/40 rounded-xl p-3 border border-border">
                          <p className="text-[10px] font-mono text-gray-500 mb-1">RISK SCORE</p>
                          <div className={`font-display text-3xl ${scanResult.risk_score >= 70 ? 'text-danger' : scanResult.risk_score >= 40 ? 'text-warning' : 'text-accent'}`}>
                            {scanResult.risk_score}<span className="text-sm text-gray-500">/100</span>
                          </div>
                          <div className="bar mt-2">
                            <div className="bar-fill" style={{
                              width: `${scanResult.risk_score}%`,
                              background: scanResult.risk_score >= 70 ? '#ff3b3b' : scanResult.risk_score >= 40 ? '#ffaa00' : '#00ff41',
                            }} />
                          </div>
                        </div>
                        <div className="bg-muted/40 rounded-xl p-3 border border-border">
                          <p className="text-[10px] font-mono text-gray-500 mb-1">SCANS TODAY</p>
                          <div className="font-display text-3xl text-white">
                            {scanResult.scans_used}<span className="text-sm text-gray-500">/{scanResult.scans_limit}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-xs font-mono text-gray-400 p-3 bg-muted/30 rounded-xl border border-border leading-relaxed">
                        {scanResult.explanation}
                      </p>

                      {scanResult.allowlist_override && (
                        <div className="badge-warn text-xs font-mono px-3 py-1.5 rounded-lg">
                          ✓ Allowlist override applied
                        </div>
                      )}

                      {/* Audit feedback on manual scan */}
                      {scanResult.log_id && (
                        <div className="pt-3 border-t border-border">
                          <p className="text-[10px] font-mono text-gray-500 mb-3 tracking-wider">AUDIT YOUR DECISION</p>
                          <FeedbackRow
                            logId={scanResult.log_id}
                            modelBlocked={scanResult.blocked}
                            existingVerdict={scanFbDone}
                            existingNote={null}
                            onSubmit={async (verdict, note) => {
                              await feedbackApi.submit(scanResult.log_id!, verdict, note || undefined)
                              setScanFbDone(verdict)
                              showToast('✓ Audit decision saved.', 'ok')
                            }}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── AUDIT LOG TAB ────────────────────────────── */}
              {tab === 'audit' && (
                <div className="space-y-4">
                  {/* Explanation banner */}
                  <div className="card p-4 space-y-2">
                    <div className="flex items-start gap-2.5">
                      <Info size={14} className="text-accent flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-xs font-sans font-semibold text-white">What is the Audit Log?</p>
                        <p className="text-xs font-mono text-gray-500 leading-relaxed">
                          Every request your app receives is logged here. Since different apps have different rules,
                          you can review what the model decided and confirm or override each decision.
                          Your feedback is collected and exported by the admin for model retraining —
                          so the model learns <em>your app&apos;s specific rules</em> over time.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: 'Total', val: logs.length, color: '#fff' },
                      { label: 'Pending review', val: pendingCount, color: '#ffaa00' },
                      { label: 'Accepted', val: acceptedCount, color: '#00ff41' },
                      { label: 'Overridden', val: overriddenCount, color: '#ff3b3b' },
                    ].map(s => (
                      <div key={s.label} className="card p-3 text-center">
                        <div className="font-display text-2xl tracking-wider" style={{ color: s.color }}>{s.val}</div>
                        <div className="text-[10px] font-mono text-gray-500 mt-0.5">{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Filters */}
                  <div className="flex gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[160px]">
                      <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                      <input value={logSearch} onChange={e => setLogSearch(e.target.value)}
                        placeholder="Search prompts or attack types..."
                        className="w-full input-g pl-9 py-2 text-sm" />
                    </div>
                    <div className="flex gap-1 bg-muted/30 p-1 rounded-xl">
                      {(['all', 'pending', 'accepted', 'overridden'] as const).map(f => (
                        <button key={f} onClick={() => setFilterStatus(f)}
                          className={`px-3 py-1.5 text-[10px] font-mono rounded-lg capitalize transition-all ${
                            filterStatus === f ? 'bg-accent text-bg font-bold' : 'text-gray-500 hover:text-gray-200'
                          }`}>
                          {f}
                        </button>
                      ))}
                    </div>
                    <button onClick={loadData} disabled={loadingLogs}
                      className="btn-o px-3 py-2 text-xs font-mono flex items-center gap-1.5">
                      {loadingLogs ? <Spinner size={3} /> : <RefreshCw size={12} />}
                    </button>
                  </div>

                  {/* Table */}
                  <div className="card overflow-hidden">
                    {loadingLogs ? (
                      <div className="flex justify-center py-12"><Spinner size={6} /></div>
                    ) : filteredLogs.length === 0 ? (
                      <div className="text-center py-12 space-y-2">
                        <p className="font-mono text-sm text-gray-500">
                          {logs.length === 0 ? 'No requests yet. Start scanning to see results here.' : 'No results match your filter.'}
                        </p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono">
                          <thead>
                            <tr className="border-b border-border bg-muted/20">
                              {['Time', 'Prompt', 'Risk', 'Attack Type', 'Model Decision', 'Your Verdict', ''].map(h => (
                                <th key={h} className="text-left py-3 px-3 text-gray-500 font-normal whitespace-nowrap">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredLogs.map(log => (
                              <LogRow
                                key={log.id}
                                log={log}
                                existingFeedback={feedbackMap[log.id] || null}
                                onFeedback={submitFeedback}
                                onWhitelist={whitelistLog}
                              />
                            ))}
                          </tbody>
                        </table>
                        <div className="px-4 py-2 border-t border-border text-[10px] font-mono text-gray-600">
                          Showing {filteredLogs.length} of {logs.length} requests · Click any row to expand and submit your audit verdict
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ALLOWLIST TAB ────────────────────────────── */}
              {tab === 'allowlist' && (
                <div className="space-y-4">
                  <div className="card p-4 text-xs font-mono text-gray-500 leading-relaxed">
                    <p className="font-semibold text-gray-300 mb-1">How the allowlist works</p>
                    If a prompt contains any listed pattern (case-insensitive match), the block is overridden.
                    Risk score is reduced by 50 and the scan is marked as &quot;Allowed (whitelisted)&quot;.
                    Each app has its own independent allowlist — rules for one app don&apos;t affect others.
                  </div>
                  <div className="card overflow-hidden">
                    {allowlist.length === 0 ? (
                      <div className="text-center py-12 font-mono text-sm text-gray-500">
                        No allowlist entries.
                        <p className="text-xs text-gray-600 mt-1">Expand any blocked request in the Audit Log to add it to the allowlist.</p>
                      </div>
                    ) : (
                      <table className="w-full text-xs font-mono">
                        <thead>
                          <tr className="border-b border-border bg-muted/20">
                            {['Pattern', 'Note', 'Added', ''].map(h => (
                              <th key={h} className="text-left py-3 px-4 text-gray-500 font-normal">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {allowlist.map(e => (
                            <tr key={e.id} className="border-b border-border/50 hover:bg-muted/10">
                              <td className="py-2.5 px-4 text-gray-300 max-w-[200px] truncate">{e.pattern}</td>
                              <td className="py-2.5 px-4 text-gray-500">{e.note || '—'}</td>
                              <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{new Date(e.created_at).toLocaleDateString()}</td>
                              <td className="py-2.5 px-4">
                                <button onClick={async () => { await detectApi.removeAllow(e.id).catch(() => {}); loadData() }}
                                  className="text-danger/50 hover:text-danger transition-colors">
                                  <Trash2 size={12} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
