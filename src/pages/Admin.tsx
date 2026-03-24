import { useState, useEffect, useCallback } from 'react'
import {
    Users, BarChart2, Tag, FileText, ChevronLeft,
    RefreshCw, Shield, Loader2,
    CheckCircle, XCircle, AlertTriangle, Search,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Header } from '@/components/Header'

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'dashboard' | 'usuarios' | 'promocoes' | 'logs'

type Plan = 'free' | 'essencial' | 'pro' | 'elite' | 'admin'

interface Stats {
    totalUsers: number
    planCounts: Record<Plan, number>
    strategiesThisMonth: number
    roteiroThisMonth: number
    buscasThisMonth: number
}

interface AdminUser {
    id: string
    full_name: string | null
    email: string | null
    plan: Plan
    plan_expires_at: string | null
    plan_billing: string | null
    is_admin: boolean
    updated_at: string
}

interface TransferPromo {
    id: number
    card_id: string
    program: string
    bonus_percent: number
    valid_until: string
    active: boolean
    last_confirmed: string | null
    is_periodic: boolean
}

interface SyncLog {
    id: number
    synced_at: string
    sources_scraped: number
    changes_detected: boolean
    rows_updated: number
    summary: string | null
}

// ─── Constants ───────────────────────────────────────────────────────────────

const TABS: { id: TabId; label: string; Icon: React.ElementType }[] = [
    { id: 'dashboard', label: 'Dashboard', Icon: BarChart2 },
    { id: 'usuarios', label: 'Usuários', Icon: Users },
    { id: 'promocoes', label: 'Promoções', Icon: Tag },
    { id: 'logs', label: 'Logs', Icon: FileText },
]

const PLAN_LABELS: Record<Plan, string> = {
    free: 'Free', essencial: 'Essencial', pro: 'Pro', elite: 'Elite', admin: 'Admin',
}

