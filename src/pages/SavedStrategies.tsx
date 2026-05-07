import { useEffect, useState } from 'react'
import { Plane, Search, Zap, TrendingDown, TrendingUp, Trash2, Tag, Loader2, AlertTriangle, CheckCircle } from 'lucide-react'
import { Header } from '@/components/Header'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import type { Strategy } from '@/lib/supabase'
import { StrategyPanel } from '@/components/StrategyPanel'
import type { StrategyResult } from '@/lib/llm/buildPrompt'
import type { SeatsContext } from '@/components/StrategyPanel'

export default function SavedStrategies() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<number | null>(null)
    const [panelOpen, setPanelOpen] = useState(false)
    const [panelStrategy, setPanelStrategy] = useState<StrategyResult | null>(null)
    const [panelSeatsCtx, setPanelSeatsCtx] = useState<SeatsContext | undefined>(undefined)
    const [panelBuscaId, setPanelBuscaId] = useState(0)
    const [panelCashPrice, setPanelCashPrice] = useState(0)

    useEffect(() => {
        if (!user) return
        supabase
            .from('strategies')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data, error }) => {
                if (data) setStrategies(data)
                if (error) console.error('[SavedStrategies]', error)
                setLoading(false)
            })
    }, [user])

    const handleDelete = async (id: number) => {
        setDeleting(id)
        await supabase.from('strategies').delete().eq('id', id).eq('user_id', user!.id)
        setStrategies(prev => prev.filter(s => s.id !== id))
        setDeleting(null)
    }

    const openStrategyPanel = (s: Strategy) => {
        const result = s.structured_result as StrategyResult | null | undefined
        if (!result) return

        const allTags: string[] = s.tags ?? []
        const seatsTag = allTags.find(t => t?.startsWith('seats:'))
        let ctx: SeatsContext | undefined
        if (seatsTag) {
            const parts = seatsTag.replace('seats:', '').split(':')
            if (parts.length >= 5) {
                const program = parts[2].replace(/_/g, ' ')
                ctx = {
                    airlineCode: '',
                    airlineName: program,
                    origem: parts[0],
                    destino: parts[1],
                    cabin: parts[3],
                    program,
                    idaMilhas: parseInt(parts[4]) || 0,
                    totalMilhas: parseInt(parts[4]) || 0,
                    isRoundTrip: false,
                    dataVoo: parts[5] ?? '',
                }
            }
        }

        setPanelStrategy(result)
        setPanelSeatsCtx(ctx)
        setPanelBuscaId(s.busca_id ?? 0)
        setPanelCashPrice(s.preco_cash ?? 0)
        setPanelOpen(true)
    }

    const formatDate = (iso?: string) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '80px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>

                <div style={{ marginBottom: '28px' }}>
                    <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '6px' }}>Estratégias Salvas</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Histórico das suas melhores rotas e análises personalizadas.</p>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <Loader2 size={32} color="var(--blue-medium)" className="spin" />
                    </div>
                ) : strategies.length === 0 ? (
                    <div className="card" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.04)', border: '1px solid var(--border-light)', background: 'var(--bg-white)' }}>
                        <div style={{ padding: '40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'var(--snow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plane size={28} color="var(--blue-medium)" />
                            </div>
                            <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)' }}>Nenhuma estratégia salva</h3>
                            <p style={{ color: 'var(--text-muted)', maxWidth: '300px', margin: '0 auto', fontSize: '14px', lineHeight: 1.6 }}>
                                Busque um voo, selecione um resultado Seats.aero e clique em "Gerar Estratégia" — ela é salva automaticamente.
                            </p>
                            <button
                                onClick={() => navigate('/home')}
                                style={{ marginTop: '8px', background: 'var(--snow)', color: 'var(--text-dark)', padding: '10px 20px', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '14px', border: '1px solid var(--border-light)', cursor: 'pointer', transition: 'background 0.2s' }}
                                onMouseEnter={e => e.currentTarget.style.background = '#eef2f8'}
                                onMouseLeave={e => e.currentTarget.style.background = 'var(--snow)'}
                            >
                                <Search size={16} color="var(--blue-medium)" /> Fazer Nova Busca
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <AnimatePresence>
                            {strategies.map((s, i) => {
                                const allTags: string[] = s.tags ?? []
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const result = s.structured_result as Record<string, any> | null | undefined

                                const seatsTag = allTags.find(t => t?.startsWith('seats:'))
                                const visibleTags = allTags.filter(t => t && !t.startsWith('seats:') && t !== 'llm')

                                const seatsInfo = seatsTag ? (() => {
                                    const parts = seatsTag.replace('seats:', '').split(':')
                                    if (parts.length < 5) return null
                                    return {
                                        from: parts[0], to: parts[1],
                                        program: parts[2].replace(/_/g, ' '),
                                        cabin: parts[3],
                                        miles: parseInt(parts[4]) || 0,
                                        date: parts[5] ?? null,
                                    }
                                })() : null

                                const programa = result?.programa_recomendado ?? visibleTags[0] ?? '—'
                                const economia = s.economia_pct ?? result?.economia_pct ?? null
                                const economiaBrl = result?.economia_brl ?? null
                                const precoCash = s.preco_cash ?? null
                                const precoEstrategia = s.preco_estrategia ?? result?.taxas_estimadas_brl ?? null
                                const valeAPena: boolean | undefined = result?.vale_a_pena
                                const cpm: number | undefined = result?.cpm_resgate
                                const cpmAvaliacao: string | undefined = result?.cpm_avaliacao
                                const milesNeeded: number | undefined = result?.milhas_necessarias

                                return (
                                    <motion.div
                                        key={s.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ delay: i * 0.05 }}
                                        style={{ background: 'var(--bg-white)', border: `1px solid ${valeAPena === false ? '#FED7AA' : 'var(--border-light)'}`, borderRadius: '16px', padding: '20px 24px', boxShadow: '0 4px 16px rgba(14,42,85,0.04)' }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: valeAPena === false ? '#FEF3C7' : 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', border: `1px solid ${valeAPena === false ? '#FDE68A' : '#C7D9F8'}`, borderRadius: '8px', padding: '4px 10px' }}>
                                                        <Zap size={12} color={valeAPena === false ? '#D97706' : '#2A60C2'} />
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: valeAPena === false ? '#92400E' : '#2A60C2' }}>{programa}</span>
                                                    </div>
                                                    {valeAPena === false ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 6, padding: '3px 8px' }}>
                                                            <AlertTriangle size={11} color="#EA580C" />
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#C2410C' }}>Dinheiro mais vantajoso</span>
                                                        </div>
                                                    ) : valeAPena === true ? (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 6, padding: '3px 8px' }}>
                                                            <CheckCircle size={11} color="#16A34A" />
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#15803D' }}>Vale a pena</span>
                                                        </div>
                                                    ) : null}
                                                    {cpm !== undefined && cpm > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: cpm >= 2.5 ? '#DCFCE7' : cpm >= 1.8 ? '#DBEAFE' : '#FEF9C3', border: `1px solid ${cpm >= 2.5 ? '#86EFAC' : cpm >= 1.8 ? '#93C5FD' : '#FDE047'}`, borderRadius: 6, padding: '3px 8px' }}>
                                                            <TrendingUp size={11} color={cpm >= 2.5 ? '#16A34A' : cpm >= 1.8 ? '#2563EB' : '#CA8A04'} />
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: cpm >= 2.5 ? '#15803D' : cpm >= 1.8 ? '#1D4ED8' : '#A16207' }}>
                                                                {cpm.toFixed(2)} c/pt{cpmAvaliacao ? ` — ${cpmAvaliacao}` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {visibleTags.slice(1, 3).map(tag => (
                                                        <span key={tag} style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>

                                                {seatsInfo && (
                                                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 8 }}>
                                                        {seatsInfo.from} → {seatsInfo.to}
                                                        <span style={{ fontWeight: 500, color: '#64748B', marginLeft: 8 }}>{seatsInfo.program} · {seatsInfo.cabin}</span>
                                                        {seatsInfo.date && <span style={{ fontWeight: 500, color: '#94A3B8', marginLeft: 8 }}>{seatsInfo.date}</span>}
                                                        {seatsInfo.miles > 0 && <span style={{ fontWeight: 700, color: '#16A34A', marginLeft: 8 }}>{seatsInfo.miles.toLocaleString('pt-BR')} pts</span>}
                                                    </div>
                                                )}

                                                {s.strategy_text && (
                                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {s.strategy_text.split('\n\n')[0]}
                                                    </p>
                                                )}

                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                    {economia !== null && economia > 0 && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <TrendingDown size={13} color="#16A34A" />
                                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>
                                                                {economia}% economia{economiaBrl ? ` (~R$ ${economiaBrl.toLocaleString('pt-BR')})` : ''}
                                                            </span>
                                                        </div>
                                                    )}
                                                    {precoCash !== null && (
                                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            Cash: <strong style={{ color: 'var(--text-dark)' }}>R$ {precoCash.toLocaleString('pt-BR')}</strong>
                                                        </span>
                                                    )}
                                                    {precoEstrategia !== null && valeAPena !== false && (
                                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            Taxas: <strong style={{ color: '#16A34A' }}>R$ {precoEstrategia.toLocaleString('pt-BR')}</strong>
                                                        </span>
                                                    )}
                                                    {milesNeeded !== undefined && milesNeeded > 0 && (
                                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            Milhas: <strong style={{ color: '#0E2A55' }}>{milesNeeded.toLocaleString('pt-BR')} pts</strong>
                                                        </span>
                                                    )}
                                                </div>
                                                {result?.promocao_ativa && (
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '10px' }}>
                                                        <Tag size={12} color="#D97706" />
                                                        <span style={{ fontSize: '12px', color: '#92400E', fontWeight: 600 }}>{result.promocao_ativa}</span>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{formatDate(s.created_at)}</span>
                                                <button
                                                    onClick={() => s.id !== undefined && handleDelete(s.id)}
                                                    disabled={deleting === s.id}
                                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#EF4444', display: 'flex', alignItems: 'center', opacity: deleting === s.id ? 0.5 : 1, transition: 'background 0.15s' }}
                                                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                                    onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                >
                                                    {deleting === s.id ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />}
                                                </button>
                                            </div>
                                        </div>
                                        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                                            {s.structured_result && (
                                                <button
                                                    onClick={() => openStrategyPanel(s)}
                                                    style={{ background: 'var(--blue-medium)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 18px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                                                >
                                                    Ver estratégia →
                                                </button>
                                            )}
                                            {s.busca_id && !s.structured_result && (
                                                <button
                                                    onClick={() => navigate(`/resultados?buscaId=${s.busca_id}`)}
                                                    style={{ background: 'var(--snow)', color: 'var(--text-dark)', border: '1px solid var(--border-light)', borderRadius: '10px', padding: '8px 18px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}
                                                >
                                                    Ver resultados →
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </main>

            <StrategyPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                buscaId={panelBuscaId}
                cashPrice={panelCashPrice}
                seatsContext={panelSeatsCtx}
                initialStrategy={panelStrategy ?? undefined}
            />
        </div>
    )
}
