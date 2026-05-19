/**
 * PROMPTWALL — API Client
 * All calls to the FastAPI backend.
 * Reads NEXT_PUBLIC_API_URL from environment — set in .env.local for dev,
 * set in Vercel environment variables for production.
 */

const BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '')

export const getBase = () => BASE

// ── Token helpers ─────────────────────────────────────────────────
export const getToken = (): string | null => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('pw_token')
}
export const setToken = (t: string): void => {
  localStorage.setItem('pw_token', t)
  // Also store in cookie for middleware
  document.cookie = `pw_token=${t}; path=/; SameSite=Lax; max-age=604800`
}
export const clearToken = (): void => {
  localStorage.removeItem('pw_token')
  document.cookie = 'pw_token=; path=/; max-age=0'
}

// ── Error class ───────────────────────────────────────────────────
export class ApiError extends Error {
  public status: number
  public code: string
  constructor(status: number, message: string, code = 'ERROR') {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

/**
 * Extract a human-readable error message from any FastAPI error response.
 * FastAPI can return errors in many shapes:
 *   { "detail": "string" }
 *   { "detail": { "error": "string", "code": "string" } }
 *   { "detail": [{ "msg": "string", "loc": [...] }] }   ← validation errors
 *   { "error": "string" }
 */
function extractError(body: unknown): { message: string; code: string } {
  if (!body || typeof body !== 'object') return { message: 'Request failed', code: 'ERROR' }

  const b = body as Record<string, unknown>

  // { detail: { error, code } }
  if (b.detail && typeof b.detail === 'object' && !Array.isArray(b.detail)) {
    const d = b.detail as Record<string, unknown>
    if (typeof d.error === 'string') return { message: d.error, code: String(d.code || 'ERROR') }
  }

  // { detail: "string" }
  if (typeof b.detail === 'string') return { message: b.detail, code: 'ERROR' }

  // { detail: [{ msg, loc }] } — Pydantic validation errors
  if (Array.isArray(b.detail) && b.detail.length > 0) {
    const first = b.detail[0] as Record<string, unknown>
    const field = Array.isArray(first.loc) ? (first.loc[first.loc.length - 1] as string) : ''
    const msg = typeof first.msg === 'string' ? first.msg : 'Validation error'
    return { message: field ? `${field}: ${msg}` : msg, code: 'VALIDATION_ERROR' }
  }

  // { error: "string" }
  if (typeof b.error === 'string') return { message: b.error, code: String(b.code || 'ERROR') }

  return { message: 'Something went wrong. Please try again.', code: 'ERROR' }
}

// ── Core fetch wrapper ────────────────────────────────────────────
async function req<T>(path: string, opts: RequestInit = {}, apiKey?: string): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  }
  if (apiKey) headers['X-API-Key'] = apiKey
  else if (token) headers['Authorization'] = `Bearer ${token}`

  let res: Response
  try {
    res = await fetch(`${BASE}${path}`, { ...opts, headers })
  } catch (networkErr) {
    // Network error — backend unreachable
    throw new ApiError(
      0,
      `Cannot connect to backend at ${BASE}. Make sure the backend is running (uvicorn main:app --port 8000) and NEXT_PUBLIC_API_URL is correct in .env.local`,
      'NETWORK_ERROR'
    )
  }

  if (!res.ok) {
    let body: unknown = {}
    try { body = await res.json() } catch { /* non-JSON error */ }
    const { message, code } = extractError(body)
    throw new ApiError(res.status, message, code)
  }

  if (res.status === 204) return undefined as T

  try {
    return await res.json()
  } catch {
    return undefined as T
  }
}

// ── Types ─────────────────────────────────────────────────────────
export interface User {
  id: string; name: string; email: string; is_verified: boolean
  is_admin: boolean; accepted_policy: boolean; daily_scans: number
  created_at: string; last_login_at: string | null
}

/** App as returned by the list/get endpoints (no raw key) */
export interface App {
  id: number; name: string; description: string | null
  api_key_prefix: string  // display only — first 28 chars + "..."
  is_active: boolean; is_demo: boolean; demo_requests_used: number
  total_requests: number; created_at: string
}

