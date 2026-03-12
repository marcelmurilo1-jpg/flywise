import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, Shield, ArrowLeft, Loader2, ExternalLink, RefreshCw } from 'lucide-react'
import confetti from 'canvas-confetti'

interface CheckoutState {
    planName: string
    planDesc: string
    planFeatures: string[]
    priceVal: number
    priceLabel: string
    billing: 'mensal' | 'anual'
    customerEmail: string
    customerName: string
    customerTaxId: string
    customerPhone: string
}

export default function Checkout() {
    const navigate = useNavigate()
    const location = useLocation()
    const state = location.state as CheckoutState | undefined

    const [billingId, setBillingId] = useState<string | null>(null)
    const [billingUrl, setBillingUrl] = useState<string | null>(null)
    const [creating, setCreating] = useState(true)
    const [createError, setCreateError] = useState<string | null>(null)
    const [iframeError, setIframeError] = useState(false)
    const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'EXPIRED'>('PENDING')
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Redirect if no state passed
    useEffect(() => {
        if (!state) navigate('/planos', { replace: true })
    }, [state, navigate])

    // Create billing on mount
    useEffect(() => {
        if (!state) return
        createBilling()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function createBilling() {
        setCreating(true)
        setCreateError(null)
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: 'PLANO',
                    destination: state!.planName.toUpperCase(),
                    totalBrl: state!.priceVal,
                    outboundCompany: `FlyWise ${state!.planName}`,
                    customerEmail: state!.customerEmail,
                    customerName: state!.customerName,
                    customerTaxId: state!.customerTaxId,
                    customerPhone: state!.customerPhone,
                }),
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar cobrança')
            setBillingId(data.id)
            setBillingUrl(data.url)
        } catch (err: any) {
            setCreateError(err.message)
        } finally {
            setCreating(false)
        }
    }

    // Poll payment status
    useEffect(() => {
        if (!billingId || paymentStatus !== 'PENDING') return
        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(`/api/checkout/status/${billingId}`)
                const d = await r.json()
                if (d.status === 'PAID' || d.status === 'COMPLETED') {
                    setPaymentStatus('PAID')
                    clearInterval(pollRef.current!)
                    confetti({ particleCount: 180, spread: 100, origin: { y: 0.5 }, colors: ['#16A34A', '#4ADE80', '#2A60C2', '#fff'] })
                    setTimeout(() => navigate('/configuracoes'), 3000)
                } else if (d.status === 'EXPIRED' || d.status === 'CANCELLED') {
                    setPaymentStatus('EXPIRED')
                    clearInterval(pollRef.current!)
                }
            } catch { /* ignore */ }
        }, 3000)
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [billingId, paymentStatus, navigate])

    if (!state) return null

    const isFeatured = state.planName === 'Pro'

    return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes pulse-ring { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.5);opacity:0} }
                @media(max-width:860px){
                    .checkout-grid { flex-direction: column !important; }
                    .checkout-left { min-height: auto !important; padding: 40px 28px !important; }
                    .checkout-right { min-height: 70vh !important; }
                }
            `}</style>

            {/* ── Top bar ── */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E2EAF5', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <button
                    onClick={() => navigate('/planos')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}
                >
                    <ArrowLeft size={16} /> Voltar aos planos
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#94A3B8' }}>
                    <Shield size={14} color="#16A34A" />
                    Pagamento 100% seguro · SSL
                </div>
            </div>

            {/* ── Main split ── */}
            <div className="checkout-grid" style={{ flex: 1, display: 'flex' }}>

                {/* ── LEFT: plan details ── */}
                <div className="checkout-left" style={{
                    width: '42%', minWidth: 320, flexShrink: 0,
                    background: 'linear-gradient(160deg, #0E2A55 0%, #112F62 60%, #0A2347 100%)',
                    padding: '56px 48px', display: 'flex', flexDirection: 'column', gap: 32,
                    position: 'relative', overflow: 'hidden',
                }}>
                    {/* Background glow */}
                    <div style={{ position: 'absolute', top: -80, right: -80, width: 300, height: 300, borderRadius: '50%', background: 'rgba(74,144,226,0.08)', filter: 'blur(60px)', pointerEvents: 'none' }} />
                    <div style={{ position: 'absolute', bottom: -60, left: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(42,96,194,0.10)', filter: 'blur(50px)', pointerEvents: 'none' }} />

                    {/* Plan badge */}
                    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(74,144,226,0.15)', border: '1px solid rgba(74,144,226,0.30)', borderRadius: 999, padding: '5px 14px 5px 8px', marginBottom: 24 }}>
                            <div style={{ width: 24, height: 24, borderRadius: '50%', background: '#2A60C2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 11, fontWeight: 900, color: '#fff' }}>FW</span>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.04em' }}>FlyWise</span>
                        </div>

                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 6 }}>
                            Plano selecionado
                        </div>
                        <h1 style={{ fontSize: 36, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 4px', lineHeight: 1.1 }}>
                            {state.planName}
                        </h1>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                            <span style={{ fontSize: 42, fontWeight: 900, color: '#4A90E2', letterSpacing: '-0.04em', lineHeight: 1 }}>
                                {state.priceLabel}
                            </span>
                            <span style={{ fontSize: 15, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>/{state.billing === 'anual' ? 'mês · cobrado anualmente' : 'mês'}</span>
                        </div>
                        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', margin: 0, lineHeight: 1.6 }}>{state.planDesc}</p>
                    </motion.div>

                    {/* Features */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} style={{ position: 'relative', zIndex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 16 }}>
                            O que está incluído
                        </div>
                        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {state.planFeatures.map(f => (
                                <li key={f} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{ width: 22, height: 22, borderRadius: 6, background: 'rgba(74,144,226,0.20)', border: '1px solid rgba(74,144,226,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        <CheckCircle2 size={13} color="#4A90E2" />
                                    </div>
                                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.80)', fontWeight: 500 }}>{f}</span>
                                </li>
                            ))}
                        </ul>
                    </motion.div>

                    {/* Trust badges */}
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} style={{ marginTop: 'auto', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {[
                            '🔒  Pagamento criptografado com SSL',
                            '↩  Cancele a qualquer momento',
                            '✦  Sem fidelidade · sem multa',
                        ].map(t => (
                            <div key={t} style={{ fontSize: 12, color: 'rgba(255,255,255,0.40)', display: 'flex', alignItems: 'center', gap: 6 }}>{t}</div>
                        ))}
                    </motion.div>
                </div>

                {/* ── RIGHT: payment iframe ── */}
                <div className="checkout-right" style={{ flex: 1, background: '#F7F9FC', display: 'flex', flexDirection: 'column', position: 'relative' }}>

                    <AnimatePresence mode="wait">

                        {/* Payment PAID */}
                        {paymentStatus === 'PAID' && (
                            <motion.div key="paid"
                                initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
                                <div style={{ position: 'relative' }}>
                                    <div style={{ width: 80, height: 80, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={44} color="#16A34A" />
                                    </div>
                                    <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid #16A34A', animation: 'pulse-ring 1s ease-out forwards' }} />
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: 24, fontWeight: 900, color: '#16A34A', marginBottom: 8 }}>Pagamento confirmado!</div>
                                    <div style={{ fontSize: 15, color: '#64748B' }}>Plano {state.planName} ativado. Redirecionando…</div>
                                </div>
                            </motion.div>
                        )}

                        {/* Payment EXPIRED */}
                        {paymentStatus === 'EXPIRED' && (
                            <motion.div key="expired"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
                                <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626' }}>Pagamento expirou</div>
                                <button onClick={createBilling}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    <RefreshCw size={15} /> Gerar novo pagamento
                                </button>
                            </motion.div>
                        )}

                        {/* Creating billing */}
                        {paymentStatus === 'PENDING' && creating && (
                            <motion.div key="creating"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
                                <Loader2 size={36} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                                <div style={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>Preparando seu checkout…</div>
                            </motion.div>
                        )}

                        {/* Create error */}
                        {paymentStatus === 'PENDING' && !creating && createError && (
                            <motion.div key="error"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 40 }}>
                                <div style={{ fontSize: 14, color: '#DC2626', textAlign: 'center', maxWidth: 360 }}>{createError}</div>
                                <button onClick={createBilling}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                    <RefreshCw size={15} /> Tentar novamente
                                </button>
                            </motion.div>
                        )}

                        {/* Iframe */}
                        {paymentStatus === 'PENDING' && !creating && !createError && billingUrl && (
                            <motion.div key="iframe"
                                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>

                                {iframeError ? (
                                    /* Fallback se iframe bloqueado */
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 40 }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontSize: 17, fontWeight: 700, color: '#0E2A55', marginBottom: 8 }}>Abrir página de pagamento</div>
                                            <div style={{ fontSize: 13, color: '#64748B', maxWidth: 340, lineHeight: 1.6 }}>
                                                Clique abaixo para pagar com PIX ou Cartão de Crédito.<br />
                                                {billingId && <span style={{ color: '#2A60C2', fontWeight: 600 }}>Estamos monitorando o pagamento automaticamente.</span>}
                                            </div>
                                        </div>
                                        <a href={billingUrl} target="_blank" rel="noopener noreferrer"
                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 32px', background: '#0E2A55', color: '#fff', borderRadius: 14, textDecoration: 'none', fontSize: 15, fontWeight: 700, boxShadow: '0 6px 24px rgba(14,42,85,0.20)' }}>
                                            <ExternalLink size={16} /> Ir para o checkout
                                        </a>
                                        {billingId && (
                                            <div style={{ fontSize: 12, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'pulse-ring 1.5s ease-out infinite' }} />
                                                Verificando pagamento automaticamente…
                                            </div>
                                        )}
                                        {/* Dev mode test card info */}
                                        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 12, padding: '14px 18px', maxWidth: 380, width: '100%' }}>
                                            <div style={{ fontSize: 11, fontWeight: 800, color: '#92400E', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>🧪 Modo teste · Cartão aprovado</div>
                                            <div style={{ fontSize: 13, color: '#78350F', fontFamily: 'monospace', letterSpacing: '0.05em' }}>4242 4242 4242 4242</div>
                                            <div style={{ fontSize: 12, color: '#92400E', marginTop: 4 }}>Qualquer data futura · qualquer CVV</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                        <iframe
                                            src={billingUrl}
                                            title="Checkout AbacatePay"
                                            onError={() => setIframeError(true)}
                                            onLoad={e => {
                                                try {
                                                    // Se iframe carregou mas está em branco (bloqueado por X-Frame-Options)
                                                    const doc = (e.target as HTMLIFrameElement).contentDocument
                                                    if (!doc || doc.body?.innerHTML === '') setIframeError(true)
                                                } catch {
                                                    setIframeError(true)
                                                }
                                            }}
                                            style={{ flex: 1, border: 'none', width: '100%', minHeight: 600 }}
                                            allow="payment"
                                        />
                                        {/* Test card overlay (dev mode) */}
                                        <div style={{ position: 'absolute', bottom: 16, right: 16, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', fontSize: 11, color: '#92400E' }}>
                                            <div style={{ fontWeight: 800, letterSpacing: '0.05em', marginBottom: 4 }}>🧪 TESTE · Cartão aprovado</div>
                                            <div style={{ fontFamily: 'monospace', letterSpacing: '0.04em' }}>4242 4242 4242 4242</div>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}
