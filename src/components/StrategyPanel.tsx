import { useState, useEffect } from 'react'
import type { ProgramPrice } from '@/components/SeatsFlightPanel'
import { X, Zap, ArrowRight, Loader2, AlertTriangle, Sparkles, Lock } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import type { ResultadoVoo, Promocao } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { usePlan } from '@/hooks/usePlan'
import type { StrategyResult } from '@/lib/llm/buildPrompt'
import { StrategyContent } from '@/components/StrategyContent'

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
    // Flight details (populated when generating; stored in _seatsContext for saved strategies)
    partida?: string
    chegada?: string
    paradas?: number
    escalas?: string[]
    duracaoMin?: number
    voltaData?: string
    voltaAirlineCode?: string
    voltaAirlineName?: string
    voltaPartida?: string
    voltaChegada?: string
    voltaParadas?: number
    voltaEscalas?: string[]
    voltaDuracaoMin?: number
}

interface StrategyPanelProps {
    open: boolean; onClose: () => void
    flight?: ResultadoVoo | null; buscaId: number; cashPrice?: number
    seatsContext?: SeatsContext
    initialStrategy?: StrategyResult
    allProgramPrices?: ProgramPrice[]
}

export function StrategyPanel({ open, onClose, flight = null, buscaId, cashPrice = 0, seatsContext, initialStrategy, allProgramPrices }: StrategyPanelProps) {
    const { user, session } = useAuth()
    const navigate = useNavigate()
    const { canGenerateStrategy, strategiesUsed, strategyLimit, plan, refresh: refreshPlan } = usePlan()
    const [loading, setLoading] = useState(false)
    const [strategy, setStrategy] = useState<StrategyResult | null>(null)
    const [llmError, setLlmError] = useState<string | null>(null)
    const [tokensUsed, setTokensUsed] = useState<number | null>(null)
    const [activePromos, setActivePromos] = useState<Promocao[]>([])

    useEffect(() => {
        if (open && initialStrategy) setStrategy(initialStrategy)
        if (!open) { setStrategy(null); setLlmError(null) }
    }, [open, initialStrategy])

    useEffect(() => {
        if (!open) return
        const program = seatsContext?.program ?? null
        const candidatePrograms = Array.from(new Set([
            ...(program ? [program] : []),
            ...(allProgramPrices?.map(p => p.program) ?? []),
        ])).filter(Boolean)
        if (candidatePrograms.length === 0) return
        supabase
            .from('vw_promocoes_ativas')
            .select('id, titulo, subcategoria, bonus_pct, preco_clube, programas_tags, valid_until')
            .overlaps('programas_tags', candidatePrograms)
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(6)
            .then(({ data }) => setActivePromos(data ?? []))
    }, [open, seatsContext?.program, allProgramPrices])

    if (!flight && !seatsContext && !initialStrategy) return null
    const price = cashPrice || flight?.preco_brl || 0

    const displayAirline = seatsContext ? `${seatsContext.airlineName} (${seatsContext.program})` : (flight?.companhia ?? '')
    const displayRoute = seatsContext ? `${seatsContext.origem} → ${seatsContext.destino}` : `${flight?.origem ?? ''} → ${flight?.destino ?? ''}`

    async function generateStrategy() {
        if (!flight?.id && !seatsContext) return
        setLoading(true); setLlmError(null); setStrategy(null)
        try {
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
                    allProgramPrices: allProgramPrices && allProgramPrices.length > 0 ? allProgramPrices : undefined,
                    frontendPromos: activePromos.length > 0 ? activePromos : undefined,
                }),
            })

            if (!response.ok) {
                await response.text().catch(() => '')
                throw new Error(response.status === 401
                    ? 'Sessão inválida. Faça logout e login novamente.'
                    : 'Erro ao contactar o servidor. Tente novamente.')
            }

            const json = await response.json()
            const typed = json as { ok: boolean; strategy: StrategyResult; tokens_used: number; error?: string } | null

            if (typed?.error === 'plan_limit_reached') throw new Error('Limite do plano atingido.')
            if (typed?.error) throw new Error(typed.error)
            if (!typed?.ok || !typed.strategy) throw new Error('Resposta inválida da IA. Tente novamente.')
            setStrategy(typed.strategy)
            setTokensUsed(typed.tokens_used ?? null)
            refreshPlan()
        } catch (err: unknown) {
            setLlmError((err as Error)?.message ?? 'Erro ao gerar estratégia.')
        } finally {
            setLoading(false)
        }
    }

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

                            {/* ── Not yet generated ──────────────────────────────── */}
                            {!strategy && !loading && !llmError && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>

                                    {(cashPrice > 0 || seatsContext) && (
                                        <div style={{ width: '100%', background: 'linear-gradient(135deg, #F0FDF4, #DCFCE7)', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 18px', textAlign: 'left' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#16A34A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Comparação de custo</div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                                                {cashPrice > 0 && (
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Preço em dinheiro</div>
                                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#0E2A55' }}>R$ {cashPrice.toLocaleString('pt-BR')}</div>
                                                    </div>
                                                )}
                                                {cashPrice > 0 && seatsContext && <ArrowRight size={16} color="#CBD5E1" />}
                                                {seatsContext && (
                                                    <div>
                                                        <div style={{ fontSize: 11, color: '#64748B', marginBottom: 2 }}>Milhas selecionadas ({seatsContext.program})</div>
                                                        <div style={{ fontSize: 20, fontWeight: 800, color: '#16A34A' }}>{seatsContext.totalMilhas.toLocaleString('pt-BR')} pts</div>
                                                        {seatsContext.taxas && <div style={{ fontSize: 10, color: '#94A3B8' }}>+ {seatsContext.taxas} taxas</div>}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activePromos.length > 0 && (
                                        <div style={{ width: '100%', background: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)', border: '1px solid #C4B5FD', borderRadius: 12, padding: '12px 16px', textAlign: 'left' }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                                                ⚡ Promoções ativas · programas candidatos
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {activePromos.map(p => (
                                                    <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                                        <span style={{ flexShrink: 0, fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '999px', background: p.subcategoria === 'clube' ? '#FEF3C7' : '#EDE9FE', color: p.subcategoria === 'clube' ? '#B45309' : '#6D28D9' }}>
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
                                            <div style={{ fontSize: '10.5px', color: '#7C3AED', marginTop: 8, fontStyle: 'italic' }}>A IA considera estas promoções automaticamente.</div>
                                        </div>
                                    )}

                                    <div style={{ width: 56, height: 56, borderRadius: 16, background: canGenerateStrategy ? 'linear-gradient(135deg, #EEF2FF, #E0E7FF)' : 'linear-gradient(135deg, #FEF3C7, #FDE68A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        {canGenerateStrategy ? <Sparkles size={26} color="#4A90E2" /> : <Lock size={26} color="#D97706" />}
                                    </div>

                                    {canGenerateStrategy ? (
                                        <>
                                            <div>
                                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Analisar estratégia com IA</p>
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
                                                <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Limite de estratégias atingido</p>
                                                <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 300 }}>
                                                    {plan === 'free'
                                                        ? 'O plano gratuito inclui 1 estratégia. Faça upgrade para gerar mais.'
                                                        : `Você usou ${strategiesUsed} de ${strategyLimit} estratégias do mês. Faça upgrade ou aguarde o próximo ciclo.`}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => { onClose(); navigate('/planos') }}
                                                style={{ background: 'linear-gradient(135deg, #D97706, #F59E0B)', color: '#fff', border: 'none', borderRadius: 12, padding: '12px 28px', fontFamily: 'inherit', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 16px rgba(217,119,6,0.35)' }}
                                            >
                                                <Zap size={15} /> Ver planos
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ── Loading ────────────────────────────────────────── */}
                            {loading && (
                                <div style={{ textAlign: 'center', padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                                    <Loader2 size={32} color="#4A90E2" className="spin" />
                                    <p style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 600 }}>Consultando promoções e calculando estratégia...</p>
                                    <p style={{ fontSize: 12, color: '#94A3B8' }}>Leva cerca de 3–5 segundos</p>
                                </div>
                            )}

                            {/* ── Error ─────────────────────────────────────────── */}
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

                            {/* ── Strategy result ───────────────────────────────── */}
                            {strategy && (
                                <StrategyContent
                                    strategy={strategy}
                                    seatsContext={seatsContext}
                                    cashPrice={price}
                                    onRegenerate={generateStrategy}
                                    userId={user?.id}
                                />
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
