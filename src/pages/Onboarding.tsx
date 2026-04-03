import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, ChevronRight, ChevronLeft, Search, Sparkles, Map, Wallet, BarChart3, CheckCircle2, Loader2 } from 'lucide-react'
import confetti from 'canvas-confetti'

interface Step {
    id: number
    icon: React.ReactNode
    tag: string
    title: string
    subtitle: string
    description: string
    videoId: string // YouTube video ID — troque pelo ID real
    videoTitle: string
    tips: string[]
    accentColor: string
    accentBg: string
}

const STEPS: Step[] = [
    {
        id: 1,
        icon: <Search size={22} />,
        tag: 'Passo 1',
        title: 'Buscando seus primeiros voos',
        subtitle: 'Encontre voos em reais e em milhas em um só lugar',
        description: 'Na tela inicial, insira origem, destino e datas. O FlyWise consulta em tempo real a Amadeus (voos comerciais) e o Seats.aero (disponibilidade de milhas), reunindo tudo num único painel comparativo.',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Como realizar sua primeira busca',
        tips: ['Use o ícone ⇄ para inverter origem e destino rapidamente', 'Marque "Flexível" para ver os preços do mês inteiro', 'Filtros de classe e companhia ficam na barra lateral'],
        accentColor: '#4A90E2',
        accentBg: 'rgba(74,144,226,0.12)',
    },
    {
        id: 2,
        icon: <BarChart3 size={22} />,
        tag: 'Passo 2',
        title: 'Comparando estratégias de milhas',
        subtitle: 'IA analisa qual programa de milhas vale mais para você',
        description: 'Ao selecionar um voo, clique em "Ver estratégia". O painel lateral abre e nossa IA compara programas como Smiles, Latam Pass, TudoAzul e outros, calculando custo por milha e recomendando a melhor rota de transferência.',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Usando o painel de estratégias',
        tips: ['Clique em qualquer card de voo para abrir a análise', 'O custo por milha é calculado automaticamente', 'Salve estratégias favoritas para consultar depois'],
        accentColor: '#8B5CF6',
        accentBg: 'rgba(139,92,246,0.12)',
    },
    {
        id: 3,
        icon: <Sparkles size={22} />,
        tag: 'Passo 3',
        title: 'Gerando roteiros com IA',
        subtitle: 'Itinerários completos criados em segundos',
        description: 'Na seção Roteiro, informe destino, duração e estilo de viagem. Nossa IA gera um itinerário dia a dia com pontos turísticos, restaurantes locais, dicas de transporte e estimativas de custo — tudo adaptado ao seu perfil.',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Criando seu roteiro com IA',
        tips: ['Escolha entre estilos: aventura, relaxamento, cultural ou gastronômico', 'O roteiro é exportável em PDF', 'Edite qualquer dia diretamente no painel'],
        accentColor: '#F59E0B',
        accentBg: 'rgba(245,158,11,0.12)',
    },
    {
        id: 4,
        icon: <Wallet size={22} />,
        tag: 'Passo 4',
        title: 'Gerenciando sua carteira de milhas',
        subtitle: 'Veja todos os seus saldos em um só lugar',
        description: 'A Carteira centraliza seus saldos de programas de fidelidade. Adicione seus programas, monitore a validade dos pontos e receba alertas antes que suas milhas expirem. Nunca mais perca pontos por descuido.',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Configurando sua carteira de milhas',
        tips: ['Conecte Smiles, Latam Pass, TudoAzul e mais', 'Alertas de expiração por e-mail e push', 'Histórico completo de acúmulo e resgate'],
        accentColor: '#10B981',
        accentBg: 'rgba(16,185,129,0.12)',
    },
    {
        id: 5,
        icon: <Map size={22} />,
        tag: 'Passo 5',
        title: 'Promoções e alertas de preço',
        subtitle: 'Seja o primeiro a saber das melhores ofertas',
        description: 'Na seção Promoções, configure alertas para rotas específicas. Quando o preço cair abaixo do seu limite ou uma promoção de milhas aparecer, você recebe uma notificação imediata — antes de todo mundo.',
        videoId: 'dQw4w9WgXcQ',
        videoTitle: 'Configurando alertas de promoção',
        tips: ['Defina preço máximo por rota e classe', 'Promoções relâmpago duram poucas horas — ative notificações', 'Filtros por data, companhia e programa de milhas'],
        accentColor: '#EF4444',
        accentBg: 'rgba(239,68,68,0.12)',
    },
]

