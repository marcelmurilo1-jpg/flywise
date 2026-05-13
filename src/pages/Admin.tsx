import { useState, useEffect, useCallback } from 'react'
import {
    Users, BarChart2, Tag, FileText, Shield,
    RefreshCw, Loader2, CheckCircle, XCircle,
    AlertTriangle, Search, Activity, Zap,
    DollarSign, MapPin, Clock, UserX, Receipt,
    Plus, Trash2, ChevronLeft, ChevronRight,
    TrendingDown, Home, Image,
    Megaphone, BarChart3,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type SectionId = 'dashboard' | 'usuarios' | 'custos' | 'promocoes' | 'logs' | 'posts' | 'codigos' | 'uso'
type Plan = 'free' | 'essencial' | 'pro' | 'elite' | 'admin'

interface Stats {
    totalUsers: number
    planCounts: Record<Plan, number>
    strategiesThisMonth: number
    roteiroThisMonth: number
    buscasThisMonth: number
}

interface Revenue {
    mrr: number
    conversionRate: string
    paidUsers: number
    churnCount: number
    newPaidThisMonth: number
    expiringIn7Days: { id: string; plan: Plan; plan_expires_at: string }[]
}

interface Engagement {
    activeUsers30d: number
    activeUsers7d: number
    inactivePaidUsers: number
    topRoutes: { route: string; count: number }[]
    strategiesPerDay: { date: string; count: number }[]
}

interface ApiCheck { name: string; ok: boolean; latency: number; error?: string }
interface ApiStatus { checks: ApiCheck[]; checkedAt: string }

interface AdminUser {
    id: string; full_name: string | null; email: string | null; phone: string | null
    plan: Plan; plan_expires_at: string | null; plan_billing: string | null
    is_admin: boolean; updated_at: string; created_at: string
}

interface TransferPromo {
    id: number; card_id: string; program: string; bonus_percent: number
    club_bonus_percent: number; club_tier_bonuses: Record<string, number>
    valid_until: string; active: boolean; last_confirmed: string | null; is_periodic: boolean
}

interface SyncLog {
    id: number; synced_at: string; sources_scraped: number
    changes_detected: boolean; rows_updated: number; summary: string | null
}

interface Cost {
    id: number; month: string; service: string; category: string
    amount_brl: number; notes: string | null; created_at: string
}

interface CostHistory { month: string; total: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTIONS: { id: SectionId; label: string; icon: React.ElementType; description: string }[] = [
    { id: 'dashboard',  label: 'Dashboard',   icon: BarChart2,  description: 'Visão geral do negócio' },
    { id: 'usuarios',   label: 'Usuários',     icon: Users,      description: 'Gerenciar contas e planos' },
    { id: 'uso',        label: 'Uso',          icon: BarChart3,  description: 'Métricas de uso por usuário' },
    { id: 'custos',     label: 'Custos',       icon: Receipt,    description: 'Controle de gastos' },
    { id: 'promocoes',  label: 'Promoções',    icon: Tag,        description: 'Bônus de transferência' },
    { id: 'logs',       label: 'Logs',         icon: FileText,   description: 'Histórico de sincronização' },
    { id: 'codigos',    label: 'Divulgação',   icon: Megaphone,  description: 'Códigos de divulgação' },
    { id: 'posts',      label: 'Posts',        icon: Image,      description: 'Gerador de slides Instagram' },
]

const PLAN_LABELS: Record<Plan, string> = {
    free: 'Free', essencial: 'Essencial', pro: 'Pro', elite: 'Elite', admin: 'Admin',
}

const PLAN_COLORS: Record<Plan, string> = {
    free: '#64748b', essencial: '#2A60C2', pro: '#7c3aed', elite: '#d97706', admin: '#dc2626',
}

const COST_CATEGORIES = ['Infraestrutura', 'APIs', 'Pagamentos', 'Marketing', 'Outros'] as const
type CostCategory = typeof COST_CATEGORIES[number]

const CATEGORY_COLORS: Record<CostCategory, string> = {
    Infraestrutura: '#2A60C2',
    APIs:           '#7c3aed',
    Pagamentos:     '#059669',
    Marketing:      '#d97706',
    Outros:         '#64748b',
}

const SUGGESTED_SERVICES: Record<CostCategory, string[]> = {
    Infraestrutura: ['Vercel', 'Railway', 'Supabase', 'Cloudflare', 'Domínio'],
    APIs:           ['Anthropic (Claude)', 'Seats.aero', 'Amadeus', 'Google APIs'],
    Pagamentos:     ['AbacatePay', 'Stripe', 'Taxas de processamento'],
    Marketing:      ['Google Ads', 'Meta Ads', 'Ferramentas de e-mail'],
    Outros:         ['Ferramentas SaaS', 'Design', 'Jurídico'],
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

function fmtBRL(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 })
}

function monthLabel(ym: string) {
    if (!ym) return 'Todos os registros'
    const [y, m] = ym.split('-')
    const names = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    return `${names[parseInt(m) - 1]}/${y}`
}


// ─── Shared UI ────────────────────────────────────────────────────────────────

function Spinner() {
    return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
            <Loader2 size={22} style={{ color: '#2A60C2', animation: 'spin 1s linear infinite' }} />
        </div>
    )
}

function ErrBox({ msg, onRetry }: { msg: string; onRetry: () => void }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '14px 18px' }}>
            <AlertTriangle size={15} style={{ color: '#DC2626', flexShrink: 0 }} />
            <span style={{ color: '#B91C1C', fontSize: 13, flex: 1 }}>{msg}</span>
            <button onClick={onRetry} style={S.btnSm}>Tentar novamente</button>
        </div>
    )
}

function BlockTitle({ icon: Icon, title, subtitle }: { icon: React.ElementType; title: string; subtitle: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ background: '#EFF4FF', borderRadius: 8, padding: 7 }}>
                <Icon size={15} style={{ color: '#2A60C2', display: 'block' }} />
            </div>
            <div>
                <p style={{ color: '#0E2A55', fontSize: 14, fontWeight: 800, margin: 0 }}>{title}</p>
                <p style={{ color: '#94A3B8', fontSize: 11, margin: 0 }}>{subtitle}</p>
            </div>
        </div>
    )
}