/** App returned immediately after creation or key regeneration (includes full key ONCE) */
export interface AppCreated extends App {
  raw_api_key: string  // FULL key — show this to user immediately, never stored again
}

export interface DetectResult {
  risk_score: number; attack_type: string; blocked: boolean; explanation: string
  app: string; scans_used: number; scans_limit: number
  allowlist_override: boolean; is_demo: boolean
  log_id: number | null
}
export interface ScanLog {
  id: number; app_id: number | null; prompt: string; risk_score: number
  attack_type: string | null; blocked: boolean; endpoint: string
  allowlist_override: boolean; created_at: string
}
export interface AllowlistEntry { id: number; app_id: number; pattern: string; note: string | null; created_at: string }
export interface AdminUser {
  id: string; name: string; email: string; plan: string; is_verified: boolean
  is_admin: boolean; is_active: boolean; apps: number; scans: number; joined: string
}
export interface AdminLog {
  id: number; user_id: string; app_id: number | null; prompt: string; risk_score: number
  attack_type: string | null; blocked: boolean; endpoint: string; ip_address: string | null; created_at: string
}

// ── Auth ─────────────────────────────────────────────────────────
export const auth = {
  register: (d: { name: string; email: string; password: string; accepted_policy: boolean }) =>
    req<{ message: string }>('/auth/register', { method: 'POST', body: JSON.stringify(d) }),

  login: async (d: { email: string; password: string }) => {
    const r = await req<{ access_token: string; user: User }>(
      '/auth/login', { method: 'POST', body: JSON.stringify(d) }
    )
    setToken(r.access_token)
    return r
  },

  verifyEmail: (token: string) =>
    req<{ access_token: string; user: User }>(`/auth/verify-email?token=${token}`, { method: 'POST' }),

  resendVerify: (email: string) =>
    req<{ message: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }),

  forgot: (email: string) =>
    req<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),

  reset: (token: string, new_password: string) =>
    req<{ message: string }>('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }),

  logout: (): void => { clearToken() },
}

// ── User ─────────────────────────────────────────────────────────
export const userApi = {
  profile: () => req<User>('/api/user/profile'),
  update: (name: string) => req<User>('/api/user/profile', { method: 'PUT', body: JSON.stringify({ name }) }),
  changePw: (current_password: string, new_password: string) =>
    req<{ message: string }>('/api/user/change-password', {
      method: 'POST', body: JSON.stringify({ current_password, new_password }),
    }),
  planLimits: () => req<{
    plan: string; apps_limit: number; daily_scans_limit: number
    scans_used_today: number; scans_remaining: number
  }>('/api/user/plan-limits'),
}

// ── Apps ─────────────────────────────────────────────────────────
export const appsApi = {
  list: () => req<App[]>('/api/applications'),
  get: (id: number) => req<App>(`/api/applications/${id}`),

  /** Returns AppCreated with raw_api_key — show this ONCE to user */
  create: (name: string, description?: string) =>
    req<AppCreated>('/api/applications', { method: 'POST', body: JSON.stringify({ name, description }) }),

  /** Create or reset demo app — returns AppCreated with raw_api_key */
  createDemo: () => req<AppCreated>('/api/applications/demo', { method: 'POST' }),

  delete: (id: number) => req<{ message: string }>(`/api/applications/${id}`, { method: 'DELETE' }),
  revoke: (id: number) => req<{ message: string }>(`/api/applications/${id}/revoke`, { method: 'POST' }),
  activate: (id: number) => req<{ message: string }>(`/api/applications/${id}/activate`, { method: 'POST' }),

  /** Returns new raw_api_key — show ONCE to user */
  regenerate: (id: number) =>
    req<{ message: string; raw_api_key: string; api_key_prefix: string }>(
      `/api/applications/${id}/regenerate`, { method: 'POST' }
    ),

  usage: (id: number) => req<{
    total_requests: number; requests_this_month: number; daily_limit: number
    scans_used_today: number; last_used: string | null; is_demo: boolean
  }>(`/api/applications/${id}/usage`),
}

