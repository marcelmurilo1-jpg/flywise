import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowLeft, Loader2, RefreshCw, Copy, Check, Clock, CreditCard, Landmark } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import confetti from 'canvas-confetti'
import { useAuth } from '@/contexts/AuthContext'

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

type PaymentMethod = 'pix' | 'cartao'

export default function Checkout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useAuth()
    const state = location.state as CheckoutState | undefined

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')

    // PIX state
    const [billingId, setBillingId] = useState<string | null>(null)
    const [billingUrl, setBillingUrl] = useState<string | null>(null)
    const [pixCode, setPixCode] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'EXPIRED'>('PENDING')
    const [copied, setCopied] = useState(false)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Card form state
    const [cardHolder, setCardHolder]         = useState('')
    const [cardNumber, setCardNumber]         = useState('')
    const [cardExpiry, setCardExpiry]         = useState('')
    const [cardCvv, setCardCvv]               = useState('')
    const [cardBrand, setCardBrand]           = useState<string | null>(null)
    const [installments, setInstallments]     = useState(1)
    const [cardProcessing, setCardProcessing]       = useState(false)
    const [cardFormError, setCardFormError]         = useState<string | null>(null)
    const [cardAwaitingPayment, setCardAwaitingPayment] = useState(false)

    useEffect(() => {
        if (!state) navigate('/planos', { replace: true })
    }, [state, navigate])

    // Auto-create PIX billing when PIX tab is selected and no billing exists yet
    useEffect(() => {
        if (!state || paymentMethod !== 'pix' || billingId || creating) return
        createPixBilling()
    }, [paymentMethod]) // eslint-disable-line react-hooks/exhaustive-deps

    // Auto-create on first mount with PIX
    useEffect(() => {
        if (!state) return
        createPixBilling()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function createPixBilling() {
        setCreating(true)
        setCreateError(null)
        setPixCode(null)
        setBillingId(null)
        setBillingUrl(null)
        setPaymentStatus('PENDING')
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
                    userId: user?.id,
                    billingType: state!.billing,
                    paymentMethod: 'pix',
                }),
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar cobrança')
            setBillingId(data.id)
            setBillingUrl(data.url ?? null)
            setPixCode(data.pixCode ?? null)
        } catch (err: any) {
            setCreateError(err.message)
        } finally {
            setCreating(false)
        }
    }

    // Poll payment status (PIX and tokenized card)
    useEffect(() => {
        if (!billingId || paymentStatus !== 'PENDING' || (paymentMethod !== 'pix' && paymentMethod !== 'cartao')) return
        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(`/api/checkout/status/${billingId}`)
                const d = await r.json()
                if (d.status === 'PAID' || d.status === 'COMPLETED') {
                    if (user && billingId) {
                        await fetch('/api/checkout/activate', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ billingId, userId: user.id }),
                        })
                    }
                    setPaymentStatus('PAID')
                    clearInterval(pollRef.current!)
                    confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: ['#16A34A', '#4ADE80', '#2A60C2', '#fff', '#4A90E2'] })
                    setTimeout(() => navigate('/onboarding', { state: { planName: state?.planName } }), 3500)
                } else if (d.status === 'EXPIRED' || d.status === 'CANCELLED') {
                    setPaymentStatus('EXPIRED')
                    clearInterval(pollRef.current!)
                }
            } catch { /* ignore */ }
        }, 3000)
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [billingId, paymentStatus, paymentMethod, navigate])

    function copyPix() {
        if (!pixCode) return
        navigator.clipboard.writeText(pixCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    function switchMethod(method: PaymentMethod) {
        if (method === paymentMethod) return
        // Stop PIX polling when switching away
        if (pollRef.current) clearInterval(pollRef.current)
        setPaymentMethod(method)
        setCardFormError(null)
    }

    function formatCardNumber(v: string): string {
        return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim()
    }

    function detectBrand(num: string): string | null {
        const n = num.replace(/\s/g, '')
        if (/^4/.test(n)) return 'VISA'
        if (/^5[1-5]|^2[2-7]/.test(n)) return 'Master'
        if (/^6(?:362[89]|3[89]|4\d{4}|5\d{4})\d*/.test(n)) return 'Elo'
        if (/^3[47]/.test(n)) return 'Amex'
        return null
    }

    function formatExpiry(v: string): string {
        const d = v.replace(/\D/g, '').slice(0, 4)
        return d.length >= 3 ? d.slice(0, 2) + '/' + d.slice(2) : d
    }

    function getInstallmentOptions(price: number) {
        return Array.from({ length: 12 }, (_, i) => {
            const n = i + 1
            const amt = (price / n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            return { n, label: n === 1 ? `1x de R$ ${amt} (sem juros)` : `${n}x de R$ ${amt}` }
        })
    }

    async function handleNativeCardPayment() {
        if (!cardHolder.trim()) { setCardFormError('Informe o nome no cartão'); return }
        if (cardNumber.replace(/\s/g, '').length < 16) { setCardFormError('Número do cartão inválido'); return }
        const [month, year] = cardExpiry.split('/')
        if (!month || !year || month.length !== 2 || year.length !== 2) { setCardFormError('Data de validade inválida (MM/AA)'); return }
        if (cardCvv.length < 3) { setCardFormError('CVV inválido'); return }

        setCardProcessing(true)
        setCardFormError(null)
        setCardAwaitingPayment(false)

        try {
            const tokenRes = await fetch('/api/checkout/tokenize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cardNumber: cardNumber.replace(/\s/g, ''),
                    cardHolder: cardHolder.trim(),
                    expiryMonth: month,
                    expiryYear: '20' + year,
                    cvv: cardCvv,
                }),
            })
            const tokenData = await tokenRes.json()

            if (tokenData.fallbackToUrl || !tokenRes.ok) {
                // AbacatePay tokenization not available — create billing and show URL in iframe
                const billingRes = await fetch('/api/checkout', {
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
                        userId: user?.id,
                        billingType: state!.billing,
                        paymentMethod: 'cartao',
                    }),
                })
                const billingData = await billingRes.json()
                if (!billingRes.ok || billingData.error) throw new Error(billingData.error || 'Erro ao criar cobrança')
                if (!billingData.url) throw new Error('URL de pagamento não retornada')
                setBillingId(billingData.id)
                setCardAwaitingPayment(true)
                window.open(billingData.url, '_blank')
                return
            }

            // Tokenization succeeded — create billing with token
            const billingRes = await fetch('/api/checkout', {
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
                    userId: user?.id,
                    billingType: state!.billing,
                    paymentMethod: 'cartao_tokenizado',
                    cardToken: tokenData.token,
                    installments,
                }),
            })
            const billingData = await billingRes.json()
            if (!billingRes.ok || billingData.error) throw new Error(billingData.error || 'Erro ao criar cobrança')
            setBillingId(billingData.id)
            // Polling useEffect handles PAID detection
        } catch (err: any) {
            setCardFormError(err.message)
        } finally {
            setCardProcessing(false)
        }
    }

    if (!state) return null

    return (
        <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes pulse-glow { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
                @keyframes pulse-ring { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.6);opacity:0} }
                @media(max-width:860px){
                    .co-grid { flex-direction: column !important; }
                    .co-left { width: 100% !important; min-height: auto !important; padding: 36px 24px 32px !important; }
                    .co-right { min-height: 60vh !important; }
                }
            `}</style>

            {/* ── LEFT: plan details ── */}
            <div className="co-left" style={{
                width: '42%', minWidth: 320, flexShrink: 0,
                background: 'linear-gradient(160deg, #0B2247 0%, #0E2A55 55%, #091d3e 100%)',
                padding: '48px 48px', display: 'flex', flexDirection: 'column', gap: 0,
                position: 'relative', overflow: 'hidden',
            }}>
                <div style={{ position: 'absolute', top: -100, right: -80, width: 340, height: 340, borderRadius: '50%', background: 'rgba(74,144,226,0.07)', filter: 'blur(70px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(42,96,194,0.09)', filter: 'blur(55px)', pointerEvents: 'none' }} />

                <button
                    onClick={() => navigate('/planos')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0, marginBottom: 36, position: 'relative', zIndex: 1, width: 'fit-content', transition: 'color .2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                    <ArrowLeft size={15} /> Voltar aos planos
                </button>

                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'relative', zIndex: 1, marginBottom: 32 }}>
                    <img src="/logoLP.png" alt="FlyWise" style={{ height: 52, objectFit: 'contain', display: 'block' }} />
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} style={{ position: 'relative', zIndex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 6 }}>
                        Plano selecionado
                    </div>
                    <h1 style={{ fontSize: 34, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1.1 }}>
                        {state.planName}
                    </h1>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                        <span style={{ fontSize: 40, fontWeight: 900, color: '#4A90E2', letterSpacing: '-0.04em', lineHeight: 1 }}>
                            {state.priceLabel}
                        </span>
                        <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.40)', fontWeight: 500 }}>
                            /{state.billing === 'anual' ? 'mês · cobrado anualmente' : 'mês'}
                        </span>
                    </div>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.50)', margin: '0 0 28px', lineHeight: 1.6 }}>{state.planDesc}</p>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.30)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                        Incluso no plano
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
                        {state.planFeatures.map(f => (
                            <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                                <div style={{ width: 20, height: 20, borderRadius: 5, background: 'rgba(74,144,226,0.18)', border: '1px solid rgba(74,144,226,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                                    <CheckCircle2 size={12} color="#4A90E2" />
                                </div>
                                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', fontWeight: 500, lineHeight: 1.5 }}>{f}</span>
                            </li>
                        ))}
                    </ul>
                </motion.div>

                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} style={{ marginTop: 32, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {['🔒  Pagamento criptografado com SSL', '↩  Cancele a qualquer momento', '✦  Sem fidelidade · sem multa'].map(t => (
                        <div key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', display: 'flex', alignItems: 'center', gap: 6 }}>{t}</div>
                    ))}
                </motion.div>
            </div>

            {/* ── RIGHT: payment ── */}
            <div className="co-right" style={{ flex: 1, background: '#F0F4FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>

                {/* Payment method toggle — only show when payment not confirmed */}
                {paymentStatus !== 'PAID' && (
                    <motion.div
                        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                        style={{ display: 'flex', background: '#fff', borderRadius: 14, padding: 4, gap: 4, boxShadow: '0 2px 12px rgba(14,42,85,0.08)', marginBottom: 28, border: '1px solid #E2EAF5' }}
                    >
                        {([
                            { id: 'pix', label: 'PIX', icon: <Landmark size={15} /> },
                            { id: 'cartao', label: 'Cartão de crédito', icon: <CreditCard size={15} /> },
                        ] as { id: PaymentMethod; label: string; icon: React.ReactNode }[]).map(opt => (
                            <button
                                key={opt.id}
                                onClick={() => switchMethod(opt.id)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: 7,
                                    padding: '9px 18px', borderRadius: 10, border: 'none',
                                    background: paymentMethod === opt.id ? '#0E2A55' : 'transparent',
                                    color: paymentMethod === opt.id ? '#fff' : '#64748B',
                                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                    fontFamily: 'inherit', transition: 'all .2s',
                                }}
                            >
                                {opt.icon} {opt.label}
                            </button>
                        ))}
                    </motion.div>
                )}

                <AnimatePresence mode="wait">

                    {/* PAID */}
                    {paymentStatus === 'PAID' && (
                        <motion.div key="paid"
                            initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, textAlign: 'center' }}>
                            <div style={{ position: 'relative' }}>
                                <div style={{ width: 88, height: 88, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <CheckCircle2 size={48} color="#16A34A" />
                                </div>
                                <div style={{ position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid #16A34A', animation: 'pulse-ring 1s ease-out forwards' }} />
                            </div>
                            <div>
                                <div style={{ fontSize: 26, fontWeight: 900, color: '#16A34A', marginBottom: 8 }}>Pagamento confirmado!</div>
                                <div style={{ fontSize: 15, color: '#64748B' }}>Plano <b>{state.planName}</b> ativado. Redirecionando…</div>
                            </div>
                        </motion.div>
                    )}

                    {/* ── PIX ── */}
                    {paymentStatus !== 'PAID' && paymentMethod === 'pix' && (
                        <motion.div key="pix-section"
                            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }}
                            style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* EXPIRED */}
                            {paymentStatus === 'EXPIRED' && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                                    <div style={{ fontSize: 17, fontWeight: 700, color: '#DC2626' }}>PIX expirado</div>
                                    <div style={{ fontSize: 13, color: '#64748B' }}>O prazo para pagamento encerrou.</div>
                                    <button onClick={createPixBilling}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <RefreshCw size={15} /> Gerar novo PIX
                                    </button>
                                </div>
                            )}

                            {/* Creating */}
                            {paymentStatus === 'PENDING' && creating && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                    <Loader2 size={38} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                                    <div style={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>Gerando cobrança PIX…</div>
                                </div>
                            )}

                            {/* Error */}
                            {paymentStatus === 'PENDING' && !creating && createError && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                                    <div style={{ fontSize: 14, color: '#DC2626', maxWidth: 360 }}>{createError}</div>
                                    <button onClick={createPixBilling}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <RefreshCw size={15} /> Tentar novamente
                                    </button>
                                </div>
                            )}

                            {/* PIX ready */}
                            {paymentStatus === 'PENDING' && !creating && !createError && (
                                <>
                                    <div style={{ textAlign: 'center' }}>
                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E8F5E9', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', animation: 'pulse-glow 2s ease-in-out infinite' }} />
                                            <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D', letterSpacing: '0.04em' }}>PIX — Aprovação instantânea</span>
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: 4 }}>Pague com PIX</div>
                                        <div style={{ fontSize: 13, color: '#64748B' }}>Escaneie o QR code ou copie o código abaixo</div>
                                    </div>

                                    <div style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total a pagar</div>
                                            <div style={{ fontSize: 36, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em' }}>R$ {state.priceVal}</div>
                                            <div style={{ fontSize: 12, color: '#94A3B8' }}>Plano {state.planName} · {state.billing === 'anual' ? 'Anual' : 'Mensal'}</div>
                                        </div>

                                        <div style={{ padding: 16, background: '#fff', borderRadius: 16, border: '2px solid #E8EEF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {pixCode ? (
                                                <QRCodeSVG value={pixCode} size={180} bgColor="#ffffff" fgColor="#0E2A55" level="M" />
                                            ) : (
                                                <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Loader2 size={32} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                                                </div>
                                            )}
                                        </div>

                                        {pixCode && (
                                            <div style={{ width: '100%' }}>
                                                <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                                    Pix Copia e Cola
                                                </div>
                                                <div style={{ display: 'flex', gap: 8 }}>
                                                    <div style={{ flex: 1, background: '#F7F9FC', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '10px 12px', fontSize: 11, color: '#475569', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text', userSelect: 'all' }}>
                                                        {pixCode}
                                                    </div>
                                                    <button onClick={copyPix} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: copied ? '#16A34A' : '#0E2A55', color: '#fff', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, transition: 'background .25s', whiteSpace: 'nowrap' }}>
                                                        {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                        <Clock size={14} color="#94A3B8" />
                                        <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Aguardando pagamento…</span>
                                        <span style={{ display: 'inline-flex', gap: 3 }}>
                                            {[0, 0.3, 0.6].map((d, i) => (
                                                <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#2A60C2', animation: `pulse-glow 1.4s ease-in-out ${d}s infinite` }} />
                                            ))}
                                        </span>
                                    </div>

                                    {billingUrl && (
                                        <div style={{ textAlign: 'center' }}>
                                            <a href={billingUrl} target="_blank" rel="noopener noreferrer"
                                                style={{ fontSize: 12, color: '#94A3B8', textDecoration: 'none', borderBottom: '1px solid rgba(148,163,184,0.35)', paddingBottom: 1, transition: 'color .2s' }}
                                                onMouseEnter={e => (e.currentTarget.style.color = '#64748B')}
                                                onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                                            >
                                                Prefere pagar pelo site da AbacatePay? Clique aqui →
                                            </a>
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ── CARTÃO ── */}
                    {paymentStatus !== 'PAID' && paymentMethod === 'cartao' && (
                        <motion.div key="card-section"
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                            style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 24 }}>

                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEF2F8', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>
                                    <CreditCard size={14} color="#2A60C2" />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#2A60C2', letterSpacing: '0.04em' }}>Cartão de crédito</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: 4 }}>
                                    {cardAwaitingPayment ? 'Pagamento em andamento' : 'Pague com cartão'}
                                </div>
                                <div style={{ fontSize: 13, color: '#64748B' }}>
                                    {cardAwaitingPayment ? 'Continue na aba que abrimos para você' : 'Preencha os dados do cartão — tudo acontece aqui'}
                                </div>
                            </div>

                            {/* Awaiting payment in new tab (fallback when tokenization unavailable) */}
                            {cardAwaitingPayment ? (
                                <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                                    <Loader2 size={36} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                                    <div style={{ fontSize: 17, fontWeight: 800, color: '#0E2A55' }}>Aguardando pagamento…</div>
                                    <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
                                        Uma nova aba foi aberta com a página de pagamento.<br />
                                        Assim que confirmarmos, você será redirecionado automaticamente.
                                    </div>
                                    <div style={{ fontSize: 11, color: '#94A3B8' }}>Verificando a cada 3 segundos</div>
                                </div>
                            ) : (
                                /* Native card form */
                                <div style={{ background: '#fff', borderRadius: 20, padding: '28px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>

                                    {/* Price summary */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F7F9FC', borderRadius: 12, border: '1px solid #E2EAF5' }}>
                                        <div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>Plano {state.planName}</div>
                                            <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>Renova automaticamente — cancele quando quiser</div>
                                        </div>
                                        <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55' }}>R$ {state.priceVal}</div>
                                    </div>

                                    {/* Cardholder name */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Nome no cartão</div>
                                        <input
                                            type="text" value={cardHolder} placeholder="Como aparece no cartão"
                                            onChange={e => setCardHolder(e.target.value)}
                                            style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', outline: 'none' }}
                                        />
                                    </div>

                                    {/* Card number */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Número do cartão</div>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                type="text" inputMode="numeric" value={cardNumber} placeholder="0000 0000 0000 0000"
                                                onChange={e => {
                                                    const v = formatCardNumber(e.target.value)
                                                    setCardNumber(v)
                                                    setCardBrand(detectBrand(v))
                                                }}
                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 44px 11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'monospace', outline: 'none' }}
                                            />
                                            {cardBrand && (
                                                <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 11, fontWeight: 800, color: '#475569', background: '#F1F5F9', padding: '2px 7px', borderRadius: 5, border: '1px solid #E2EAF5' }}>
                                                    {cardBrand}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expiry + CVV */}
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Validade</div>
                                            <input
                                                type="text" inputMode="numeric" value={cardExpiry} placeholder="MM/AA"
                                                onChange={e => setCardExpiry(formatExpiry(e.target.value))}
                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', outline: 'none' }}
                                            />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>CVV</div>
                                            <input
                                                type="password" inputMode="numeric" value={cardCvv} placeholder="•••"
                                                maxLength={4}
                                                onChange={e => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
                                                style={{ width: '100%', boxSizing: 'border-box', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', outline: 'none' }}
                                            />
                                        </div>
                                    </div>

                                    {/* Installments */}
                                    <div>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '.05em', textTransform: 'uppercase', marginBottom: 6 }}>Parcelas</div>
                                        <select
                                            value={installments}
                                            onChange={e => setInstallments(Number(e.target.value))}
                                            style={{ width: '100%', border: '1.5px solid #E2EAF5', borderRadius: 10, padding: '11px 13px', fontSize: 14, color: '#0E2A55', fontFamily: 'inherit', background: '#fff', outline: 'none', cursor: 'pointer' }}
                                        >
                                            {getInstallmentOptions(state.priceVal).map(opt => (
                                                <option key={opt.n} value={opt.n}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Accepted brands */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.05em' }}>Aceito</span>
                                        <div style={{ display: 'flex', gap: 5 }}>
                                            {['VISA', 'Master', 'Elo', 'Amex'].map(b => (
                                                <span key={b} style={{ padding: '2px 8px', background: cardBrand === b ? '#E0EAFF' : '#F1F5F9', border: `1px solid ${cardBrand === b ? '#93C5FD' : '#E2EAF5'}`, borderRadius: 5, fontSize: 10, fontWeight: 800, color: cardBrand === b ? '#1D4ED8' : '#475569' }}>{b}</span>
                                            ))}
                                        </div>
                                    </div>

                                    {cardFormError && (
                                        <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', border: '1px solid #FECACA' }}>
                                            {cardFormError}
                                        </div>
                                    )}

                                    <button
                                        onClick={handleNativeCardPayment}
                                        disabled={cardProcessing}
                                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: 15, background: cardProcessing ? '#94A3B8' : '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 15, fontWeight: 800, cursor: cardProcessing ? 'not-allowed' : 'pointer', fontFamily: 'inherit', transition: 'background .2s' }}
                                    >
                                        {cardProcessing
                                            ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processando…</>
                                            : <>🔒 Pagar R$ {state.priceVal}</>
                                        }
                                    </button>

                                    <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.6 }}>
                                        Dados protegidos por SSL · PCI DSS<br />
                                        Cancele a qualquer momento em Configurações
                                    </div>
                                </div>
                            )}

                            <div style={{ display: 'flex', justifyContent: 'center', gap: 20 }}>
                                {['🔒 SSL', '🛡️ PCI DSS', '🔄 Renovação automática'].map(t => (
                                    <div key={t} style={{ fontSize: 11, color: '#94A3B8', fontWeight: 600 }}>{t}</div>
                                ))}
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    )
}
