import { useState } from 'react'
import { X, Zap, TrendingDown, ArrowRight, Save, CheckCircle, Loader2, AlertTriangle, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { ResultadoVoo } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface StrategyPanelProps {
    open: boolean; onClose: () => void
    flight: ResultadoVoo | null; buscaId: number; cashPrice?: number
}

const STEPS: Record<string, string[]> = {
    LATAM: [
        'Verifique promoções de transferência ativas para LATAM Pass (ex: bônus 40% no Ponto Itaú)',
        'Transfira pontos durante a janela de bônus para maximizar as milhas obtidas',
        'Emita o bilhete pelo site da LATAM Pass e pague apenas as taxas aeroportuárias',
    ],
    GOL: [
        'Procure promoções de transferência para Smiles com bônus (Nubank, Clube Smiles)',
        'Transfira seus pontos para Smiles e aproveite o multiplicador de categoria',
        'Emita o voo GOL pelo Smiles — taxas geralmente abaixo de R$ 300',
    ],
    Azul: [
        'Verifique promoções de transferência para TudoAzul via cartões Bradesco',
        'Junte ou transfira milhas suficientes com bônus de categoria Gold/Diamante',
        'Emita o voo Azul pelo TudoAzul — frequentemente o menor CPM entre as três',
    ],
}

export function StrategyPanel({ open, onClose, flight, buscaId, cashPrice = 0 }: StrategyPanelProps) {
    const { user } = useAuth()
    const [saved, setSaved] = useState(false)
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState('')

    if (!flight) return null
    const airline = flight.companhia ?? 'LATAM'
    const steps = STEPS[airline] ?? STEPS['LATAM']
    const hasStrategy = flight.estrategia_disponivel
    const estPrice = (flight.taxas_brl ?? 0) + cashPrice * 0.35
    const savings = Math.max(0, cashPrice - estPrice)
    const savingsPct = cashPrice > 0 ? Math.round((savings / cashPrice) * 100) : 0

    const handleSave = async () => {
        if (!user || saved) return
        setSaving(true)
        try {
            const { error } = await supabase.from('strategies').insert({
                busca_id: buscaId, user_id: user.id,
                strategy_text: steps.join('\n\n'),
                tags: [airline, 'mock'], economia_pct: savingsPct,
                preco_cash: cashPrice, preco_estrategia: estPrice,
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
                            width: 'min(480px, 95vw)', zIndex: 201,
                            background: 'var(--bg-surface)',
                            borderLeft: '1px solid var(--border-light)',
                            boxShadow: 'var(--shadow-xl)',
                            overflowY: 'auto', display: 'flex', flexDirection: 'column',
                        }}
                    >
                        {/* Header row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid var(--border-faint)', position: 'sticky', top: 0, background: 'var(--bg-surface)', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: hasStrategy ? 'var(--accent-soft)' : 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {hasStrategy ? <Zap size={18} color="var(--accent-start)" /> : <AlertTriangle size={18} color="var(--text-muted)" />}
                                </div>
                                <div>
                                    <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-primary)' }}>
                                        {hasStrategy ? 'Estratégia encontrada' : 'Sem estratégia especial'}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{airline} · via milhas</div>
                                </div>
                            </div>
                            <button onClick={onClose} className="icon-btn"><X size={16} /></button>
                        </div>

                        <div style={{ padding: '24px', flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            {hasStrategy ? (
                                <>
                                    {/* Savings comparison */}
                                    {cashPrice > 0 && (
                                        <div style={{ background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', border: '1px solid rgba(16,185,129,0.15)', borderRadius: '14px', padding: '18px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                                                <TrendingDown size={15} color="var(--green)" />
                                                <span style={{ color: 'var(--green)', fontWeight: 700, fontSize: '13px' }}>Economia estimada: {savingsPct}%</span>
                                            </div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '10px' }}>
                                                <div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Preço normal</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--red)', letterSpacing: '-0.02em' }}>R$ {cashPrice.toLocaleString('pt-BR')}</div>
                                                </div>
                                                <ArrowRight size={18} color="var(--text-faint)" />
                                                <div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '3px' }}>Com estratégia</div>
                                                    <div style={{ fontSize: '22px', fontWeight: 900, color: 'var(--green)', letterSpacing: '-0.02em' }}>R$ {Math.round(estPrice).toLocaleString('pt-BR')}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Promo badge */}
                                    <div style={{ display: 'flex', gap: '8px', padding: '10px 14px', background: 'var(--amber-bg)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '10px' }}>
                                        <Tag size={14} color="var(--amber)" style={{ flexShrink: 0, marginTop: '1px' }} />
                                        <span style={{ fontSize: '13px', color: '#92400e', fontWeight: 600 }}>
                                            Promoção de transferência detectada para {airline === 'GOL' ? 'Smiles' : airline === 'LATAM' ? 'LATAM Pass' : 'TudoAzul'}
                                        </span>
                                    </div>

                                    {/* Steps */}
                                    <div>
                                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>Plano passo a passo</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {steps.map((step, i) => (
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

                                    {/* Miles detail */}
                                    {flight.preco_milhas && (
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                                            {[
                                                { label: 'Milhas', value: flight.preco_milhas.toLocaleString('pt-BR') },
                                                { label: 'Taxas', value: `R$ ${(flight.taxas_brl ?? 0).toLocaleString('pt-BR')}` },
                                                { label: 'CPM', value: flight.cpm ? `R$ ${flight.cpm.toFixed(2)}/1k` : '—' },
                                            ].map(d => (
                                                <div key={d.label} style={{ background: 'var(--bg-subtle)', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{d.label}</div>
                                                    <div style={{ fontSize: '15px', fontWeight: 800, color: 'var(--text-primary)' }}>{d.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {/* Save */}
                                    {msg && (
                                        <div style={{ padding: '9px 13px', borderRadius: '8px', background: saved ? 'var(--green-bg)' : 'var(--red-bg)', color: saved ? 'var(--green)' : 'var(--red)', fontSize: '13px', fontWeight: 600 }}>{msg}</div>
                                    )}
                                    <button onClick={handleSave} disabled={saved || saving} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '12px', opacity: saved || saving ? 0.7 : 1 }}>
                                        {saving ? <><Loader2 size={15} className="spin" /> Salvando...</> : saved ? <><CheckCircle size={15} /> Salva!</> : <><Save size={15} /> Salvar estratégia</>}
                                    </button>
                                </>
                            ) : (
                                /* No strategy */
                                <div>
                                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '20px' }}>
                                        Não encontrei uma estratégia de milhas visivelmente melhor para este voo. Isso pode mudar com novas promoções de transferência.
                                    </p>
                                    <div style={{ background: 'var(--accent-soft)', border: '1px solid rgba(59,130,246,0.15)', borderRadius: '12px', padding: '18px' }}>
                                        <p style={{ fontSize: '13.5px', color: 'var(--accent-start)', fontWeight: 700, marginBottom: '6px' }}>💡 Quer ver alternativas?</p>
                                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '14px' }}>
                                            Posso buscar rotas com aeroportos próximos — ex: GRU em vez de VCP, MAD em vez de CDG.
                                        </p>
                                        <button onClick={onClose} className="btn btn-outline btn-sm" style={{ width: '100%', justifyContent: 'center' }}>Buscar alternativas</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    )
}
