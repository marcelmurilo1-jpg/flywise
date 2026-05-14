import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowLeft, Loader2, RefreshCw, Copy, Check, Clock, CreditCard, Landmark, X } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import confetti from 'canvas-confetti'
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js'
import type { StripeElementsOptions } from '@stripe/stripe-js'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { apiUrl } from '@/lib/api'

function maskCPF(v: string) {
    return v.replace(/\D/g, '').slice(0, 11)
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}
function maskPhone(v: string) {
    return v.replace(/\D/g, '').slice(0, 11)
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
}

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

// ─── Stripe appearance — alinhado ao design system FlyWise ───────────────────
const stripeAppearance = {
    theme: 'stripe' as const,
    variables: {
        colorPrimary: '#2A60C2',
        colorBackground: '#ffffff',
        colorText: '#0E2A55',
        colorDanger: '#DC2626',
        fontFamily: 'Inter, system-ui, sans-serif',
        borderRadius: '10px',
        fontSizeBase: '14px',
    },
    rules: {
        '.Input': {
            border: '1.5px solid #E2EAF5',
            padding: '11px 13px',
            fontSize: '14px',
        },
        '.Input:focus': {
            border: '1.5px solid #2A60C2',
            boxShadow: '0 0 0 3px rgba(42,96,194,0.12)',
        },
        '.Label': {
            fontSize: '11px',
            fontWeight: '700',
            color: '#64748B',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '6px',
        },
    },
}

