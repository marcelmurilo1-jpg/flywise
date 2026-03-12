import { useState, useCallback, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ChevronLeft, Loader2, Copy, Check, X, QrCode } from 'lucide-react'
import confetti from 'canvas-confetti'
import NumberFlow from '@number-flow/react'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

const PLANS = [
    {
        name: 'Free', price: 'Grátis', priceAnual: 'Grátis',
        priceVal: null as number | null, priceAnualVal: null as number | null,
        period: '', featured: false,
        desc: 'Para dar o primeiro passo com milhas.',
        features: ['Janela de 30 dias de pesquisa', '1 estratégia', 'Sem roteiro', 'Sem notificações'],
    },
    {
        name: 'Essencial', price: 'R$ 19', priceAnual: 'R$ 12',
        priceVal: 19, priceAnualVal: 12,
        period: '/mês', featured: false,
        desc: 'Para quem quer começar a viajar melhor.',
        features: ['Buscas ilimitadas de passagens', '3 estratégias/mês', '1 roteiro/mês', 'Sem notificações'],
    },
    {
        name: 'Pro', price: 'R$ 39', priceAnual: 'R$ 25',
        priceVal: 39, priceAnualVal: 25,
        period: '/mês', featured: true,
        desc: 'Para viajantes frequentes e estratégicos.',
        features: ['Buscas ilimitadas de passagens', '5 estratégias/mês', '3 roteiros/mês', 'Alertas de promoções por e-mail'],
    },
    {
        name: 'Elite', price: 'R$ 69', priceAnual: 'R$ 45',
        priceVal: 69, priceAnualVal: 45,
        period: '/mês', featured: false,
        desc: 'Para quem não quer perder nenhuma promoção.',
        features: ['Buscas ilimitadas de passagens', '10 estratégias/mês', '5 roteiros/mês', 'Alertas por e-mail e WhatsApp'],
    },
]

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

