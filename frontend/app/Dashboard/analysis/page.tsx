'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import DashSidebar from '@/components/dashboard/DashSidebar'
import { Spinner, ScoreBadge, StatusBadge } from '@/components/ui/Shared'
import { useAuth } from '@/hooks/useAuth'
import { appsApi, detectApi, ApiError, type App, type ScanLog } from '@/lib/api'

export default function Analysis() {
  const { user, loading: authLoading } = useAuth()
  const params = useSearchParams()
  const [apps, setApps] = useState<App[]>([])
  const [selApp, setSelApp] = useState<number | null>(null)
  const [stats, setStats] = useState<{ total_requests: number; blocked: number; allowed: number; block_rate: number; avg_risk_score: number; attack_breakdown: { attack_type: string; count: number }[] } | null>(null)
  const [logs, setLogs] = useState<ScanLog[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    appsApi.list().then(a => {
      setApps(a)
      const qId = params.get('app_id')
      if (qId) setSelApp(Number(qId))
      else if (a.length) setSelApp(a[0].id)
    }).catch(() => {})
  }, [params])

  useEffect(() => {
    if (!selApp) return
    setLoading(true)
    Promise.all([detectApi.analysis(selApp), detectApi.logs(selApp, 50)])
      .then(([s, l]) => { setStats(s); setLogs(l) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [selApp])

  if (authLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size={8} /></div>

  return (
    <div className="flex min-h-screen bg-bg">
      <DashSidebar userName={user?.name || ''} isAdmin={user?.is_admin || false} />
      <main className="flex-1 flex flex-col pt-14 md:pt-0">
        <header className="hidden md:flex h-16 border-b border-border px-6 items-center bg-card/50 flex-shrink-0">
          <h1 className="font-display text-xl tracking-widest text-white">ANALYSIS</h1>
        </header>
        <div className="flex-1 p-4 md:p-6 space-y-5 overflow-auto">
          {/* App selector */}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setSelApp(null)}
              className={`px-4 py-2 text-xs font-mono rounded-xl border transition-all ${selApp === null ? 'bg-accent text-bg font-bold border-accent' : 'border-border text-gray-400 hover:border-accent/40'}`}>
              All Apps
            </button>
            {apps.map(a => (
              <button key={a.id} onClick={() => setSelApp(a.id)}
                className={`px-4 py-2 text-xs font-mono rounded-xl border transition-all ${selApp === a.id ? 'bg-accent text-bg font-bold border-accent' : 'border-border text-gray-400 hover:border-accent/40'}`}>
                {a.name}
              </button>
            ))}
          </div>

          {loading ? <div className="flex justify-center py-20"><Spinner size={8} /></div> : stats ? (
            <>
              {/* Stat cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { label: 'Total Requests', val: stats.total_requests.toLocaleString(), color: '#00ff41' },
                  { label: 'Blocked', val: stats.blocked.toLocaleString(), color: '#ff3b3b' },
                  { label: 'Allowed', val: stats.allowed.toLocaleString(), color: '#00ff88' },
                  { label: 'Block Rate', val: `${stats.block_rate}%`, color: stats.block_rate > 30 ? '#ff3b3b' : '#ffaa00' },
                ].map(s => (
                  <div key={s.label} className="card p-4 card-hover">
                    <div className="text-[10px] font-mono text-gray-500 mb-2">{s.label.toUpperCase()}</div>
                    <div className="font-display text-3xl tracking-wider" style={{ color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>

              {/* Attack breakdown */}
              {stats.attack_breakdown.length > 0 && (
                <div className="card p-5">
                  <h3 className="text-sm font-sans font-semibold text-white mb-4">Attack Type Breakdown</h3>
                  <div className="space-y-3">
                    {stats.attack_breakdown.map(a => (
                      <div key={a.attack_type}>
                        <div className="flex justify-between text-xs font-mono mb-1">
                          <span className="text-gray-400">{a.attack_type || 'None'}</span>
                          <span className="text-danger">{a.count}</span>
                        </div>
                        <div className="bar">
                          <div className="bar-fill bg-danger" style={{ width: `${Math.min((a.count / (stats.total_requests || 1)) * 100, 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Logs table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-3 border-b border-border flex items-center justify-between">
                  <h3 className="text-sm font-sans font-semibold text-white">Recent Logs</h3>
                  <span className="text-xs font-mono text-gray-500">{logs.length} entries</span>
                </div>
                {logs.length === 0 ? (
                  <div className="text-center py-10 font-mono text-sm text-gray-500">No logs yet.</div>
                ) : (
                  <table className="w-full text-xs font-mono">
                    <thead><tr className="border-b border-border bg-muted/20">
                      {['Prompt','Score','Attack','Status','Source','Time'].map(h => (
                        <th key={h} className="text-left py-3 px-4 text-gray-500 font-normal">{h}</th>
                      ))}
                    </tr></thead>
                    <tbody>
                      {logs.map(l => (
                        <tr key={l.id} className={`border-b border-border/50 hover:bg-muted/10 ${l.blocked ? 'row-blocked' : ''}`}>
                          <td className="py-2.5 px-4 max-w-[160px] truncate text-gray-300" title={l.prompt}>{l.prompt.slice(0,45)}{l.prompt.length>45&&'…'}</td>
                          <td className="py-2.5 px-4"><ScoreBadge score={l.risk_score} /></td>
                          <td className="py-2.5 px-4 text-gray-400">{l.attack_type || 'None'}</td>
                          <td className="py-2.5 px-4"><StatusBadge blocked={l.blocked} /></td>
                          <td className="py-2.5 px-4 text-gray-500">{l.endpoint}</td>
                          <td className="py-2.5 px-4 text-gray-500 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          ) : (
            <div className="card p-12 text-center font-mono text-sm text-gray-500">Select an app to view analysis.</div>
          )}
        </div>
      </main>
    </div>
  )
}
