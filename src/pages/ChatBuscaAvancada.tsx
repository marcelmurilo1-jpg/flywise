import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Send, Loader2, Bot, User, Plus, Search, Sparkles } from 'lucide-react'
import { Header } from '@/components/Header'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import type { ChatConversation, ChatMessage } from '@/lib/supabase'

function getSuggestedPrompts(w: Record<string, unknown> | null): string[] {
    const dest = typeof w?.destination === 'string'
        ? w.destination.split('(')[0].trim()
        : 'este destino'
    const cabin = (w?.cabinClass as string) ?? 'economy'
    const isBusiness = cabin === 'business' || cabin === 'first'
    const isHacker = w?.hackerMode === 'hacker'
    const hasReturn = Boolean(w?.dateReturn)

    const prompts: string[] = [
        `Qual companhia tem mais assentos de milhas disponíveis para ${dest}?`,
        isBusiness
            ? `Vale mais Smiles ou LATAM Pass para executiva nessa rota?`
            : `Vale a pena upgrade para executiva ou focar em econômica?`,
        hasReturn
            ? `Qual a melhor combinação de ida + volta em milhas?`
            : `Quais datas próximas têm melhor disponibilidade de assentos?`,
        `Como transferir meus pontos do cartão de crédito para maximizar esse voo?`,
    ]

    if (isHacker) {
        prompts.push(`Existe algum routing alternativo ou escala que reduza o custo em milhas?`)
    }

    return prompts.slice(0, 4)
}

