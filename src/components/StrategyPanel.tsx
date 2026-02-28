import { useState } from 'react'
import { X, Zap, TrendingDown, ArrowRight, Save, CheckCircle, Loader2, AlertTriangle, Tag, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResultadoVoo } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { StrategyResult } from '@/lib/llm/buildPrompt'

interface StrategyPanelProps {
    open: boolean; onClose: () => void
    flight: ResultadoVoo | null; buscaId: number; cashPrice?: number
}

export function StrategyPanel({ open, onClose, flight, buscaId, cashPrice = 0 }: StrategyPanelProps) {
    const { user } = useAuth()
    const [saved, setSaved] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')
    const [loading, setLoading] = useState(false)
    const [strategy, setStrategy] = useState<StrategyResult | null>(null)
    const [llmError, setLlmError] = useState<string | null>(null)
    const [tokensUsed, setTokensUsed] = useState<number | null>(null)

    if (!flight) return null
    const price = cashPrice || flight.preco_brl || 0

    async function generateStrategy() {
        if (!flight?.id) return
        setLoading(true); setLlmError(null); setStrategy(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const res = await supabase.functions.invoke('strategy', {
                body: { flightId: flight.id, userId: user?.id },
                headers: token ? { Authorization: `Bearer ${token}` } : {},
            })

            if (res.error) throw new Error(res.error.message)
            const json = res.data as { ok: boolean; strategy: StrategyResult; tokens_used: number }
            if (!json?.ok || !json.strategy) throw new Error('Resposta inválida da LLM.')
            setStrategy(json.strategy)
            setTokensUsed(json.tokens_used ?? null)
        } catch (err: any) {
            setLlmError(err?.message ?? 'Erro ao gerar estratégia.')
        } finally {
            setLoading(false)
        }
    }

    const economyPct = strategy?.economia_pct ?? 0
    const milesNeeded = strategy?.milhas_necessarias ?? 0
    const taxesBrl = strategy?.taxas_estimadas_brl ?? 0
    const strategyPrice = taxesBrl
    void strategyPrice // referenced in save flow

    const handleSave = async () => {
        if (!user || saved || !strategy) return
        setSaving(true)
        try {
            const { error } = await supabase.from('strategies').insert({
                busca_id: buscaId, user_id: user.id,
                strategy_text: strategy.steps.join('\n\n'),
                tags: [strategy.programa_recomendado, strategy.alternativa].filter(Boolean),
                economia_pct: economyPct,
                preco_cash: price,
                preco_estrategia: strategyPrice,
                structured_result: strategy,
            })
            if (error) throw error
            setSaved(true); setMsg('✓ Estratégia salva!')
            setTimeout(() => setMsg(''), 3000)
        } catch { setMsg('Erro ao salvar.') }
        finally { setSaving(false) }
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
                                        {flight.companhia} · {flight.origem} → {flight.destino}
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
                                    <div style={{ width: 56, height: 56, borderRadius: 16, background: 'linear-gradient(135deg, #EEF2FF, #E0E7FF)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <Sparkles size={26} color="#4A90E2" />
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                                            Analisar estratégia com IA
                                        </p>
                                        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, maxWidth: 320 }}>
                                            A IA vai analisar o voo, verificar promoções ativas e calcular o melhor programa de milhas para esta rota.
                                        </p>
                                    </div>
                                    <button
                                        onClick={generateStrategy}
                                        style={{
                                            background: 'linear-gradient(135deg, #2A60C2, #4A90E2)',
                                            color: '#fff', border: 'none', borderRadius: 12,
                                            padding: '12px 28px', fontFamily: 'inherit',
                                            fontSize: 14, fontWeight: 700, cursor: 'pointer',
                                            display: 'flex', alignItems: 'center', gap: 8,
                                            boxShadow: '0 4px 16px rgba(42,96,194,0.35)',
                                        }}
                                    >
                                        <Zap size={15} /> Gerar estratégia
                                    </button>
                                    <p style={{ fontSize: 11, color: '#94A3B8' }}>
                                        ~1.500 tokens · R$ 0,015 por análise
                                    </p>
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
                                    {/* Recommendation badge */}
                                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '12px 16px', background: 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', border: '1px solid #C7D9F8', borderRadius: 12 }}>
                                        <Zap size={16} color="#2A60C2" />
                                        <div>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#2A60C2', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Programa recomendado</div>
                                            <div style={{ fontSize: 17, fontWeight: 900, color: '#0E2A55' }}>{strategy.programa_recomendado}</div>
                                            {strategy.alternativa && (
                                                <div style={{ fontSize: 11, color: '#64748B' }}>Alternativa: {strategy.alternativa}</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Motivo */}
                                    <p style={{ fontSize: 13.5, color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                                        {strategy.motivo}
                                    </p>

                                    {/* Savings comparison */}
                                    {price > 0 && (
                                        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '14px', padding: '18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                                                <TrendingDown size={15} color="var(--green)" />
                                                <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '13px' }}>Economia estimada: {economyPct}%</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Preço cash</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--red)', letterSpacing: '-0.02em' }}>R$ {price.toLocaleString('pt-BR')}</div>
                                                </div>
                                                <ArrowRight size={18} color="var(--text-faint)" />
                                                <div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Com milhas</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.02em' }}>R$ {taxesBrl.toLocaleString('pt-BR')}</div>
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
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {(strategy.steps ?? []).map((step, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.1 }}
                                                    style={{ display: 'flex', gap: '12px', background: 'var(--bg-subtle)', border: '1px solid var(--border-faint)', borderRadius: '12px', padding: '14px' }}
                                                >
                                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--accent-soft)', border: '1px solid rgba(59,130,246,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-start)', fontWeight: 800, fontSize: '12px', flexShrink: 0 }}>{i + 1}</div>
                                                    <p style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{step}</p>
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Aviso */}
                                    {strategy.aviso && (
                                        <div style={{ display: 'flex', gap: 8, padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 10 }}>
                                            <AlertTriangle size={14} color="#D97706" style={{ flexShrink: 0, marginTop: 1 }} />
                                            <span style={{ fontSize: 12, color: '#92400E' }}>{strategy.aviso}</span>
                                        </div>
                                    )}

                                    {/* Regenerate + Save */}
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <button
                                            onClick={generateStrategy}
                                            style={{ flex: 1, background: 'none', border: '1px solid var(--border-light)', borderRadius: 10, padding: '10px', fontFamily: 'inherit', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                                        >
                                            <Zap size={12} /> Regerar
                                        </button>
                                        <button
                                            onClick={handleSave}
                                            disabled={saved || saving}
                                            className="btn btn-primary"
                                            style={{ flex: 2, justifyContent: 'center', padding: '10px', opacity: saved || saving ? 0.7 : 1 }}
                                        >
                                            {saving ? <><Loader2 size={15} className="spin" /> Salvando...</> : saved ? <><CheckCircle size={15} /> Salva!</> : <><Save size={15} /> Salvar estratégia</>}
                                        </button>
                                    </div>
                                    {msg && (
                                        <div style={{ padding: '9px 13px', borderRadius: '8px', background: saved ? 'var(--green-bg)' : 'var(--red-bg)', color: saved ? 'var(--green)' : 'var(--red)', fontSize: '13px', fontWeight: 600 }}>{msg}</div>
                                    )}
                                </>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