function KPI({ label, value, sub, color, tooltip }: {
    label: string; value: string | number; sub?: string; color?: string; tooltip?: string
}) {
    return (
        <div title={tooltip} style={{ background: '#FFFFFF', border: `1px solid ${color ? color + '30' : '#E2E8F0'}`, borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 6px' }}>{label}</p>
            <p style={{ fontSize: 24, fontWeight: 800, color: color ?? '#0E2A55', margin: '0 0 4px' }}>{value}</p>
            {sub && <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>{sub}</p>}
        </div>
    )
}

function PlanBadge({ plan }: { plan: Plan }) {
    return (
        <span style={{ background: PLAN_COLORS[plan] + '22', color: PLAN_COLORS[plan], border: `1px solid ${PLAN_COLORS[plan]}44`, borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
            {PLAN_LABELS[plan]}
        </span>
    )
}

function Divider() {
    return <div style={{ height: 1, background: '#E2E8F0', margin: '28px 0' }} />
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

function Dashboard({ token }: { token: string }) {
    const [stats, setStats] = useState<Stats | null>(null)
    const [revenue, setRevenue] = useState<Revenue | null>(null)
    const [engagement, setEngagement] = useState<Engagement | null>(null)
    const [apiStatus, setApiStatus] = useState<ApiStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [loadingApi, setLoadingApi] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const [s, r, e] = await Promise.all([
                adminFetch('/api/admin/stats', token),
                adminFetch('/api/admin/revenue', token),
                adminFetch('/api/admin/engagement', token),
            ])
            setStats(s); setRevenue(r); setEngagement(e)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao carregar')
        } finally { setLoading(false) }
    }, [token])

    const checkApis = useCallback(async () => {
        setLoadingApi(true)
        try { setApiStatus(await adminFetch('/api/admin/api-status', token)) }
        finally { setLoadingApi(false) }
    }, [token])

    useEffect(() => { load() }, [load])

    if (loading) return <Spinner />
    if (error) return <ErrBox msg={error} onRetry={load} />
    if (!stats || !revenue || !engagement) return null

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

            {/* ── Receita ────────────────────────────────────────────── */}
            <section>
                <BlockTitle icon={DollarSign} title="Receita" subtitle="MRR, conversão e alertas de renovação" />
                <div style={S.grid5}>
                    <KPI label="MRR" value={fmtBRL(revenue.mrr)} sub="Receita mensal recorrente" color="#22c55e"
                        tooltip="Soma dos planos pagantes ativos × preço mensal" />
                    <KPI label="Pagantes" value={revenue.paidUsers} sub={`de ${stats.totalUsers} usuários`}
                        tooltip="Planos essencial, pro ou elite não expirados" />
                    <KPI label="Conversão" value={`${revenue.conversionRate}%`} sub="Free → pago"
                        tooltip="% de usuários com plano pago ativo" />
                    <KPI label="Novos pagantes" value={revenue.newPaidThisMonth} sub="Este mês" />
                    <KPI label="Churn (expirados)" value={revenue.churnCount} sub="Não renovaram"
                        color={revenue.churnCount > 0 ? '#ef4444' : undefined}
                        tooltip="Planos pagos expirados e não renovados" />
                </div>

                {revenue.expiringIn7Days.length > 0 && (
                    <div style={{ marginTop: 10, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10, padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Clock size={13} style={{ color: '#D97706' }} />
                            <span style={{ color: '#92400E', fontSize: 13, fontWeight: 700 }}>
                                {revenue.expiringIn7Days.length} plano(s) expirando nos próximos 7 dias — considere entrar em contato
                            </span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {revenue.expiringIn7Days.map(u => (
                                <span key={u.id} style={{ fontSize: 11, color: '#92400E', background: '#FEF3C7', borderRadius: 6, padding: '3px 8px' }}>
                                    {PLAN_LABELS[u.plan]} · expira {fmtDate(u.plan_expires_at)}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            <Divider />

            {/* ── Usuários ───────────────────────────────────────────── */}
            <section>
                <BlockTitle icon={Users} title="Usuários" subtitle="Cadastros, engajamento e distribuição por plano" />
                <div style={S.grid4}>
                    <KPI label="Total de usuários" value={stats.totalUsers} sub="Todos os cadastros" />
                    <KPI label="Ativos (30d)" value={engagement.activeUsers30d} sub="≥1 busca nos últimos 30d"
                        tooltip="Usuários que fizeram pelo menos 1 busca de voo nos últimos 30 dias" />
                    <KPI label="Ativos (7d)" value={engagement.activeUsers7d} sub="Semana atual" />
                    <KPI label="Pagantes sem uso" value={engagement.inactivePaidUsers} sub="Risco de churn"
                        color={engagement.inactivePaidUsers > 0 ? '#f59e0b' : undefined}
                        tooltip="Plano pago ativo mas sem busca nos últimos 30 dias" />
                </div>

                <div style={{ ...S.card, marginTop: 12 }}>
                    <p style={S.cardLabel}>Distribuição por plano</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
                        {(['free', 'essencial', 'pro', 'elite', 'admin'] as Plan[]).map(p => {
                            const count = stats.planCounts[p] ?? 0
                            const pct = stats.totalUsers > 0 ? (count / stats.totalUsers) * 100 : 0
                            return (
                                <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <span style={{ width: 72, fontSize: 12, fontWeight: 700, color: PLAN_COLORS[p] }}>{PLAN_LABELS[p]}</span>
                                    <div style={{ flex: 1, background: '#E2E8F0', borderRadius: 4, height: 7 }}>
                                        <div style={{ width: `${pct}%`, height: '100%', background: PLAN_COLORS[p], borderRadius: 4, transition: 'width 0.6s' }} />
                                    </div>
                                    <span style={{ width: 32, textAlign: 'right', fontSize: 12, color: '#64748B', fontWeight: 700 }}>{count}</span>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </section>

            <Divider />

            {/* ── Uso do produto ─────────────────────────────────────── */}
            <section>
                <BlockTitle icon={Activity} title="Uso do produto" subtitle="Volume de uso das funcionalidades de IA este mês" />
                <div style={S.grid3}>
                    <KPI label="Buscas (mês)" value={stats.buscasThisMonth} sub="Voos consultados"
                        tooltip="Total de buscas de voos realizadas este mês" />
                    <KPI label="Estratégias (mês)" value={stats.strategiesThisMonth} sub="Geradas pelo Claude"
                        tooltip="Estratégias de milhas geradas por IA este mês" />
                    <KPI label="Roteiros (mês)" value={stats.roteiroThisMonth} sub="Gerados pelo Claude" />
                </div>

                {engagement.strategiesPerDay.length > 0 && (
                    <div style={{ ...S.card, marginTop: 12 }}>
                        <p style={S.cardLabel}>Estratégias geradas por dia — últimos 14 dias</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 56, marginTop: 16 }}>
                            {(() => {
                                const max = Math.max(...engagement.strategiesPerDay.map(d => d.count as number), 1)
                                return engagement.strategiesPerDay.map(d => (
                                    <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <div title={`${d.date}: ${d.count}`} style={{
                                            width: '100%', background: '#2A60C2', borderRadius: '3px 3px 0 0',
                                            height: `${Math.max(((d.count as number) / max) * 48, 2)}px`, transition: 'height 0.3s',
                                        }} />
                                        <span style={{ fontSize: 9, color: '#94A3B8', writingMode: 'vertical-rl', transform: 'rotate(180deg)', height: 24 }}>
                                            {d.date.slice(5)}
                                        </span>
                                    </div>
                                ))
                            })()}
                        </div>
                    </div>
                )}
            </section>

            <Divider />

            {/* ── Top destinos ───────────────────────────────────────── */}
            <section>
                <BlockTitle icon={MapPin} title="Top destinos" subtitle="Rotas mais buscadas nos últimos 30 dias" />
                <div style={S.card}>
                    {engagement.topRoutes.length === 0 && (
                        <p style={{ color: '#475569', textAlign: 'center', padding: 16, fontSize: 13 }}>Sem dados de buscas recentes.</p>
                    )}
                    {engagement.topRoutes.map((r, i) => {
                        const max = engagement.topRoutes[0]?.count ?? 1
                        const pct = ((r.count as number) / (max as number)) * 100
                        return (
                            <div key={r.route} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: i < engagement.topRoutes.length - 1 ? '1px solid #E2E8F0' : 'none' }}>
                                <span style={{ width: 18, fontSize: 11, color: '#94A3B8', fontWeight: 700 }}>#{i + 1}</span>
                                <span style={{ flex: 1, fontSize: 13, color: '#0E2A55', fontWeight: 600 }}>{r.route}</span>
                                <div style={{ width: 72, background: '#E2E8F0', borderRadius: 4, height: 5 }}>
                                    <div style={{ width: `${pct}%`, height: '100%', background: '#2A60C2', borderRadius: 4 }} />
                                </div>
                                <span style={{ width: 24, textAlign: 'right', fontSize: 12, color: '#64748B', fontWeight: 700 }}>{r.count}</span>
                            </div>
                        )
                    })}
                </div>
            </section>

            <Divider />

            {/* ── Status das APIs ────────────────────────────────────── */}
            <section>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
                    <BlockTitle icon={Zap} title="Status das APIs" subtitle="Verifica se os serviços externos estão respondendo" />
                    <button onClick={checkApis} disabled={loadingApi} style={{ ...S.btnSm, marginTop: 2 }}>
                        {loadingApi ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={12} />}
                        Verificar agora
                    </button>
                </div>

                {!apiStatus && !loadingApi && (
                    <p style={{ color: '#475569', fontSize: 13 }}>Clique em "Verificar agora" para checar as integrações.</p>
                )}
                {loadingApi && <Spinner />}
                {apiStatus && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {apiStatus.checks.map(c => (
                            <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF', border: `1px solid ${c.ok ? '#BBF7D0' : '#FECACA'}`, borderRadius: 10, padding: '11px 16px' }}>
                                {c.ok ? <CheckCircle size={15} style={{ color: '#16A34A', flexShrink: 0 }} /> : <XCircle size={15} style={{ color: '#DC2626', flexShrink: 0 }} />}
                                <span style={{ flex: 1, color: '#0E2A55', fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                                <span style={{ fontSize: 11, color: '#94A3B8' }}>{c.latency}ms</span>
                                {!c.ok && c.error && <span style={{ fontSize: 11, color: '#B91C1C', maxWidth: 180, textAlign: 'right' }}>{c.error}</span>}
                            </div>
                        ))}
                        <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'right', marginTop: 4 }}>Verificado em {fmtDateTime(apiStatus.checkedAt)}</p>
                    </div>
                )}
            </section>
        </div>
    )
}

// ─── Usuários ─────────────────────────────────────────────────────────────────

function Usuarios({ token }: { token: string }) {
    const [users, setUsers] = useState<AdminUser[]>([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [planFilter, setPlanFilter] = useState<Plan | ''>('')
    const [search, setSearch] = useState('')
    const [sortBy, setSortBy] = useState('updated_at')
    const [churned, setChurned] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [editing, setEditing] = useState<AdminUser | null>(null)
    const [viewing, setViewing] = useState<AdminUser | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const p = new URLSearchParams({ page: String(page), sort_by: sortBy })
            if (churned) { p.set('churned', 'true') }
            else if (planFilter) p.set('plan', planFilter)
            if (search) p.set('search', search)
            const data = await adminFetch(`/api/admin/users?${p}`, token)
            setUsers(data.users); setTotal(data.total)
        } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
        finally { setLoading(false) }
    }, [token, page, planFilter, search, sortBy, churned])

    useEffect(() => { load() }, [load])

    const pages = Math.ceil(total / 20)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <BlockTitle icon={Users} title="Gerenciar usuários" subtitle="Edite plano, expiração e permissões de cada conta" />

            {/* Tabs: ativos / churnados */}
            <div style={{ display: 'flex', gap: 8 }}>
                <button
                    onClick={() => { setChurned(false); setPage(1) }}
                    style={{ ...S.btnSm, background: !churned ? '#EFF4FF' : '#F7F9FC', borderColor: !churned ? '#BFDBFE' : '#E2E8F0', color: !churned ? '#2A60C2' : '#64748B', fontWeight: !churned ? 700 : 500 }}
                >
                    Todos os usuários
                </button>
                <button
                    onClick={() => { setChurned(true); setPlanFilter(''); setPage(1) }}
                    style={{ ...S.btnSm, background: churned ? '#FEF2F2' : '#F7F9FC', borderColor: churned ? '#FECACA' : '#E2E8F0', color: churned ? '#DC2626' : '#64748B', fontWeight: churned ? 700 : 500 }}
                >
                    <UserX size={13} /> Churnados
                </button>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                    <input value={search} onChange={e => { setSearch(e.target.value); setPage(1) }}
                        placeholder="Buscar por nome, email ou WhatsApp…" style={inputSt({ paddingLeft: 30 })} />
                </div>
                {!churned && (
                    <select value={planFilter} onChange={e => { setPlanFilter(e.target.value as Plan | ''); setPage(1) }} style={inputSt({ width: 148 })}>
                        <option value="">Todos os planos</option>
                        {(['free', 'essencial', 'pro', 'elite', 'admin'] as Plan[]).map(p => (
                            <option key={p} value={p}>{PLAN_LABELS[p]}</option>
                        ))}
                    </select>
                )}
                <select value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }} style={inputSt({ width: 176 })}>
                    <option value="updated_at">+ recente atualização</option>
                    <option value="created_at">+ tempo cadastrado</option>
                    <option value="plan_expires_at">+ tempo pagando</option>
                </select>
                <button onClick={load} style={S.btnSm}><RefreshCw size={13} /></button>
            </div>

            {loading && <Spinner />}
            {error && <ErrBox msg={error} onRetry={load} />}
            {!loading && !error && (
                <>
                    {churned && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                            {total} usuário(s) que já foram pagantes mas não renovaram. Entre em contato pelo WhatsApp para reativação.
                        </div>
                    )}
                    <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid #E2E8F0' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                            <thead>
                                <tr style={{ background: '#F7F9FC' }}>
                                    {['Nome / Email', 'WhatsApp', 'Plano', 'Expira em', 'Cadastro', ''].map(h => (
                                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {users.map((u, i) => (
                                    <tr key={u.id} style={{ borderTop: '1px solid #E2E8F0', background: i % 2 === 0 ? '#FFFFFF' : '#F7F9FC' }}>
                                        <td style={{ padding: '11px 14px' }}>
                                            <div style={{ color: '#0E2A55', fontWeight: 600 }}>{u.full_name || '—'}</div>
                                            <div style={{ color: '#94A3B8', fontSize: 11 }}>{u.email ?? u.id.slice(0, 8)}</div>
                                        </td>
                                        <td style={{ padding: '11px 14px', color: '#64748B', fontSize: 12 }}>
                                            {u.phone
                                                ? <a href={`https://wa.me/${u.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" style={{ color: '#16A34A', textDecoration: 'none', fontWeight: 600 }}>{u.phone}</a>
                                                : <span style={{ color: '#CBD5E1' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '11px 14px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <PlanBadge plan={u.plan} />
                                                {u.is_admin && <span title="Admin" style={{ display: 'flex' }}><Shield size={11} style={{ color: '#DC2626' }} /></span>}
                                            </div>
                                        </td>
                                        <td style={{ padding: '11px 14px', color: '#64748B', fontSize: 12 }}>{fmtDate(u.plan_expires_at)}</td>
                                        <td style={{ padding: '11px 14px', color: '#94A3B8', fontSize: 11 }}>{fmtDate(u.created_at)}</td>
                                        <td style={{ padding: '11px 14px' }}>
                                            <div style={{ display: 'flex', gap: 6 }}>
                                                <button onClick={() => setViewing(u)} style={S.btnXs}>Ver</button>
                                                <button onClick={() => setEditing(u)} style={S.btnXs}>Editar</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {users.length === 0 && <p style={{ textAlign: 'center', color: '#94A3B8', padding: 28, fontSize: 13 }}>Nenhum usuário encontrado.</p>}
                    </div>
                    {pages > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
                            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={S.btnSm}><ChevronLeft size={14} /></button>
                            <span style={{ color: '#64748B', fontSize: 13 }}>{page} / {pages}</span>
                            <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} style={S.btnSm}><ChevronRight size={14} /></button>
                        </div>
                    )}
                </>
            )}
            {editing && <EditUserModal user={editing} token={token} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
            {viewing && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                    onClick={e => e.target === e.currentTarget && setViewing(null)}>
                    <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, width: '100%', maxWidth: 380 }}>
                        <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 15, marginBottom: 20 }}>Informações do usuário</p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {[
                                { label: 'Nome', value: viewing.full_name || '—' },
                                { label: 'Email', value: viewing.email || '—' },
                                { label: 'WhatsApp', value: viewing.phone || '—' },
                                { label: 'Plano', value: PLAN_LABELS[viewing.plan] },
                                { label: 'Expira em', value: fmtDate(viewing.plan_expires_at) },
                                { label: 'Cadastro', value: fmtDate(viewing.created_at) },
                            ].map(({ label, value }) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, paddingBottom: 10, borderBottom: '1px solid #F1F5F9' }}>
                                    <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 600 }}>{label}</span>
                                    <span style={{ fontSize: 13, color: '#0E2A55', fontWeight: 600, textAlign: 'right' }}>{value}</span>
                                </div>
                            ))}
                        </div>
                        {viewing.phone && (
                            <a href={`https://wa.me/${viewing.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer"
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20, background: '#16A34A', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
                                Abrir WhatsApp
                            </a>
                        )}
                        <button onClick={() => setViewing(null)} style={{ ...S.btnSm, width: '100%', justifyContent: 'center', marginTop: 10 }}>Fechar</button>
                    </div>
                </div>
            )}
        </div>
    )
}

function EditUserModal({ user, token, onClose, onSaved }: {
    user: AdminUser; token: string; onClose: () => void; onSaved: () => void
}) {
    const [plan, setPlan] = useState<Plan>(user.plan)
    const [expiresAt, setExpiresAt] = useState(user.plan_expires_at ? user.plan_expires_at.slice(0, 10) : '')
    const [billing, setBilling] = useState(user.plan_billing ?? '')
    const [isAdmin, setIsAdmin] = useState(user.is_admin)
    const [phone, setPhone] = useState(user.phone ?? '')
    const [saving, setSaving] = useState(false)
    const [deleting, setDeleting] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function save() {
        setSaving(true); setErr(null)
        try {
            await adminFetch(`/api/admin/users/${user.id}/plan`, token, {
                method: 'PATCH',
                body: JSON.stringify({ plan, plan_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null, plan_billing: billing || null, phone: phone || null }),
            })
            if (isAdmin !== user.is_admin) {
                await adminFetch(`/api/admin/users/${user.id}/toggle-admin`, token, { method: 'POST', body: JSON.stringify({ is_admin: isAdmin }) })
            }
            onSaved()
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao salvar') }
        finally { setSaving(false) }
    }

    async function deleteUser() {
        if (!confirm(`Excluir permanentemente ${user.full_name ?? user.email ?? user.id}? Esta ação não pode ser desfeita.`)) return
        setDeleting(true); setErr(null)
        try {
            await adminFetch(`/api/admin/users/${user.id}`, token, { method: 'DELETE' })
            onSaved()
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao excluir') }
        finally { setDeleting(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
                <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Editar usuário</p>
                <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 20 }}>{user.email ?? user.id}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={S.label}>WhatsApp / Telefone
                        <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+55 11 99999-9999" style={inputSt()} />
                    </label>
                    <label style={S.label}>Plano
                        <select value={plan} onChange={e => setPlan(e.target.value as Plan)} style={inputSt()}>
                            {(['free', 'essencial', 'pro', 'elite', 'admin'] as Plan[]).map(p => <option key={p} value={p}>{PLAN_LABELS[p]}</option>)}
                        </select>
                    </label>
                    <label style={S.label}>Data de expiração
                        <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inputSt()} />
                    </label>
                    <label style={S.label}>Cobrança
                        <select value={billing} onChange={e => setBilling(e.target.value)} style={inputSt()}>
                            <option value="">— sem cobrança —</option>
                            <option value="mensal">Mensal</option>
                            <option value="anual">Anual</option>
                        </select>
                    </label>
                    <label style={{ ...S.label, flexDirection: 'row', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                        <input type="checkbox" checked={isAdmin} onChange={e => setIsAdmin(e.target.checked)} />
                        <div>
                            <span style={{ color: '#0E2A55' }}>Acesso de admin</span>
                            <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>Permite acessar este painel</p>
                        </div>
                    </label>
                </div>
                {err && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12 }}>{err}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
                    <button onClick={deleteUser} disabled={deleting} style={{ ...S.btnSm, color: '#DC2626', borderColor: '#FECACA' }}>
                        {deleting ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Trash2 size={12} />}
                        Excluir
                    </button>
                    <div style={{ display: 'flex', gap: 10 }}>
                        <button onClick={onClose} style={S.btnSm}>Cancelar</button>
                        <button onClick={save} disabled={saving} style={S.btnPrimary}>
                            {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Custos ───────────────────────────────────────────────────────────────────

function Custos({ token }: { token: string }) {
    const [month, setMonth] = useState('') // empty = all costs
    const [costs, setCosts] = useState<Cost[]>([])
    const [history, setHistory] = useState<CostHistory[]>([])
    const [mrr, setMrr] = useState(0)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showForm, setShowForm] = useState(false)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const [c, h, r] = await Promise.all([
                adminFetch(`/api/admin/costs${month ? `?month=${month}` : ''}`, token),
                adminFetch('/api/admin/costs/history', token),
                adminFetch('/api/admin/revenue', token),
            ])
            setCosts(c.costs); setHistory(h.history); setMrr(r.mrr)
        } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
        finally { setLoading(false) }
    }, [token, month])

    useEffect(() => { load() }, [load])

    async function deleteCost(id: number) {
        if (!confirm('Remover este custo?')) return
        await adminFetch(`/api/admin/costs/${id}`, token, { method: 'DELETE' })
        setCosts(c => c.filter(x => x.id !== id))
    }

    const totalMonth = costs.reduce((s, c) => s + Number(c.amount_brl), 0)
    const profit = mrr - totalMonth
    const margin = mrr > 0 ? ((profit / mrr) * 100).toFixed(0) : '—'

    // Agrupado por categoria
    const byCategory: Record<string, number> = {}
    for (const c of costs) {
        byCategory[c.category] = (byCategory[c.category] ?? 0) + Number(c.amount_brl)
    }
    const maxCat = Math.max(...Object.values(byCategory), 1)

    // Histórico dos últimos 6 meses
    const histMax = Math.max(...history.map(h => h.total), 1)

    const availableMonths: string[] = Array.from(new Set([
        ...costs.map(c => c.month.slice(0, 7)),
        ...history.map(h => h.month),
    ])).sort((a, b) => b.localeCompare(a))

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <BlockTitle icon={Receipt} title="Controle de custos" subtitle="Registre e acompanhe todos os gastos operacionais do FlyWise" />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <select value={month} onChange={e => setMonth(e.target.value)} style={inputSt({ width: 160 })}>
                        <option value="">Todos os meses</option>
                        {availableMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
                    </select>
                    {month && (
                        <button onClick={() => setMonth('')} style={S.btnSm} title="Ver todos os registros">Limpar</button>
                    )}
                    <button onClick={() => setShowForm(true)} style={S.btnPrimary}><Plus size={14} />Adicionar</button>
                </div>
            </div>

            {loading && <Spinner />}
            {error && <ErrBox msg={error} onRetry={load} />}

            {!loading && !error && (
                <>
                    {/* ── KPIs ── */}
                    <div style={S.grid4}>
                        <KPI label="MRR atual" value={fmtBRL(mrr)} sub="Receita mensal recorrente" color="#22c55e"
                            tooltip="MRR calculado a partir dos planos pagantes ativos" />
                        {month && (
                            <KPI label="Lucro bruto" value={fmtBRL(profit)} sub={`${monthLabel(month)} − custos`}
                                color={profit >= 0 ? '#22c55e' : '#ef4444'}
                                tooltip="MRR menos os custos do mês selecionado" />
                        )}
                        {month && (
                            <KPI label="Margem bruta" value={`${margin}%`} sub="Do MRR"
                                color={typeof margin === 'string' && parseInt(margin) > 50 ? '#22c55e' : parseInt(margin as string) > 0 ? '#f59e0b' : '#ef4444'}
                                tooltip="(Lucro bruto / MRR) × 100" />
                        )}
                    </div>

                    {/* ── Breakdown por categoria ── */}
                    {Object.keys(byCategory).length > 0 && (
                        <div style={S.card}>
                            <p style={S.cardLabel}>Distribuição por categoria — {monthLabel(month)}</p>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
                                {Object.entries(byCategory).sort((a, b) => b[1] - a[1]).map(([cat, val]) => {
                                    const color = CATEGORY_COLORS[cat as CostCategory] ?? '#64748b'
                                    const pct = (val / maxCat) * 100
                                    return (
                                        <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ width: 110, fontSize: 12, fontWeight: 600, color }}>{cat}</span>
                                            <div style={{ flex: 1, background: '#E2E8F0', borderRadius: 4, height: 7 }}>
                                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.4s' }} />
                                            </div>
                                            <span style={{ width: 72, textAlign: 'right', fontSize: 12, color: '#64748B', fontWeight: 700 }}>{fmtBRL(val)}</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* ── Histórico 6 meses ── */}
                    {history.length > 0 && (
                        <div style={S.card}>
                            <p style={S.cardLabel}>Custos totais — últimos 6 meses</p>
                            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 64, marginTop: 16 }}>
                                {history.map(h => (
                                    <div key={h.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                        <div title={`${monthLabel(h.month)}: ${fmtBRL(h.total)}`} style={{
                                            width: '100%', background: h.month === month ? '#EF4444' : '#FECACA',
                                            borderRadius: '3px 3px 0 0',
                                            height: `${Math.max((h.total / histMax) * 52, 2)}px`,
                                            transition: 'height 0.3s',
                                        }} />
                                        <span style={{ fontSize: 10, color: '#94A3B8' }}>{monthLabel(h.month)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* ── Lista de lançamentos ── */}
                    <div>
                        <p style={{ color: '#64748B', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                            {month ? `Lançamentos — ${monthLabel(month)}` : `Todos os lançamentos (${costs.length})`}
                        </p>
                        {costs.length === 0 && (
                            <div style={{ ...S.card, textAlign: 'center' }}>
                                <TrendingDown size={28} style={{ color: '#CBD5E1', margin: '0 auto 8px' }} />
                                <p style={{ color: '#94A3B8', fontSize: 13, margin: 0 }}>Nenhum custo registrado{month ? ' para este mês' : ''}.</p>
                                <p style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>Clique em "Adicionar" para lançar o primeiro.</p>
                            </div>
                        )}
                        {costs.length > 0 && (
                            <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                    <thead>
                                        <tr style={{ background: '#F7F9FC' }}>
                                            {['Serviço', 'Categoria', 'Valor', 'Observação', ''].map(h => (
                                                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {!month ? (() => {
                                            const groups: Record<string, Cost[]> = {}
                                            for (const c of costs) {
                                                const m = c.month.slice(0, 7)
                                                if (!groups[m]) groups[m] = []
                                                groups[m].push(c)
                                            }
                                            const sortedMs = Object.keys(groups).sort((a, b) => b.localeCompare(a))
                                            return sortedMs.flatMap(m => [
                                                <tr key={`g-${m}`} style={{ background: '#F1F5F9' }}>
                                                    <td colSpan={5} style={{ padding: '7px 14px', color: '#64748B', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', borderTop: '1px solid #E2E8F0' }}>
                                                        {monthLabel(m)} · {fmtBRL(groups[m].reduce((s, c) => s + Number(c.amount_brl), 0))}
                                                    </td>
                                                </tr>,
                                                ...groups[m].map(c => (
                                                    <tr key={c.id} style={{ borderTop: '1px solid #E2E8F0', background: '#FFFFFF' }}>
                                                        <td style={{ padding: '11px 14px', color: '#0E2A55', fontWeight: 600 }}>{c.service}</td>
                                                        <td style={{ padding: '11px 14px' }}>
                                                            <span style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLORS[c.category as CostCategory] ?? '#64748B', background: (CATEGORY_COLORS[c.category as CostCategory] ?? '#64748B') + '22', borderRadius: 5, padding: '2px 7px' }}>{c.category}</span>
                                                        </td>
                                                        <td style={{ padding: '11px 14px', color: '#EF4444', fontWeight: 700 }}>{fmtBRL(Number(c.amount_brl))}</td>
                                                        <td style={{ padding: '11px 14px', color: '#64748B', fontSize: 12 }}>{c.notes ?? '—'}</td>
                                                        <td style={{ padding: '11px 14px' }}>
                                                            <button onClick={() => deleteCost(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }} title="Remover">
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            ])
                                        })() : costs.map((c, i) => (
                                            <tr key={c.id} style={{ borderTop: '1px solid #E2E8F0', background: i % 2 === 0 ? '#FFFFFF' : '#F7F9FC' }}>
                                                <td style={{ padding: '11px 14px', color: '#0E2A55', fontWeight: 600 }}>{c.service}</td>
                                                <td style={{ padding: '11px 14px' }}>
                                                    <span style={{ fontSize: 11, fontWeight: 700, color: CATEGORY_COLORS[c.category as CostCategory] ?? '#64748B', background: (CATEGORY_COLORS[c.category as CostCategory] ?? '#64748B') + '22', borderRadius: 5, padding: '2px 7px' }}>{c.category}</span>
                                                </td>
                                                <td style={{ padding: '11px 14px', color: '#EF4444', fontWeight: 700 }}>{fmtBRL(Number(c.amount_brl))}</td>
                                                <td style={{ padding: '11px 14px', color: '#64748B', fontSize: 12 }}>{c.notes ?? '—'}</td>
                                                <td style={{ padding: '11px 14px' }}>
                                                    <button onClick={() => deleteCost(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4, display: 'flex' }} title="Remover">
                                                        <Trash2 size={13} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {!loading && !error && (
                <>
                    <div style={{ height: 1, background: '#E2E8F0', margin: '8px 0' }} />
                    <PartnersPanel token={token} mrr={mrr} totalCosts={totalMonth} month={month} numMonths={availableMonths.length || 1} />
                </>
            )}

            {showForm && (
                <AddCostModal
                    token={token}
                    defaultMonth={month}
                    onClose={() => setShowForm(false)}
                    onSaved={() => { setShowForm(false); load() }}
                />
            )}
        </div>
    )
}

function AddCostModal({ token, defaultMonth, onClose, onSaved }: {
    token: string; defaultMonth: string; onClose: () => void; onSaved: () => void
}) {
    const [month, setMonth] = useState(defaultMonth)
    const [category, setCategory] = useState<CostCategory>('Infraestrutura')
    const [service, setService] = useState('')
    const [customService, setCustomService] = useState('')
    const [amount, setAmount] = useState('')
    const [notes, setNotes] = useState('')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const finalService = service === '__custom' ? customService : service

    async function save() {
        if (!finalService || !amount) { setErr('Preencha serviço e valor.'); return }
        setSaving(true); setErr(null)
        try {
            await adminFetch('/api/admin/costs', token, {
                method: 'POST',
                body: JSON.stringify({ month, service: finalService, category, amount_brl: parseFloat(amount), notes: notes || null }),
            })
            onSaved()
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro ao salvar') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, width: '100%', maxWidth: 420 }}>
                <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Adicionar custo</p>
                <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 20 }}>Registre um gasto operacional do FlyWise</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={S.label}>Mês de referência
                        <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={inputSt()} />
                    </label>
                    <label style={S.label}>Categoria
                        <select value={category} onChange={e => { setCategory(e.target.value as CostCategory); setService('') }} style={inputSt()}>
                            {COST_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                    <label style={S.label}>Serviço
                        <select value={service} onChange={e => setService(e.target.value)} style={inputSt()}>
                            <option value="">Selecione…</option>
                            {SUGGESTED_SERVICES[category].map(s => <option key={s} value={s}>{s}</option>)}
                            <option value="__custom">Outro (digitar)</option>
                        </select>
                    </label>
                    {service === '__custom' && (
                        <label style={S.label}>Nome do serviço
                            <input value={customService} onChange={e => setCustomService(e.target.value)} placeholder="Ex: Notion, Figma…" style={inputSt()} />
                        </label>
                    )}
                    <label style={S.label}>Valor (R$)
                        <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0,00" style={inputSt()} />
                    </label>
                    <label style={S.label}>Observação <span style={{ color: '#94A3B8', fontWeight: 400 }}>(opcional)</span>
                        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex: plano Pro, 10 usuários…" style={inputSt()} />
                    </label>
                </div>

                {err && <p style={{ color: '#ef4444', fontSize: 12, marginTop: 12 }}>{err}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={S.btnSm}>Cancelar</button>
                    <button onClick={save} disabled={saving} style={S.btnPrimary}>
                        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Partners (Sócios) ───────────────────────────────────────────────────────

interface Partner {
    id: number
    name: string
    profit_pct: number
    cost_pct: number
    salary_brl: number
    notes: string | null
    active: boolean
    created_at: string
}

function PartnersPanel({ token, mrr, totalCosts, month, numMonths }: { token: string; mrr: number; totalCosts: number; month: string; numMonths: number }) {
    const [partners, setPartners] = useState<Partner[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editing, setEditing] = useState<Partner | null>(null)
    const [err, setErr] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        try { const d = await adminFetch('/api/admin/partners', token); setPartners(d.partners ?? []) }
        catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro') }
        finally { setLoading(false) }
    }, [token])

    useEffect(() => { load() }, [load])

    const monthlyCosts = !month && numMonths > 1 ? totalCosts / numMonths : totalCosts
    const profit = mrr - monthlyCosts
    const active = partners.filter(p => p.active)

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <BlockTitle icon={Users} title="Sócios" subtitle="Divisão de lucros, custos e pró-labore" />
                <button onClick={() => setShowForm(true)} style={S.btnPrimary}><Plus size={14} />Adicionar sócio</button>
            </div>

            {err && <ErrBox msg={err} onRetry={load} />}
            {loading ? <Spinner /> : (
                <>
                    {active.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            {active.map(p => {
                                const participacao = profit * p.profit_pct / 100
                                const total = participacao + Number(p.salary_brl)
                                return (
                                    <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 18px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 14, margin: 0 }}>{p.name}</p>
                                                <p style={{ color: '#94A3B8', fontSize: 10, margin: '2px 0 0', fontWeight: 500 }}>
                                                    {month ? monthLabel(month) : `Média/mês · ${numMonths}m`}
                                                </p>
                                            </div>
                                            <button onClick={() => setEditing(p)} style={S.btnXs}>Editar</button>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                <span style={{ color: '#64748B' }}>MRR</span>
                                                <span style={{ color: '#16A34A', fontWeight: 600 }}>{fmtBRL(mrr)}</span>
                                            </div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                <span style={{ color: '#64748B' }}>Custos</span>
                                                <span style={{ color: '#EF4444', fontWeight: 600 }}>−{fmtBRL(monthlyCosts)}</span>
                                            </div>
                                            <div style={{ height: 1, background: '#E2E8F0', margin: '2px 0' }} />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                <span style={{ color: '#64748B' }}>Lucro líquido</span>
                                                <span style={{ color: profit >= 0 ? '#0E2A55' : '#EF4444', fontWeight: 700 }}>{fmtBRL(profit)}</span>
                                            </div>
                                            {p.profit_pct > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                <span style={{ color: '#64748B' }}>Participação ({p.profit_pct}%)</span>
                                                <span style={{ color: '#16A34A', fontWeight: 700 }}>{fmtBRL(participacao)}</span>
                                            </div>}
                                            {Number(p.salary_brl) > 0 && <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                                                <span style={{ color: '#64748B' }}>Pró-labore</span>
                                                <span style={{ color: '#0E2A55', fontWeight: 700 }}>{fmtBRL(Number(p.salary_brl))}</span>
                                            </div>}
                                            <div style={{ height: 1, background: '#E2E8F0', margin: '4px 0' }} />
                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                                                <span style={{ color: '#0E2A55', fontWeight: 700 }}>Total do sócio</span>
                                                <span style={{ color: total >= 0 ? '#16A34A' : '#EF4444', fontWeight: 800 }}>{fmtBRL(total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {partners.length === 0 && (
                        <p style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: 20 }}>Nenhum sócio cadastrado.</p>
                    )}
                </>
            )}

            {showForm && <PartnerFormModal token={token} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
            {editing && <PartnerFormModal token={token} partner={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
        </div>
    )
}

function PartnerFormModal({ token, partner, onClose, onSaved }: {
    token: string; partner?: Partner; onClose: () => void; onSaved: () => void
}) {
    const [name, setName] = useState(partner?.name ?? '')
    const [profitPct, setProfitPct] = useState(String(partner?.profit_pct ?? 0))
    const [costPct, setCostPct] = useState(String(partner?.cost_pct ?? 0))
    const [salary, setSalary] = useState(String(partner?.salary_brl ?? 0))
    const [notes, setNotes] = useState(partner?.notes ?? '')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function save() {
        if (!name.trim()) { setErr('Nome é obrigatório'); return }
        setSaving(true); setErr(null)
        try {
            const body = { name, profit_pct: parseFloat(profitPct) || 0, cost_pct: parseFloat(costPct) || 0, salary_brl: parseFloat(salary) || 0, notes: notes || null }
            if (partner) {
                await adminFetch(`/api/admin/partners/${partner.id}`, token, { method: 'PATCH', body: JSON.stringify(body) })
            } else {
                await adminFetch('/api/admin/partners', token, { method: 'POST', body: JSON.stringify(body) })
            }
            onSaved()
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro') }
        finally { setSaving(false) }
    }

    async function deletePartner() {
        if (!partner || !confirm(`Remover ${partner.name}?`)) return
        setSaving(true)
        try {
            await adminFetch(`/api/admin/partners/${partner.id}`, token, { method: 'DELETE' })
            onSaved()
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, width: '100%', maxWidth: 400 }}>
                <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 15, marginBottom: 20 }}>{partner ? 'Editar sócio' : 'Novo sócio'}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={S.label}>Nome *<input value={name} onChange={e => setName(e.target.value)} style={inputSt()} /></label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                        <label style={S.label}>% Lucro<input type="number" min="0" max="100" step="0.5" value={profitPct} onChange={e => setProfitPct(e.target.value)} style={inputSt()} /></label>
                        <label style={S.label}>% Custos<input type="number" min="0" max="100" step="0.5" value={costPct} onChange={e => setCostPct(e.target.value)} style={inputSt()} /></label>
                    </div>
                    <label style={S.label}>Pró-labore (R$/mês)<input type="number" min="0" step="100" value={salary} onChange={e => setSalary(e.target.value)} style={inputSt()} /></label>
                    <label style={S.label}>Notas<textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputSt(), minHeight: 56, fontFamily: 'inherit' }} /></label>
                </div>
                {err && <p style={{ color: '#EF4444', fontSize: 12, marginTop: 12 }}>{err}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'space-between' }}>
                    {partner && <button onClick={deletePartner} disabled={saving} style={{ ...S.btnSm, color: '#DC2626', borderColor: '#FECACA' }}><Trash2 size={12} />Remover</button>}
                    <div style={{ display: 'flex', gap: 10, marginLeft: 'auto' }}>
                        <button onClick={onClose} style={S.btnSm}>Cancelar</button>
                        <button onClick={save} disabled={saving} style={S.btnPrimary}>{saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Salvar'}</button>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ─── Promoções ────────────────────────────────────────────────────────────────

function EditPromoModal({ promo, token, onClose, onSaved }: {
    promo: TransferPromo; token: string
    onClose: () => void; onSaved: (updated: TransferPromo) => void
}) {
    const [bonusPercent, setBonusPercent] = useState(String(promo.bonus_percent))
    const [clubBonusPercent, setClubBonusPercent] = useState(String(promo.club_bonus_percent ?? 0))
    const [tierJson, setTierJson] = useState(JSON.stringify(promo.club_tier_bonuses ?? {}, null, 2))
    const [lastConfirmed, setLastConfirmed] = useState(promo.last_confirmed ?? '')
    const [validUntil, setValidUntil] = useState(promo.valid_until ?? '')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    async function save() {
        setSaving(true); setErr(null)
        try {
            let tierBonuses: Record<string, number>
            try { tierBonuses = JSON.parse(tierJson) }
            catch { throw new Error('JSON dos planos inválido') }

            const updates = {
                bonus_percent: parseInt(bonusPercent) || 0,
                club_bonus_percent: parseInt(clubBonusPercent) || 0,
                club_tier_bonuses: tierBonuses,
                last_confirmed: lastConfirmed,
                valid_until: validUntil,
                updated_at: new Date().toISOString(),
            }
            const { error: supaErr } = await supabase.from('transfer_promotions').update(updates).eq('id', promo.id)
            if (supaErr) throw new Error(supaErr.message)
            // Invalida cache no servidor
            await adminFetch('/api/transfer-promotions/update', token, { method: 'POST' }).catch(() => null)
            onSaved({ ...promo, ...updates })
        } catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Erro') }
        finally { setSaving(false) }
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 24, width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ color: '#0E2A55', fontWeight: 700, fontSize: 15, margin: 0 }}>{promo.card_id}</p>
                        <p style={{ color: '#94A3B8', fontSize: 12, margin: 0 }}>{promo.program}</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <label style={S.label}>
                        Bônus base (%)
                        <input type="number" value={bonusPercent} onChange={e => setBonusPercent(e.target.value)} style={inputSt()} />
                    </label>
                    <label style={S.label}>
                        Bônus clube (%)
                        <input type="number" value={clubBonusPercent} onChange={e => setClubBonusPercent(e.target.value)} style={inputSt()} />
                    </label>
                    <label style={S.label}>
                        Última confirmação
                        <input type="text" value={lastConfirmed} onChange={e => setLastConfirmed(e.target.value)} placeholder="Mai/2026" style={inputSt()} />
                    </label>
                    <label style={S.label}>
                        Válido até
                        <input type="text" value={validUntil} onChange={e => setValidUntil(e.target.value)} style={inputSt()} />
                    </label>
                </div>

                <label style={S.label}>
                    Bônus por plano (JSON)
                    <textarea
                        value={tierJson}
                        onChange={e => setTierJson(e.target.value)}
                        rows={6}
                        style={inputSt({ fontFamily: 'monospace', fontSize: 11, resize: 'vertical' })}
                    />
                </label>

                {err && <p style={{ color: '#f87171', fontSize: 12, margin: 0 }}>{err}</p>}

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={S.btnSm}>Cancelar</button>
                    <button onClick={save} disabled={saving} style={S.btnPrimary}>
                        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : null}
                        Salvar
                    </button>
                </div>
            </div>
        </div>
    )
}

const SYNC_STEP_LABELS: Record<string, string> = {
    scraping: 'Scraping fontes RSS...',
    analyzing: 'Analisando com Claude Sonnet...',
    updating: 'Atualizando banco...',
    done: 'Concluído',
    error: 'Erro no sync',
    idle: '',
}

function Promocoes({ token }: { token: string }) {
    const [promos, setPromos] = useState<TransferPromo[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [syncing, setSyncing] = useState(false)
    const [syncingAI, setSyncingAI] = useState(false)
    const [syncMsg, setSyncMsg] = useState<string | null>(null)
    const [syncStep, setSyncStep] = useState<string | null>(null)
    const [editing, setEditing] = useState<TransferPromo | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try {
            const { data, error: err } = await supabase.from('transfer_promotions')
                .select('id, card_id, program, bonus_percent, club_bonus_percent, club_tier_bonuses, valid_until, active, last_confirmed, is_periodic').order('card_id')
            if (err) throw err
            setPromos(data ?? [])
        } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
        finally { setLoading(false) }
    }, [])

    useEffect(() => { load() }, [load])

    async function syncCache() {
        setSyncing(true); setSyncMsg(null)
        try {
            await adminFetch('/api/transfer-promotions/update', token, { method: 'POST' })
            setSyncMsg('Cache invalidado.')
            await load()
        } catch (e: unknown) { setSyncMsg(e instanceof Error ? e.message : 'Erro') }
        finally { setSyncing(false) }
    }

    async function syncAI() {
        setSyncingAI(true); setSyncMsg(null); setSyncStep('Disparando...')
        try {
            await adminFetch('/api/admin/sync-transfer-data', token, { method: 'POST' })
            // Poll status a cada 4s até concluir (max 3 min)
            for (let i = 0; i < 45; i++) {
                await new Promise(r => setTimeout(r, 4000))
                try {
                    const status = await adminFetch('/api/admin/transfer-sync-status', token)
                    setSyncStep(SYNC_STEP_LABELS[status.step] ?? status.step)
                    if (!status.inProgress) {
                        const res = status.lastResult
                        if (res?.error) {
                            setSyncMsg(`Erro: ${res.error}`)
                        } else if (res?.changesDetected) {
                            const diffsText = res.diffs?.length
                                ? ` (${res.diffs.map((d: { card_id: string; program: string }) => `${d.card_id}→${d.program}`).join(', ')})`
                                : ''
                            setSyncMsg(`✓ ${res.rowsUpdated} promo(s) atualizada(s)${diffsText}`)
                        } else {
                            setSyncMsg('✓ Nenhuma mudança detectada — dados já estão atualizados.')
                        }
                        await load()
                        break
                    }
                } catch { break }
            }
        } catch (e: unknown) {
            setSyncMsg(e instanceof Error ? e.message : 'Erro no sync AI')
        } finally {
            setSyncingAI(false); setSyncStep(null)
        }
    }

    async function toggleActive(id: number, current: boolean) {
        await supabase.from('transfer_promotions').update({ active: !current }).eq('id', id)
        setPromos(p => p.map(x => x.id === id ? { ...x, active: !current } : x))
    }

    if (loading) return <Spinner />
    if (error) return <ErrBox msg={error} onRetry={load} />

    const activeCount = promos.filter(p => p.active).length

    // Detect stale: any promo with last_confirmed older than 45 days
    const today = new Date()
    const staleMonths = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
    const isStale = promos.some(p => {
        if (!p.last_confirmed) return true
        const [mon, yr] = p.last_confirmed.toLowerCase().split('/')
        const mi = staleMonths.findIndex(m => mon.startsWith(m))
        if (mi < 0 || !yr) return true
        const confirmed = new Date(parseInt('20' + yr.trim()), mi, 1)
        return (today.getTime() - confirmed.getTime()) > 45 * 24 * 60 * 60 * 1000
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {editing && (
                <EditPromoModal
                    promo={editing} token={token}
                    onClose={() => setEditing(null)}
                    onSaved={updated => {
                        setPromos(p => p.map(x => x.id === updated.id ? updated : x))
                        setEditing(null)
                    }}
                />
            )}

            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <BlockTitle icon={Tag} title="Promoções de transferência" subtitle="Bônus exibidos no simulador. Edite diretamente ou dispare o sync com IA." />
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    {syncingAI && syncStep && (
                        <span style={{ fontSize: 11, color: '#2A60C2', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                            {syncStep}
                        </span>
                    )}
                    {!syncingAI && syncMsg && <span style={{ fontSize: 12, color: syncMsg.startsWith('✓') ? '#16A34A' : syncMsg.startsWith('Erro') ? '#DC2626' : '#64748B' }}>{syncMsg}</span>}
                    <button onClick={syncCache} disabled={syncing || syncingAI} style={S.btnSm}>
                        {syncing ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <RefreshCw size={13} />}
                        Cache
                    </button>
                    <button onClick={syncAI} disabled={syncingAI} style={{ ...S.btnSm, borderColor: '#BFDBFE', color: '#2A60C2' }}>
                        {syncingAI ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={13} />}
                        Sync AI
                    </button>
                </div>
            </div>

            {isStale && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                    <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                    Dados com mais de 45 dias sem confirmação. Edite as promoções ou use "Sync AI" para atualizar automaticamente.
                </div>
            )}

            <div style={{ display: 'flex', gap: 12, fontSize: 12 }}>
                <span style={{ color: '#16A34A' }}>{activeCount} ativas</span>
                <span style={{ color: '#CBD5E1' }}>·</span>
                <span style={{ color: '#94A3B8' }}>{promos.length - activeCount} inativas</span>
            </div>

            <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                        <tr style={{ background: '#F7F9FC' }}>
                            {['Cartão', 'Programa', 'Base', 'Clube', 'Última conf.', 'Per.', 'Ativo', ''].map(h => (
                                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', color: '#94A3B8', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {promos.map((p, i) => {
                            const [mon, yr] = (p.last_confirmed ?? '').toLowerCase().split('/')
                            const mi = staleMonths.findIndex(m => mon?.startsWith(m))
                            const confirmedDate = mi >= 0 && yr ? new Date(parseInt('20' + yr.trim()), mi, 1) : null
                            const rowStale = !confirmedDate || (today.getTime() - confirmedDate.getTime()) > 45 * 24 * 60 * 60 * 1000
                            return (
                                <tr key={p.id} style={{ borderTop: '1px solid #E2E8F0', background: i % 2 === 0 ? '#FFFFFF' : '#F7F9FC', opacity: p.active ? 1 : 0.4 }}>
                                    <td style={{ padding: '11px 14px', color: '#0E2A55', fontWeight: 600, whiteSpace: 'nowrap' }}>{p.card_id}</td>
                                    <td style={{ padding: '11px 14px', color: '#64748B' }}>{p.program}</td>
                                    <td style={{ padding: '11px 14px', color: '#16A34A', fontWeight: 700 }}>+{p.bonus_percent}%</td>
                                    <td style={{ padding: '11px 14px', color: '#2A60C2', fontWeight: 600 }}>+{p.club_bonus_percent ?? 0}%</td>
                                    <td style={{ padding: '11px 14px', color: rowStale ? '#D97706' : '#64748B', fontSize: 11, whiteSpace: 'nowrap' }}>
                                        {rowStale && <AlertTriangle size={10} style={{ marginRight: 4, verticalAlign: 'middle' }} />}
                                        {p.last_confirmed ?? '—'}
                                    </td>
                                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                                        {p.is_periodic ? <CheckCircle size={13} style={{ color: '#16A34A' }} /> : <XCircle size={13} style={{ color: '#CBD5E1' }} />}
                                    </td>
                                    <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                                        <button onClick={() => toggleActive(p.id, p.active)} title={p.active ? 'Desativar' : 'Ativar'} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                                            {p.active ? <CheckCircle size={15} style={{ color: '#16A34A' }} /> : <XCircle size={15} style={{ color: '#CBD5E1' }} />}
                                        </button>
                                    </td>
                                    <td style={{ padding: '8px 14px' }}>
                                        <button onClick={() => setEditing(p)} style={S.btnXs}>Editar</button>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Logs ─────────────────────────────────────────────────────────────────────

function Logs({ token }: { token: string }) {
    const [logs, setLogs] = useState<SyncLog[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true); setError(null)
        try { const data = await adminFetch('/api/admin/transfer-sync-log', token); setLogs(data.logs) }
        catch (e: unknown) { setError(e instanceof Error ? e.message : 'Erro') }
        finally { setLoading(false) }
    }, [token])

    useEffect(() => { load() }, [load])

    if (loading) return <Spinner />
    if (error) return <ErrBox msg={error} onRetry={load} />

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <BlockTitle icon={FileText} title="Logs de sincronização" subtitle="Histórico do sync automático de promoções de transferência. Útil para detectar falhas ou confirmar atualização dos dados." />
                <button onClick={load} style={{ ...S.btnSm, marginTop: 2 }}><RefreshCw size={13} /></button>
            </div>
            {logs.length === 0 && <p style={{ color: '#94A3B8', textAlign: 'center', padding: 32, fontSize: 13 }}>Nenhum log encontrado.</p>}
            {logs.map(log => {
                // Separate Claude summary from field-level diffs stored after \n\nMUDANÇAS:
                const [summaryPart, diffsPart] = (log.summary ?? '').split('\n\nMUDANÇAS:\n')
                const diffLines = diffsPart ? diffsPart.split('\n').filter(Boolean) : []
                return (
                <div key={log.id} style={{ background: '#FFFFFF', border: `1px solid ${log.changes_detected ? '#BFDBFE' : '#E2E8F0'}`, borderRadius: 10, padding: '13px 16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {log.changes_detected
                                ? <CheckCircle size={14} style={{ color: '#16A34A', flexShrink: 0 }} />
                                : <UserX size={14} style={{ color: '#94A3B8', flexShrink: 0 }} />}
                            <span style={{ color: '#0E2A55', fontSize: 13, fontWeight: 600 }}>
                                {log.changes_detected ? `${log.rows_updated} linha(s) atualizada(s)` : 'Sem alterações detectadas'}
                            </span>
                        </div>
                        <span style={{ color: '#94A3B8', fontSize: 11, whiteSpace: 'nowrap' }}>{fmtDateTime(log.synced_at)}</span>
                    </div>
                    {summaryPart && <p style={{ color: '#64748B', fontSize: 12, marginTop: 6, lineHeight: 1.5 }}>{summaryPart}</p>}
                    {diffLines.length > 0 && (
                        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {diffLines.map((line, i) => (
                                <span key={i} style={{ fontFamily: 'monospace', fontSize: 11, color: line.startsWith('+') ? '#16A34A' : '#D97706', background: '#F7F9FC', borderRadius: 4, padding: '2px 6px' }}>
                                    {line}
                                </span>
                            ))}
                        </div>
                    )}
                    <p style={{ color: '#94A3B8', fontSize: 11, marginTop: 6 }}>{log.sources_scraped} fonte(s) verificada(s)</p>
                </div>
                )
            })}
        </div>
    )
}

// ─── PostGenerator ────────────────────────────────────────────────────────────

type SlideBg = 'navy' | 'white' | 'snow' | 'vibrant'

interface SlideData {
    background: SlideBg
    tag: string
    headline: string
    headlineSize: number
    body: string
    swipeHint: string
}

const BG_LABELS: Record<SlideBg, string> = { navy: 'Navy', white: 'Branco', snow: 'Snow', vibrant: 'Azul CTA' }
const BG_COLORS: Record<SlideBg, string> = { navy: '#0E2A55', white: '#e2e8f0', snow: '#F7F9FC', vibrant: '#2A60C2' }
const BG_TEXT:   Record<SlideBg, string> = { navy: '#fff',    white: '#0E2A55', snow: '#0E2A55', vibrant: '#fff' }

const CALENDAR_REC: Record<number, { format: string; pilar: string; label: string }> = {
    1: { format: 'carrossel', pilar: 'estrategia', label: 'Segunda → Carrossel Estratégia' },
    2: { format: 'isolado',   pilar: 'produto',    label: 'Terça → Post Isolado Produto' },
    3: { format: 'isolado',   pilar: 'produto',    label: 'Quarta → Post Isolado Produto / Inspiração' },
    4: { format: 'carrossel', pilar: 'inspiracao', label: 'Quinta → Carrossel Inspiração' },
    5: { format: 'carrossel', pilar: 'prova',      label: 'Sexta → Carrossel Prova' },
    6: { format: 'story',     pilar: 'estrategia', label: 'Sábado → Story Urgente' },
    0: { format: 'story',     pilar: 'inspiracao', label: 'Domingo → Story Inspiração' },
}

const DAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']

function PostGenerator({ token }: { token: string }) {
    const today = new Date()
    const dow = today.getDay()
    const rec = CALENDAR_REC[dow]

    const [format, setFormat] = useState(rec.format)
    const [pilar, setPilar] = useState(rec.pilar)
    const [topic, setTopic] = useState('')
    const [aiLoading, setAiLoading] = useState(false)
    const [aiErr, setAiErr] = useState<string | null>(null)

    const [slides, setSlides] = useState<SlideData[]>([])
    const [caption, setCaption] = useState('')
    const [imgLoading, setImgLoading] = useState(false)
    const [images, setImages] = useState<{ name: string; data: string }[]>([])
    const [imgErr, setImgErr] = useState<string | null>(null)

    const updateSlide = (i: number, field: keyof SlideData, value: string | number) =>
        setSlides(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s))

    const addSlide = () => {
        if (slides.length >= 7) return
        setSlides(prev => [...prev, { background: 'white', tag: '', headline: '', headlineSize: 0, body: '', swipeHint: '' }])
    }

    const removeSlide = (i: number) =>
        setSlides(prev => prev.filter((_, idx) => idx !== i))

    const generateContent = async () => {
        setAiLoading(true)
        setAiErr(null)
        setImages([])
        try {
            const data = await adminFetch('/api/admin/generate-post-content', token, {
                method: 'POST',
                body: JSON.stringify({ format, pilar, topic, dayOfWeek: DAY_NAMES[dow] }),
            })
            setSlides(data.slides ?? [])
            setCaption(data.caption ?? '')
        } catch (e: unknown) {
            setAiErr(e instanceof Error ? e.message : String(e))
        } finally {
            setAiLoading(false)
        }
    }

    const generateImages = async () => {
        if (!slides.length) return
        setImgLoading(true)
        setImgErr(null)
        setImages([])
        try {
            const data = await adminFetch('/api/admin/generate-post', token, {
                method: 'POST',
                body: JSON.stringify({ slides, postFormat: format === 'story' ? 'story' : 'feed' }),
            })
            setImages(data.images)
        } catch (e: unknown) {
            setImgErr(e instanceof Error ? e.message : String(e))
        } finally {
            setImgLoading(false)
        }
    }

    const downloadAll = () => {
        images.forEach(({ name, data }, i) => {
            setTimeout(() => {
                const a = document.createElement('a')
                a.href = `data:image/png;base64,${data}`
                a.download = name
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
            }, i * 350)
        })
    }

    const labelSt: React.CSSProperties = {
        color: '#94A3B8', fontSize: 11, fontWeight: 700, letterSpacing: '0.07em',
        textTransform: 'uppercase', display: 'block', marginBottom: 6,
    }

    const chipSt = (active: boolean, color = '#2A60C2'): React.CSSProperties => ({
        padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        background: active ? color : '#F7F9FC',
        border: `1.5px solid ${active ? color : '#E2E8F0'}`,
        color: active ? '#fff' : '#64748B',
        transition: 'all 0.15s',
    })

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <BlockTitle icon={Image} title="Gerador de Posts" subtitle="Crie conteúdo para o Instagram do FlyWise com IA" />

            {/* ── Painel de Criação ── */}
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
                    <Zap size={14} style={{ color: '#2A60C2' }} />
                    <span style={{ color: '#0E2A55', fontSize: 13, fontWeight: 700 }}>Gerar conteúdo com IA</span>
                    <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: 11, background: '#F7F9FC', border: '1px solid #E2E8F0', borderRadius: 6, padding: '3px 8px' }}>
                        {rec.label}
                    </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                        <label style={labelSt}>Formato</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                                { id: 'carrossel', label: 'Carrossel Feed' },
                                { id: 'isolado',   label: 'Post Isolado Feed' },
                                { id: 'story',     label: 'Story' },
                            ].map(f => (
                                <button key={f.id} onClick={() => setFormat(f.id)} style={chipSt(format === f.id)}>
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={labelSt}>Pilar</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[
                                { id: 'estrategia', label: 'Estratégia' },
                                { id: 'produto',    label: 'Produto' },
                                { id: 'inspiracao', label: 'Inspiração' },
                                { id: 'prova',      label: 'Prova' },
                            ].map(p => (
                                <button key={p.id} onClick={() => setPilar(p.id)} style={chipSt(pilar === p.id, '#7c3aed')}>
                                    {p.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label style={labelSt}>Tema ou ângulo (opcional)</label>
                        <input
                            value={topic}
                            onChange={e => setTopic(e.target.value)}
                            placeholder="Ex: como saber se vale usar milhas numa viagem internacional"
                            style={inputSt()}
                            onKeyDown={e => e.key === 'Enter' && generateContent()}
                        />
                        <p style={{ color: '#94A3B8', fontSize: 11, marginTop: 6 }}>
                            Deixe em branco para a IA escolher o melhor tema para o {DAY_NAMES[dow].toLowerCase()}.
                        </p>
                    </div>

                    {aiErr && (
                        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#B91C1C', fontSize: 12 }}>
                            {aiErr}
                        </div>
                    )}

                    <button onClick={generateContent} disabled={aiLoading} style={{
                        background: aiLoading ? '#E2E8F0' : 'linear-gradient(135deg, #2A60C2, #7c3aed)',
                        border: 'none', borderRadius: 10, color: aiLoading ? '#94A3B8' : '#fff',
                        fontSize: 14, fontWeight: 700, padding: '13px 22px', cursor: aiLoading ? 'not-allowed' : 'pointer',
                        alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.2s',
                    }}>
                        {aiLoading
                            ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Gerando conteúdo...</>
                            : <><Zap size={15} /> Gerar conteúdo</>}
                    </button>
                </div>
            </div>

            {/* ── Editor de Slides ── */}
            {slides.length > 0 && <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <p style={{ color: '#64748B', fontSize: 12, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', margin: 0 }}>
                        {slides.length} slides gerados — edite se necessário
                    </p>
                    {slides.length < 7 && (
                        <button onClick={addSlide} style={{ ...S.btnSm, gap: 5 }}>
                            <Plus size={12} /> Adicionar slide
                        </button>
                    )}
                </div>

                {slides.map((slide, i) => (
                    <div key={i} style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 18, height: 18, borderRadius: 4, background: BG_COLORS[slide.background], border: '1px solid #E2E8F0', flexShrink: 0 }} />
                                <span style={{ color: '#64748B', fontSize: 13, fontWeight: 700 }}>Slide {i + 1}</span>
                            </div>
                            {slides.length > 1 && (
                                <button onClick={() => removeSlide(i)} style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer', padding: 4 }}>
                                    <Trash2 size={13} />
                                </button>
                            )}
                        </div>

                        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                            {(['navy', 'white', 'snow', 'vibrant'] as SlideBg[]).map(bg => (
                                <button key={bg} onClick={() => updateSlide(i, 'background', bg)} style={{
                                    padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    background: slide.background === bg ? BG_COLORS[bg] : '#F7F9FC',
                                    border: `1.5px solid ${slide.background === bg ? BG_COLORS[bg] : '#E2E8F0'}`,
                                    color: slide.background === bg ? BG_TEXT[bg] : '#64748B',
                                    transition: 'all 0.12s',
                                }}>
                                    {BG_LABELS[bg]}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div>
                                <label style={labelSt}>Tag</label>
                                <input value={slide.tag} onChange={e => updateSlide(i, 'tag', e.target.value)}
                                    placeholder="O PROBLEMA" style={inputSt()} />
                            </div>
                            <div>
                                <label style={labelSt}>Swipe hint</label>
                                <input value={slide.swipeHint} onChange={e => updateSlide(i, 'swipeHint', e.target.value)}
                                    placeholder="arrasta →" style={inputSt()} />
                            </div>
                        </div>

                        <div style={{ marginBottom: 10 }}>
                            <label style={labelSt}>Headline</label>
                            <textarea value={slide.headline} onChange={e => updateSlide(i, 'headline', e.target.value)}
                                rows={3} placeholder="Título principal"
                                style={inputSt({ fontFamily: 'Manrope, sans-serif', fontWeight: 800, resize: 'vertical', height: 84 })} />
                        </div>

                        <div>
                            <label style={labelSt}>Corpo</label>
                            <textarea value={slide.body} onChange={e => updateSlide(i, 'body', e.target.value)}
                                rows={3} placeholder="Texto do corpo (↵ = nova linha)"
                                style={inputSt({ resize: 'vertical', height: 96 })} />
                        </div>
                    </div>
                ))}

                {/* Caption */}
                <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: 20 }}>
                    <label style={labelSt}>Caption (Instagram)</label>
                    <textarea value={caption} onChange={e => setCaption(e.target.value)}
                        rows={6} placeholder="Caption com hashtags..."
                        style={inputSt({ resize: 'vertical', height: 160 })} />
                    {caption && (
                        <button onClick={() => navigator.clipboard.writeText(caption)}
                            style={{ ...S.btnXs, marginTop: 8 }}>
                            Copiar caption
                        </button>
                    )}
                </div>

                {/* Gerar imagens */}
                {imgErr && (
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '10px 14px', color: '#B91C1C', fontSize: 12 }}>
                        {imgErr}
                    </div>
                )}

                <button onClick={generateImages} disabled={imgLoading} style={{
                    background: imgLoading ? '#E2E8F0' : '#2A60C2', border: 'none', borderRadius: 10,
                    color: imgLoading ? '#94A3B8' : '#fff', fontSize: 14, fontWeight: 700, padding: '13px 22px',
                    cursor: imgLoading ? 'not-allowed' : 'pointer', alignSelf: 'flex-start',
                    display: 'flex', alignItems: 'center', gap: 8, transition: 'all 0.15s',
                }}>
                    {imgLoading
                        ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Renderizando slides...</>
                        : <><Image size={15} /> Gerar {slides.length} Slides (PNG)</>}
                </button>

                {/* Resultados */}
                {images.length > 0 && (
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: 24 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <CheckCircle size={15} style={{ color: '#16A34A' }} />
                                <span style={{ color: '#0E2A55', fontSize: 14, fontWeight: 700 }}>{images.length} slides prontos</span>
                            </div>
                            <button onClick={downloadAll} style={{ ...S.btnSm, background: '#DCFCE7', borderColor: '#BBF7D0', color: '#16A34A' }}>
                                Baixar tudo ({images.length} PNGs)
                            </button>
                        </div>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            {images.map(({ name, data }) => {
                                const th = format === 'story' ? 171 : 120
                                return (
                                    <a key={name} href={`data:image/png;base64,${data}`} download={name}
                                        style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center', textDecoration: 'none' }}
                                        title={`Clique para baixar ${name}`}>
                                        <img src={`data:image/png;base64,${data}`} alt={name}
                                            style={{ width: 96, height: th, objectFit: 'cover', borderRadius: 8, border: '1px solid #E2E8F0' }} />
                                        <span style={{ color: '#94A3B8', fontSize: 10 }}>{name}</span>
                                    </a>
                                )
                            })}
                        </div>
                    </div>
                )}
            </>}
        </div>
    )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
    grid5: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))', gap: 10 } as React.CSSProperties,
    grid4: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))', gap: 10 } as React.CSSProperties,
    grid3: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: 10 } as React.CSSProperties,
    card: { background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px 20px' } as React.CSSProperties,
    cardLabel: { fontSize: 11, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 } as React.CSSProperties,
    btnPrimary: { background: '#2A60C2', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 } as React.CSSProperties,
    btnSm: { background: '#F7F9FC', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 13px', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 } as React.CSSProperties,
    btnXs: { background: '#F7F9FC', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' } as React.CSSProperties,
    label: { display: 'flex', flexDirection: 'column', gap: 6, color: '#64748B', fontSize: 12, fontWeight: 600 } as React.CSSProperties,
}

function inputSt(extra: React.CSSProperties = {}): React.CSSProperties {
    return { background: '#F7F9FC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0E2A55', fontSize: 13, padding: '8px 12px', outline: 'none', width: '100%', ...extra }
}

// ─── Codigos (Divulgação) ────────────────────────────────────────────────────

interface ReferralCode {
    id: number
    code: string
    owner_name: string
    owner_contact: string | null
    notes: string | null
    active: boolean
    created_at: string
    updated_at: string
    signups_count: number
    paying_count: number
    plan_breakdown: Record<string, number>
    commission_pct: number
    monthly_revenue: number
    commission_owed: number
}

function Codigos({ token }: { token: string }) {
    const [codes, setCodes] = useState<ReferralCode[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [editing, setEditing] = useState<ReferralCode | null>(null)
    const [showCreate, setShowCreate] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await adminFetch('/api/admin/referral-codes', token)
            setCodes(data.codes ?? [])
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setLoading(false)
        }
    }, [token])

    useEffect(() => { load() }, [load])

    const handleCreate = async (payload: { owner_name: string; owner_contact: string; notes: string; commission_pct: number }) => {
        setCreating(true)
        try {
            await adminFetch('/api/admin/referral-codes', token, {
                method: 'POST',
                body: JSON.stringify(payload),
            })
            setShowCreate(false)
            await load()
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e))
        } finally {
            setCreating(false)
        }
    }

    const handleToggleActive = async (c: ReferralCode) => {
        try {
            await adminFetch(`/api/admin/referral-codes/${c.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({ active: !c.active }),
            })
            await load()
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e))
        }
    }

    const handleDelete = async (c: ReferralCode) => {
        if (!confirm(`Remover o código ${c.code} de ${c.owner_name}? Os usuários já cadastrados mantêm o vínculo.`)) return
        try {
            await adminFetch(`/api/admin/referral-codes/${c.id}`, token, { method: 'DELETE' })
            await load()
        } catch (e) {
            alert(e instanceof Error ? e.message : String(e))
        }
    }

    const handleCopy = (code: string) => {
        navigator.clipboard.writeText(code)
    }

    if (loading) return <Spinner />
    if (error) return <ErrBox msg={error} onRetry={load} />

    const thSt: React.CSSProperties = {
        padding: '12px 14px', textAlign: 'left', color: '#94A3B8',
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
    }
    const tdSt: React.CSSProperties = {
        padding: '12px 14px', fontSize: 13, color: '#334155', borderTop: '1px solid #E2E8F0',
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <BlockTitle icon={Megaphone} title="Códigos de divulgação" subtitle={`${codes.length} divulgador${codes.length !== 1 ? 'es' : ''}`} />
                <button onClick={() => setShowCreate(true)} style={S.btnPrimary}>
                    <Plus size={14} style={{ marginRight: 6 }} />Novo divulgador
                </button>
            </div>

            <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F7F9FC' }}>
                        <tr>
                            <th style={thSt}>Código</th>
                            <th style={thSt}>Divulgador</th>
                            <th style={thSt}>Contato</th>
                            <th style={thSt}>Cadastros</th>
                            <th style={thSt}>Pagantes</th>
                            <th style={thSt}>Receita/mês</th>
                            <th style={thSt}>Comissão</th>
                            <th style={thSt}>Status</th>
                            <th style={thSt}>Criado</th>
                            <th style={thSt}>Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {codes.length === 0 && (
                            <tr>
                                <td colSpan={10} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                                    Nenhum código cadastrado ainda.
                                </td>
                            </tr>
                        )}
                        {codes.map((c, i) => (
                            <tr key={c.id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F7F9FC' }}>
                                <td style={tdSt}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                        <code style={{ color: '#2A60C2', fontWeight: 700 }}>{c.code}</code>
                                        <button onClick={() => handleCopy(c.code)} style={{ ...S.btnXs, padding: '2px 6px' }} title="Copiar código">
                                            Copiar
                                        </button>
                                    </div>
                                </td>
                                <td style={{ ...tdSt, color: '#0E2A55', fontWeight: 600 }}>{c.owner_name}</td>
                                <td style={{ ...tdSt, color: '#94A3B8' }}>{c.owner_contact ?? '—'}</td>
                                <td style={{ ...tdSt, fontWeight: 700, color: '#0E2A55' }}>{c.signups_count}</td>
                                <td style={{ ...tdSt, fontWeight: 700, color: c.paying_count > 0 ? '#16A34A' : '#94A3B8' }}>
                                    {c.paying_count}
                                    {c.paying_count > 0 && (
                                        <span style={{ color: '#94A3B8', fontWeight: 400, fontSize: 11, marginLeft: 6 }}>
                                            ({Object.entries(c.plan_breakdown)
                                                .filter(([p]) => p !== 'free')
                                                .map(([p, n]) => `${n} ${p}`)
                                                .join(', ')})
                                        </span>
                                    )}
                                </td>
                                <td style={{ ...tdSt, fontWeight: 700, color: c.monthly_revenue > 0 ? '#0E2A55' : '#94A3B8' }}>
                                    {c.monthly_revenue > 0 ? fmtBRL(c.monthly_revenue) : '—'}
                                </td>
                                <td style={{ ...tdSt }}>
                                    {c.commission_pct > 0 ? (
                                        <span>
                                            <span style={{ color: '#D97706', fontWeight: 700 }}>{fmtBRL(c.commission_owed)}</span>
                                            <span style={{ color: '#94A3B8', fontSize: 11, marginLeft: 4 }}>({c.commission_pct}%)</span>
                                        </span>
                                    ) : (
                                        <span style={{ color: '#94A3B8' }}>—</span>
                                    )}
                                </td>
                                <td style={tdSt}>
                                    <span style={{
                                        padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                                        background: c.active ? '#DCFCE7' : '#FEF2F2',
                                        color: c.active ? '#16A34A' : '#DC2626',
                                    }}>
                                        {c.active ? 'Ativo' : 'Inativo'}
                                    </span>
                                </td>
                                <td style={{ ...tdSt, color: '#94A3B8', fontSize: 12 }}>{fmtDate(c.created_at)}</td>
                                <td style={tdSt}>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button onClick={() => setEditing(c)} style={S.btnXs}>Editar</button>
                                        <button onClick={() => handleToggleActive(c)} style={S.btnXs}>
                                            {c.active ? 'Pausar' : 'Reativar'}
                                        </button>
                                        <button onClick={() => handleDelete(c)} style={{ ...S.btnXs, color: '#DC2626' }}>
                                            <Trash2 size={12} />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {showCreate && (
                <CreateReferralModal
                    onClose={() => setShowCreate(false)}
                    onSave={handleCreate}
                    saving={creating}
                />
            )}
            {editing && (
                <EditReferralModal
                    code={editing}
                    token={token}
                    onClose={() => setEditing(null)}
                    onSaved={() => { setEditing(null); load() }}
                />
            )}
        </div>
    )
}

function CreateReferralModal({
    onClose, onSave, saving,
}: {
    onClose: () => void
    onSave: (p: { owner_name: string; owner_contact: string; notes: string; commission_pct: number }) => void
    saving: boolean
}) {
    const [ownerName, setOwnerName] = useState('')
    const [ownerContact, setOwnerContact] = useState('')
    const [notes, setNotes] = useState('')
    const [commissionPct, setCommissionPct] = useState('0')
    const [err, setErr] = useState<string | null>(null)

    const submit = () => {
        if (!ownerName.trim()) { setErr('Nome é obrigatório'); return }
        setErr(null)
        onSave({ owner_name: ownerName, owner_contact: ownerContact, notes, commission_pct: parseFloat(commissionPct) || 0 })
    }

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440 }}>
                <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Novo divulgador</p>
                <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 20 }}>O código será gerado automaticamente.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={S.label}>Nome do divulgador *
                        <input value={ownerName} onChange={e => setOwnerName(e.target.value)} style={inputSt()} placeholder="Ex: Maria Silva" />
                    </label>
                    <label style={S.label}>Contato
                        <input value={ownerContact} onChange={e => setOwnerContact(e.target.value)} style={inputSt()} placeholder="Email, telefone ou @instagram" />
                    </label>
                    <label style={S.label}>Comissão (%)
                        <input type="number" min="0" max="100" step="0.5" value={commissionPct} onChange={e => setCommissionPct(e.target.value)} style={inputSt()} placeholder="Ex: 10" />
                    </label>
                    <label style={S.label}>Notas internas
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputSt(), minHeight: 60, fontFamily: 'inherit' }} placeholder="Opcional" />
                    </label>
                </div>
                {err && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 12 }}>{err}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={S.btnSm}>Cancelar</button>
                    <button onClick={submit} disabled={saving} style={S.btnPrimary}>
                        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Criar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

function EditReferralModal({
    code, token, onClose, onSaved,
}: {
    code: ReferralCode
    token: string
    onClose: () => void
    onSaved: () => void
}) {
    const [ownerName, setOwnerName] = useState(code.owner_name)
    const [ownerContact, setOwnerContact] = useState(code.owner_contact ?? '')
    const [notes, setNotes] = useState(code.notes ?? '')
    const [commissionPct, setCommissionPct] = useState(String(code.commission_pct ?? 0))
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState<string | null>(null)

    const save = async () => {
        if (!ownerName.trim()) { setErr('Nome é obrigatório'); return }
        setSaving(true)
        setErr(null)
        try {
            await adminFetch(`/api/admin/referral-codes/${code.id}`, token, {
                method: 'PATCH',
                body: JSON.stringify({
                    owner_name: ownerName,
                    owner_contact: ownerContact,
                    notes,
                    commission_pct: parseFloat(commissionPct) || 0,
                }),
            })
            onSaved()
        } catch (e) {
            setErr(e instanceof Error ? e.message : String(e))
        } finally {
            setSaving(false)
        }
    }

    const commPct = parseFloat(commissionPct) || 0
    const commOwed = parseFloat((code.monthly_revenue * commPct / 100).toFixed(2))
    const netRevenue = code.monthly_revenue - commOwed

    return (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 28, width: '100%', maxWidth: 500 }}>
                <p style={{ color: '#0E2A55', fontWeight: 800, fontSize: 15, marginBottom: 4 }}>Editar divulgador</p>
                <p style={{ color: '#94A3B8', fontSize: 12, marginBottom: 20 }}>
                    Código: <code style={{ color: '#2A60C2' }}>{code.code}</code>
                </p>

                {/* Revenue summary */}
                {code.paying_count > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
                        <div style={{ background: '#F7F9FC', borderRadius: 10, padding: '12px 14px', border: '1px solid #E2E8F0' }}>
                            <p style={{ fontSize: 10, color: '#94A3B8', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>Receita/mês</p>
                            <p style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55', margin: 0 }}>{fmtBRL(code.monthly_revenue)}</p>
                        </div>
                        <div style={{ background: '#FFFBEB', borderRadius: 10, padding: '12px 14px', border: '1px solid #FDE68A' }}>
                            <p style={{ fontSize: 10, color: '#92400E', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>Comissão ({commPct}%)</p>
                            <p style={{ fontSize: 18, fontWeight: 800, color: '#D97706', margin: 0 }}>{fmtBRL(commOwed)}</p>
                        </div>
                        <div style={{ background: '#F0FDF4', borderRadius: 10, padding: '12px 14px', border: '1px solid #BBF7D0' }}>
                            <p style={{ fontSize: 10, color: '#14532D', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>Líquido</p>
                            <p style={{ fontSize: 18, fontWeight: 800, color: '#16A34A', margin: 0 }}>{fmtBRL(netRevenue)}</p>
                        </div>
                    </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <label style={S.label}>Nome *
                        <input value={ownerName} onChange={e => setOwnerName(e.target.value)} style={inputSt()} />
                    </label>
                    <label style={S.label}>Contato
                        <input value={ownerContact} onChange={e => setOwnerContact(e.target.value)} style={inputSt()} />
                    </label>
                    <label style={S.label}>Comissão (%)
                        <input type="number" min="0" max="100" step="0.5" value={commissionPct} onChange={e => setCommissionPct(e.target.value)} style={inputSt()} placeholder="Ex: 10" />
                    </label>
                    <label style={S.label}>Notas internas
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} style={{ ...inputSt(), minHeight: 60, fontFamily: 'inherit' }} />
                    </label>
                </div>
                {err && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 12 }}>{err}</p>}
                <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                    <button onClick={onClose} style={S.btnSm}>Cancelar</button>
                    <button onClick={save} disabled={saving} style={S.btnPrimary}>
                        {saving ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    )
}

// ─── Uso (Métricas de uso por usuário) ───────────────────────────────────────

type UsagePeriod = 'today' | '7d' | '30d' | 'month' | 'all'

interface UsageUser {
    user_id: string
    full_name: string | null
    email: string | null
    plan: Plan
    seats_calls_count: number
    roteiros_count: number
    strategies_used: number
    strategies_limit: number | null
    roteiros_used: number
    roteiros_limit: number
    last_activity: string | null
}

interface UsageStats {
    period: UsagePeriod
    totals: {
        total_seats_calls: number
        total_roteiros: number
        active_users: number
    }
    users: UsageUser[]
}

interface SeatsAeroUsage {
    todayCount: number
    dailyLimit: number
    dailyBreakdown: { date: string; calls: number }[]
}

const PERIOD_OPTIONS: { id: UsagePeriod; label: string }[] = [
    { id: 'today', label: 'Hoje' },
    { id: '7d',    label: '7 dias' },
    { id: '30d',   label: '30 dias' },
    { id: 'month', label: 'Este mês' },
    { id: 'all',   label: 'Total' },
]

function Uso({ token }: { token: string }) {
    const [period, setPeriod] = useState<UsagePeriod>('month')
    const [stats, setStats] = useState<UsageStats | null>(null)
    const [seatsUsage, setSeatsUsage] = useState<SeatsAeroUsage | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [search, setSearch] = useState('')
    const [includeInactive, setIncludeInactive] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [data, seats] = await Promise.all([
                adminFetch(`/api/admin/usage-stats?period=${period}&include_inactive=${includeInactive}`, token),
                adminFetch('/api/admin/seatsaero-usage', token),
            ])
            setStats(data)
            setSeatsUsage(seats)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setLoading(false)
        }
    }, [token, period, includeInactive])

    useEffect(() => { load() }, [load])

    if (loading) return <Spinner />
    if (error) return <ErrBox msg={error} onRetry={load} />
    if (!stats) return null

    const filteredUsers = search.trim()
        ? stats.users.filter(u => {
            const s = search.toLowerCase()
            return u.full_name?.toLowerCase().includes(s) || u.email?.toLowerCase().includes(s)
        })
        : stats.users

    const thSt: React.CSSProperties = {
        padding: '12px 14px', textAlign: 'left', color: '#94A3B8',
        fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
    }
    const tdSt: React.CSSProperties = {
        padding: '12px 14px', fontSize: 13, color: '#334155', borderTop: '1px solid #E2E8F0',
    }

    const quotaPct = seatsUsage ? Math.round((seatsUsage.todayCount / seatsUsage.dailyLimit) * 100) : 0
    const quotaColor = quotaPct >= 90 ? '#DC2626' : quotaPct >= 70 ? '#D97706' : '#16A34A'
    const seatsMax = seatsUsage ? Math.max(...seatsUsage.dailyBreakdown.map(d => d.calls), 1) : 1

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Seats.aero quota ── */}
            {seatsUsage && (
                <div style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div>
                            <p style={{ ...S.cardLabel, marginBottom: 4 }}>Seats.aero API — cota diária</p>
                            <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>
                                Limite: <strong style={{ color: '#0E2A55' }}>{seatsUsage.dailyLimit.toLocaleString('pt-BR')}</strong> chamadas/dia
                            </p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: quotaColor }}>
                                {seatsUsage.todayCount}
                            </p>
                            <p style={{ margin: 0, fontSize: 11, color: '#94A3B8' }}>hoje · {quotaPct}% usado</p>
                        </div>
                    </div>

                    {/* Progress bar */}
                    <div style={{ background: '#E2E8F0', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                        <div style={{
                            height: '100%', borderRadius: 6,
                            width: `${Math.min(quotaPct, 100)}%`,
                            background: quotaColor,
                            transition: 'width 0.4s',
                        }} />
                    </div>

                    {quotaPct >= 80 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#92400E' }}>
                            <AlertTriangle size={13} style={{ flexShrink: 0 }} />
                            Você está se aproximando do limite diário. Considere fazer upgrade do plano Seats.aero.
                        </div>
                    )}

                    {/* 7-day breakdown */}
                    <div>
                        <p style={{ ...S.cardLabel, marginBottom: 10 }}>Últimos 7 dias</p>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 60 }}>
                            {seatsUsage.dailyBreakdown.map(d => {
                                const isToday = d.date === new Date().toISOString().slice(0, 10)
                                const barH = Math.max((d.calls / seatsMax) * 48, d.calls > 0 ? 4 : 2)
                                return (
                                    <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                        <div title={`${d.date}: ${d.calls} chamadas`} style={{
                                            width: '100%',
                                            height: `${barH}px`,
                                            background: isToday ? quotaColor : '#BFDBFE',
                                            borderRadius: '3px 3px 0 0',
                                            transition: 'height 0.3s',
                                        }} />
                                        <span style={{ fontSize: 9, color: '#94A3B8' }}>{d.date.slice(5)}</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <BlockTitle
                    icon={BarChart3}
                    title="Uso por usuário"
                    subtitle={
                        includeInactive
                            ? `${stats.users.length} usuário${stats.users.length !== 1 ? 's' : ''} no total`
                            : `${stats.users.length} usuário${stats.users.length !== 1 ? 's' : ''} ativo${stats.users.length !== 1 ? 's' : ''} no período`
                    }
                />
                <div style={{ display: 'flex', gap: 6, background: '#F7F9FC', padding: 4, borderRadius: 10, border: '1px solid #E2E8F0' }}>
                    {PERIOD_OPTIONS.map(opt => (
                        <button
                            key={opt.id}
                            onClick={() => setPeriod(opt.id)}
                            style={{
                                padding: '6px 12px',
                                fontSize: 12,
                                fontWeight: 600,
                                borderRadius: 6,
                                border: 'none',
                                cursor: 'pointer',
                                background: period === opt.id ? '#2A60C2' : 'transparent',
                                color: period === opt.id ? '#fff' : '#64748B',
                                transition: 'all 0.15s',
                            }}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Toggle "todos os usuários" */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#64748B' }}>
                    <input
                        type="checkbox"
                        checked={includeInactive}
                        onChange={e => setIncludeInactive(e.target.checked)}
                        style={{ cursor: 'pointer', accentColor: '#2A60C2', width: 16, height: 16 }}
                    />
                    Mostrar todos os usuários (incluindo sem atividade)
                </label>
            </div>

            {/* Cards de totais */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
                <div style={S.card}>
                    <p style={S.cardLabel}>Chamadas Seats.aero</p>
                    <p style={{ color: '#0E2A55', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                        {stats.totals.total_seats_calls.toLocaleString('pt-BR')}
                    </p>
                    <p style={{ color: '#94A3B8', fontSize: 11, marginTop: 2 }}>no período</p>
                </div>
                <div style={S.card}>
                    <p style={S.cardLabel}>Roteiros gerados</p>
                    <p style={{ color: '#0E2A55', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                        {stats.totals.total_roteiros.toLocaleString('pt-BR')}
                    </p>
                </div>
                <div style={S.card}>
                    <p style={S.cardLabel}>Usuários ativos</p>
                    <p style={{ color: '#0E2A55', fontSize: 28, fontWeight: 800, marginTop: 4 }}>
                        {stats.totals.active_users.toLocaleString('pt-BR')}
                    </p>
                </div>
            </div>

            {/* Barra de busca */}
            <div style={{ position: 'relative', maxWidth: 400 }}>
                <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }} />
                <input
                    type="text"
                    placeholder="Buscar por nome ou email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={inputSt({ paddingLeft: 36 })}
                />
            </div>

            {/* Tabela */}
            <div style={{ borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#F7F9FC' }}>
                        <tr>
                            <th style={thSt}>Usuário</th>
                            <th style={thSt}>Plano</th>
                            <th style={thSt}>API Seats.aero</th>
                            <th style={thSt}>Estratégias</th>
                            <th style={thSt}>Roteiros</th>
                            <th style={thSt}>Última atividade</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredUsers.length === 0 && (
                            <tr>
                                <td colSpan={6} style={{ padding: 24, textAlign: 'center', color: '#94A3B8', fontSize: 13 }}>
                                    {search
                                        ? 'Nenhum usuário encontrado.'
                                        : includeInactive
                                            ? 'Nenhum usuário cadastrado ainda.'
                                            : 'Nenhuma atividade no período selecionado.'}
                                </td>
                            </tr>
                        )}
                        {filteredUsers.map((u, i) => {
                            const stratLimit = u.strategies_limit != null ? String(u.strategies_limit) : '∞'
                            const roteiroLimit = u.roteiros_limit === 999 ? '∞' : String(u.roteiros_limit)
                            return (
                                <tr key={u.user_id} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#F7F9FC' }}>
                                    <td style={{ ...tdSt, color: '#0E2A55', fontWeight: 600 }}>{u.full_name ?? <span style={{ color: '#94A3B8' }}>—</span>}</td>
                                    <td style={tdSt}><PlanBadge plan={u.plan} /></td>
                                    <td style={{ ...tdSt, fontWeight: 700, color: u.seats_calls_count > 0 ? '#0E2A55' : '#94A3B8' }}>
                                        {u.seats_calls_count}
                                    </td>
                                    <td style={{ ...tdSt, fontWeight: 600, color: u.strategies_limit != null && u.strategies_used >= u.strategies_limit ? '#DC2626' : '#0E2A55' }}>
                                        {u.strategies_used}/{stratLimit}
                                    </td>
                                    <td style={{ ...tdSt, fontWeight: 600, color: u.roteiros_limit !== 999 && u.roteiros_used >= u.roteiros_limit ? '#DC2626' : '#0E2A55' }}>
                                        {u.roteiros_used}/{roteiroLimit}
                                    </td>
                                    <td style={{ ...tdSt, color: '#64748B', fontSize: 12 }}>{fmtDateTime(u.last_activity)}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// ─── Layout principal ─────────────────────────────────────────────────────────

export default function Admin() {
    const { session, user } = useAuth()
    const navigate = useNavigate()
    const [section, setSection] = useState<SectionId>('dashboard')
    const token = session?.access_token ?? ''

    const active = SECTIONS.find(s => s.id === section)!

    return (
        <div style={{ minHeight: '100vh', background: '#F7F9FC', fontFamily: 'Inter, Manrope, sans-serif', display: 'flex', flexDirection: 'column' }}>
            <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } } * { box-sizing: border-box; }`}</style>

            {/* ── Top bar ── */}
            <div style={{ background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', padding: '0 24px', height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, position: 'sticky', top: 0, zIndex: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Shield size={14} style={{ color: '#DC2626' }} />
                        <span style={{ color: '#DC2626', fontSize: 12, fontWeight: 800, letterSpacing: '0.05em' }}>ADMIN</span>
                    </div>
                    <span style={{ color: '#E2E8F0', fontSize: 16 }}>·</span>
                    <span style={{ color: '#0E2A55', fontSize: 14, fontWeight: 700 }}>FlyWise</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{ color: '#94A3B8', fontSize: 12 }}>{user?.email}</span>
                    <button onClick={() => navigate('/home')} style={{ ...S.btnSm, gap: 5 }}>
                        <Home size={13} /> Voltar ao app
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

                {/* ── Sidebar ── */}
                <aside style={{ width: 220, background: '#FFFFFF', borderRight: '1px solid #E2E8F0', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
                    <p style={{ color: '#94A3B8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', padding: '0 8px', marginBottom: 8 }}>Navegação</p>

                    {SECTIONS.map(({ id, label, icon: Icon, description }) => {
                        const isActive = section === id
                        return (
                            <button key={id} onClick={() => setSection(id)} style={{
                                background: isActive ? '#EFF4FF' : 'none',
                                border: `1px solid ${isActive ? '#BFDBFE' : 'transparent'}`,
                                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                                textAlign: 'left', width: '100%', transition: 'all 0.15s',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                                    <Icon size={15} style={{ color: isActive ? '#2A60C2' : '#94A3B8', flexShrink: 0 }} />
                                    <div>
                                        <p style={{ margin: 0, fontSize: 13, fontWeight: isActive ? 700 : 500, color: isActive ? '#0E2A55' : '#64748B' }}>{label}</p>
                                        <p style={{ margin: 0, fontSize: 10, color: '#94A3B8', marginTop: 1 }}>{description}</p>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </aside>

                {/* ── Conteúdo ── */}
                <main style={{ flex: 1, overflowY: 'auto', padding: '28px 32px 60px' }}>
                    {/* Breadcrumb */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 24 }}>
                        <active.icon size={16} style={{ color: '#2A60C2' }} />
                        <h1 style={{ color: '#0E2A55', fontSize: 18, fontWeight: 800, margin: 0 }}>{active.label}</h1>
                    </div>

                    {section === 'dashboard'  && <Dashboard      token={token} />}
                    {section === 'usuarios'   && <Usuarios      token={token} />}
                    {section === 'custos'     && <Custos         token={token} />}
                    {section === 'promocoes'  && <Promocoes      token={token} />}
                    {section === 'logs'       && <Logs           token={token} />}
                    {section === 'codigos'    && <Codigos        token={token} />}
                    {section === 'uso'        && <Uso            token={token} />}
                    {section === 'posts'      && <PostGenerator  token={token} />}
                </main>
            </div>
        </div>
    )
}