const PLAN_COLORS: Record<Plan, string> = {
    free: '#64748b',
    essencial: '#2A60C2',
    pro: '#7c3aed',
    elite: '#d97706',
    admin: '#dc2626',
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function adminFetch(path: string, token: string, options?: RequestInit) {
    const res = await fetch(`${API_BASE}${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
            ...(options?.headers ?? {}),
        },
    })
    if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `HTTP ${res.status}`)
    }
    return res.json()
}

function fmtDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function fmtDateTime(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
    return (
        <div style={{
            background: '#111827', border: '1px solid #1e293b', borderRadius: 12,
            padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 4,
        }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: '#f1f5f9' }}>{value}</span>
            {sub && <span style={{ fontSize: 12, color: '#475569' }}>{sub}</span>}
        </div>
    )
}

function PlanBadge({ plan }: { plan: Plan }) {
    return (
        <span style={{
            background: PLAN_COLORS[plan] + '22',
            color: PLAN_COLORS[plan],
            border: `1px solid ${PLAN_COLORS[plan]}44`,
            borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700,
        }}>
            {PLAN_LABELS[plan]}
        </span>
    )
}

// ─── Dashboard Tab ────────────────────────────────────────────────────────────

function DashboardTab({ token }: { token: string }) {
    const [stats, setStats] = useState<Stats | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const data = await adminFetch('/api/admin/stats', token)
            setStats(data)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { load() }, [load])

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMsg msg={error} onRetry={load} />
    if (!stats) return null

    const paid = (stats.planCounts.essencial ?? 0) + (stats.planCounts.pro ?? 0) +
        (stats.planCounts.elite ?? 0) + (stats.planCounts.admin ?? 0)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                <StatCard label="Total de usuários" value={stats.totalUsers} />
                <StatCard label="Pagantes" value={paid} sub={`${((paid / Math.max(stats.totalUsers, 1)) * 100).toFixed(1)}% conversão`} />
                <StatCard label="Estratégias (mês)" value={stats.strategiesThisMonth} />
                <StatCard label="Roteiros (mês)" value={stats.roteiroThisMonth} />
                <StatCard label="Buscas (mês)" value={stats.buscasThisMonth} />
            </div>

            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 12, padding: 24 }}>
                <p style={{ color: '#94a3b8', fontSize: 13, fontWeight: 700, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Distribuição por plano</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(['free', 'essencial', 'pro', 'elite', 'admin'] as Plan[]).map(p => {
                        const count = stats.planCounts[p] ?? 0
                        const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0
                        return (
                            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <span style={{ width: 72, fontSize: 12, fontWeight: 700, color: PLAN_COLORS[p] }}>{PLAN_LABELS[p]}</span>
                                <div style={{ flex: 1, background: '#1e293b', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: PLAN_COLORS[p], borderRadius: 4, transition: 'width 0.6s' }} />
                                </div>
                                <span style={{ width: 36, textAlign: 'right', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>{count}</span>
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── Usuários Tab ─────────────────────────────────────────────────────────────

function UsuariosTab({ token }: { token: string }) {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [planFilter, setPlanFilter] = useState<Plan | ''>('')
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editingUser, setEditingUser] = useState<AdminUser | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const params = new URLSearchParams({ page: String(page) })
            if (planFilter) params.set('plan', planFilter)
            if (search) params.set('search', search)
            const data = await adminFetch(`/api/admin/users?${params}`, token)
            setUsers(data.users)
            setTotal(data.total)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar')
        } finally {
            setLoading(false)
        }
    }, [token, page, planFilter, search])

    useEffect(() => { load() }, [load])

    const totalPages = Math.ceil(total / 20)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Filtros */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input
                        value={search}
                        onChange={e => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Buscar por nome ou email…"
                        style={inputStyle({ paddingLeft: 32 })}
                    />
                </div>
                <select
                    value={planFilter}
                    onChange={e => { setPlanFilter(e.target.value as Plan | ''); setPage(1) }}
                    style={inputStyle({ width: 140 })}
                >
                    <option value="">Todos os planos</option>
                    {(['free', 'essencial', 'pro', 'elite', 'admin'] as Plan[]).map(p => (
                        <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                    ))}
                </select>
                <button onClick={load} style={btnSecondary}><RefreshCw size={14} /></button>
            </div>

            {loading && <LoadingSpinner />}
            {error && <ErrorMsg msg={error} onRetry={load} />}

            {!loading && !error && (
                <>
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #1e293b' }}>
                                    {['Nome / Email', 'Plano', 'Expira', 'Cobrança', 'Atualizado', 'Ações'].map(h => (
                                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map(u => (
                                    <tr key={u.id} style={{ borderBottom: '1px solid #0f172a' }}>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ color: '#f1f5f9', fontWeight: 600 }}>{u.full_name || '—'}</div>
                                            <div style={{ color: '#475569', fontSize: 11 }}>{u.email ?? u.id.slice(0, 8)}</div>
                                        </td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <PlanBadge plan={u.plan} />
                                                {u.is_admin && <span title="Admin" style={{ color: '#dc2626' }}><Shield size={12} /></span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{fmtDate(u.plan_expires_at)}</td>
                                        <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{u.plan_billing ?? '—'}</td>
                                        <td style={{ padding: '10px 12px', color: '#475569', fontSize: 11 }}>{fmtDate(u.updated_at)}</td>
                                        <td style={{ padding: '10px 12px' }}>
                                            <button onClick={() => setEditingUser(u)} style={btnSmall}>Editar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length === 0 && (
                            <p style={{ textAlign: 'center', color: '#475569', padding: 32 }}>Nenhum usuário encontrado.</p>
                        )}
                    </div>
                    {totalPages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={btnSecondary}>←</button>
                            <span style={{ color: '#94a3b8', fontSize: 13 }}>{page} / {totalPages}</span>
                            <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} style={btnSecondary}>→</button>
                        </div>
                    )}
                </>
            )}

            {editingUser && (
                <EditUserModal
                    user={editingUser}
                    token={token}
                    onClose={() => setEditingUser(null)}
                    onSaved={() => { setEditingUser(null); load() }}
                />
            )}
        </div>
    )
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

function EditUserModal({ user, token, onClose, onSaved }: {
    user: AdminUser
    token: string
    onClose: () => void
    onSaved: () => void
}) {
    const [plan, setPlan] = useState<Plan>(user.plan)
    const [expiresAt, setExpiresAt] = useState(user.plan_expires_at ? user.plan_expires_at.slice(0, 10) : '')
    const [billing, setBilling] = useState(user.plan_billing ?? '')
    const [isAdmin, setIsAdmin] = useState(user.is_admin)
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function save() {
        setSaving(true); setErr(null)
        try {
            await adminFetch(`/api/admin/users/${user.id}/plan`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    plan,
                    plan_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
                    plan_billing: billing || null,
                }),
            })
            if (isAdmin !== user.is_admin) {
                await adminFetch(`/api/admin/users/${user.id}/toggle-admin`, token, {
                    method: 'POST',
                    body: JSON.stringify({ is_admin: isAdmin }),
                })
            }
            onSaved()
        } catch (e: unknown) {
            setErr(e instanceof Error ? e.message : 'Erro ao salvar')
        } finally {
            setSaving(false)
        }
    }

    return (
        <div style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#111827', border: '1px solid #1e293b', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
                <h3 style={{ color: '#f1f5f9', fontWeight: 800, fontSize: 16, marginBottom: 4 }}>Editar usuário</h3>
                <p style={{ color: '#64748b', fontSize: 12, marginBottom: 20 }}>{user.email ?? user.id}</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={labelStyle}>
                        Plano
                        <select value={plan} onChange={e => setPlan(e.target.value as Plan)} style={inputStyle()}>
                            {(['free', 'essencial', 'pro', 'elite', 'admin'] as Plan[]).map(p => (
                                <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                            ))}
                        </select>
                    </label>

                    <label style={labelStyle}>
                        Expiração do plano
                        <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputStyle()} />
                    </label>

                    <label style={labelStyle}>
                        Cobrança
                        <select value={billing} onChange={e => setBilling(e.target.value)} style={inputStyle()}>
                            <option value="">— sem cobrança —</option>
                            <option value="mensal">Mensal</option>
                            <option value="anual">Anual</option>
                        </select>
                    </label>

                    <label style={{ ...labelStyle, flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
                        <span>Admin (acesso ao painel)</span>
                    </label>
                </div>

                {err && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12 }}>{err}</p>}

                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={btnSecondary}>Cancelar</button>
                    <button onClick={save} disabled={saving} style={btnPrimary}>
                        {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Promoções Tab ────────────────────────────────────────────────────────────

function PromocoesTab({ token }: { token: string }) {
    const [promos, setPromos] = useState<TransferPromo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [syncMsg, setSyncMsg] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const { data, error: err } = await supabase
                .from('transfer_promotions')
                .select('id, card_id, program, bonus_percent, valid_until, active, last_confirmed, is_periodic')
                .order('card_id')
            if (err) throw err
            setPromos(data ?? [])
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { load() }, [load])

    async function syncPromos() {
        setSyncing(true); setSyncMsg(null)
        try {
            await adminFetch('/api/transfer-promotions/update', token, { method: 'POST' })
            setSyncMsg('Sync disparado com sucesso.')
            await load()
        } catch (e: unknown) {
            setSyncMsg(e instanceof Error ? e.message : 'Erro no sync')
        } finally {
            setSyncing(false)
        }
    }

    async function toggleActive(id: number, current: boolean) {
        await supabase.from('transfer_promotions').update({ active: !current }).eq('id', id)
        setPromos(p => p.map(x => x.id === id ? { ...x, active: !current } : x))
    }

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMsg msg={error} onRetry={load} />

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <p style={{ color: '#94a3b8', fontSize: 13 }}>{promos.length} promoções cadastradas</p>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {syncMsg && <span style={{ fontSize: 12, color: '#94a3b8' }}>{syncMsg}</span>}
                    <button onClick={syncPromos} disabled={syncing} style={btnSecondary}>
                        {syncing ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={14} />}
                        &nbsp;Sync
                    </button>
                </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ borderBottom: '1px solid #1e293b' }}>
                            {['Cartão', 'Programa', 'Bônus', 'Validade', 'Confirmado', 'Periódico', 'Ativo'].map(h => (
                                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: '#64748b', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {promos.map(p => (
                            <tr key={p.id} style={{ borderBottom: '1px solid #0f172a', opacity: p.active ? 1 : 0.45 }}>
                                <td style={{ padding: '10px 12px', color: '#f1f5f9', fontWeight: 600 }}>{p.card_id}</td>
                                <td style={{ padding: '10px 12px', color: '#94a3b8' }}>{p.program}</td>
                                <td style={{ padding: '10px 12px', color: '#22c55e', fontWeight: 700 }}>+{p.bonus_percent}%</td>
                                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11, maxWidth: 160 }}>{p.valid_until}</td>
                                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: 11 }}>{p.last_confirmed ?? '—'}</td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    {p.is_periodic ? <CheckCircle size={14} style={{ color: '#22c55e' }} /> : <XCircle size={14} style={{ color: '#475569' }} />}
                                </td>
                                <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                                    <button
                                        onClick={() => toggleActive(p.id, p.active)}
                                        title={p.active ? 'Desativar' : 'Ativar'}
                                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}
                                    >
                                        {p.active
                                            ? <CheckCircle size={16} style={{ color: '#22c55e' }} />
                                            : <XCircle size={16} style={{ color: '#475569' }} />}
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

function LogsTab({ token }: { token: string }) {
    const [logs, setLogs] = useState<SyncLog[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const data = await adminFetch('/api/admin/transfer-sync-log', token)
            setLogs(data.logs)
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : 'Erro ao carregar')
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { load() }, [load])

    if (loading) return <LoadingSpinner />
    if (error) return <ErrorMsg msg={error} onRetry={load} />

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <p style={{ color: '#64748b', fontSize: 13 }}>{logs.length} registros</p>
                <button onClick={load} style={btnSecondary}><RefreshCw size={14} /></button>
            </div>
            {logs.length === 0 && (
                <p style={{ color: '#475569', textAlign: 'center', padding: 32 }}>Nenhum log encontrado.</p>
            )}
            {logs.map(log => (
                <div key={log.id} style={{
                    background: '#111827', border: `1px solid ${log.changes_detected ? '#1e3a5f' : '#1e293b'}`,
                    borderRadius: 10, padding: '14px 18px',
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {log.changes_detected
                                ? <CheckCircle size={14} style={{ color: '#22c55e', flexShrink: 0 }} />
                                : <XCircle size={14} style={{ color: '#475569', flexShrink: 0 }} />}
                            <span style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600 }}>
                                {log.changes_detected ? `${log.rows_updated} linha(s) atualizada(s)` : 'Sem alterações'}
                            </span>
                        </div>
                        <span style={{ color: '#475569', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDateTime(log.synced_at)}</span>
                    </div>
                    {log.summary && (
                        <p style={{ color: '#64748b', fontSize: 12, marginTop: 6, lineHeight: 1.4 }}>{log.summary}</p>
                    )}
                    <p style={{ color: '#334155', fontSize: 11, marginTop: 4 }}>
                        {log.sources_scraped} fonte(s) verificada(s)
                    </p>
                </div>
            ))}
        </div>
    )
}

// ─── Shared UI ────────────────────────────────────────────────────────────────

function LoadingSpinner() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ color: '#2A60C2', animation: 'spin 1s linear infinite' }} />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
    )
}

function ErrorMsg({ msg, onRetry }: { msg: string; onRetry: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#1a0a0a', border: '1px solid #7f1d1d', borderRadius: 10, padding: '14px 18px' }}>
            <AlertTriangle size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ color: '#fca5a5', fontSize: 13, flex: 1 }}>{msg}</span>
            <button onClick={onRetry} style={btnSecondary}>Tentar novamente</button>
        </div>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function inputStyle(extra: React.CSSProperties = {}): React.CSSProperties {
    return {
        background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8,
        color: '#f1f5f9', fontSize: 13, padding: '8px 12px', outline: 'none', width: '100%',
        ...extra,
    }
}

const labelStyle: React.CSSProperties = {
    display: 'flex', flexDirection: 'column', gap: 6,
    color: '#94a3b8', fontSize: 12, fontWeight: 600,
}

const btnPrimary: React.CSSProperties = {
    background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 8,
    padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
}

const btnSecondary: React.CSSProperties = {
    background: '#1e293b', color: '#94a3b8', border: '1px solid #334155', borderRadius: 8,
    padding: '7px 14px', fontSize: 13, cursor: 'pointer',
    display: 'flex', alignItems: 'center', gap: 6,
}

const btnSmall: React.CSSProperties = {
    background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
    borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer',
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Admin() {
    const { session } = useAuth()
    const navigate = useNavigate()
    const [tab, setTab] = useState<TabId>('dashboard')
    const token = session?.access_token ?? ''

    return (
        <div style={{ minHeight: '100vh', background: '#080a10', fontFamily: 'Manrope, sans-serif' }}>
            <Header />
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>

            <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 16px 80px' }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                    <button onClick={() => navigate('/home')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: 4 }}>
                        <ChevronLeft size={20} />
                    </button>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Shield size={20} style={{ color: '#dc2626' }} />
                        <h1 style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 800, margin: 0 }}>Painel Admin</h1>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #1e293b', marginBottom: 24 }}>
                    {TABS.map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            onClick={() => setTab(id)}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                padding: '10px 16px', borderRadius: '8px 8px 0 0',
                                color: tab === id ? '#2A60C2' : '#64748b',
                                borderBottom: tab === id ? '2px solid #2A60C2' : '2px solid transparent',
                                fontSize: 13, fontWeight: tab === id ? 700 : 500,
                                display: 'flex', alignItems: 'center', gap: 6,
                                transition: 'color 0.15s',
                            }}
                        >
                            <Icon size={14} />
                            {label}
                        </button>
                    ))}
                </div>

                {/* Content */}
                {tab === 'dashboard' && <DashboardTab token={token} />}
                {tab === 'usuarios' && <UsuariosTab token={token} />}
                {tab === 'promocoes' && <PromocoesTab token={token} />}
                {tab === 'logs' && <LogsTab token={token} />}
            </div>
        </div>
    )
}
