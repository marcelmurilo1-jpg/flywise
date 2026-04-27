import { useState, useEffect } from 'react'
import { X, Zap, TrendingDown, ArrowRight, Loader2, AlertTriangle, Tag, Sparkles, Lock, ChevronDown, ChevronUp, TrendingUp, Coins } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { ResultadoVoo, Promocao } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import type { StrategyResult, ProgramComparison } from '@/lib/llm/buildPrompt'

export interface SeatsContext {
    airlineCode: string
    airlineName: string
    origem: string
    destino: string
    cabin: string
    program: string
    idaMilhas: number
    voltaMilhas?: number
    totalMilhas: number
    isRoundTrip: boolean
    dataVoo: string
    taxas?: string
}

interface StrategyPanelProps {
    open: boolean; onClose: () => void
    flight?: ResultadoVoo | null; buscaId: number; cashPrice?: number
    seatsContext?: SeatsContext
}

export function StrategyPanel({ open, onClose, flight = null, buscaId, cashPrice = 0, seatsContext }: StrategyPanelProps) {
    const { user, session } = useAuth()
    const navigate = useNavigate()
    const { canGenerateStrategy, strategiesUsed, strategyLimit, plan, refresh: refreshPlan } = usePlan()
    const [loading, setLoading] = useState(false)
    const [strategy, setStrategy] = useState<StrategyResult | null>(null)
    const [llmError, setLlmError] = useState<string | null>(null)
    const [tokensUsed, setTokensUsed] = useState<number | null>(null)
    const [openSteps, setOpenSteps] = useState<Set<number>>(new Set())
    const [rulesOpen, setRulesOpen] = useState(false)
    const [activePromos, setActivePromos] = useState<Promocao[]>([])
    const [cpmHistorico, setCpmHistorico] = useState<{ avg: number; count: number } | null>(null)
    function toggleStep(i: number) { setOpenSteps(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n }) }

    useEffect(() => {
        if (!open) return
        const program = seatsContext?.program ?? null
        if (!program) return
        supabase
            .from('vw_promocoes_ativas')
            .select('id, titulo, subcategoria, bonus_pct, preco_clube, programas_tags, valid_until')
            .overlaps('programas_tags', [program])
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(3)
            .then(({ data }) => setActivePromos(data ?? []))
    }, [open, seatsContext?.program])

    useEffect(() => {
        if (!strategy?.programa_recomendado || !user?.id) return
        setCpmHistorico(null)
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
        supabase
            .from('strategies')
            .select('structured_result')
            .eq('user_id', user.id)
            .gte('created_at', thirtyDaysAgo)
            .not('structured_result', 'is', null)
            .limit(20)
            .then(({ data }) => {
                if (!data || data.length === 0) return
                const cpms = data
                    .map(r => {
                        const sr = r.structured_result as Record<string, unknown>
                        return typeof sr?.cpm_resgate === 'number' ? sr.cpm_resgate : null
                    })
                    .filter((v): v is number => v !== null && v > 0)
                if (cpms.length < 2) return
                const avg = cpms.reduce((s, v) => s + v, 0) / cpms.length
                setCpmHistorico({ avg: parseFloat(avg.toFixed(2)), count: cpms.length })
            })
    }, [strategy?.programa_recomendado, user?.id])

    // Must have either a DB flight or seatsContext to render
    if (!flight && !seatsContext) return null
    const price = cashPrice || flight?.preco_brl || 0

    // Header display info — prefer seatsContext when no DB flight
    const displayAirline = seatsContext ? `${seatsContext.airlineName} (${seatsContext.program})` : (flight?.companhia ?? '')
    const displayRoute = seatsContext ? `${seatsContext.origem} → ${seatsContext.destino}` : `${flight?.origem ?? ''} → ${flight?.destino ?? ''}`

    async function generateStrategy() {
        // Either need a DB flight id OR seatsContext
        if (!flight?.id && !seatsContext) return
        setLoading(true); setLlmError(null); setStrategy(null)
        try {
            // JWT acquisition — 3-tier strategy:
            // 1. session from AuthContext (kept fresh by supabase-js onAuthStateChange)
            // 2. Force server-side refresh if context session is null/expired
            // 3. Throw if still missing — user must re-login
            // NEVER uses the anon key (sb_publishable_...) as Bearer — it is not a JWT.
            let accessToken: string | null = session?.access_token ?? null
            if (!accessToken) {
                const { data: refreshData } = await supabase.auth.refreshSession()
                accessToken = refreshData.session?.access_token ?? null
            }
            if (!accessToken) throw new Error('Sessão expirada. Faça login novamente.')

            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
            const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

            const response = await fetch(`${supabaseUrl}/functions/v1/strategy`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                    'apikey': anonKey,
                },
                body: JSON.stringify({
                    flightId: flight?.id || undefined,
                    userId: user?.id,
                    cashPrice: cashPrice || undefined,
                    seatsContext: seatsContext || undefined,
                    buscaId: buscaId || undefined,
                }),
            })

            if (!response.ok) {
                const errText = await response.text().catch(() => '')
                console.error('[StrategyPanel] HTTP error:', response.status, errText)
                throw new Error(response.status === 401
                    ? 'Sessão inválida. Faça logout e login novamente.'
                    : 'Erro ao contactar o servidor. Tente novamente.')
            }

            const json = await response.json()
            const typed = json as { ok: boolean; strategy: StrategyResult; tokens_used: number; error?: string } | null

            // Todos os erros de lógica chegam como HTTP 200 com ok:false
            if (typed?.error === 'plan_limit_reached') throw new Error('Limite do plano atingido.')
            if (typed?.error) throw new Error(typed.error)
            if (!typed?.ok || !typed.strategy) throw new Error('Resposta inválida da IA. Tente novamente.')
            setStrategy(typed.strategy)
            setTokensUsed(typed.tokens_used ?? null)
            refreshPlan()
        } catch (err: any) {
            setLlmError(err?.message ?? 'Erro ao gerar estratégia.')
        } finally {
            setLoading(false)
        }
    }

    const economyPct = strategy?.economia_pct ?? 0
    const milesNeeded = strategy?.milhas_necessarias ?? 0
    const taxesBrl = strategy?.taxas_estimadas_brl ?? 0
    // custo_total_estrategia = compra de milhas + taxas (valor real "com milhas")
    // Fallback: custo_total de bestAnalysis via comparacao_programas, ou só taxas se déficit=0
    const custoTotalComMilhas = strategy?.custo_total_estrategia
        ?? (strategy?.comparacao_programas?.find(p => p.melhor_opcao)?.custo_total_brl)
        ?? taxesBrl

    return (
        <AnimatePresence>
            {open && (
                <>
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(3px)', zIndex: 200 }}
                    />
                    <motion.div
                        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
                        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                        style={{
                            position: 'fixed', right: 0, top: 0, bottom: 0,
                            width: 'min(520px, 95vw)', zIndex: 201,
                            background: 'var(--bg-surface)',
                            borderLeft: '1px solid var(--border-light)',
                            boxShadow: 'var(--shadow-xl)',
                            overflowY: 'auto', display: 'flex', flexDirection: 'column',
                        }}
                    >
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-faint)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: strategy ? 'var(--accent-soft)' : 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {loading ? <Loader2 size={18} color="var(--text-muted)" className="spin" /> : strategy ? <Zap size={18} color="var(--accent-start)" /> : <Sparkles size={18} color="var(--text-muted)" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                                        {loading ? 'Analisando estratégia...' : strategy ? 'Estratégia gerada por IA' : 'Estratégia com Milhas'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {displayAirline} · {displayRoute}
                                        {seatsContext && <span style={{ marginLeft: 6, color: '#16A34A', fontWeight: 700 }}>· {seatsContext.totalMilhas.toLocaleString('pt-BR')} pts</span>}
                                        {tokensUsed && <span style={{ marginLeft: 8, color: '#94A3B8' }}>· {tokensUsed} tokens</span>}
                                    </div>
                                </div>
                            </div>
                            <button onClick={onClose} className="icon-btn"><X size={16} /></button>
                        </div>

                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            {/* ── Not yet generated ────────────────────────────────── */}
                            {!strategy && !loading && !llmError && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

                                    {/* Comparação cash vs milhas */}
                                    {(cashPrice > 0 || seatsContext) && (
                                        <div style={{ width: '100%', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 18px', textAlign: 'left' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Comparação de custo</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                                {cashPrice > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Preço em dinheiro</div>
                                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#0E2A55' }}>
                                                            R$ {cashPrice.toLocaleString('pt-BR')}
                                                        </div>
                                                    </div>
                                                )}
                                                {cashPrice > 0 && seatsContext && <ArrowRight size={16} color="#CBD5E1" />}
                                                {seatsContext && (
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Milhas selecionadas ({seatsContext.program})</div>
                                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#16A34A' }}>
                                                            {seatsContext.totalMilhas.toLocaleString('pt-BR')} pts
                                                        </div>
                                                        {seatsContext.taxas && <div style={{ fontSize: 10, color: '#94A3B8' }}>+ {seatsContext.taxas} taxas</div>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* Banner promos ativas */}
                                    {activePromos.length > 0 && (
                                        <div style={{
                                            width: '100%', background: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)',
                                            border: '1px solid #C4B5FD', borderRadius: 12, padding: '12px 16px', textAlign: 'left',
                                        }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                                ⚡ Promoções ativas · {seatsContext?.program}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {activePromos.map(p => (
                                                    <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                        <span style={{
                                                            flexShrink: 0, fontSize: '10px', fontWeight: 700,
                                                            padding: '2px 7px', borderRadius: '999px',
                                                            background: p.subcategoria === 'clube' ? '#FEF3C7' : '#EDE9FE',
                                                            color: p.subcategoria === 'clube' ? '#B45309' : '#6D28D9',
                                                        }}>
                                                            {p.subcategoria === 'clube' ? 'Clube' : p.subcategoria === 'transferencia' ? 'Transferência' : 'Promo'}
                                                        </span>
                                                        <span style={{ fontSize: '12px', color: '#374151', lineHeight: 1.4 }}>
                                                            {(p.titulo ?? '').slice(0, 80)}{(p.titulo ?? '').length > 80 ? '…' : ''}
                                                            {p.bonus_pct ? <strong style={{ color: '#6D28D9' }}> +{p.bonus_pct}%</strong> : null}
                                                            {p.preco_clube ? <span style={{ color: '#B45309' }}> · R$ {p.preco_clube.toFixed(2)}/mês</span> : null}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                            <div style={{ fontSize: '10.5px', color: '#7C3AED', marginTop: 8, fontStyle: 'italic' }}>
                                                A IA considera estas promoções automaticamente.
                                            </div>
                                        </div>
                                    )}

                                    <div style={{ width: 56, height: 56, borderRadius: 16, background: canGenerateStrategy ? 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' : 'linear-gradient(135deg, #FEF3C7, #FDE68A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {canGenerateStrategy ? <Sparkles size={26} color="#4A90E2" /> : <Lock size={26} color="#D97706" />}
                                    </div>
                                    {canGenerateStrategy ? (
                                        <>
                                            <div>
                                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                                    Analisar estratégia com IA
                                                </p>
                                                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>
                                                    {cashPrice > 0
                                                        ? 'A IA vai calcular quantas milhas você precisa, verificar promoções ativas e mostrar quanto você economiza vs o preço em dinheiro.'
                                                        : 'A IA vai analisar o voo, verificar promoções ativas e calcular o melhor programa de milhas para esta rota.'}
                                                </p>
                                            </div>
                                            {(() => {
                                                const ready = !!seatsContext || !!flight?.id
                                                return (
                                                    <button
                                                        onClick={generateStrategy}
                                                        disabled={!ready}
                                                        style={{
                                                            background: ready ? 'linear-gradient(135deg, #2A60C2, #4A90E2)' : '#CBD5E1',
                                                            color: '#fff', border: 'none', borderRadius: 12,
                                                            padding: '12px 28px', fontFamily: 'inherit',
                                                            fontSize: 14, fontWeight: 700, cursor: ready ? 'pointer' : 'not-allowed',
                                                            display: 'flex', alignItems: 'center', gap: 8,
                                                            boxShadow: ready ? '0 4px 16px rgba(42,96,194,0.35)' : 'none',
                                                        }}
                                                    >
                                                        {ready ? <><Zap size={15} /> Gerar estratégia</> : <><Loader2 size={15} className="spin" /> Preparando...</>}
                                                    </button>
                                                )
                                            })()}
                                            {(() => {
                                                const now = new Date()
                                                const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
                                                const renewalStr = nextMonth.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })
                                                return (
                                                    <div style={{ textAlign: 'center' }}>
                                                        <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>
                                                            {strategiesUsed}/{strategyLimit === 9999 ? '∞' : strategyLimit} estratégia{strategyLimit !== 1 ? 's' : ''} gerada{strategiesUsed !== 1 ? 's' : ''}
                                                        </p>
                                                        {plan !== 'free' && strategyLimit !== 9999 && (
                                                            <p style={{ fontSize: 10, color: '#CBD5E1', margin: '2px 0 0', lineHeight: 1.4 }}>
                                                                Suas estratégias renovam em {renewalStr}
                                                            </p>
                                                        )}
                                                    </div>
                                                )
                                            })()}
                                        </>
                                    ) : (
                                        <>
                                            <div>
                                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                                    Limite de estratégias atingido
                                                </p>
                                                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 300 }}>
                                                    {plan === 'free'
                                                        ? 'O plano gratuito inclui 1 estratégia. Faça upgrade para gerar mais.'
                                                        : `Você usou ${strategiesUsed} de ${strategyLimit} estratégias do mês. Faça upgrade ou aguarde o próximo ciclo.`}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { onClose(); navigate('/planos') }}
                                                style={{
                                                    background: 'linear-gradient(135deg, #D97706, #F59E0B)',
                                                    color: '#fff', border: 'none', borderRadius: 12,
                                                    padding: '12px 28px', fontFamily: 'inherit',
                                                    fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 8,
                                                    boxShadow: '0 4px 16px rgba(217,119,6,0.35)',
                                                }}
                                            >
                                                <Zap size={15} /> Ver planos
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Loading ───────────────────────────────────────────── */}
                            {loading && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <Loader2 size={32} color="#4A90E2" className="spin" />
                                    <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>
                                        Consultando promoções e calculando estratégia...
                                    </p>
                                    <p style={{ fontSize: 12, color: '#94A3B8' }}>Leva cerca de 3–5 segundos</p>
                                </div>
                            )}

                            {/* ── Error ─────────────────────────────────────────────── */}
                            {llmError && (
                                <div style={{ padding: '16px', background: '#FFF5F5', border: '1px solid #FCA5A5', borderRadius: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <AlertTriangle size={16} color="#EF4444" />
                                        <span style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>Erro ao gerar estratégia</span>
                                    </div>
                                    <p style={{ fontSize: 12, color: '#991B1B' }}>{llmError}</p>
                                    <button onClick={generateStrategy} style={{ alignSelf: 'flex-start', background: '#EF4444', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                                        Tentar novamente
                                    </button>
                                </div>
                            )}

                            {/* ── Strategy result ───────────────────────────────────── */}
                            {strategy && (
                                <>
                                    {/* vale_a_pena: false — dinheiro é melhor */}
                                    {strategy.vale_a_pena === false && (
                                        <div style={{ padding: '14px 16px', background: 'linear-gradient(135deg, #FFF7ED, #FFEDD5)', border: '2px solid #FED7AA', borderRadius: 14 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                                                <AlertTriangle size={17} color="#EA580C" />
                                                <span style={{ fontSize: 14, fontWeight: 800, color: '#C2410C' }}>Dinheiro é mais vantajoso</span>
                                            </div>
                                            <p style={{ fontSize: 13, color: '#7C2D12', lineHeight: 1.6, margin: 0 }}>{strategy.motivo}</p>
                                            {strategy.cpm_resgate > 0 && (
                                                <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, background: '#FEF3C7', borderRadius: 8, padding: '6px 10px', width: 'fit-content' }}>
                                                    <TrendingDown size={13} color="#D97706" />
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>CPM: {strategy.cpm_resgate.toFixed(2)} c/pt — {strategy.cpm_avaliacao}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* CPM badge (only when vale_a_pena: true) */}
                                    {strategy.vale_a_pena !== false && strategy.cpm_resgate > 0 && (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <div style={{
                                                    display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                                                    background: strategy.cpm_resgate >= 2.5 ? '#DCFCE7' : strategy.cpm_resgate >= 1.8 ? '#DBEAFE' : '#FEF9C3',
                                                    border: `1px solid ${strategy.cpm_resgate >= 2.5 ? '#86EFAC' : strategy.cpm_resgate >= 1.8 ? '#93C5FD' : '#FDE047'}`,
                                                    borderRadius: 20,
                                                }}>
                                                    <TrendingUp size={13} color={strategy.cpm_resgate >= 2.5 ? '#16A34A' : strategy.cpm_resgate >= 1.8 ? '#2563EB' : '#CA8A04'} />
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: strategy.cpm_resgate >= 2.5 ? '#15803D' : strategy.cpm_resgate >= 1.8 ? '#1D4ED8' : '#A16207' }}>
                                                        CPM {strategy.cpm_resgate.toFixed(2)} c/pt — {strategy.cpm_avaliacao}
                                                    </span>
                                                </div>
                                            </div>
                                            {cpmHistorico && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '10.5px', color: '#64748B' }}>
                                                    {strategy.cpm_resgate > cpmHistorico.avg
                                                        ? <TrendingUp size={11} color="#16A34A" />
                                                        : <TrendingDown size={11} color="#DC2626" />
                                                    }
                                                    {strategy.cpm_resgate > cpmHistorico.avg
                                                        ? `Acima da sua média dos últimos 30 dias (${cpmHistorico.avg.toFixed(2)} c/pt)`
                                                        : `Abaixo da sua média dos últimos 30 dias (${cpmHistorico.avg.toFixed(2)} c/pt)`
                                                    }
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Multi-program comparison cards */}
                                    {(strategy.comparacao_programas ?? []).length > 1 && (
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 10 }}>
                                                Comparação de programas
                                            </div>
                                            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 4, scrollSnapType: 'x mandatory' }}>
                                                {(strategy.comparacao_programas ?? []).map((prog: ProgramComparison) => {
                                                    const coveragePct = prog.milhas_necessarias > 0 ? Math.min(100, Math.round(prog.total_potencial / prog.milhas_necessarias * 100)) : 100
                                                    const promoTransfers = prog.transferencias.filter(t => t.promo_bonus_pct > 0)
                                                    return (
                                                        <div key={prog.programa} style={{
                                                            minWidth: 200, maxWidth: 230, flexShrink: 0, scrollSnapAlign: 'start',
                                                            borderRadius: 12,
                                                            border: `2px solid ${prog.melhor_opcao ? '#16A34A' : 'var(--border-faint)'}`,
                                                            background: prog.melhor_opcao ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'var(--bg-subtle)',
                                                            padding: '12px', display: 'flex', flexDirection: 'column', gap: 8,
                                                        }}>
                                                            {/* Header */}
                                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                                                <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1.2 }}>{prog.programa}</span>
                                                                {prog.melhor_opcao && (
                                                                    <span style={{ fontSize: 9, fontWeight: 700, background: '#16A34A', color: '#fff', borderRadius: 4, padding: '2px 5px', flexShrink: 0 }}>MELHOR</span>
                                                                )}
                                                            </div>

                                                            {/* Coverage bar */}
                                                            <div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                                    <span>Cobertura</span>
                                                                    <span style={{ fontWeight: 700 }}>{coveragePct}%</span>
                                                                </div>
                                                                <div style={{ height: 5, borderRadius: 3, background: 'rgba(0,0,0,0.1)', overflow: 'hidden' }}>
                                                                    <div style={{ height: '100%', width: `${coveragePct}%`, background: prog.deficit === 0 ? '#16A34A' : '#3B82F6', borderRadius: 3, transition: 'width 0.4s ease' }} />
                                                                </div>
                                                                <div style={{ fontSize: 10, fontWeight: 700, color: prog.deficit === 0 ? '#16A34A' : '#DC2626', marginTop: 3 }}>
                                                                    {prog.deficit === 0 ? '✓ Cobre tudo' : `Faltam ${prog.deficit.toLocaleString('pt-BR')} pts`}
                                                                </div>
                                                            </div>

                                                            {/* Transfer promos highlight */}
                                                            {promoTransfers.slice(0, 2).map(t => (
                                                                <div key={t.source} style={{ fontSize: 10, background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 6, padding: '3px 7px', color: '#92400E', fontWeight: 600, lineHeight: 1.4 }}>
                                                                    ★ {t.source}: ×{t.ratio_base} +{t.promo_bonus_pct}% = ×{t.ratio_efetivo.toFixed(1)} efetivo
                                                                </div>
                                                            ))}

                                                            {/* Cost breakdown */}
                                                            <div style={{ borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
                                                                {prog.custo_compra_milhas_brl > 0 && (
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                                                        <span>Comprar milhas</span>
                                                                        <span>R$ {prog.custo_compra_milhas_brl.toLocaleString('pt-BR')}</span>
                                                                    </div>
                                                                )}
                                                                {prog.promo_compra_ativa && (
                                                                    <div style={{ fontSize: 10, color: '#16A34A', fontWeight: 700 }}>
                                                                        ★ Promo: R${prog.custo_efetivo_por_mil}/mil (vs R${prog.custo_compra_milhas_brl > 0 ? Math.round(prog.custo_compra_milhas_brl / prog.deficit * 1000) : '?'} normal)
                                                                    </div>
                                                                )}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                                                                    <span>Taxas estimadas</span>
                                                                    <span>~R$ {prog.taxas_estimadas_brl.toLocaleString('pt-BR')}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 800, marginTop: 2 }}>
                                                                    <span style={{ color: 'var(--text-primary)' }}>Total</span>
                                                                    <span style={{ color: prog.melhor_opcao ? '#16A34A' : 'var(--text-primary)' }}>
                                                                        R$ {prog.custo_total_brl.toLocaleString('pt-BR')}
                                                                    </span>
                                                                </div>
                                                                {prog.economia_vs_cash_pct > 0 && (
                                                                    <div style={{ fontSize: 11, color: '#16A34A', textAlign: 'right', fontWeight: 700 }}>
                                                                        Economia: {prog.economia_vs_cash_pct}%
                                                                    </div>
                                                                )}
                                                                {prog.economia_vs_cash_pct < 0 && (
                                                                    <div style={{ fontSize: 10, color: '#DC2626', textAlign: 'right', fontWeight: 700 }}>
                                                                        ⚠ {Math.abs(prog.economia_vs_cash_pct)}% mais caro que dinheiro
                                                                    </div>
                                                                )}
                                                                {!prog.disponibilidade_confirmada && (
                                                                    <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 600, marginTop: 2 }}>
                                                                        ⚠ Verifique disponibilidade
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Recommendation badge */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', background: strategy.vale_a_pena === false ? 'var(--bg-subtle)' : 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', border: `1px solid ${strategy.vale_a_pena === false ? 'var(--border-light)' : '#C7D9F8'}`, borderRadius: 12 }}>
                                        <Zap size={16} color={strategy.vale_a_pena === false ? 'var(--text-muted)' : '#2A60C2'} />
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: strategy.vale_a_pena === false ? 'var(--text-muted)' : '#2A60C2', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                                                {strategy.vale_a_pena === false ? 'Se ainda quiser usar milhas' : 'Programa recomendado'}
                                            </div>
                                            <div style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)' }}>{strategy.programa_recomendado}</div>
                                            {strategy.alternativa && (
                                                <div style={{ fontSize: 11, color: '#64748B' }}>Alternativa: {strategy.alternativa}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Motivo (only when vale_a_pena: true — false case already shown above) */}
                                    {strategy.vale_a_pena !== false && (
                                        <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                            {strategy.motivo}
                                        </p>
                                    )}

                                    {/* Savings comparison */}
                                    {price > 0 && strategy.vale_a_pena !== false && (
                                        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '14px', padding: '18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                                                <TrendingDown size={15} color="var(--green)" />
                                                <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '13px' }}>
                                                    Economia estimada: {economyPct}%
                                                    {strategy.economia_brl ? ` (~R$ ${strategy.economia_brl.toLocaleString('pt-BR')})` : ''}
                                                </span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Preço cash</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--red)', letterSpacing: '-0.02em' }}>R$ {price.toLocaleString('pt-BR')}</div>
                                                </div>
                                                <ArrowRight size={18} color="var(--text-faint)" />
                                                <div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Custo total com milhas</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.02em' }}>R$ {custoTotalComMilhas.toLocaleString('pt-BR')}</div>
                                                    {custoTotalComMilhas !== taxesBrl && taxesBrl > 0 && (
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>taxas: R$ {taxesBrl.toLocaleString('pt-BR')}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Miles stats */}
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                                        {[
                                            { label: 'Milhas necessárias', value: `${milesNeeded.toLocaleString('pt-BR')} pts` },
                                            { label: 'Taxas estimadas', value: `R$ ${taxesBrl.toLocaleString('pt-BR')}` },
                                        ].map(d => (
                                            <div key={d.label} style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                                <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{d.label}</div>
                                                <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{d.value}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Coverage: milhas em carteira + faltantes + como completar */}
                                    {(strategy.milhas_em_carteira !== undefined || strategy.milhas_faltantes !== undefined) && (
                                        <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-faint)', borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Sua cobertura</div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '10px', textAlign: 'center', border: '1px solid var(--border-faint)' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Em carteira</div>
                                                    <div style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>{(strategy.milhas_em_carteira ?? 0).toLocaleString('pt-BR')} pts</div>
                                                </div>
                                                <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: '10px', textAlign: 'center', border: '1px solid var(--border-faint)' }}>
                                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Faltam</div>
                                                    <div style={{ fontSize: 15, fontWeight: 800, color: (strategy.milhas_faltantes ?? 0) > 0 ? '#DC2626' : '#16A34A' }}>
                                                        {(strategy.milhas_faltantes ?? 0) > 0 ? `${strategy.milhas_faltantes!.toLocaleString('pt-BR')} pts` : '✓ Coberto'}
                                                    </div>
                                                </div>
                                            </div>
                                            {strategy.como_completar_faltantes && (
                                                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                                                    <Coins size={14} color="#2A60C2" style={{ flexShrink: 0, marginTop: 2 }} />
                                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{strategy.como_completar_faltantes}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Promo badge */}
                                    {strategy.promocao_ativa && (
                                        <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' }}>
                                            <Tag size={14} color="var(--amber)" style={{ flexShrink: 0, marginTop: '1px' }} />
                                            <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                                                {strategy.promocao_ativa}
                                            </span>
                                        </div>
                                    )}

                                    {/* Steps */}
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Plano passo a passo</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {(strategy.steps ?? []).map((step, i) => {
                                                const detail = strategy.step_details?.[i]
                                                const isOpen = openSteps.has(i)
                                                return (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                                                        transition={{ delay: i * 0.08 }}
                                                        style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-faint)', borderRadius: '12px', overflow: 'hidden' }}
                                                    >
                                                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', padding: '12px 14px' }}>
                                                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-start)', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>{i + 1}</div>
                                                            <p style={{ flex: 1, fontSize: '13.5px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.4, margin: 0 }}>{step}</p>
                                                            {detail && (
                                                                <button onClick={() => toggleStep(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, flexShrink: 0, fontFamily: 'inherit' }}>
                                                                    {isOpen ? <><ChevronUp size={13} /> Ocultar</> : <><ChevronDown size={13} /> Saiba mais</>}
                                                                </button>
                                                            )}
                                                        </div>
                                                        <AnimatePresence>
                                                            {isOpen && detail && (
                                                                <motion.div
                                                                    initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                                                    transition={{ duration: 0.2 }}
                                                                    style={{ overflow: 'hidden' }}
                                                                >
                                                                    <div style={{ padding: '0 14px 14px 50px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, borderTop: '1px dashed var(--border-faint)' }}>
                                                                        <div style={{ paddingTop: 10 }}>{detail}</div>
                                                                    </div>
                                                                </motion.div>
                                                            )}
                                                        </AnimatePresence>
                                                    </motion.div>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    {/* Aviso */}
                                    {strategy.aviso && (
                                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
                                            <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                                            <span style={{ fontSize: 12, color: '#92400E' }}>{strategy.aviso}</span>
                                        </div>
                                    )}

                                    {/* Regras e condições das promoções */}
                                    {(strategy.regras_promocoes ?? []).length > 0 && (
                                        <div style={{ border: '1px solid #FDE68A', borderRadius: 12, overflow: 'hidden' }}>
                                            <button onClick={() => setRulesOpen(o => !o)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px', background: '#FFFBEB', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                                    <AlertTriangle size={14} color="#D97706" />
                                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#92400E' }}>Regras e condições das promoções</span>
                                                </div>
                                                {rulesOpen ? <ChevronUp size={13} color="#D97706" /> : <ChevronDown size={13} color="#D97706" />}
                                            </button>
                                            <AnimatePresence>
                                                {rulesOpen && (
                                                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} style={{ overflow: 'hidden' }}>
                                                        <div style={{ padding: '10px 14px 14px', background: '#FFFDF0', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                            {(strategy.regras_promocoes ?? []).map((rule, i) => (
                                                                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: '#78350F', lineHeight: 1.6 }}>
                                                                    <span style={{ flexShrink: 0, marginTop: 2 }}>•</span>
                                                                    <span>{rule}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>
                                        </div>
                                    )}

                                    {/* Regenerate */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                        <button
                                            onClick={generateStrategy}
                                            style={{ flex: 1, background: 'none', border: '1px solid var(--border-light)', borderRadius: 10, padding: '10px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        >
                                            <Zap size={12} /> Regerar estratégia
                                        </button>
                                    </div>
                                    <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', margin: 0 }}>✓ Salva automaticamente no seu histórico</p>
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
