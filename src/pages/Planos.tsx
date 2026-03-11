import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Crown, Zap, Star, Check, ChevronLeft, Loader2 } from 'lucide-react'

const PLANS = [
    {
        id: 'pro',
        name: 'Pro',
        price: 2990,
        priceFmt: 'R$ 29,90',
        period: '/mês',
        Icon: Zap,
        color: '#2A60C2',
        highlight: false,
        description: 'Para quem viaja com frequência e quer economizar mais.',
        features: [
            '50 buscas por mês',
            'Alertas de promoções',
            'Análise de milhas por IA',
            'Acesso a estratégias salvas',
        ],
    },
    {
        id: 'premium',
        name: 'Premium',
        price: 4990,
        priceFmt: 'R$ 49,90',
        period: '/mês',
        Icon: Star,
        color: '#7C3AED',
        highlight: true,
        description: 'O máximo em economia de passagens e milhas.',
        features: [
            'Buscas ilimitadas',
            'Todos os alertas em tempo real',
            'Roteiros gerados por IA',
            'Award space monitoring',
            'Suporte prioritário',
        ],
    },
]

export default function Planos() {
    const navigate = useNavigate()
    const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
    const [error, setError] = useState<string | null>(null)

    async function handleCheckout(plan: typeof PLANS[number]) {
        setLoadingPlan(plan.id)
        setError(null)
        try {
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: 'PLANO',
                    destination: plan.name.toUpperCase(),
                    totalBrl: plan.price / 100,
                    outboundCompany: `FlyWise ${plan.name}`,
                }),
            })
            const data = await res.json()
            if (!res.ok || !data.url) throw new Error(data.error || 'Erro ao iniciar pagamento')
            window.open(data.url, '_blank')
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoadingPlan(null)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                @keyframes shimmer { 0%,100%{opacity:1} 50%{opacity:0.6} }
                @media(max-width:680px){
                    .plans-grid { flex-direction: column !important; }
                    .plan-card { max-width: 100% !important; }
                }
            `}</style>

            {/* ── Header ── */}
            <div style={{
                background: '#fff',
                borderBottom: '1px solid #E2EAF5',
                padding: '16px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 12,
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 6,
                        color: '#64748B', fontSize: 14, fontWeight: 600, fontFamily: 'inherit',
                        padding: '4px 8px 4px 0',
                    }}
                >
                    <ChevronLeft size={18} /> Voltar
                </button>
            </div>

            {/* ── Content ── */}
            <div style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '48px 24px',
                gap: 32,
            }}>
                {/* Title */}
                <motion.div
                    initial={{ opacity: 0, y: -12 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}
                >
                    <div style={{
                        width: 52, height: 52, borderRadius: 16,
                        background: 'linear-gradient(135deg, #0E2A55 0%, #2A60C2 100%)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Crown size={26} color="#fff" />
                    </div>
                    <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em' }}>
                        Escolha seu plano
                    </h1>
                    <p style={{ margin: 0, fontSize: 15, color: '#64748B', maxWidth: 400 }}>
                        Desbloqueie buscas ilimitadas, alertas de milhas e roteiros personalizados por IA.
                    </p>
                </motion.div>

                {/* Cards */}
                <motion.div
                    className="plans-grid"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{ display: 'flex', gap: 20, width: '100%', maxWidth: 720, alignItems: 'stretch' }}
                >
                    {PLANS.map((plan, i) => (
                        <motion.div
                            key={plan.id}
                            className="plan-card"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.15 + i * 0.08 }}
                            style={{
                                flex: 1,
                                background: '#fff',
                                borderRadius: 20,
                                border: plan.highlight ? `2px solid ${plan.color}` : '1.5px solid #E2EAF5',
                                boxShadow: plan.highlight
                                    ? `0 8px 32px ${plan.color}22`
                                    : '0 2px 12px rgba(14,42,85,0.06)',
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                position: 'relative' as const,
                            }}
                        >
                            {plan.highlight && (
                                <div style={{
                                    position: 'absolute' as const, top: 16, right: 16,
                                    background: plan.color, color: '#fff',
                                    fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
                                    padding: '3px 10px', borderRadius: 999,
                                }}>
                                    MAIS POPULAR
                                </div>
                            )}

                            {/* Card header */}
                            <div style={{
                                padding: '28px 28px 20px',
                                background: `linear-gradient(135deg, ${plan.color}12 0%, ${plan.color}06 100%)`,
                                borderBottom: `1px solid ${plan.color}20`,
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                                    <div style={{
                                        width: 42, height: 42, borderRadius: 12,
                                        background: plan.color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        <plan.Icon size={20} color="#fff" />
                                    </div>
                                    <span style={{ fontSize: 18, fontWeight: 800, color: plan.color }}>
                                        FlyWise {plan.name}
                                    </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 6 }}>
                                    <span style={{ fontSize: 32, fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em' }}>
                                        {plan.priceFmt}
                                    </span>
                                    <span style={{ fontSize: 14, color: '#94A3B8', fontWeight: 500 }}>{plan.period}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: 13, color: '#64748B' }}>{plan.description}</p>
                            </div>

                            {/* Features */}
                            <div style={{ padding: '20px 28px', flex: 1 }}>
                                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {plan.features.map(f => (
                                        <li key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <div style={{
                                                width: 20, height: 20, borderRadius: 6,
                                                background: `${plan.color}18`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                flexShrink: 0, marginTop: 1,
                                            }}>
                                                <Check size={12} color={plan.color} strokeWidth={3} />
                                            </div>
                                            <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            {/* CTA */}
                            <div style={{ padding: '0 28px 28px' }}>
                                <button
                                    onClick={() => handleCheckout(plan)}
                                    disabled={loadingPlan === plan.id}
                                    style={{
                                        width: '100%',
                                        padding: '14px 0',
                                        borderRadius: 12,
                                        border: 'none',
                                        background: plan.color,
                                        color: '#fff',
                                        fontSize: 15,
                                        fontWeight: 800,
                                        cursor: loadingPlan === plan.id ? 'not-allowed' : 'pointer',
                                        fontFamily: 'inherit',
                                        opacity: loadingPlan === plan.id ? 0.75 : 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: 8,
                                        transition: 'opacity 0.15s, transform 0.1s',
                                    }}
                                    onMouseEnter={e => { if (loadingPlan !== plan.id) (e.currentTarget as HTMLButtonElement).style.opacity = '0.9' }}
                                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = loadingPlan === plan.id ? '0.75' : '1' }}
                                >
                                    {loadingPlan === plan.id
                                        ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Aguarde...</>
                                        : <>Assinar {plan.name} com PIX ✦</>
                                    }
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </motion.div>

                {/* Error */}
                {error && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{
                            background: '#FEF2F2', border: '1px solid #FECACA',
                            borderRadius: 10, padding: '10px 18px',
                            fontSize: 13, color: '#DC2626', maxWidth: 720, width: '100%',
                        }}
                    >
                        {error}
                    </motion.div>
                )}

                {/* Footer note */}
                <p style={{ margin: 0, fontSize: 12, color: '#94A3B8', textAlign: 'center' }}>
                    Pagamento via PIX · Cancele a qualquer momento · Sem fidelidade
                </p>
            </div>
        </div>
    )
}
