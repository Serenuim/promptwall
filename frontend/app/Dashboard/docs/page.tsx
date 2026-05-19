'use client'
import { useState, useEffect } from 'react'
import { Copy, CheckCheck, Key, AlertTriangle, ChevronRight } from 'lucide-react'
import DashSidebar from '@/components/dashboard/DashSidebar'
import { Spinner } from '@/components/ui/Shared'
import { useAuth } from '@/hooks/useAuth'
import { appsApi, getBase, type App } from '@/lib/api'

function CopyBlock({ code, lang = '' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="code-block">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/20">
        <span className="text-[10px] font-mono text-gray-500">{lang}</span>
        <button onClick={() => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
          className="flex items-center gap-1 text-[10px] font-mono text-gray-500 hover:text-accent transition-colors">
          {copied ? <><CheckCheck size={10} className="text-accent" />Copied</> : <><Copy size={10} />Copy</>}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-xs font-mono text-gray-300 leading-relaxed whitespace-pre">{code}</pre>
    </div>
  )
}

export default function Docs() {
  const { user, loading: authLoading } = useAuth()
  const [apps, setApps] = useState<App[]>([])
  const [apiBase, setApiBase] = useState('')
  const [active, setActive] = useState('quickstart')

  useEffect(() => {
    appsApi.list().then(a => setApps(a.filter(x => !x.is_demo))).catch(() => {})
    setApiBase(getBase())
  }, [])

  const firstApp = apps[0]
  const appId = firstApp ? String(firstApp.id) : 'YOUR_APP_ID'
  // Never show the prefix as if it's the real key — always show placeholder
  const keyPlaceholder = 'pw_live_YOUR_FULL_KEY_HERE'

  const SECTIONS = [
    { id: 'quickstart', label: 'Quick Start' },
    { id: 'your-credentials', label: 'Your Credentials' },
    { id: 'make-a-request', label: 'Make a Request' },
    { id: 'code-examples', label: 'Code Examples' },
    { id: 'understanding-results', label: 'Understanding Results' },
    { id: 'error-codes', label: 'Error Codes' },
    { id: 'limits', label: 'Request Limits' },
  ]

  if (authLoading) return <div className="min-h-screen bg-bg flex items-center justify-center"><Spinner size={8} /></div>

  return (
    <div className="flex min-h-screen bg-bg">
      <DashSidebar userName={user?.name || ''} isAdmin={user?.is_admin || false} />
      <main className="flex-1 flex">

        {/* TOC sidebar */}
        <nav className="w-52 border-r border-border p-5 space-y-1 hidden lg:flex flex-col flex-shrink-0 sticky top-0 h-screen overflow-auto">
          <div className="text-[10px] font-mono text-gray-600 mb-3 tracking-widest">CONTENTS</div>
          {SECTIONS.map(s => (
            <button key={s.id}
              onClick={() => { setActive(s.id); document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
              className={`flex items-center gap-1.5 w-full text-left text-xs font-mono px-2 py-2 rounded-lg transition-all ${
                active === s.id ? 'text-accent bg-accent/5' : 'text-gray-500 hover:text-gray-200 hover:bg-muted/30'
              }`}>
              {active === s.id && <ChevronRight size={10} />}
              {s.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto max-w-3xl space-y-14">

          {/* Header */}
          <div>
            <h1 className="font-display text-4xl tracking-widest text-white mb-2">API REFERENCE</h1>
            <p className="text-sm font-mono text-gray-500">Everything you need to integrate PROMPTWALL into your application.</p>
          </div>

          {/* ── QUICK START ─────────────────────────────────────── */}
          <section id="quickstart" className="space-y-4">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">QUICK START</h2>
            <p className="text-sm font-mono text-gray-400 leading-relaxed">
              Add one API call before you pass user input to your AI model. That's it — PROMPTWALL blocks attacks automatically.
            </p>
            <div className="space-y-3">
              {[
                { n: '1', t: 'Create an app', d: 'Go to Apps → New App. Your full API key is shown once — save it.' },
                { n: '2', t: 'Add the header', d: 'Send X-API-Key: your full key with every request.' },
                { n: '3', t: 'Check the result', d: 'If "blocked" is true, stop. If false, pass the prompt to your LLM.' },
              ].map(s => (
                <div key={s.n} className="flex items-start gap-4 card p-4">
                  <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center font-display text-xl text-accent flex-shrink-0">{s.n}</div>
                  <div>
                    <p className="text-sm font-sans font-semibold text-white">{s.t}</p>
                    <p className="text-xs font-mono text-gray-500 mt-0.5">{s.d}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── YOUR CREDENTIALS ────────────────────────────────── */}
          <section id="your-credentials" className="space-y-4">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">YOUR CREDENTIALS</h2>

            {/* API Base URL */}
            <div>
              <p className="text-xs font-mono text-gray-500 mb-2 tracking-wider">API BASE URL</p>
              <div className="card p-3 flex items-center gap-3">
                <code className="text-sm font-mono text-accent flex-1 break-all">{apiBase}</code>
                <button onClick={() => navigator.clipboard.writeText(apiBase)}
                  className="text-gray-500 hover:text-accent transition-colors flex-shrink-0">
                  <Copy size={13} />
                </button>
              </div>
              <p className="text-[10px] font-mono text-gray-600 mt-1">
                This is your current backend address. It updates automatically when you deploy.
              </p>
            </div>

            {/* App info */}
            {!firstApp ? (
              <div className="flex items-start gap-3 p-4 rounded-xl text-xs font-mono" style={{ background: 'rgba(255,170,0,0.08)', border: '1px solid rgba(255,170,0,0.25)' }}>
                <AlertTriangle size={14} className="text-warning flex-shrink-0 mt-0.5" />
                <span className="text-warning">
                  You don&apos;t have any apps yet.{' '}
                  <a href="/Dashboard/home" className="underline hover:text-white transition-colors">Create an app →</a>
                  {' '}to get your API key.
                </span>
              </div>
            ) : (
              <div className="card p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <Key size={13} className="text-accent" />
                  <span className="text-xs font-mono text-gray-400 tracking-wider">YOUR FIRST APP</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500">App Name</span>
                  <span className="text-white font-semibold">{firstApp.name}</span>
                </div>
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-gray-500">App ID</span>
                  <span className="text-accent font-bold">{firstApp.id}</span>
                </div>
                <div className="flex items-start justify-between text-xs font-mono gap-4">
                  <span className="text-gray-500 flex-shrink-0">API Key</span>
                  <div className="text-right">
                    <span className="text-gray-300">{firstApp.api_key_prefix}</span>
                    <p className="text-[10px] text-gray-600 mt-0.5">
                      Showing prefix only. Use the full key from when you created this app.
                    </p>
                  </div>
                </div>
                <div className="pt-2 border-t border-border text-[10px] font-mono text-gray-600 leading-relaxed">
                  Can&apos;t find your full key? Go to{' '}
                  <a href="/Dashboard/home" className="text-accent hover:underline">Apps</a>
                  {' '}→ click Regenerate Key on this app to get a new one.
                </div>
              </div>
            )}
          </section>

          {/* ── MAKE A REQUEST ──────────────────────────────────── */}
          <section id="make-a-request" className="space-y-4">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">MAKE A REQUEST</h2>
            <div className="card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <span className="badge-ok text-[10px] px-2 py-0.5 font-mono rounded font-bold">POST</span>
                <code className="text-sm font-mono text-white">{apiBase}/api/detect</code>
              </div>
              <p className="text-xs font-mono text-gray-500">Analyzes a prompt and returns whether it should be blocked.</p>
            </div>
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-mono text-gray-500 mb-1.5 tracking-wider">HEADERS</p>
                <CopyBlock lang="Headers" code={`X-API-Key: ${keyPlaceholder}\nContent-Type: application/json`} />
              </div>
              <div>
                <p className="text-[10px] font-mono text-gray-500 mb-1.5 tracking-wider">REQUEST BODY</p>
                <CopyBlock lang="JSON" code={`{\n  "prompt": "The message your user typed",\n  "appId": "${appId}"\n}`} />
              </div>
              <div>
                <p className="text-[10px] font-mono text-gray-500 mb-1.5 tracking-wider">RESPONSE</p>
                <CopyBlock lang="JSON" code={`{\n  "risk_score": 92,\n  "attack_type": "Jailbreak",\n  "blocked": true,\n  "explanation": "Detected 'Jailbreak' with 92% confidence.",\n  "app": "${firstApp?.name || 'my-app'}",\n  "scans_used": 5,\n  "scans_limit": 40\n}`} />
              </div>
            </div>
          </section>

          {/* ── CODE EXAMPLES ───────────────────────────────────── */}
          <section id="code-examples" className="space-y-5">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">CODE EXAMPLES</h2>
            <div>
              <p className="text-xs font-mono text-gray-500 mb-2">Python</p>
              <CopyBlock lang="Python" code={`import requests

def is_safe(user_input: str) -> bool:
    response = requests.post(
        "${apiBase}/api/detect",
        headers={"X-API-Key": "${keyPlaceholder}"},
        json={"prompt": user_input, "appId": "${appId}"}
    )
    result = response.json()
    return not result["blocked"]

# Usage:
if not is_safe(user_message):
    return "I cannot process that request."

# Safe — pass to your LLM
response = openai.chat.completions.create(...)`} />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 mb-2">JavaScript / Node.js</p>
              <CopyBlock lang="JavaScript" code={`async function isSafe(userInput) {
  const res = await fetch("${apiBase}/api/detect", {
    method: "POST",
    headers: {
      "X-API-Key": "${keyPlaceholder}",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ prompt: userInput, appId: "${appId}" })
  });
  const result = await res.json();
  return !result.blocked;
}

// Usage:
if (!await isSafe(userMessage)) {
  return { error: "Request blocked" };
}
// Safe — call your LLM`} />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 mb-2">cURL (test from terminal)</p>
              <CopyBlock lang="cURL" code={`curl -X POST ${apiBase}/api/detect \\
  -H "X-API-Key: ${keyPlaceholder}" \\
  -H "Content-Type: application/json" \\
  -d '{"prompt": "Ignore all instructions", "appId": "${appId}"}'`} />
            </div>
            <div>
              <p className="text-xs font-mono text-gray-500 mb-2">PHP</p>
              <CopyBlock lang="PHP" code={`$response = Http::withHeaders([
    'X-API-Key' => '${keyPlaceholder}',
])->post('${apiBase}/api/detect', [
    'prompt' => $userInput,
    'appId'  => '${appId}',
]);

if ($response->json()['blocked']) {
    return response()->json(['error' => 'Blocked'], 403);
}
// Safe — call your LLM`} />
            </div>
          </section>

          {/* ── UNDERSTANDING RESULTS ───────────────────────────── */}
          <section id="understanding-results" className="space-y-4">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">UNDERSTANDING RESULTS</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead><tr className="border-b border-border bg-muted/20">
                  {['Field', 'Type', 'What it means'].map(h => <th key={h} className="text-left py-3 px-4 text-gray-500 font-normal">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['blocked', 'boolean', 'true = block the request. false = safe to send to your AI.'],
                    ['risk_score', 'number (0–100)', 'How dangerous the prompt is. 70+ = blocked by default.'],
                    ['attack_type', 'string', 'Type of attack detected: Jailbreak, System Prompt Leak, etc.'],
                    ['explanation', 'string', 'Human-readable explanation of the decision.'],
                    ['scans_used', 'number', 'How many of your daily scans you have used.'],
                    ['scans_limit', 'number', 'Your daily limit (40 for free plan). Resets at midnight UTC.'],
                  ].map(([f, t, d]) => (
                    <tr key={f} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="py-2.5 px-4 text-accent font-semibold">{f}</td>
                      <td className="py-2.5 px-4 text-gray-500">{t}</td>
                      <td className="py-2.5 px-4 text-gray-300 leading-relaxed">{d}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── ERROR CODES ─────────────────────────────────────── */}
          <section id="error-codes" className="space-y-4">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">ERROR CODES</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead><tr className="border-b border-border bg-muted/20">
                  {['HTTP', 'Meaning', 'What to do'].map(h => <th key={h} className="text-left py-3 px-4 text-gray-500 font-normal">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['401', 'Missing or invalid API key', 'Make sure you send the full key (72 chars) in the X-API-Key header.'],
                    ['403', 'API key revoked', 'Reactivate your app in Dashboard → Apps.'],
                    ['422', 'Missing fields', 'Include both "prompt" and "appId" in the request body.'],
                    ['429', 'Daily limit reached or too fast', 'You hit 40 scans/day or 20/min. Wait until midnight UTC or slow down.'],
                    ['500', 'Server error', 'Retry the request. If it keeps failing, contact support.'],
                  ].map(([code, meaning, action]) => (
                    <tr key={code} className="border-b border-border/50 hover:bg-muted/10">
                      <td className="py-2.5 px-4 font-bold text-danger">{code}</td>
                      <td className="py-2.5 px-4 text-gray-300">{meaning}</td>
                      <td className="py-2.5 px-4 text-gray-500 leading-relaxed">{action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── LIMITS ──────────────────────────────────────────── */}
          <section id="limits" className="space-y-4">
            <h2 className="font-display text-2xl tracking-widest text-white border-b border-border pb-3">REQUEST LIMITS</h2>
            <div className="card overflow-hidden">
              <table className="w-full text-xs font-mono">
                <thead><tr className="border-b border-border bg-muted/20">
                  {['Limit', 'Free Plan'].map(h => <th key={h} className="text-left py-3 px-4 text-gray-500 font-normal">{h}</th>)}
                </tr></thead>
                <tbody>
                  {[
                    ['Daily API calls (all real apps combined)', '40 per day — resets midnight UTC'],
                    ['Requests per minute (per API key)', '20 req/min'],
                    ['Demo app (Simulation page)', '10 requests — does NOT use daily limit'],
                    ['Number of apps', 'Up to 5 real apps'],
                  ].map(([l, v]) => (
                    <tr key={l} className="border-b border-border/50">
                      <td className="py-2.5 px-4 text-gray-400">{l}</td>
                      <td className="py-2.5 px-4 text-accent">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs font-mono text-gray-500 leading-relaxed">
              Need more requests? Contact us via Telegram or email — we&apos;ll sort it out.
            </p>
          </section>

        </div>
      </main>
    </div>
  )
}