function formatMarkdown(text: string): string {
    if (!text) return ''

    // Tables: | col | col |
    const tableRegex = /(\|.+\|\n?)+/g
    text = text.replace(tableRegex, (match) => {
        const rows = match.trim().split('\n').filter(r => r.trim())
        if (rows.length < 2) return match
        const header = rows[0]
        const body = rows.slice(2) // skip separator row
        const thCells = header.split('|').filter(c => c.trim()).map(c => `<th style="padding:8px 12px;text-align:left;font-weight:700;color:#0E2A55;border-bottom:2px solid #D4E2F4;white-space:nowrap">${c.trim()}</th>`).join('')
        const trs = body.map(row => {
            const cells = row.split('|').filter(c => c.trim()).map(c => `<td style="padding:7px 12px;border-bottom:1px solid #f0f4fb;color:#334155">${c.trim()}</td>`).join('')
            return `<tr>${cells}</tr>`
        }).join('')
        return `<div style="overflow-x:auto;margin:12px 0"><table style="width:100%;border-collapse:collapse;font-size:13px"><thead><tr>${thCells}</tr></thead><tbody>${trs}</tbody></table></div>`
    })

    return text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/^### (.*)/gm, '<h3 style="font-size:14px;font-weight:700;color:#0E2A55;margin:14px 0 5px">$1</h3>')
        .replace(/^## (.*)/gm, '<h2 style="font-size:16px;font-weight:800;color:#0E2A55;margin:16px 0 7px">$1</h2>')
        .replace(/^# (.*)/gm, '<h2 style="font-size:18px;font-weight:800;color:#0E2A55;margin:16px 0 8px">$1</h2>')
        .replace(/^- (.*)/gm, '<li style="margin:3px 0;padding-left:4px">$1</li>')
        .replace(/(<li.*?<\/li>\n?)+/gs, (m) => `<ul style="padding-left:18px;margin:8px 0">${m}</ul>`)
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
    const [searchingRoutes, setSearchingRoutes] = useState<string[]>([])

    const bottomRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLTextAreaElement>(null)
    const streamAbort = useRef<AbortController | null>(null)
    const isMounted = useRef(true)

    useEffect(() => {
        isMounted.current = true
        return () => {
            isMounted.current = false
            streamAbort.current?.abort()
        }
    }, [])

    useEffect(() => {
        if (!id || !user) return
        supabase
            .from('chat_conversations')
            .select('*')
            .eq('id', id)
            .eq('user_id', user.id)
            .single()
            .then(({ data, error }) => {
                if (!isMounted.current) return
                if (error || !data) { navigate('/saved-strategies'); return }
                const msgs = (data.messages as ChatMessage[]) ?? []
                const conversation = data as ChatConversation
                setConv(conversation)
                setMessages(msgs)
                if (msgs.length === 0) setAiTyping(true)
                setLoading(false)
                if (msgs.length === 0) sendToAI([], conversation)
            })
    }, [id, user])

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, aiTyping, searchingRoutes])

    async function saveMessages(msgs: ChatMessage[]) {
        if (!id) return
        await supabase
            .from('chat_conversations')
            .update({ messages: msgs, updated_at: new Date().toISOString() })
            .eq('id', id)
    }

    async function sendToAI(history: ChatMessage[], conversation: ChatConversation) {
        setAiTyping(true)
        setSearchingRoutes([])

        // Cancel any in-flight stream before starting a new one
        streamAbort.current?.abort()
        const abort = new AbortController()
        streamAbort.current = abort

        let localSearching: string[] = []
        let accumulatedText = ''
        let messageAdded = false

        try {
            const { data: { session } } = await supabase.auth.getSession()
            const token = session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY

            const response = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chat-busca`,
                {
                    method: 'POST',
                    signal: abort.signal,
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

            if (!response.ok || !response.body) {
                const errText = await response.text().catch(() => `HTTP ${response.status}`)
                throw new Error(errText || `HTTP ${response.status}`)
            }

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buf = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (!isMounted.current) { reader.cancel(); break }

                buf += decoder.decode(value, { stream: true })
                const lines = buf.split('\n')
                buf = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = line.slice(6).trim()
                    if (!data) continue

                    try {
                        const event = JSON.parse(data)

                        if (event.type === 'searching') {
                            localSearching = [...localSearching, event.label as string]
                            if (isMounted.current) setSearchingRoutes([...localSearching])
                        }

                        if (event.type === 'text') {
                            if (localSearching.length > 0) {
                                localSearching = []
                                if (isMounted.current) setSearchingRoutes([])
                            }
                            if (isMounted.current) setAiTyping(false)

                            accumulatedText += event.delta as string

                            if (!isMounted.current) continue

                            if (!messageAdded) {
                                messageAdded = true
                                const partial: ChatMessage = {
                                    role: 'assistant',
                                    content: accumulatedText,
                                    created_at: new Date().toISOString(),
                                }
                                setMessages(prev => [...prev, partial])
                            } else {
                                setMessages(prev => {
                                    const updated = [...prev]
                                    updated[updated.length - 1] = {
                                        ...updated[updated.length - 1],
                                        content: accumulatedText,
                                    }
                                    return updated
                                })
                            }
                        }

                        if (event.type === 'done') {
                            if (accumulatedText) {
                                const finalMsg: ChatMessage = {
                                    role: 'assistant',
                                    content: accumulatedText,
                                    created_at: new Date().toISOString(),
                                }
                                await saveMessages([...history, finalMsg])
                            }
                        }

                        if (event.type === 'error') {
                            throw new Error(event.message as string)
                        }
                    } catch (parseErr) {
                        // ignore malformed SSE chunks
                    }
                }
            }
        } catch (err) {
            if (!isMounted.current) return
            const detail = err instanceof Error ? err.message : String(err)
            if (detail.includes('AbortError') || detail.includes('abort')) return
            const errMsg: ChatMessage = {
                role: 'assistant',
                content: `Erro ao conectar com a IA: ${detail}`,
                created_at: new Date().toISOString(),
            }
            if (!messageAdded) {
                setMessages(prev => [...prev, errMsg])
            }
        } finally {
            if (isMounted.current) {
                setAiTyping(false)
                setSearchingRoutes([])
            }
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

    const w = conv?.wizard_data as Record<string, unknown> | null

    const suggestedPrompts = getSuggestedPrompts(w)
    const showSuggestions = !loading && messages.length > 0 && messages.length <= 4 && !aiTyping && searchingRoutes.length === 0

    return (
        <div style={{ height: '100dvh', background: '#F8FAFF', fontFamily: 'Manrope, system-ui, sans-serif', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Header variant="app" />

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', maxWidth: '760px', width: '100%', margin: '0 auto', padding: '0 16px', paddingBottom: '0', minHeight: 0 }}>

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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {conv?.title ?? 'Busca Avançada IA'}
                            </h1>
                            <span style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                                padding: '2px 8px', borderRadius: 20,
                                background: 'linear-gradient(135deg, #EEF4FF, #E0ECFF)',
                                border: '1px solid #C7D9F5',
                                fontSize: 10, fontWeight: 800, color: '#2A60C2',
                                flexShrink: 0,
                            }}>
                                <Sparkles size={9} /> IA
                            </span>
                        </div>
                        {w && (
                            <p style={{ fontSize: '12px', color: '#94a3b8', margin: 0, marginTop: '2px' }}>
                                {CABIN_LABELS[w.cabinClass as string] ?? w.cabinClass as string} · {w.passengers as number} pax · {HACKER_LABELS[w.hackerMode as string] ?? w.hackerMode as string}
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
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: msg.role === 'assistant' ? 'linear-gradient(135deg, #2A60C2, #4a90e2)' : '#e2e8f0',
                                            color: msg.role === 'assistant' ? '#fff' : '#64748b',
                                        }}>
                                            {msg.role === 'assistant' ? <Bot size={16} /> : <User size={15} />}
                                        </div>

                                        <div style={{
                                            maxWidth: '84%',
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

                            {/* Searching chips */}
                            <AnimatePresence>
                                {searchingRoutes.length > 0 && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -4 }}
                                        style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                                    >
                                        <div style={{
                                            width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            background: 'linear-gradient(135deg, #2A60C2, #4a90e2)', color: '#fff',
                                        }}>
                                            <Bot size={16} />
                                        </div>
                                        <div style={{
                                            padding: '12px 16px', borderRadius: '18px 18px 18px 4px',
                                            background: '#fff', border: '1px solid #e2e8f0',
                                            boxShadow: '0 2px 8px rgba(14,42,85,0.08)',
                                        }}>
                                            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 8px', fontWeight: 600 }}>
                                                Consultando Seats.aero...
                                            </p>
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                {searchingRoutes.map((route, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, scale: 0.85 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        style={{
                                                            display: 'flex', alignItems: 'center', gap: '5px',
                                                            padding: '4px 10px', borderRadius: '20px',
                                                            background: 'linear-gradient(135deg, #EEF4FF, #E0ECFF)',
                                                            border: '1px solid #C7D9F5',
                                                            fontSize: '12px', fontWeight: 700, color: '#2A60C2',
                                                        }}
                                                    >
                                                        <Search size={10} />
                                                        {route}
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* AI typing dots (shown before first text arrives) */}
                            {aiTyping && searchingRoutes.length === 0 && (
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

                            {/* Suggested prompts — shown after first AI reply, disappears after few turns */}
                            <AnimatePresence>
                                {showSuggestions && (
                                    <motion.div
                                        key="suggestions"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: -6 }}
                                        transition={{ duration: 0.3 }}
                                        style={{ paddingLeft: 42 }}
                                    >
                                        <p style={{ fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 8px' }}>
                                            Sugestões para continuar
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {suggestedPrompts.map((prompt, i) => (
                                                <motion.button
                                                    key={i}
                                                    initial={{ opacity: 0, x: -8 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{ delay: i * 0.07 }}
                                                    onClick={() => {
                                                        setInput(prompt)
                                                        inputRef.current?.focus()
                                                    }}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 8,
                                                        padding: '9px 14px', borderRadius: 12,
                                                        background: '#fff', border: '1.5px solid #D4E2F4',
                                                        cursor: 'pointer', fontFamily: 'inherit',
                                                        fontSize: 13, color: '#334155', textAlign: 'left',
                                                        boxShadow: '0 1px 4px rgba(14,42,85,0.06)',
                                                        transition: 'border-color 0.15s, background 0.15s',
                                                    }}
                                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A60C2'; e.currentTarget.style.background = '#F5F9FF' }}
                                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#D4E2F4'; e.currentTarget.style.background = '#fff' }}
                                                >
                                                    <Sparkles size={12} color="#2A60C2" style={{ flexShrink: 0 }} />
                                                    {prompt}
                                                </motion.button>
                                            ))}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
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
                    {/* Chat vs Busca Normal — shown only on first few turns */}
                    {!loading && messages.length <= 1 && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', marginBottom: 10, borderRadius: 12,
                            background: 'linear-gradient(135deg, #F0F6FF, #EAF1FF)',
                            border: '1px solid #C7D9F5',
                        }}>
                            <Sparkles size={14} color="#2A60C2" style={{ flexShrink: 0 }} />
                            <p style={{ margin: 0, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                                <strong style={{ color: '#0E2A55' }}>Chat IA:</strong> estratégia, timing e análise de rota.{' '}
                                <span style={{ color: '#64748b' }}>Para ver preços ao vivo, use a </span>
                                <button
                                    onClick={() => navigate('/')}
                                    style={{ background: 'none', border: 'none', padding: 0, color: '#2A60C2', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
                                >
                                    Busca Normal →
                                </button>
                            </p>
                        </div>
                    )}

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
                            placeholder="Estratégia, timing, qual companhia usar..."
                            value={input}
                            onChange={e => {
                                setInput(e.target.value)
                                e.target.style.height = 'auto'
                                e.target.style.height = `${Math.min(e.target.scrollHeight, 140)}px`
                            }}
                            onKeyDown={handleKeyDown}
                            disabled={sending || aiTyping || searchingRoutes.length > 0}
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
                            disabled={!input.trim() || sending || aiTyping || searchingRoutes.length > 0}
                            style={{
                                width: 40, height: 40, borderRadius: '10px', border: 'none',
                                background: !input.trim() || aiTyping || searchingRoutes.length > 0 ? '#e2e8f0' : '#2A60C2',
                                color: !input.trim() || aiTyping || searchingRoutes.length > 0 ? '#94a3b8' : '#fff',
                                cursor: !input.trim() || aiTyping || searchingRoutes.length > 0 ? 'not-allowed' : 'pointer',
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
