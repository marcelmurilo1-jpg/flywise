import { useEffect, useState } from 'react'
import { Plane, Search, Zap, TrendingDown, Trash2, Tag, Loader2, MessageSquare, Plus, ChevronRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import type { Strategy, ChatConversation } from '@/lib/supabase'

const CABIN_LABELS: Record<string, string> = {
    economy: 'Econômica',
    premium_economy: 'Premium Economy',
    business: 'Executiva',
    first: 'Primeira Classe',
}

export default function SavedStrategies() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [strategies, setStrategies] = useState<Strategy[]>([])
    const [conversations, setConversations] = useState<ChatConversation[]>([])
    const [loading, setLoading] = useState(true)
    const [deleting, setDeleting] = useState<number | null>(null)
    const [deletingConv, setDeletingConv] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return
        Promise.all([
            supabase.from('strategies').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('chat_conversations').select('*').eq('user_id', user.id).order('updated_at', { ascending: false }),
        ]).then(([{ data: strats }, { data: convs }]) => {
            if (strats) setStrategies(strats)
            if (convs) setConversations(convs as ChatConversation[])
            setLoading(false)
        })
    }, [user])

    const handleDelete = async (id: number) => {
        setDeleting(id)
        await supabase.from('strategies').delete().eq('id', id).eq('user_id', user!.id)
        setStrategies(prev => prev.filter(s => s.id !== id))
        setDeleting(null)
    }

    const handleDeleteConv = async (id: string) => {
        setDeletingConv(id)
        await supabase.from('chat_conversations').delete().eq('id', id).eq('user_id', user!.id)
        setConversations(prev => prev.filter(c => c.id !== id))
        setDeletingConv(null)
    }

    const formatDate = (iso?: string) => {
        if (!iso) return ''
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    const formatRelative = (iso?: string) => {
        if (!iso) return ''
        const diff = Date.now() - new Date(iso).getTime()
        const mins = Math.floor(diff / 60000)
        const hours = Math.floor(diff / 3600000)
        const days = Math.floor(diff / 86400000)
        if (mins < 2) return 'agora'
        if (mins < 60) return `há ${mins} min`
        if (hours < 24) return `há ${hours}h`
        if (days === 1) return 'ontem'
        if (days < 7) return `há ${days} dias`
        return formatDate(iso)
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '80px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>

                {/* ── Estratégias Salvas ── */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '6px' }}>Estratégias Salvas</h1>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Histórico das suas melhores rotas e análises personalizadas.</p>
                    </div>
                </div>

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <Loader2 size={32} color="var(--blue-medium)" className="spin" />
                    </div>
                ) : (
                    <>
                        {strategies.length === 0 ? (
                            <div className="card" style={{ padding: '0', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(14,42,85,0.04)', border: '1px solid var(--border-light)', background: 'var(--bg-white)', marginBottom: '40px' }}>
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
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
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
                                                style={{ background: 'var(--bg-white)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '20px 24px', boxShadow: '0 4px 16px rgba(14,42,85,0.04)' }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                                                    <div style={{ flex: 1, minWidth: 0 }}>
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
                                                        {s.strategy_text && (
                                                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: '14px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                                {s.strategy_text.split('\n\n')[0]}
                                                            </p>
                                                        )}
                                                        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                                                            {economia !== null && (
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                    <TrendingDown size={13} color="#16A34A" />
                                                                    <span style={{ fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>{economia}% de economia</span>
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

                        {/* ── Histórico Busca Avançada ── */}
                        <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                                <div>
                                    <h2 style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.01em', marginBottom: '4px' }}>
                                        Histórico Busca Avançada IA
                                    </h2>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Suas conversas com a IA salvas automaticamente.</p>
                                </div>
                                <button
                                    onClick={() => navigate('/busca-avancada')}
                                    style={{
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                        padding: '10px 16px', borderRadius: '12px', border: 'none',
                                        background: '#2A60C2', color: '#fff',
                                        fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                                        fontFamily: 'inherit', flexShrink: 0,
                                        boxShadow: '0 4px 12px rgba(42,96,194,0.25)',
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.background = '#1a4fa0'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                    onMouseLeave={e => { e.currentTarget.style.background = '#2A60C2'; e.currentTarget.style.transform = 'none' }}
                                >
                                    <Plus size={15} /> Novo Chat
                                </button>
                            </div>

                            {conversations.length === 0 ? (
                                <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '32px', textAlign: 'center', boxShadow: '0 4px 16px rgba(14,42,85,0.04)' }}>
                                    <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                        <MessageSquare size={22} color="#2A60C2" />
                                    </div>
                                    <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px' }}>Nenhuma conversa ainda</h3>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.6, maxWidth: '280px', margin: '0 auto 16px' }}>
                                        Use a Busca Avançada IA para conversar com a IA sobre sua viagem e estratégias de milhas.
                                    </p>
                                    <button
                                        onClick={() => navigate('/busca-avancada')}
                                        style={{ background: 'linear-gradient(135deg, #2A60C2, #4a90e2)', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 20px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                    >
                                        ✨ Iniciar primeira conversa
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <AnimatePresence>
                                        {conversations.map((c, i) => {
                                            const w = c.wizard_data as any
                                            const msgCount = c.messages?.length ?? 0
                                            const lastMsg = c.messages?.[msgCount - 1]

                                            return (
                                                <motion.div
                                                    key={c.id}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    exit={{ opacity: 0, x: -20 }}
                                                    transition={{ delay: i * 0.04 }}
                                                    style={{
                                                        background: 'var(--bg-white)',
                                                        border: '1px solid var(--border-light)',
                                                        borderRadius: '14px',
                                                        padding: '16px 20px',
                                                        boxShadow: '0 2px 8px rgba(14,42,85,0.04)',
                                                        cursor: 'pointer',
                                                        transition: 'all 0.2s',
                                                    }}
                                                    onClick={() => navigate(`/chat/${c.id}`)}
                                                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(14,42,85,0.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#C7D9F8' }}
                                                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(14,42,85,0.04)'; (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border-light)' }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                                        {/* Icon */}
                                                        <div style={{
                                                            width: 42, height: 42, borderRadius: '12px', flexShrink: 0,
                                                            background: 'linear-gradient(135deg, #EEF4FF, #dbeafe)',
                                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        }}>
                                                            <MessageSquare size={18} color="#2A60C2" />
                                                        </div>

                                                        {/* Content */}
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                                <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {c.title}
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                                {w?.cabinClass && (
                                                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#2A60C2', background: '#EEF4FF', padding: '2px 8px', borderRadius: '6px' }}>
                                                                        {CABIN_LABELS[w.cabinClass] ?? w.cabinClass}
                                                                    </span>
                                                                )}
                                                                {w?.passengers && (
                                                                    <span style={{ fontSize: '11px', color: '#64748b' }}>{w.passengers} pax</span>
                                                                )}
                                                                <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                                    {msgCount} {msgCount === 1 ? 'mensagem' : 'mensagens'}
                                                                </span>
                                                                {lastMsg && (
                                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>· {formatRelative(lastMsg.created_at || c.updated_at)}</span>
                                                                )}
                                                            </div>
                                                            {lastMsg?.role === 'assistant' && (
                                                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                    {lastMsg.content.replace(/[#*]/g, '').slice(0, 80)}...
                                                                </p>
                                                            )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                            <button
                                                                onClick={e => { e.stopPropagation(); handleDeleteConv(c.id) }}
                                                                disabled={deletingConv === c.id}
                                                                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '8px', color: '#EF4444', display: 'flex', alignItems: 'center', opacity: deletingConv === c.id ? 0.5 : 1, transition: 'background 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
                                                                onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                                            >
                                                                {deletingConv === c.id ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                                            </button>
                                                            <ChevronRight size={16} color="#94a3b8" />
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )
                                        })}
                                    </AnimatePresence>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