// ── Detection ─────────────────────────────────────────────────────
export const detectApi = {
  scan: (prompt: string, app_id: number) =>
    req<DetectResult>('/api/analyze-prompt', { method: 'POST', body: JSON.stringify({ prompt, app_id }) }),

  /** External API call using the app's raw API key */
  externalScan: (apiKey: string, prompt: string, appId: string) =>
    req<DetectResult>('/api/detect', {
      method: 'POST', body: JSON.stringify({ prompt, appId }),
    }, apiKey),

  logs: (app_id?: number, limit = 100) =>
    req<ScanLog[]>(`/api/logs?limit=${limit}${app_id ? `&app_id=${app_id}` : ''}`),

  analysis: (app_id?: number) =>
    req<{
      total_requests: number; blocked: number; allowed: number
      block_rate: number; avg_risk_score: number
      attack_breakdown: { attack_type: string; count: number }[]
    }>(`/api/analysis${app_id ? `?app_id=${app_id}` : ''}`),

  allowlist: (app_id: number) => req<AllowlistEntry[]>(`/api/allowlist?app_id=${app_id}`),

  addAllow: (app_id: number, pattern: string, note?: string) =>
    req<AllowlistEntry>('/api/allowlist', { method: 'POST', body: JSON.stringify({ app_id, pattern, note }) }),

  removeAllow: (id: number) => req<{ message: string }>(`/api/allowlist/${id}`, { method: 'DELETE' }),

  simulate: (message: string, app_id?: number, use_demo = false) =>
    req<{ bot_reply: string; detection: DetectResult }>('/api/simulate-attack', {
      method: 'POST', body: JSON.stringify({ message, app_id, use_demo }),
    }),

  status: () => req<{ status: string; detector: { ml_active: boolean; model_type: string } }>('/api/status'),
}

// ── Admin ─────────────────────────────────────────────────────────
export const adminApi = {
  stats: () => req<{
    total_users: number; total_apps: number; total_scans: number
    total_blocked: number; block_rate: number
  }>('/api/admin/stats'),

  users: (search = '') => req<AdminUser[]>(`/api/admin/users?search=${encodeURIComponent(search)}`),

  userAction: (id: string, action: string) =>
    req<{ message: string }>(`/api/admin/users/${id}/action?action=${encodeURIComponent(action)}`, { method: 'POST' }),

  apps: () => req<{ id: number; name: string; owner_id: string; is_active: boolean; total_requests: number; created_at: string }[]>('/api/admin/apps'),

  logs: (search = '', app_id?: number) =>
    req<AdminLog[]>(`/api/admin/logs?search=${encodeURIComponent(search)}${app_id ? `&app_id=${app_id}` : ''}`),

  exportCsvUrl: (app_id?: number) =>
    `${BASE}/api/admin/export-csv${app_id ? `?app_id=${app_id}` : ''}`,
}

// ── Feedback (Accept / Reject scan results) ───────────────────────
export interface FeedbackEntry {
  feedback_id: number
  scan_log_id: number
  verdict: 'accept' | 'reject'
  note: string | null
  feedback_at: string
  prompt: string
  risk_score: number
  attack_type: string | null
  blocked: boolean
  scan_at?: string
}

export const feedbackApi = {
  submit: (scan_log_id: number, verdict: 'accept' | 'reject', note?: string) =>
    req<{ id: number; verdict: string }>('/api/feedback', {
      method: 'POST',
      body: JSON.stringify({ scan_log_id, verdict, note }),
    }),
  list: (app_id?: number) =>
    req<FeedbackEntry[]>(`/api/feedback${app_id ? `?app_id=${app_id}` : ''}`),
}

// ── Key verification ──────────────────────────────────────────────
export const verifyApiKey = (apiKey: string) =>
  req<{ valid: boolean; app_name: string; app_id: number; message: string }>(
    '/api/verify-key', {}, apiKey
  )

// ── Admin feedback ────────────────────────────────────────────────
export const adminFeedbackApi = {
  list: (app_id?: number) =>
    req<{
      feedback_id: number; scan_log_id: number; user_id: string; app_id: number
      verdict: string; note: string | null; feedback_at: string
      prompt: string; risk_score: number; attack_type: string | null; model_said_blocked: boolean
    }[]>(`/api/admin/feedback${app_id ? `?app_id=${app_id}` : ''}`),
  exportCsvUrl: (app_id?: number) =>
    `${getBase()}/api/admin/export-feedback-csv${app_id ? `?app_id=${app_id}` : ''}`,
}