export default function Checkout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useAuth()
    const locationState = location.state as CheckoutState | undefined

    // Quando o user chega via Landing → Auth, o state vem reconstruído do sessionStorage.
    // Quando chega via /planos (fluxo padrão logado), vem em location.state.
    const [state, setState] = useState<CheckoutState | null>(locationState ?? null)
    const [showDataModal, setShowDataModal] = useState(false)
    const [savingData, setSavingData] = useState(false)
    const [reconstructing, setReconstructing] = useState(!locationState)

    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('pix')

    // PIX state
    const [billingId, setBillingId] = useState<string | null>(null)
    const [pixCode, setPixCode] = useState<string | null>(null)
    const [creating, setCreating] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)
    const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'EXPIRED'>('PENDING')
    const [copied, setCopied] = useState(false)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    // Reconstrói o state a partir do sessionStorage quando o user vem direto da Landing.
    useEffect(() => {
        if (state || !user) return
        const pendingJson = sessionStorage.getItem('flywise_pending_plan')
        const pendingBilling = sessionStorage.getItem('flywise_pending_billing_period')

        if (!pendingJson) {
            navigate('/planos', { replace: true })
            return
        }

        let plan: any
        try { plan = JSON.parse(pendingJson) } catch {
            navigate('/planos', { replace: true })
            return
        }
        if (!plan?.priceVal || !plan?.priceAnualVal) {
            navigate('/planos', { replace: true })
            return
        }

        const billing: 'mensal' | 'anual' = pendingBilling === 'anual' ? 'anual' : 'mensal'
        const priceVal = billing === 'anual' ? plan.priceAnualVal * 12 : plan.priceVal
        const priceLabel = billing === 'anual' ? `R$ ${plan.priceAnualVal}` : plan.price

        ;(async () => {
            const { data: profile } = await supabase
                .from('user_profiles')
                .select('cpf, phone')
                .eq('id', user.id)
                .maybeSingle()

            const cpf = (profile as any)?.cpf ?? ''
            const phone = profile?.phone ?? ''

            const baseState: CheckoutState = {
                planName: plan.name,
                planDesc: plan.desc,
                planFeatures: plan.features,
                priceVal,
                priceLabel,
                billing,
                customerEmail: user.email ?? '',
                customerName: user.user_metadata?.full_name || user.email?.split('@')[0] || '',
                customerTaxId: cpf,
                customerPhone: phone,
            }
            setState(baseState)
            setReconstructing(false)

            if (!cpf || !phone) {
                setShowDataModal(true)
            } else {
                // Tudo pronto — limpa sessionStorage agora
                sessionStorage.removeItem('flywise_pending_plan')
                sessionStorage.removeItem('flywise_pending_billing_period')
            }
        })()
    }, [state, user, navigate])

    async function handleDataSubmit(cpf: string, phone: string) {
        if (!user || !state) return
        setSavingData(true)
        try {
            await supabase.from('user_profiles').upsert({ id: user.id, cpf, phone })
            setState({ ...state, customerTaxId: cpf, customerPhone: phone })
            setShowDataModal(false)
            sessionStorage.removeItem('flywise_pending_plan')
            sessionStorage.removeItem('flywise_pending_billing_period')
        } finally {
            setSavingData(false)
        }
    }

    // Auto-create PIX billing apenas quando a aba PIX está ativa e ainda não temos cobrança.
    useEffect(() => {
        if (!state || paymentMethod !== 'pix' || billingId || creating) return
        createPixBilling()
    }, [state, paymentMethod]) // eslint-disable-line react-hooks/exhaustive-deps

    async function createPixBilling() {
        setCreating(true)
        setCreateError(null)
        setPixCode(null)
        setBillingId(null)
        setPaymentStatus('PENDING')
        try {
            const res = await fetch(apiUrl('/api/checkout'), {
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
            setPixCode(data.pixCode ?? null)
        } catch (err: any) {
            setCreateError(err.message)
        } finally {
            setCreating(false)
        }
    }

    // Poll PIX status
    useEffect(() => {
        if (!billingId || paymentStatus !== 'PENDING' || paymentMethod !== 'pix') return
        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(apiUrl(`/api/checkout/status/${billingId}`))
                const d = await r.json()
                if (d.status === 'PAID' || d.status === 'COMPLETED') {
                    if (user && billingId) {
                        await fetch(apiUrl('/api/checkout/activate'), {
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
        if (pollRef.current) clearInterval(pollRef.current)
        setPaymentMethod(method)
    }

    function onCardSuccess() {
        setPaymentStatus('PAID')
        confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: ['#16A34A', '#4ADE80', '#2A60C2', '#fff', '#4A90E2'] })
        setTimeout(() => navigate('/onboarding', { state: { planName: state?.planName } }), 3500)
    }

    if (!state || reconstructing) {
        return (
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F0F4FA', fontFamily: 'Inter, system-ui, sans-serif' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                    <Loader2 size={38} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: 14, color: '#64748B' }}>Preparando seu checkout…</div>
                    <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                </div>
            </div>
        )
    }

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

                            {paymentStatus === 'PENDING' && creating && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                    <Loader2 size={38} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                                    <div style={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>Gerando cobrança PIX…</div>
                                </div>
                            )}

                            {paymentStatus === 'PENDING' && !creating && createError && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                                    <div style={{ fontSize: 14, color: '#DC2626', maxWidth: 360 }}>{createError}</div>
                                    <button onClick={createPixBilling}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                        <RefreshCw size={15} /> Tentar novamente
                                    </button>
                                </div>
                            )}

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

                                </>
                            )}
                        </motion.div>
                    )}

                    {/* ── CARTÃO (Stripe) ── */}
                    {paymentStatus !== 'PAID' && paymentMethod === 'cartao' && state && user && (
                        <motion.div key="card-section"
                            initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 16 }}
                            style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 24 }}>
                            <StripeCardSection state={state} userId={user.id} onSuccess={onCardSuccess} />
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {/* Modal de CPF/telefone — quando user veio direto da Landing sem ter esses dados */}
            <AnimatePresence>
                {showDataModal && (
                    <CompleteDataModal
                        loading={savingData}
                        onSubmit={handleDataSubmit}
                        onClose={() => navigate('/home')}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Modal CPF + Telefone (para usuário recém-cadastrado vindo da Landing) ───
function CompleteDataModal({ onSubmit, onClose, loading }: {
    onSubmit: (cpf: string, phone: string) => void
    onClose: () => void
    loading: boolean
}) {
    const [cpf, setCpf] = useState('')
    const [phone, setPhone] = useState('')
    const [err, setErr] = useState('')

    function submit() {
        const raw = cpf.replace(/\D/g, '')
        if (raw.length !== 11) { setErr('CPF inválido. Digite os 11 dígitos.'); return }
        const rawPhone = phone.replace(/\D/g, '')
        if (rawPhone.length < 10) { setErr('Telefone inválido.'); return }
        setErr('')
        onSubmit(raw, rawPhone)
    }

    return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(14,42,85,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)' }}
        >
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{ background: '#fff', borderRadius: 24, padding: '32px 28px', maxWidth: 400, width: '100%', boxShadow: '0 24px 80px rgba(14,42,85,0.20)', display: 'flex', flexDirection: 'column', gap: 20 }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55' }}>Falta pouco!</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Precisamos do seu CPF e WhatsApp para emitir o pagamento</div>
                    </div>
                    <button onClick={onClose} disabled={loading} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>CPF</label>
                        <input value={cpf} onChange={e => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00"
                            style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2EAF5', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55' }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Telefone (WhatsApp)</label>
                        <input value={phone} onChange={e => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999"
                            style={{ padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2EAF5', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55' }}
                        />
                    </div>
                    {err && <div style={{ fontSize: 12, color: '#DC2626' }}>{err}</div>}
                </div>

                <button onClick={submit} disabled={loading}
                    style={{ padding: '13px', borderRadius: 12, border: 'none', background: '#0E2A55', color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.75 : 1 }}
                >
                    {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Salvando…</> : 'Continuar para pagamento'}
                </button>
            </motion.div>
        </motion.div>
    )
}

// ─── Stripe card section ─────────────────────────────────────────────────────
function StripeCardSection({ state, userId, onSuccess }: {
    state: CheckoutState
    userId: string
    onSuccess: () => void
}) {
    const [clientSecret, setClientSecret] = useState<string | null>(null)
    const [subscriptionId, setSubscriptionId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let cancelled = false
        async function createSub() {
            setLoading(true)
            setError(null)
            try {
                const res = await fetch(apiUrl('/api/stripe/create-subscription'), {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        userId,
                        plan: state.planName.toLowerCase(),
                        billing: state.billing,
                        customerEmail: state.customerEmail,
                        customerName: state.customerName,
                        customerTaxId: state.customerTaxId,
                    }),
                })
                const data = await res.json()
                if (cancelled) return
                if (!res.ok || data.error) throw new Error(data.error || 'Erro ao iniciar assinatura')
                setClientSecret(data.clientSecret)
                setSubscriptionId(data.subscriptionId)
            } catch (err: any) {
                if (!cancelled) setError(err.message)
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        createSub()
        return () => { cancelled = true }
    }, [userId, state.planName, state.billing, state.customerEmail, state.customerName, state.customerTaxId])

    if (loading) {
        return (
            <>
                <CardHeader state={state} />
                <div style={{ background: '#fff', borderRadius: 20, padding: '36px 28px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                    <Loader2 size={32} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                    <div style={{ fontSize: 14, color: '#64748B' }}>Preparando pagamento seguro…</div>
                </div>
            </>
        )
    }

    if (error || !clientSecret) {
        return (
            <>
                <CardHeader state={state} />
                <div style={{ background: '#fff', borderRadius: 20, padding: '28px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, color: '#DC2626', marginBottom: 16 }}>{error || 'Erro ao carregar pagamento'}</div>
                    <button onClick={() => window.location.reload()}
                        style={{ padding: '12px 24px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Tentar novamente
                    </button>
                </div>
            </>
        )
    }

    const options: StripeElementsOptions = {
        clientSecret,
        appearance: stripeAppearance,
    }

    return (
        <>
            <CardHeader state={state} />
            <Elements stripe={getStripe()} options={options}>
                <StripeCardForm state={state} subscriptionId={subscriptionId!} onSuccess={onSuccess} />
            </Elements>
        </>
    )
}

function CardHeader({ state }: { state: CheckoutState }) {
    return (
        <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#EEF2F8', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>
                <CreditCard size={14} color="#2A60C2" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#2A60C2', letterSpacing: '0.04em' }}>Cartão de crédito</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: 4 }}>
                Pague com cartão
            </div>
            <div style={{ fontSize: 13, color: '#64748B' }}>
                Plano {state.planName} · {state.billing === 'anual' ? 'Anual' : 'Mensal'} · renova automaticamente
            </div>
        </div>
    )
}

function StripeCardForm({ state, subscriptionId, onSuccess }: {
    state: CheckoutState
    subscriptionId: string
    onSuccess: () => void
}) {
    const stripe = useStripe()
    const elements = useElements()
    const [processing, setProcessing] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [confirming, setConfirming] = useState(false)

    async function pollPlanActivation(): Promise<boolean> {
        const maxAttempts = 25
        for (let i = 0; i < maxAttempts; i++) {
            try {
                const r = await fetch(apiUrl(`/api/stripe/subscription/${subscriptionId}/status`))
                const d = await r.json()
                if (d.planActive) return true
            } catch { /* ignore */ }
            await new Promise(resolve => setTimeout(resolve, 1000))
        }
        return false
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        if (!stripe || !elements) return

        setProcessing(true)
        setError(null)

        const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
            elements,
            confirmParams: {
                return_url: window.location.href,
            },
            redirect: 'if_required',
        })

        if (stripeError) {
            setError(stripeError.message ?? 'Falha no pagamento')
            setProcessing(false)
            return
        }

        if (paymentIntent?.status === 'succeeded') {
            setConfirming(true)
            const activated = await pollPlanActivation()
            if (activated) {
                onSuccess()
            } else {
                // Pagamento aprovado mas webhook ainda não veio. Mostra mensagem
                // amigável e segue para onboarding mesmo assim (webhook ativa em background).
                setError('Pagamento aprovado! Estamos ativando seu plano. Você receberá um email em instantes.')
                setTimeout(onSuccess, 2000)
            }
        } else if (paymentIntent?.status === 'processing') {
            setError('Pagamento em processamento. Você receberá um email quando confirmado.')
            setProcessing(false)
        } else {
            setError('Pagamento não confirmado. Tente novamente.')
            setProcessing(false)
        }
    }

    return (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 20, padding: '28px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', gap: 16 }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: '#F7F9FC', borderRadius: 12, border: '1px solid #E2EAF5' }}>
                <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>Plano {state.planName}</div>
                    <div style={{ fontSize: 11, color: '#94A3B8', marginTop: 2 }}>
                        {state.billing === 'anual' ? 'Cobrança anual · renova a cada 12 meses' : 'Cobrança mensal · renova a cada 30 dias'}
                    </div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55' }}>R$ {state.priceVal}</div>
            </div>

            <PaymentElement options={{ layout: 'tabs' }} />

            {error && (
                <div style={{ fontSize: 13, color: '#DC2626', background: '#FEF2F2', borderRadius: 10, padding: '10px 14px', border: '1px solid #FECACA' }}>
                    {error}
                </div>
            )}

            <button
                type="submit"
                disabled={!stripe || !elements || processing || confirming}
                style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    width: '100%', padding: 15,
                    background: (processing || confirming) ? '#94A3B8' : '#0E2A55',
                    color: '#fff', border: 'none', borderRadius: 12,
                    fontSize: 15, fontWeight: 800,
                    cursor: (processing || confirming) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit', transition: 'background .2s',
                }}
            >
                {confirming
                    ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Ativando seu plano…</>
                    : processing
                        ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Processando…</>
                        : <>🔒 Pagar R$ {state.priceVal}</>}
            </button>

            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', lineHeight: 1.6 }}>
                Pagamento processado pela Stripe · PCI DSS Level 1<br />
                Cancele a qualquer momento em Configurações
            </div>
        </form>
    )
}
