import { useEffect, useState } from 'react'
import { Plane, Search, Zap, TrendingDown, Trash2, Tag, Loader2 } from 'lucide-react'
import { Header } from '@/components/Header'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import type { Strategy } from '@/lib/supabase'

export default function SavedStrategies() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<number | null>(null)

    useEffect(() => {
        if (!user) return
        supabase
            .from('strategies')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .then(({ data }) => {
                if (data) setStrategies(data)
                setLoading(false)
            })
    }, [user])

    const handleDelete = async (id: number) => {
        setDeleting(id)
        await supabase.from('strategies').delete().eq('id', id).eq('user_id', user!.id)
        setStrategies(prev => prev.filter(s => s.id !== id))
        setDeleting(null)
    }

    const formatDate = (iso?: string) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '60px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '8px' }}>Estratégias Salvas</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '15px' }}>Histórico das suas melhores rotas e análises personalizadas.</p>
                    </div>
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
                                Você ainda não salvou nenhuma rota. Realize uma busca e clique em "Ver Detalhes" para gerar e salvar uma estratégia.
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
                                const tags: string[] = s.tags ?? []
                                const result = (s as any).structured_result
                                const programa = result?.programa_recomendado ?? tags[0] ?? '—'
                                const economia = s.economia_pct ?? result?.economia_pct ?? null
                                const precoCash = s.preco_cash ?? null
                                const precoEstrategia = s.preco_estrategia ?? result?.taxas_estimadas_brl ?? null

                                return (
                                    <motion.div
                                        key={s.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -8 }}
                                        transition={{ delay: i * 0.05 }}
                                        style={{
                                            background: 'var(--bg-white)',
                                            border: '1px solid var(--border-light)',
                                            borderRadius: '16px',
                                            padding: '20px 24px',
                                            boxShadow: '0 4px 16px rgba(14,42,85,0.04)',
                                        }}
                                    >
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                {/* Programa badge */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', border: '1px solid #C7D9F8', borderRadius: '8px', padding: '4px 10px' }}>
                                                        <Zap size={12} color="#2A60C2" />
                                                        <span style={{ fontSize: '12px', fontWeight: 700, color: '#2A60C2' }}>{programa}</span>
                                                    </div>
                                                    {tags.slice(1).map(tag => (
                                                        <span key={tag} style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', background: '#F1F5F9', padding: '3px 8px', borderRadius: '6px' }}>
                                                            {tag}
                                                        </span>
                                                    ))}
                                                </div>

                                                {/* Strategy text preview */}
                                                {s.strategy_text && (
                                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {s.strategy_text.split('\n\n')[0]}
                                                    </p>
                                                )}

                                                {/* Economia + preços */}
                                                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                    {economia !== null && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                            <TrendingDown size={13} color="#16A34A" />
                                                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>
                                                                {economia}% de economia
                                                            </span>
                                                        </div>
                                                    )}
                                                    {precoCash !== null && (
                                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            Preço cash: <strong style={{ color: 'var(--text-dark)' }}>R$ {precoCash.toLocaleString('pt-BR')}</strong>
                                                        </span>
                                                    )}
                                                    {precoEstrategia !== null && (
                                                        <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                                            Com milhas: <strong style={{ color: '#16A34A' }}>R$ {precoEstrategia.toLocaleString('pt-BR')}</strong>
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Promoção ativa */}
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

                                        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end' }}>
                                            <button
                                                onClick={() => s.busca_id && navigate(`/resultados?buscaId=${s.busca_id}`)}
                                                style={{ background: 'var(--blue-medium)', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 18px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}
                                            >
                                                Ver resultados →
                                            </button>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </AnimatePresence>
                    </div>
                )}
            </main>
        </div>
    )
}