// ─── Modal PIX ────────────────────────────────────────────────────────────────
function PixModal({ billingId, pixCode, pixQrCode, planName, priceLabel, onClose, onPaid }: {
    billingId: string; pixCode: string | null; pixQrCode: string | null
    planName: string; priceLabel: string; onClose: () => void; onPaid: () => void
}) {
    const [copied, setCopied] = useState(false)
    const [status, setStatus] = useState<'PENDING' | 'PAID' | 'EXPIRED'>('PENDING')
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

    useEffect(() => {
        pollRef.current = setInterval(async () => {
            try {
                const r = await fetch(`/api/checkout/status/${billingId}`)
                const d = await r.json()
                if (d.status === 'PAID' || d.status === 'COMPLETED') {
                    setStatus('PAID')
                    clearInterval(pollRef.current!)
                    confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, colors: ['#16A34A', '#4ADE80', '#fff'] })
                    setTimeout(onPaid, 2200)
                } else if (d.status === 'EXPIRED' || d.status === 'CANCELLED') {
                    setStatus('EXPIRED')
                    clearInterval(pollRef.current!)
                }
            } catch { /* ignore */ }
        }, 3000)
        return () => { if (pollRef.current) clearInterval(pollRef.current) }
    }, [billingId, onPaid])

    function copyCode() {
        if (!pixCode) return
        navigator.clipboard.writeText(pixCode)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(14,42,85,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                style={{
                    background: '#fff', borderRadius: 24, padding: '32px 28px',
                    maxWidth: 440, width: '100%',
                    boxShadow: '0 24px 80px rgba(14,42,85,0.20)',
                    display: 'flex', flexDirection: 'column', gap: 20,
                }}
            >
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B', letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4 }}>
                            Pagamento PIX
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900, color: '#0E2A55' }}>FlyWise {planName}</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#2A60C2', marginTop: 2 }}>{priceLabel}/mês</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', padding: 4 }}>
                        <X size={20} />
                    </button>
                </div>

                {status === 'PAID' ? (
                    <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        style={{ textAlign: 'center', padding: '24px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                        <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <CheckCircle2 size={36} color="#16A34A" />
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#16A34A' }}>Pagamento confirmado!</div>
                        <div style={{ fontSize: 13, color: '#64748B' }}>Seu plano {planName} está ativo. Redirecionando…</div>
                    </motion.div>
                ) : status === 'EXPIRED' ? (
                    <div style={{ textAlign: 'center', padding: '16px 0', color: '#DC2626', fontSize: 14, fontWeight: 600 }}>
                        O pagamento expirou. Tente novamente.
                    </div>
                ) : (
                    <>
                        {/* QR Code */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
                            <div style={{ padding: 16, background: '#F8FAFC', borderRadius: 16, border: '1px solid #E2EAF5' }}>
                                {pixQrCode ? (
                                    <img src={pixQrCode} alt="QR Code PIX" style={{ width: 180, height: 180, display: 'block' }} />
                                ) : pixCode ? (
                                    <QRCodeSVG value={pixCode} size={180} />
                                ) : (
                                    <div style={{ width: 180, height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8' }}>
                                        <QrCode size={40} />
                                    </div>
                                )}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 12 }}>
                                <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16A34A', display: 'inline-block', animation: 'pulse-dot 1.5s ease-in-out infinite' }} />
                                Aguardando pagamento…
                            </div>
                        </div>

                        {/* Copy code */}
                        {pixCode && (
                            <div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>
                                    Ou copie o código PIX:
                                </div>
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <div style={{
                                        flex: 1, background: '#F8FAFC', border: '1px solid #E2EAF5',
                                        borderRadius: 10, padding: '10px 12px',
                                        fontSize: 11, color: '#64748B', fontFamily: 'monospace',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {pixCode}
                                    </div>
                                    <button
                                        onClick={copyCode}
                                        style={{
                                            background: copied ? '#DCFCE7' : '#0E2A55', color: copied ? '#16A34A' : '#fff',
                                            border: 'none', borderRadius: 10, padding: '0 16px',
                                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                                            fontSize: 12, fontWeight: 700, fontFamily: 'inherit', flexShrink: 0,
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        {copied ? <><Check size={14} /> Copiado!</> : <><Copy size={14} /> Copiar</>}
                                    </button>
                                </div>
                            </div>
                        )}

                        <div style={{ fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                            O QR code expira em 30 minutos · Verificando automaticamente a cada 3s
                        </div>
                    </>
                )}
            </motion.div>
        </motion.div>
    )
}

// ─── Modal completar dados ─────────────────────────────────────────────────────
function CompleteDataModal({ onSubmit, onClose, loading }: {
    onSubmit: (cpf: string, phone: string) => void; onClose: () => void; loading: boolean
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
        <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{
                position: 'fixed', inset: 0, background: 'rgba(14,42,85,0.55)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                zIndex: 1000, padding: 16, backdropFilter: 'blur(4px)',
            }}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                style={{
                    background: '#fff', borderRadius: 24, padding: '32px 28px',
                    maxWidth: 400, width: '100%',
                    boxShadow: '0 24px 80px rgba(14,42,85,0.20)',
                    display: 'flex', flexDirection: 'column', gap: 20,
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55' }}>Complete seus dados</div>
                        <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Necessário para emitir o PIX</div>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8' }}>
                        <X size={20} />
                    </button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>CPF</label>
                        <input
                            value={cpf}
                            onChange={e => setCpf(maskCPF(e.target.value))}
                            placeholder="000.000.000-00"
                            style={{
                                padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2EAF5',
                                fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55',
                            }}
                        />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Telefone (WhatsApp)</label>
                        <input
                            value={phone}
                            onChange={e => setPhone(maskPhone(e.target.value))}
                            placeholder="(11) 99999-9999"
                            style={{
                                padding: '12px 14px', borderRadius: 12, border: '1.5px solid #E2EAF5',
                                fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55',
                            }}
                        />
                    </div>
                    {err && <div style={{ fontSize: 12, color: '#DC2626' }}>{err}</div>}
                </div>

                <button
                    onClick={submit}
                    disabled={loading}
                    style={{
                        padding: '13px', borderRadius: 12, border: 'none',
                        background: '#0E2A55', color: '#fff',
                        fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                        fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        opacity: loading ? 0.75 : 1,
                    }}
                >
                    {loading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Aguarde…</> : 'Continuar para pagamento'}
                </button>
            </motion.div>
        </motion.div>
    )
}

// ─── Página principal ──────────────────────────────────────────────────────────
export default function Planos() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const [billing, setBilling] = useState<'mensal' | 'anual'>('mensal')
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    // fluxo
    const [pendingPlan, setPendingPlan] = useState<typeof PLANS[number] | null>(null)
    const [showDataModal, setShowDataModal] = useState(false)
    const [savingData, setSavingData] = useState(false)
    const [pixData, setPixData] = useState<{ id: string; pixCode: string | null; pixQrCode: string | null; planName: string; priceLabel: string } | null>(null)

    const switchToAnual = useCallback(() => {
        if (billing === 'mensal') {
            setBilling('anual')
            confetti({ particleCount: 120, spread: 80, origin: { y: 0.55 }, colors: ['#2A60C2', '#4A90E2', '#67e8f9', '#fff'] })
        } else {
            setBilling('mensal')
        }
    }, [billing])

    async function startCheckout(plan: typeof PLANS[number], cpf?: string, phone?: string) {
        setLoadingPlan(plan.name)
        setError(null)
        const priceVal = billing === 'anual' ? plan.priceAnualVal! : plan.priceVal!
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: 'PLANO',
                    destination: plan.name.toUpperCase(),
                    totalBrl: priceVal,
                    outboundCompany: `FlyWise ${plan.name}`,
                    customerEmail: user?.email,
                    customerName: user?.user_metadata?.full_name || user?.email?.split('@')[0],
                    customerTaxId: cpf,
                    customerPhone: phone,
                }),
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao iniciar pagamento')

            const priceLabel = billing === 'anual'
                ? `R$ ${plan.priceAnualVal}`
                : plan.price

            setPixData({ id: data.id, pixCode: data.pixCode, pixQrCode: data.pixQrCode, planName: plan.name, priceLabel })
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoadingPlan(null)
        }
    }

    async function handlePlanClick(plan: typeof PLANS[number]) {
        if (!plan.priceVal) return
        setPendingPlan(plan)

        // Verificar se tem CPF e telefone no perfil
        const { data: profile } = await supabase
            .from('user_profiles')
            .select('phone, cpf')
            .eq('id', user!.id)
            .single()

        const hasCpf = !!(profile as any)?.cpf
        const hasPhone = !!profile?.phone

        if (!hasCpf || !hasPhone) {
            setShowDataModal(true)
        } else {
            await startCheckout(plan, (profile as any).cpf, profile!.phone)
        }
    }

    async function handleDataSubmit(cpf: string, phone: string) {
        setSavingData(true)
        try {
            await supabase.from('user_profiles').upsert({ id: user!.id, cpf, phone })
            setShowDataModal(false)
            if (pendingPlan) await startCheckout(pendingPlan, cpf, phone)
        } finally {
            setSavingData(false)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F7F9FC', fontFamily: 'Inter, system-ui, sans-serif' }}>
            <style>{`
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes pulse-dot { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.5;transform:scale(1.3)} }
            `}</style>

            {/* ── Header ── */}
            <div style={{ background: '#fff', borderBottom: '1px solid #E2EAF5', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: '#64748B', fontSize: 14, fontWeight: 600, fontFamily: 'inherit', padding: '4px 8px 4px 0' }}
                >
                    <ChevronLeft size={18} /> Voltar
                </button>
            </div>

            {/* ── Pricing ── */}
            <section style={{ padding: '80px 60px' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Planos</div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Para Viajantes Estratégicos</h2>
                        <p style={{ color: '#6B7A99', fontSize: '17px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.65 }}>Escolha o plano que melhor se adapta ao seu ritmo de viagem.</p>

                        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#F1F5F9', borderRadius: '999px', padding: '5px', gap: '2px', position: 'relative' }}>
                            {(['mensal', 'anual'] as const).map(freq => (
                                <button
                                    key={freq}
                                    onClick={freq === 'anual' ? switchToAnual : () => setBilling('mensal')}
                                    style={{ position: 'relative', padding: '8px 20px', borderRadius: '999px', border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: '13px', fontWeight: 700, transition: 'color 0.2s', background: 'transparent', color: billing === freq ? '#0E2A55' : '#94A3B8', display: 'flex', alignItems: 'center', gap: '8px', zIndex: 1 }}
                                >
                                    {billing === freq && (
                                        <motion.span layoutId="billing-pill-planos" transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                                            style={{ position: 'absolute', inset: 0, borderRadius: '999px', background: '#fff', boxShadow: '0 1px 6px rgba(14,42,85,0.10)', zIndex: -1 }}
                                        />
                                    )}
                                    <span style={{ position: 'relative', zIndex: 1, textTransform: 'capitalize' }}>{freq}</span>
                                    {freq === 'anual' && (
                                        <span style={{ position: 'relative', zIndex: 1, background: billing === 'anual' ? '#EEF2F8' : '#2A60C2', color: billing === 'anual' ? '#2A60C2' : '#fff', fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '999px', letterSpacing: '0.04em', whiteSpace: 'nowrap', transition: 'background 0.3s, color 0.3s' }}>Economize 35%</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
                        {PLANS.map((plan, i) => (
                            <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                                style={{ background: plan.featured ? '#0E2A55' : '#fff', borderRadius: '20px', padding: '36px 32px', border: plan.featured ? '2px solid #4A90E2' : '1px solid #E2EAF5', boxShadow: plan.featured ? '0 16px 48px rgba(14,42,85,0.25)' : '0 4px 16px rgba(14,42,85,0.06)', position: 'relative' }}
                            >
                                {plan.featured && (
                                    <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: '#2A60C2', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '5px 16px', borderRadius: '999px', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mais Popular</div>
                                )}
                                <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: plan.featured ? 'rgba(255,255,255,0.6)' : '#6B7A99', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{plan.name}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px', minHeight: '52px' }}>
                                    {plan.priceVal !== null ? (
                                        <>
                                            <span style={{ fontSize: '42px', fontWeight: 900, color: plan.featured ? '#4A90E2' : '#0E2A55', letterSpacing: '-0.04em', lineHeight: 1 }}>R$&nbsp;</span>
                                            <NumberFlow
                                                value={billing === 'anual' ? plan.priceAnualVal! : plan.priceVal}
                                                transformTiming={{ duration: 700, easing: 'ease-out' }}
                                                spinTiming={{ duration: 700, easing: 'ease-out' }}
                                                opacityTiming={{ duration: 350, easing: 'ease-out' }}
                                                style={{ fontSize: '42px', fontWeight: 900, color: plan.featured ? '#4A90E2' : '#0E2A55', letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}
                                            />
                                        </>
                                    ) : (
                                        <span style={{ fontSize: '42px', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.04em', lineHeight: 1 }}>Grátis</span>
                                    )}
                                    {plan.period && <span style={{ fontSize: '14px', color: plan.featured ? 'rgba(255,255,255,0.5)' : '#6B7A99' }}>{plan.period}</span>}
                                </div>
                                {billing === 'anual' && plan.price !== 'Grátis' && (
                                    <div style={{ fontSize: '12px', color: plan.featured ? 'rgba(255,255,255,0.45)' : '#A0AECB', marginBottom: '4px', textDecoration: 'line-through' }}>{plan.price}/mês</div>
                                )}
                                <p style={{ fontSize: '14px', color: plan.featured ? 'rgba(255,255,255,0.65)' : '#6B7A99', marginBottom: '28px', lineHeight: 1.6 }}>{plan.desc}</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {plan.features.map(f => (
                                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: plan.featured ? 'rgba(255,255,255,0.85)' : '#2C3E6B', fontWeight: 500 }}>
                                            <CheckCircle2 size={16} color={plan.featured ? '#4A90E2' : '#2A60C2'} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <button
                                    onClick={() => handlePlanClick(plan)}
                                    disabled={!plan.priceVal || loadingPlan === plan.name}
                                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', textAlign: 'center', padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', background: plan.featured ? '#2A60C2' : 'transparent', color: plan.featured ? '#fff' : '#2A60C2', border: plan.featured ? 'none' : '2px solid #2A60C2', boxShadow: plan.featured ? '0 4px 16px rgba(42,96,194,0.40)' : 'none', cursor: (!plan.priceVal || loadingPlan === plan.name) ? 'not-allowed' : 'pointer', opacity: loadingPlan === plan.name ? 0.75 : 1, fontFamily: 'inherit' }}
                                >
                                    {loadingPlan === plan.name
                                        ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Aguarde...</>
                                        : plan.price === 'Grátis' ? 'Plano atual' : 'Assinar agora'
                                    }
                                </button>
                            </motion.div>
                        ))}
                    </div>

                    {error && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                            style={{ marginTop: 24, background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10, padding: '10px 18px', fontSize: 13, color: '#DC2626', maxWidth: 720, margin: '24px auto 0' }}>
                            {error}
                        </motion.div>
                    )}

                    <p style={{ marginTop: 32, textAlign: 'center', fontSize: 13, color: '#94A3B8' }}>
                        Pagamento via PIX · Cancele a qualquer momento · Sem fidelidade
                    </p>
                </div>
            </section>

            {/* ── Modals ── */}
            <AnimatePresence>
                {showDataModal && (
                    <CompleteDataModal
                        loading={savingData}
                        onSubmit={handleDataSubmit}
                        onClose={() => { setShowDataModal(false); setPendingPlan(null) }}
                    />
                )}
                {pixData && (
                    <PixModal
                        billingId={pixData.id}
                        pixCode={pixData.pixCode}
                        pixQrCode={pixData.pixQrCode}
                        planName={pixData.planName}
                        priceLabel={pixData.priceLabel}
                        onClose={() => setPixData(null)}
                        onPaid={() => { setPixData(null); navigate('/configuracoes') }}
                    />
                )}
            </AnimatePresence>
        </div>
    )
}
