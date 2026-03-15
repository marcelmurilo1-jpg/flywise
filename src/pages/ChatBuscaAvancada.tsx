import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Loader2, Bot, User, Plus } from 'lucide-react'
import { Header } from '@/components/Header'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ChatConversation, ChatMessage } from '@/lib/supabase'

function formatMarkdown(text: string): string {
    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*)/gm, '<h3 style="font-size:15px;font-weight:700;color:#0E2A55;margin:14px 0 6px">$1</h3>')
        .replace(/^## (.*)/gm, '<h2 style="font-size:17px;font-weight:800;color:#0E2A55;margin:16px 0 8px">$1</h2>')
        .replace(/^# (.*)/gm, '<h2 style="font-size:19px;font-weight:800;color:#0E2A55;margin:16px 0 8px">$1</h2>')
        .replace(/^- (.*)/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
        .replace(/(<li.*<\/li>)/s, '<ul style="padding-left:18px;margin:8px 0">$1</ul>')
        .replace(/\n\n/g, '<br/><br/>')
        .replace(/\n/g, '<br/>')
}

const CABIN_LABELS: Record<string, string> = {
    economy: 'Econômica',
    premium_economy: 'Premium Economy',
    business: 'Executiva',
    first: 'Primeira Classe',
}

const HACKER_LABELS: Record<string, string> = {
    comfort: 'Conforto',
    value: 'Custo-Benefício',
    hacker: 'Modo Hacker 🔥',
}

export default function ChatBuscaAvancada() {
    const { id } = useParams<{ id: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()

    const [conv, setConv] = useState<ChatConversation | null>(null)
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(true)
    const [sending, setSending] = useState(false)
    const [aiTyping, setAiTyping] = useState(false)

    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)

    // Load conversation
    useEffect(() => {
        if (!id || !user) return
        supabase
            .from('chat_conversations')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()
            .then(({ data, error }) => {
                if (error || !data) { navigate('/saved-strategies'); return }
                setConv(data as ChatConversation)
                setMessages((data.messages as ChatMessage[]) ?? [])
                setLoading(false)
            })
    }, [id, user])

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, aiTyping])

    // Trigger first AI message if conversation is new (no messages yet)
    useEffect(() => {
        if (!conv || messages.length > 0 || loading) return
        sendToAI([], conv)
    }, [conv, loading])

    async function saveMessages(msgs: ChatMessage[]) {
        if (!id) return
        await supabase
            .from('chat_conversations')
            .update({ messages: msgs, updated_at: new Date().toISOString() })
            .eq('id', id)
    }

    async function sendToAI(history: ChatMessage[], conversation: ChatConversation) {
        setAiTyping(true)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-busca`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
                    },
                    body: JSON.stringify({
                        messages: history,
                        wizard_data: conversation.wizard_data,
                    }),
                }
            )

            const json = await response.json()
            if (json.error) throw new Error(json.error)

            const aiMsg: ChatMessage = { role: 'assistant', content: json.reply, created_at: new Date().toISOString() }
            const updated = [...history, aiMsg]
            setMessages(updated)
            await saveMessages(updated)
        } catch (err) {
            const errMsg: ChatMessage = {
                role: 'assistant',
                content: 'Erro ao conectar com a IA. Verifique sua conexão e tente novamente.',
                created_at: new Date().toISOString(),
            }
            setMessages(prev => [...prev, errMsg])
        } finally {
            setAiTyping(false)
        }
    }

    async function handleSend() {
        const text = input.trim()
        if (!text || sending || !conv) return
        setSending(true)
        setInput('')

        const userMsg: ChatMessage = { role: 'user', content: text, created_at: new Date().toISOString() }
        const updated = [...messages, userMsg]
        setMessages(updated)
        await saveMessages(updated)

        setSending(false)
        await sendToAI(updated, conv)
        inputRef.current?.focus()
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handleSend()
        }
    }

    const w = conv?.wizard_data as any

    return (
        <div style={{ minHeight: '100vh', background: '#F8FAFF', fontFamily: 'Manrope, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
            <Header variant="app" />

            {/* Chat container */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '760px', width: '100%', margin: '0 auto', padding: '0 16px', paddingBottom: '0' }}>

                {/* Top bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '20px 0 16px' }}>
                    <button
                        onClick={() => navigate('/saved-strategies')}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: '10px', border: 'none', background: 'rgba(14,42,85,0.06)', cursor: 'pointer', color: '#64748b', flexShrink: 0 }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,42,85,0.10)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,42,85,0.06)'}
                    >
                        <ArrowLeft size={16} />
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {conv?.title ?? 'Busca Avançada IA'}
                        </h1>
                        {w && (
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                                {CABIN_LABELS[w.cabinClass] ?? w.cabinClass} · {w.passengers} pax · {HACKER_LABELS[w.hackerMode] ?? w.hackerMode}
                                {w.dateGo ? ` · ${w.dateGo}${w.dateReturn ? ` → ${w.dateReturn}` : ''}` : ''}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={() => navigate('/busca-avancada')}
                        style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '8px 14px', borderRadius: '10px', border: 'none',
                            background: '#2A60C2', color: '#fff', fontSize: '13px',
                            fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#1a4fa0'}
                        onMouseLeave={e => e.currentTarget.style.background = '#2A60C2'}
                    >
                        <Plus size={14} /> Novo Chat
                    </button>
                </div>

                {/* Messages area */}
                <div style={{
                    flex: 1, overflowY: 'auto',
                    display: 'flex', flexDirection: 'column', gap: '16px',
                    paddingBottom: '16px',
                    minHeight: 0,
                }}>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                            <Loader2 size={28} color="#2A60C2" className="spin" />
                        </div>
                    ) : (
                        <>
                            <AnimatePresence initial={false}>
                                {messages.map((msg, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.25 }}
                                        style={{
                                            display: 'flex',
                                            flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                                            gap: '10px', alignItems: 'flex-start',
                                        }}
                                    >
                                        {/* Avatar */}
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: msg.role === 'assistant' ? 'linear-gradient(135deg, #2A60C2, #4a90e2)' : '#e2e8f0',
                                            color: msg.role === 'assistant' ? '#fff' : '#64748b',
                                        }}>
                                            {msg.role === 'assistant' ? <Bot size={16} /> : <User size={15} />}
                                        </div>

                                        {/* Bubble */}
                                        <div style={{
                                            maxWidth: '80%',
                                            padding: '12px 16px',
                                            borderRadius: msg.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                                            background: msg.role === 'user' ? '#2A60C2' : '#fff',
                                            color: msg.role === 'user' ? '#fff' : '#1e293b',
                                            fontSize: '14px', lineHeight: 1.6,
                                            boxShadow: '0 2px 8px rgba(14,42,85,0.08)',
                                            border: msg.role === 'assistant' ? '1px solid #e2e8f0' : 'none',
                                        }}>
                                            {msg.role === 'assistant' ? (
                                                <div dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                                            ) : (
                                                <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* AI typing indicator */}
                            {aiTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                                >
                                    <div style={{
                                        width: 32, height: 32, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'linear-gradient(135deg, #2A60C2, #4a90e2)', color: '#fff', flexShrink: 0,
                                    }}>
                                        <Bot size={16} />
                                    </div>
                                    <div style={{
                                        padding: '14px 18px', borderRadius: '18px 18px 18px 4px',
                                        background: '#fff', border: '1px solid #e2e8f0',
                                        boxShadow: '0 2px 8px rgba(14,42,85,0.08)',
                                        display: 'flex', alignItems: 'center', gap: '6px',
                                    }}>
                                        <TypingDots />
                                    </div>
                                </motion.div>
                            )}
                        </>
                    )}
                    <div ref={bottomRef} />
                </div>

                {/* Input area */}
                <div style={{
                    position: 'sticky', bottom: 0,
                    background: '#F8FAFF',
                    paddingTop: '12px', paddingBottom: '24px',
                    borderTop: '1px solid rgba(14,42,85,0.08)',
                }}>
                    <div style={{
                        display: 'flex', gap: '10px', alignItems: 'flex-end',
                        background: '#fff', borderRadius: '16px',
                        border: '1.5px solid #D4E2F4',
                        padding: '8px 8px 8px 16px',
                        boxShadow: '0 4px 20px rgba(14,42,85,0.08)',
                    }}>
                        <textarea
                            ref={inputRef}
                            rows={1}
                            placeholder="Pergunte algo sobre esta rota..."
                            value={input}
                            onChange={e => {
                                setInput(e.target.value)
                                e.target.style.height = 'auto'
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={sending || aiTyping}
                            style={{
                                flex: 1, border: 'none', outline: 'none', resize: 'none',
                                fontFamily: 'inherit', fontSize: '14px', color: '#1e293b',
                                background: 'transparent', lineHeight: 1.6,
                                maxHeight: '140px', overflowY: 'auto',
                                padding: '6px 0',
                            }}
                        />
                        <button
                            onClick={handleSend}
                            disabled={!input.trim() || sending || aiTyping}
                            style={{
                                width: 40, height: 40, borderRadius: '10px', border: 'none',
                                background: !input.trim() || aiTyping ? '#e2e8f0' : '#2A60C2',
                                color: !input.trim() || aiTyping ? '#94a3b8' : '#fff',
                                cursor: !input.trim() || aiTyping ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.2s', flexShrink: 0,
                            }}
                        >
                            {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                        </button>
                    </div>
                    <p style={{ fontSize: '11px', color: '#94a3b8', textAlign: 'center', marginTop: '8px' }}>
                        Enter para enviar · Shift+Enter para nova linha
                    </p>
                </div>
            </div>
        </div>
    )
}

function TypingDots() {
    return (
        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
                <motion.div
                    key={i}
                    style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8' }}
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
                />
            ))}
        </div>
    )
}
