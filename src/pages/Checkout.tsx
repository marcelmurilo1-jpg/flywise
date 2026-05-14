import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { CheckCircle2, ArrowLeft, Loader2, Wrench } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'

// ─── Checkout — aguardando integração de novo gateway ────────────────────────
//
// Stripe + AbacatePay foram removidos. Esta tela mantém o resumo do plano
// (painel esquerdo) e exibe um placeholder no lugar do formulário de pagamento.
//
// Quando integrar a nova gateway:
//   1. Importe createCheckout / getCheckoutStatus / activatePlan de '@/lib/payments'.
//   2. Substitua o bloco <PaymentPlaceholder /> pelo formulário (PIX / cartão / etc).
//   3. Use `state.priceVal` (em reais) e `state.billing` para montar o payload.
//
// ─────────────────────────────────────────────────────────────────────────────

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
    const locationState = location.state as CheckoutState | undefined

    const [state, setState] = useState<CheckoutState | null>(locationState ?? null)
    const [reconstructing, setReconstructing] = useState(!locationState)

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

            setState({
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
            })
            setReconstructing(false)
            sessionStorage.removeItem('flywise_pending_plan')
            sessionStorage.removeItem('flywise_pending_billing_period')
        })()
    }, [state, user, navigate])

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
                padding: '48px 48px', display: 'flex', flexDirection: 'column',
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
            </div>

            {/* ── RIGHT: payment placeholder ── */}
            <div className="co-right" style={{ flex: 1, background: '#F0F4FA', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 32px' }}>
                <PaymentPlaceholder planName={state.planName} priceVal={state.priceVal} billing={state.billing} onBack={() => navigate('/planos')} />
            </div>
        </div>
    )
}

// ─── Placeholder enquanto nenhum gateway está integrado ──────────────────────
function PaymentPlaceholder({ planName, priceVal, billing, onBack }: {
    planName: string
    priceVal: number
    billing: 'mensal' | 'anual'
    onBack: () => void
}) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 22, textAlign: 'center' }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 76, height: 76, borderRadius: '50%', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Wrench size={32} color="#D97706" />
                </div>
                <div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: 6 }}>
                        Pagamento em manutenção
                    </div>
                    <div style={{ fontSize: 14, color: '#64748B', lineHeight: 1.55, maxWidth: 380 }}>
                        Estamos migrando para uma nova plataforma de pagamento mais estável. Em breve você poderá ativar o plano <b>{planName}</b> novamente.
                    </div>
                </div>
            </div>

            <div style={{ background: '#fff', borderRadius: 16, padding: '18px 22px', boxShadow: '0 4px 24px rgba(14,42,85,0.06)', border: '1px solid #E2EAF5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748B', letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 4 }}>Plano selecionado</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#0E2A55' }}>FlyWise {planName} · {billing === 'anual' ? 'Anual' : 'Mensal'}</div>
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#0E2A55' }}>R$ {priceVal}</div>
            </div>

            <button
                onClick={onBack}
                style={{ padding: '13px 20px', background: '#0E2A55', color: '#fff', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
            >
                Voltar aos planos
            </button>

            <div style={{ fontSize: 12, color: '#94A3B8', lineHeight: 1.6 }}>
                Quer ser avisado quando voltar? Fale com a gente em <a href="mailto:suporte@flywise.app" style={{ color: '#2A60C2', fontWeight: 700, textDecoration: 'none' }}>suporte@flywise.app</a>
            </div>
        </motion.div>
    )
}
