import { useEffect, useState } from 'react'
import { Bot, Plus, Trash2, Loader2, ChevronRight } from 'lucide-react'
import { Header } from '@/components/Header'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import type { ChatConversation } from '@/lib/supabase'

const CABIN_LABELS: Record<string, string> = {
    economy: 'Econômica',
    premium_economy: 'Premium Economy',
    business: 'Executiva',
    first: 'Primeira Classe',
}

export default function ChatsIA() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [conversations, setConversations] = useState<ChatConversation[]>([])
    const [loading, setLoading] = useState(true)
    const [deletingConv, setDeletingConv] = useState<string | null>(null)

    useEffect(() => {
        if (!user) return
        supabase
            .from('chat_conversations')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .then(({ data }) => {
                if (data) setConversations(data as ChatConversation[])
            })
            .finally(() => setLoading(false))
    }, [user])

    const handleDelete = async (id: string) => {
        setDeletingConv(id)
        await supabase.from('chat_conversations').delete().eq('id', id).eq('user_id', user!.id)
        setConversations(prev => prev.filter(c => c.id !== id))
        setDeletingConv(null)
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
        return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif', paddingBottom: '80px' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '840px', margin: '40px auto 0', padding: '0 24px' }}>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                    <div>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: 'var(--text-dark)', letterSpacing: '-0.02em', marginBottom: '6px' }}>Chats IA</h1>
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

                {loading ? (
                    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                        <Loader2 size={32} color="var(--blue-medium)" className="spin" />
                    </div>
                ) : conversations.length === 0 ? (
                    <div style={{ background: 'var(--bg-white)', border: '1px solid var(--border-light)', borderRadius: '16px', padding: '48px 32px', textAlign: 'center', boxShadow: '0 4px 16px rgba(14,42,85,0.04)' }}>
                        <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #EEF4FF, #E8F0FF)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                            <Bot size={28} color="#2A60C2" />
                        </div>
                        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)', marginBottom: '8px' }}>Nenhuma conversa ainda</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6, maxWidth: '300px', margin: '0 auto 20px' }}>
                            Use a Busca Avançada IA ou "Analisar com IA" na carteira para iniciar uma conversa.
                        </p>
                        <button
                            onClick={() => navigate('/busca-avancada')}
                            style={{ background: 'linear-gradient(135deg, #2A60C2, #4a90e2)', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Bot size={16} /> Iniciar primeira conversa
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        <AnimatePresence>
                            {conversations.map((c, i) => {
                                const w = c.wizard_data as Record<string, unknown>
                                const msgs = Array.isArray(c.messages) ? c.messages : []
                                const lastMsg = msgs[msgs.length - 1] as { role: string; content: string; created_at?: string } | undefined
                                const msgCount = msgs.length
                                const lastPreview = lastMsg?.role === 'assistant' && typeof lastMsg?.content === 'string'
                                    ? lastMsg.content.replace(/[#*]/g, '').slice(0, 90)
                                    : null
                                const isParaOnde = w?.mode === 'para_onde'

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
                                            <div style={{
                                                width: 44, height: 44, borderRadius: '12px', flexShrink: 0,
                                                background: isParaOnde
                                                    ? 'linear-gradient(135deg, #F5F3FF, #ede9fe)'
                                                    : 'linear-gradient(135deg, #EEF4FF, #dbeafe)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            }}>
                                                <Bot size={20} color={isParaOnde ? '#7C3AED' : '#2A60C2'} />
                                            </div>

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {c.title}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    {isParaOnde && (
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#7C3AED', background: '#F5F3FF', padding: '2px 8px', borderRadius: '6px' }}>
                                                            Para Onde Posso Voar
                                                        </span>
                                                    )}
                                                    {!isParaOnde && w?.cabinClass && (
                                                        <span style={{ fontSize: '11px', fontWeight: 600, color: '#2A60C2', background: '#EEF4FF', padding: '2px 8px', borderRadius: '6px' }}>
                                                            {CABIN_LABELS[w.cabinClass as string] ?? String(w.cabinClass)}
                                                        </span>
                                                    )}
                                                    {!isParaOnde && w?.passengers && (
                                                        <span style={{ fontSize: '11px', color: '#64748b' }}>{String(w.passengers)} pax</span>
                                                    )}
                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        {msgCount} {msgCount === 1 ? 'mensagem' : 'mensagens'}
                                                    </span>
                                                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                                                        · {formatRelative(lastMsg?.created_at || c.updated_at)}
                                                    </span>
                                                </div>
                                                {lastPreview && (
                                                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        {lastPreview}...
                                                    </p>
                                                )}
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                                                <button
                                                    onClick={e => { e.stopPropagation(); handleDelete(c.id) }}
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
            </main>
        </div>
    )
}