function VideoCard({ step }: { step: Step }) {
    const [playing, setPlaying] = useState(false)

    return (
        <div style={{ borderRadius: 20, overflow: 'hidden', background: '#0B1628', position: 'relative', aspectRatio: '16/9', width: '100%' }}>
            {playing ? (
                <iframe
                    src={`https://www.youtube.com/embed/${step.videoId}?autoplay=1&rel=0&modestbranding=1`}
                    title={step.videoTitle}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                />
            ) : (
                <>
                    {/* Thumbnail gradient */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: `linear-gradient(135deg, ${step.accentBg.replace('0.12', '0.25')} 0%, #0B1628 60%, #080e1c 100%)`,
                    }} />

                    {/* Grid lines decoration */}
                    <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.06 }} viewBox="0 0 400 225" preserveAspectRatio="none">
                        {[0,50,100,150,200,250,300,350,400].map(x => <line key={x} x1={x} y1="0" x2={x} y2="225" stroke="#fff" strokeWidth="1" />)}
                        {[0,45,90,135,180,225].map(y => <line key={y} x1="0" y1={y} x2="400" y2={y} stroke="#fff" strokeWidth="1" />)}
                    </svg>

                    {/* Floating icon */}
                    <div style={{ position: 'absolute', top: 24, left: 24, width: 44, height: 44, borderRadius: 12, background: step.accentBg, border: `1.5px solid ${step.accentColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: step.accentColor }}>
                        {step.icon}
                    </div>

                    {/* Video title */}
                    <div style={{ position: 'absolute', bottom: 70, left: 24, right: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: step.accentColor, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6, opacity: 0.85 }}>{step.tag}</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', lineHeight: 1.3 }}>{step.videoTitle}</div>
                    </div>

                    {/* Duration badge */}
                    <div style={{ position: 'absolute', bottom: 24, left: 24, background: 'rgba(0,0,0,0.60)', borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        2:30
                    </div>

                    {/* Play button */}
                    <button
                        onClick={() => setPlaying(true)}
                        style={{
                            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                            width: 64, height: 64, borderRadius: '50%',
                            background: 'rgba(255,255,255,0.95)', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: `0 0 0 12px ${step.accentColor}25, 0 8px 32px rgba(0,0,0,0.35)`,
                            transition: 'transform .2s, box-shadow .2s',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translate(-50%,-50%) scale(1.08)'; e.currentTarget.style.boxShadow = `0 0 0 18px ${step.accentColor}30, 0 12px 40px rgba(0,0,0,0.45)` }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translate(-50%,-50%) scale(1)'; e.currentTarget.style.boxShadow = `0 0 0 12px ${step.accentColor}25, 0 8px 32px rgba(0,0,0,0.35)` }}
                    >
                        <Play size={26} color={step.accentColor} style={{ marginLeft: 4 }} fill={step.accentColor} />
                    </button>
                </>
            )}
        </div>
    )
}

export default function Onboarding() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useAuth()
    const planName = (location.state as { planName?: string } | null)?.planName
        ?? sessionStorage.getItem('flywise_pending_plan')
        ?? 'FlyWise'

    const [activating, setActivating] = useState(false)
    const [current, setCurrent] = useState(0)
    const [direction, setDirection] = useState(1)
    const [finished, setFinished] = useState(false)

    // Cartão: ao retornar da AbacatePay, ativa o plano via billingId salvo em sessionStorage
    useEffect(() => {
        const billingId = sessionStorage.getItem('flywise_pending_billing')
        if (!billingId) return

        sessionStorage.removeItem('flywise_pending_billing')
        sessionStorage.removeItem('flywise_pending_plan')

        setActivating(true)
        fetch('/api/checkout/activate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billingId, userId: user?.id ?? null }),
        })
            .catch(() => { /* webhook é a garantia caso activate falhe */ })
            .finally(() => {
                setActivating(false)
                confetti({ particleCount: 200, spread: 120, origin: { y: 0.5 }, colors: ['#16A34A', '#4ADE80', '#2A60C2', '#fff', '#4A90E2'] })
            })
    }, [])

    const step = STEPS[current]
    const isLast = current === STEPS.length - 1

    if (activating) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0B1628 0%, #0E2A55 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
                <Loader2 size={44} color="#4A90E2" style={{ animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 17, fontWeight: 700, color: 'rgba(255,255,255,0.75)' }}>Confirmando seu pagamento…</div>
            </div>
        )
    }

    function go(next: number) {
        setDirection(next > current ? 1 : -1)
        setCurrent(next)
    }

    function finish() {
        setFinished(true)
        confetti({ particleCount: 160, spread: 100, origin: { y: 0.55 }, colors: ['#4A90E2', '#8B5CF6', '#10B981', '#F59E0B', '#fff'] })
        setTimeout(() => navigate('/home'), 2800)
    }

    if (finished) {
        return (
            <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #0B1628 0%, #0E2A55 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, fontFamily: 'Inter, system-ui, sans-serif' }}>
                <style>{`@keyframes pulse-ring { 0%{transform:scale(1);opacity:1} 100%{transform:scale(1.6);opacity:0} }`}</style>
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} style={{ position: 'relative' }}>
                    <div style={{ width: 96, height: 96, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <CheckCircle2 size={52} color="#10B981" />
                    </div>
                    <div style={{ position: 'absolute', inset: -10, borderRadius: '50%', border: '2px solid #10B981', animation: 'pulse-ring 1s ease-out forwards' }} />
                </motion.div>
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', marginBottom: 8 }}>Pronto para decolar! ✈️</div>
                    <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)' }}>Redirecionando para o painel…</div>
                </motion.div>
            </div>
        )
    }

    return (
        <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #07101f 0%, #0B1628 50%, #0d2040 100%)', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column' }}>
            <style>{`
                @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
                @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
                @media(max-width:900px){
                    .ob-grid { flex-direction: column !important; }
                    .ob-left { width: 100% !important; padding: 32px 24px 20px !important; }
                    .ob-right { padding: 20px 24px 36px !important; }
                }
            `}</style>

            {/* ── Top progress bar ── */}
            <div style={{ padding: '22px 32px 0', display: 'flex', alignItems: 'center', gap: 16, position: 'relative', zIndex: 10 }}>
                <img src="/logoLP.png" alt="FlyWise" style={{ height: 36, objectFit: 'contain', flexShrink: 0 }} />
                <div style={{ flex: 1, display: 'flex', gap: 6 }}>
                    {STEPS.map((s, i) => (
                        <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 99, background: 'rgba(255,255,255,0.10)', overflow: 'hidden', cursor: i <= current ? 'pointer' : 'default' }} onClick={() => i < current && go(i)}>
                            <motion.div
                                animate={{ width: i < current ? '100%' : i === current ? '100%' : '0%' }}
                                initial={{ width: '0%' }}
                                transition={{ duration: 0.5, ease: 'easeOut' }}
                                style={{ height: '100%', background: i <= current ? step.accentColor : 'transparent', borderRadius: 99 }}
                            />
                        </div>
                    ))}
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                    {current + 1} / {STEPS.length}
                </div>
                <button
                    onClick={() => navigate('/home')}
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8, padding: '5px 12px', color: 'rgba(255,255,255,0.40)', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', transition: 'all .2s' }}
                    onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)' }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.40)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)' }}
                >
                    Pular tutorial
                </button>
            </div>

            {/* ── Main content ── */}
            <div className="ob-grid" style={{ flex: 1, display: 'flex', padding: '28px 32px 32px', gap: 40, alignItems: 'flex-start' }}>

                {/* LEFT — step info */}
                <div className="ob-left" style={{ width: '42%', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: direction * 32 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: direction * -32 }}
                            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                            style={{ display: 'flex', flexDirection: 'column', gap: 0 }}
                        >
                            {/* Tag */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: step.accentBg, border: `1px solid ${step.accentColor}35`, borderRadius: 999, padding: '5px 14px 5px 10px', marginBottom: 24, width: 'fit-content' }}>
                                <div style={{ color: step.accentColor }}>{step.icon}</div>
                                <span style={{ fontSize: 12, fontWeight: 700, color: step.accentColor, letterSpacing: '0.05em' }}>{step.tag}</span>
                            </div>

                            {/* Title */}
                            <h1 style={{ fontSize: 32, fontWeight: 900, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.15, margin: '0 0 12px' }}>
                                {step.title}
                            </h1>
                            <div style={{ fontSize: 15, fontWeight: 600, color: step.accentColor, marginBottom: 20, lineHeight: 1.4 }}>
                                {step.subtitle}
                            </div>
                            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.58)', lineHeight: 1.75, margin: '0 0 32px' }}>
                                {step.description}
                            </p>

                            {/* Tips */}
                            <div style={{ marginBottom: 40 }}>
                                <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                                    Dicas rápidas
                                </div>
                                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                    {step.tips.map(tip => (
                                        <li key={tip} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: step.accentColor, marginTop: 6, flexShrink: 0 }} />
                                            <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.55 }}>{tip}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 'auto' }}>
                        {current > 0 && (
                            <button
                                onClick={() => go(current - 1)}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '12px 20px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, color: 'rgba(255,255,255,0.65)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s' }}
                                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
                            >
                                <ChevronLeft size={16} /> Anterior
                            </button>
                        )}
                        <button
                            onClick={isLast ? finish : () => go(current + 1)}
                            style={{
                                flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                padding: '14px 28px',
                                background: isLast ? 'linear-gradient(135deg, #10B981 0%, #059669 100%)' : `linear-gradient(135deg, ${step.accentColor} 0%, ${step.accentColor}cc 100%)`,
                                border: 'none', borderRadius: 12,
                                color: '#fff', fontSize: 15, fontWeight: 800,
                                cursor: 'pointer', fontFamily: 'inherit',
                                boxShadow: `0 6px 28px ${step.accentColor}40`,
                                transition: 'transform .2s, box-shadow .2s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 10px 36px ${step.accentColor}55` }}
                            onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = `0 6px 28px ${step.accentColor}40` }}
                        >
                            {isLast ? '🚀 Começar a usar o FlyWise' : <>Próximo <ChevronRight size={16} /></>}
                        </button>
                    </div>

                    {/* Welcome message on step 1 */}
                    {current === 0 && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                            style={{ marginTop: 20, padding: '14px 18px', background: 'rgba(74,144,226,0.08)', border: '1px solid rgba(74,144,226,0.18)', borderRadius: 14 }}>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.70)', lineHeight: 1.6 }}>
                                ✈️ &nbsp;Bem-vindo ao <b style={{ color: '#4A90E2' }}>FlyWise {planName}</b>! Este tutorial vai te mostrar tudo que você precisa para começar a economizar nas suas viagens.
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* RIGHT — video + step dots */}
                <div className="ob-right" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 24 }}>
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
                        >
                            <VideoCard step={step} />
                        </motion.div>
                    </AnimatePresence>

                    {/* Step dots / quick nav */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
                        {STEPS.map((s, i) => (
                            <button
                                key={s.id}
                                onClick={() => go(i)}
                                title={s.title}
                                style={{
                                    width: i === current ? 28 : 8, height: 8, borderRadius: 99,
                                    background: i === current ? step.accentColor : i < current ? `${step.accentColor}55` : 'rgba(255,255,255,0.15)',
                                    border: 'none', cursor: 'pointer', padding: 0,
                                    transition: 'all .3s ease',
                                }}
                            />
                        ))}
                    </div>

                    {/* All steps overview cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                        {STEPS.map((s, i) => (
                            <button
                                key={s.id}
                                onClick={() => go(i)}
                                style={{
                                    background: i === current ? `${s.accentColor}18` : i < current ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.03)',
                                    border: `1.5px solid ${i === current ? `${s.accentColor}50` : 'rgba(255,255,255,0.07)'}`,
                                    borderRadius: 12, padding: '12px 8px',
                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all .2s',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = `${s.accentColor}15`; e.currentTarget.style.borderColor = `${s.accentColor}40` }}
                                onMouseLeave={e => { e.currentTarget.style.background = i === current ? `${s.accentColor}18` : 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = i === current ? `${s.accentColor}50` : 'rgba(255,255,255,0.07)' }}
                            >
                                <div style={{ color: i <= current ? s.accentColor : 'rgba(255,255,255,0.25)', transition: 'color .2s' }}>
                                    {i < current ? <CheckCircle2 size={18} color={s.accentColor} /> : s.icon}
                                </div>
                                <div style={{ fontSize: 10, fontWeight: 700, color: i === current ? '#fff' : 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.3, letterSpacing: '0.02em' }}>
                                    {s.tag.replace('Passo ', '')}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
