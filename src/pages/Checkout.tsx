import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ArrowLeft, Loader2, RefreshCw, Copy, Check, Clock } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import confetti from 'canvas-confetti'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { normalizePlan } from '@/lib/planLimits'

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
    const { user } = useAuth()
    const state = location.state as CheckoutState | undefined

    const [billingId, setBillingId] = useState<string | null>(null)
    const [billingUrl, setBillingUrl] = useState<string | null>(null)
    const [pixCode, setPixCode] = useState<string | null>(null)
    const [creating, setCreating] = useState(true)
    const [createError, setCreateError] = useState<string | null>(null)
    const [paymentStatus, setPaymentStatus] = useState<'PENDING' | 'PAID' | 'EXPIRED'>('PENDING')
    const [copied, setCopied] = useState(false)
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        if (!state) navigate('/planos', { replace: true })
    }, [state, navigate])

    useEffect(() => {
        if (!state) return
        createBilling()
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    async function createBilling() {
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

    // Poll payment status
    useEffect(() => {
        if (!billingId || paymentStatus !== 'PENDING') return
        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(`/api/checkout/status/${billingId}`)
                const d = await r.json()
                if (d.status === 'PAID' || d.status === 'COMPLETED') {
                    // Activate plan in user_profiles
                    if (user && state) {
                        const daysToAdd = state.billing === 'anual' ? 365 : 30
                        const expiresAt = new Date(Date.now() + daysToAdd * 24 * 60 * 60 * 1000).toISOString()
                        await supabase.from('user_profiles').upsert({
                            id: user.id,
                            plan: normalizePlan(state.planName),
                            plan_expires_at: expiresAt,
                            plan_billing: state.billing,
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
    }, [billingId, paymentStatus, navigate])

    function copyPix() {
        if (!pixCode) return
        navigator.clipboard.writeText(pixCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2500)
    }

    if (!state) return null

    return (
        <div style={{ minHeight: '100vh', display: 'flex', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes pulse-glow { 0%,100%{opacity:0.5;transform:scale(1)} 50%{opacity:1;transform:scale(1.08)} }
                @keyframes pulse-ring { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.6);opacity:0} }
                @keyframes ticker { 0%{stroke-dashoffset:0} 100%{stroke-dashoffset:-283} }
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
                {/* Glows */}
                <div style={{ position: 'absolute', top: -100, right: -80, width: 340, height: 340, borderRadius: '50%', background: 'rgba(74,144,226,0.07)', filter: 'blur(70px)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', bottom: -80, left: -60, width: 260, height: 260, borderRadius: '50%', background: 'rgba(42,96,194,0.09)', filter: 'blur(55px)', pointerEvents: 'none' }} />

                {/* Back link */}
                <button
                    onClick={() => navigate('/planos')}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.45)', fontSize: 13, fontWeight: 600, fontFamily: 'inherit', padding: 0, marginBottom: 36, position: 'relative', zIndex: 1, width: 'fit-content', transition: 'color .2s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.85)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.45)')}
                >
                    <ArrowLeft size={15} /> Voltar aos planos
                </button>

                {/* Logo */}
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} style={{ position: 'relative', zIndex: 1, marginBottom: 32 }}>
                    <img src="/logoLP.png" alt="FlyWise" style={{ height: 52, objectFit: 'contain', display: 'block' }} />
                </motion.div>

                {/* Plan info */}
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

                {/* Features */}
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

                {/* Trust badges */}
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.22 }} style={{ marginTop: 32, position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 9 }}>
                    {['🔒  Pagamento criptografado com SSL', '↩  Cancele a qualquer momento', '✦  Sem fidelidade · sem multa'].map(t => (
                        <div key={t} style={{ fontSize: 11, color: 'rgba(255,255,255,0.32)', display: 'flex', alignItems: 'center', gap: 6 }}>{t}</div>
                    ))}
                </motion.div>
            </div>

            {/* ── RIGHT: PIX payment ── */}
            <div className="co-right" style={{ flex: 1, background: '#F0F4FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
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

                    {/* EXPIRED */}
                    {paymentStatus === 'EXPIRED' && (
                        <motion.div key="expired"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: '#DC2626', marginBottom: 4 }}>PIX expirado</div>
                            <div style={{ fontSize: 13, color: '#64748B', marginBottom: 8 }}>O prazo para pagamento encerrou.</div>
                            <button onClick={createBilling}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 28px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                <RefreshCw size={15} /> Gerar novo PIX
                            </button>
                        </motion.div>
                    )}

                    {/* Creating */}
                    {paymentStatus === 'PENDING' && creating && (
                        <motion.div key="creating"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                            <Loader2 size={38} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                            <div style={{ fontSize: 15, color: '#64748B', fontWeight: 500 }}>Gerando cobrança PIX…</div>
                        </motion.div>
                    )}

                    {/* Error */}
                    {paymentStatus === 'PENDING' && !creating && createError && (
                        <motion.div key="error"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center' }}>
                            <div style={{ fontSize: 14, color: '#DC2626', maxWidth: 360 }}>{createError}</div>
                            <button onClick={createBilling}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 24px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                                <RefreshCw size={15} /> Tentar novamente
                            </button>
                        </motion.div>
                    )}

                    {/* PIX ready */}
                    {paymentStatus === 'PENDING' && !creating && !createError && (
                        <motion.div key="pix"
                            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                            style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 24 }}>

                            {/* Header */}
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: '#E8F5E9', borderRadius: 999, padding: '5px 14px', marginBottom: 16 }}>
                                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', animation: 'pulse-glow 2s ease-in-out infinite' }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: '#15803D', letterSpacing: '0.04em' }}>PIX — Aprovação instantânea</span>
                                </div>
                                <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: 4 }}>Pague com PIX</div>
                                <div style={{ fontSize: 13, color: '#64748B' }}>Escaneie o QR code ou copie o código abaixo</div>
                            </div>

                            {/* QR code card */}
                            <div style={{ background: '#fff', borderRadius: 20, padding: '28px 28px 24px', boxShadow: '0 4px 32px rgba(14,42,85,0.08)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>

                                {/* Price */}
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Total a pagar</div>
                                    <div style={{ fontSize: 36, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em' }}>{state.priceLabel}</div>
                                    <div style={{ fontSize: 12, color: '#94A3B8' }}>Plano {state.planName} · {state.billing === 'anual' ? 'Anual' : 'Mensal'}</div>
                                </div>

                                {/* QR */}
                                <div style={{ padding: 16, background: '#fff', borderRadius: 16, border: '2px solid #E8EEF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {pixCode ? (
                                        <QRCodeSVG value={pixCode} size={180} bgColor="#ffffff" fgColor="#0E2A55" level="M" />
                                    ) : (
                                        <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Loader2 size={32} color="#2A60C2" style={{ animation: 'spin 1s linear infinite' }} />
                                        </div>
                                    )}
                                </div>

                                {/* Pix copia e cola */}
                                {pixCode && (
                                    <div style={{ width: '100%' }}>
                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' }}>
                                            Pix Copia e Cola
                                        </div>
                                        <div style={{ display: 'flex', gap: 8 }}>
                                            <div style={{
                                                flex: 1, background: '#F7F9FC', border: '1.5px solid #E2EAF5',
                                                borderRadius: 10, padding: '10px 12px',
                                                fontSize: 11, color: '#475569', fontFamily: 'monospace',
                                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                                cursor: 'text', userSelect: 'all',
                                            }}>
                                                {pixCode}
                                            </div>
                                            <button onClick={copyPix} style={{
                                                display: 'flex', alignItems: 'center', gap: 6,
                                                padding: '10px 16px', background: copied ? '#16A34A' : '#0E2A55',
                                                color: '#fff', border: 'none', borderRadius: 10,
                                                fontSize: 13, fontWeight: 700, cursor: 'pointer',
                                                fontFamily: 'inherit', flexShrink: 0, transition: 'background .25s',
                                                whiteSpace: 'nowrap',
                                            }}>
                                                {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Waiting indicator */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                                <Clock size={14} color="#94A3B8" />
                                <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>Aguardando pagamento…</span>
                                <span style={{ display: 'inline-flex', gap: 3 }}>
                                    {[0, 0.3, 0.6].map((d, i) => (
                                        <span key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: '#2A60C2', animation: `pulse-glow 1.4s ease-in-out ${d}s infinite` }} />
                                    ))}
                                </span>
                            </div>

                            {/* AbacatePay fallback link */}
                            {billingUrl && (
                                <div style={{ textAlign: 'center' }}>
                                    <a
                                        href={billingUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ fontSize: 12, color: '#94A3B8', textDecoration: 'none', borderBottom: '1px solid rgba(148,163,184,0.35)', paddingBottom: 1, transition: 'color .2s' }}
                                        onMouseEnter={e => (e.currentTarget.style.color = '#64748B')}
                                        onMouseLeave={e => (e.currentTarget.style.color = '#94A3B8')}
                                    >
                                        Prefere pagar pelo site da AbacatePay? Clique aqui →
                                    </a>
                                </div>
                            )}
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>
        </div>
    )
}
