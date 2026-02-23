import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, ChevronDown, ChevronUp, Check, Minus, Plane, ArrowLeftRight } from 'lucide-react'

/* ─────────────────────────────────────────
   STRATEGY FORM CARD (right side — à la Quasar)
───────────────────────────────────────── */
const PROGRAMS = ['Smiles (GOL)', 'LATAM Pass', 'TudoAzul', 'Livelo']

function StrategyCard() {
    const [tripType, setTripType] = useState<'ida' | 'volta' | 'multiplos'>('ida')
    const [from, setFrom] = useState('')
    const [to, setTo] = useState('')
    const [program, setProgram] = useState(PROGRAMS[0])
    const [miles, setMiles] = useState('')

    const swap = () => { setFrom(to); setTo(from) }

    return (
        <div style={{
            background: 'rgba(255,255,255,0.12)',
            backdropFilter: 'blur(28px)',
            WebkitBackdropFilter: 'blur(28px)',
            border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: '20px',
            padding: '28px',
            width: '360px',
            flexShrink: 0,
            boxShadow: '0 24px 80px rgba(0,0,0,0.3)',
        }}>
            <h2 style={{ fontSize: '22px', fontWeight: 700, color: '#fff', marginBottom: '6px', letterSpacing: '-0.03em' }}>
                Qual é a sua estratégia?
            </h2>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.55)', marginBottom: '20px', lineHeight: 1.6 }}>
                Analise cenários, compare milhas vs dinheiro e encontre o melhor caminho.
            </p>

            {/* Trip type pills */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '18px' }}>
                {([['ida', 'Só Ida'], ['volta', 'Ida e Volta'], ['multiplos', 'Multi-destino']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setTripType(val)} style={{
                        padding: '6px 12px', borderRadius: '999px', border: 'none',
                        fontFamily: 'inherit', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        transition: 'all 0.18s',
                        background: tripType === val ? '#fff' : 'rgba(255,255,255,0.1)',
                        color: tripType === val ? 'var(--petrol-deep)' : 'rgba(255,255,255,0.65)',
                    }}>{label}</button>
                ))}
            </div>

            {/* Origem / Destino */}
            <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '2px', marginBottom: '10px' }}>
                {/* From */}
                <div style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '12px 12px 0 0', padding: '12px 16px',
                }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>De</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(14,107,87,0.35)', borderRadius: '6px', padding: '4px 8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--green-soft)', letterSpacing: '0.05em' }}>
                                {from.toUpperCase() || 'GRU'}
                            </span>
                        </div>
                        <input
                            type="text" maxLength={3} placeholder="São Paulo, Brasil"
                            value={from} onChange={e => setFrom(e.target.value.toUpperCase())}
                            style={{ border: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: '13px', fontWeight: 500, flex: 1, outline: 'none' }}
                        />
                    </div>
                </div>

                {/* Swap button */}
                <button onClick={swap} style={{
                    position: 'absolute', top: '50%', right: '16px', transform: 'translateY(-50%)',
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: 'var(--green-strat)', border: '2px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', zIndex: 2, transition: 'all 0.2s',
                }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--green-soft)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--green-strat)'}
                >
                    <ArrowLeftRight size={13} color="#fff" />
                </button>

                {/* To */}
                <div style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '0 0 12px 12px', padding: '12px 16px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>Para</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(14,107,87,0.35)', borderRadius: '6px', padding: '4px 8px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--green-soft)', letterSpacing: '0.05em' }}>
                                {to.toUpperCase() || 'JFK'}
                            </span>
                        </div>
                        <input
                            type="text" maxLength={3} placeholder="Nova York, EUA"
                            value={to} onChange={e => setTo(e.target.value.toUpperCase())}
                            style={{ border: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: '13px', fontWeight: 500, flex: 1, outline: 'none' }}
                        />
                    </div>
                </div>
            </div>

            {/* Programa + Saldo */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Programa</p>
                    <select value={program} onChange={e => setProgram(e.target.value)} style={{
                        border: 'none', background: 'transparent', color: '#fff',
                        fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                        width: '100%', outline: 'none', cursor: 'pointer',
                    }}>
                        {PROGRAMS.map(p => <option key={p} value={p} style={{ background: '#0F2F3A' }}>{p}</option>)}
                    </select>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '12px 14px' }}>
                    <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>Saldo (mil)</p>
                    <input type="number" placeholder="40.000" value={miles} onChange={e => setMiles(e.target.value)}
                        style={{ border: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, width: '100%', outline: 'none' }} />
                </div>
            </div>

            {/* CTA */}
            <Link to="/auth?tab=signup" className="btn btn-green" style={{ width: '100%', justifyContent: 'center', padding: '14px', fontSize: '15px' }}>
                Analisar Estratégia <ArrowRight size={16} />
            </Link>

            <p style={{ textAlign: 'center', fontSize: '12px', color: 'rgba(255,255,255,0.35)', marginTop: '12px' }}>
                Análise gratuita · Sem cartão de crédito
            </p>
        </div>
    )
}

/* ─────────────────────────────────────────
   DESTINATION CARDS (bottom-left à la Quasar)
───────────────────────────────────────── */
const DEST_CARDS = [
    { city: 'Nova York', country: 'EUA', code: 'JFK', economy: 'R$ 1.680', miles: '40k pts', emoji: '🗽' },
    { city: 'Lisboa', country: 'Portugal', code: 'LIS', economy: 'R$ 980', miles: '28k pts', emoji: '🏛️' },
    { city: 'Miami', country: 'EUA', code: 'MIA', economy: 'R$ 820', miles: '22k pts', emoji: '🌴' },
]

function DestinationCards() {
    return (
        <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Destinos Estratégicos
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
                {DEST_CARDS.map((d) => (
                    <motion.div key={d.code}
                        whileHover={{ y: -4, scale: 1.02 }}
                        style={{
                            background: 'rgba(255,255,255,0.10)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.14)',
                            borderRadius: '14px',
                            padding: '14px 16px',
                            cursor: 'pointer',
                            minWidth: '130px',
                            transition: 'box-shadow 0.2s',
                        }}
                    >
                        <div style={{ fontSize: '22px', marginBottom: '6px' }}>{d.emoji}</div>
                        <p style={{ fontSize: '13px', fontWeight: 700, color: '#fff', marginBottom: '2px' }}>{d.city}</p>
                        <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginBottom: '8px' }}>{d.country}</p>
                        <div style={{ background: 'rgba(14,107,87,0.3)', border: '1px solid rgba(31,138,112,0.4)', borderRadius: '6px', padding: '4px 8px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--green-soft)' }}>✦ {d.economy}</span>
                        </div>
                        <p style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '4px' }}>{d.miles}</p>
                    </motion.div>
                ))}
            </div>
        </div>
    )
}

/* ─────────────────────────────────────────
   FAQ
───────────────────────────────────────── */
const FAQ_ITEMS = [
    { q: 'O FlyWise mostra passagens em tempo real?', a: 'Não somos um buscador de passagens. Somos uma plataforma de inteligência estratégica que analisa cenários, compara opções de milhas e dinheiro, e gera o melhor plano de ação para você.' },
    { q: 'Quais programas de milhas são suportados?', a: 'Atualmente suportamos Smiles (GOL), LATAM Pass, TudoAzul e Livelo. Novos programas são adicionados continuamente.' },
    { q: 'Preciso ter milhas para usar o FlyWise?', a: 'Não. Mesmo sem milhas, a plataforma analisa quando vale a pena acumular, transferir e emitir com base no seu perfil de viagem.' },
    { q: 'O plano Básico tem limite de buscas?', a: 'Sim. O plano Básico permite até 10 análises estratégicas por mês. Os planos Pro e Expert não têm limite.' },
    { q: 'Posso cancelar a assinatura a qualquer momento?', a: 'Sim, sem fidelidade e sem multa. Você pode cancelar quando quiser diretamente pelo painel.' },
]

function FAQ() {
    const [open, setOpen] = useState<number | null>(null)
    return (
        <section id="faq" style={{ padding: '96px 24px', background: '#fff', maxWidth: '720px', margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                <span className="pill pill-light" style={{ marginBottom: '16px' }}>Dúvidas Frequentes</span>
                <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: 'var(--graphite)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>
                    Tudo que você precisa saber
                </h2>
            </div>
            {FAQ_ITEMS.map((item, i) => (
                <div key={i} className="faq-item">
                    <button className="faq-question" onClick={() => setOpen(open === i ? null : i)}>
                        {item.q}
                        {open === i ? <ChevronUp size={18} style={{ color: 'var(--green-strat)', flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />}
                    </button>
                    <AnimatePresence>
                        {open === i && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: 'easeOut' }} style={{ overflow: 'hidden' }}>
                                <p className="faq-answer">{item.a}</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            ))}
        </section>
    )
}

/* ─────────────────────────────────────────
   PLANS
───────────────────────────────────────── */
const PLANS = [
    { name: 'Básico', price: 'R$ 49', period: '/mês', desc: 'Para começar a usar milhas com inteligência.', features: ['10 análises estratégicas/mês', 'Comparação milhas vs dinheiro', 'Suporte por email', null, null], featured: false, cta: 'Assinar Plano' },
    { name: 'Pro', price: 'R$ 119', period: '/mês', desc: 'Para viajantes frequentes que querem maximizar cada milha.', features: ['Análises ilimitadas', 'Comparação milhas vs dinheiro', 'Alertas de promoções de transferência', 'Rotas alternativas inteligentes', 'Suporte prioritário'], featured: true, cta: 'Assinar Pro' },
    { name: 'Expert', price: 'R$ 249', period: '/mês', desc: 'Para consultores e agências que trabalham com milhas.', features: ['Tudo do Pro', 'Multi-perfis de cliente', 'API de integração', 'Relatórios exportáveis', 'Gerente de conta dedicado'], featured: false, cta: 'Assinar Plano' },
]

function Plans() {
    return (
        <section id="planos" style={{ padding: '96px 24px', background: 'var(--snow)' }}>
            <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    <span className="pill pill-light" style={{ marginBottom: '16px' }}>Planos</span>
                    <h2 style={{ fontSize: 'clamp(28px,4vw,40px)', fontWeight: 700, color: 'var(--graphite)', letterSpacing: '-0.03em', lineHeight: 1.2 }}>Para Viajantes Estratégicos</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '16px', marginTop: '12px', maxWidth: '420px', margin: '12px auto 0' }}>Escolha o plano que melhor se adapta ao seu ritmo de viagem.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px', alignItems: 'start' }}>
                    {PLANS.map((plan, i) => (
                        <motion.div key={plan.name} className={`card-plan${plan.featured ? ' card-plan-featured' : ''}`} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }} style={{ position: 'relative' }}>
                            {plan.featured && (
                                <div style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', background: 'var(--green-strat)', color: '#fff', fontSize: '11px', fontWeight: 700, padding: '4px 14px', borderRadius: '999px', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>Mais Popular</div>
                            )}
                            <div style={{ marginBottom: '24px' }}>
                                <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{plan.name}</p>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '36px', fontWeight: 800, color: 'var(--graphite)', letterSpacing: '-0.04em' }}>{plan.price}</span>
                                    <span style={{ fontSize: '14px', color: 'var(--text-muted)', fontWeight: 500 }}>{plan.period}</span>
                                </div>
                                <p style={{ fontSize: '13.5px', color: 'var(--text-body)', lineHeight: 1.6 }}>{plan.desc}</p>
                            </div>
                            <div style={{ marginBottom: '28px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {plan.features.map((feat, fi) => (
                                    <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {feat ? <Check size={14} style={{ color: 'var(--green-strat)', flexShrink: 0 }} /> : <Minus size={14} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />}
                                        <span style={{ fontSize: '13.5px', color: feat ? 'var(--text-dark)' : 'var(--text-faint)' }}>{feat ?? '—'}</span>
                                    </div>
                                ))}
                            </div>
                            <Link to="/auth?tab=signup" className={`btn ${plan.featured ? 'btn-green' : 'btn-outline-dark'}`} style={{ width: '100%', justifyContent: 'center' }}>{plan.cta}</Link>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}

/* ─────────────────────────────────────────
   MAIN LANDING
───────────────────────────────────────── */
export default function Landing() {
    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif' }}>

            {/* ════════════════════════════
                HERO SECTION — QUASAR STYLE
            ════════════════════════════ */}
            <section style={{
                minHeight: '100vh',
                position: 'relative',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
            }}>
                {/* Background photo */}
                <div style={{
                    position: 'absolute', inset: 0,
                    backgroundImage: 'url(/hero-aerial.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center 40%',
                    filter: 'brightness(0.75)',
                }} />
                {/* Gradient overlay — petróleo à esquerda, mais transparente à direita */}
                <div style={{
                    position: 'absolute', inset: 0,
                    background: 'linear-gradient(105deg, rgba(15,47,58,0.88) 0%, rgba(15,47,58,0.60) 50%, rgba(15,47,58,0.30) 100%)',
                }} />

                {/* HEADER sobre a foto */}
                <header style={{
                    position: 'relative', zIndex: 10,
                    display: 'flex', alignItems: 'center',
                    padding: '22px 48px',
                    justifyContent: 'space-between',
                }}>
                    {/* Logo */}
                    <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '9px' }}>
                        <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'var(--green-strat)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 12px rgba(14,107,87,0.4)' }}>
                            <Plane size={14} color="#fff" strokeWidth={2.5} />
                        </div>
                        <span style={{ fontWeight: 700, fontSize: '17px', color: '#fff', letterSpacing: '-0.03em' }}>FlyWise</span>
                    </Link>

                    {/* Nav links */}
                    <nav style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {[['Como Funciona', '#como-funciona'], ['Planos', '#planos'], ['Sobre', '#faq']].map(([label, href]) => (
                            <a key={label} href={href} style={{
                                color: 'rgba(255,255,255,0.70)', textDecoration: 'none', fontSize: '13.5px',
                                fontWeight: 500, padding: '7px 14px', borderRadius: '10px', transition: 'all 0.2s',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.1)' }}
                                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.70)'; e.currentTarget.style.background = 'transparent' }}
                            >{label}</a>
                        ))}
                    </nav>

                    {/* CTAs */}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <Link to="/auth" style={{ color: 'rgba(255,255,255,0.75)', textDecoration: 'none', fontSize: '13.5px', fontWeight: 500, padding: '8px 16px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.25)', transition: 'all 0.2s' }}
                            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#fff' }}
                            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
                        >Entrar</Link>
                        <Link to="/auth?tab=signup" className="btn btn-green btn-sm">Começar grátis</Link>
                    </div>
                </header>

                {/* HERO CONTENT */}
                <div style={{
                    position: 'relative', zIndex: 5,
                    flex: 1,
                    maxWidth: '1280px', width: '100%', margin: '0 auto',
                    padding: '0 48px 60px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'space-between',
                    gap: '48px',
                    paddingTop: '40px',
                }}>
                    {/* Left: text + destination cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.65, ease: 'easeOut' }}
                        style={{ maxWidth: '520px' }}
                    >
                        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                            <span className="pill pill-dark" style={{ marginBottom: '24px' }}>✦ Inteligência Estratégica para Milhas</span>
                        </motion.div>

                        <h1 style={{
                            fontSize: 'clamp(40px, 5.5vw, 68px)',
                            fontWeight: 700,
                            lineHeight: 1.0,
                            letterSpacing: '-0.045em',
                            color: '#fff',
                            marginBottom: '20px',
                        }}>
                            Viaje com<br />
                            <span style={{ color: 'var(--green-soft)' }}>Estratégia.</span>
                            <br />
                            <span style={{ fontSize: '0.6em', color: 'rgba(255,255,255,0.75)', fontWeight: 500, letterSpacing: '-0.02em', lineHeight: 1.4, display: 'block', marginTop: '8px' }}>
                                Não com tentativa e erro.
                            </span>
                        </h1>

                        <p style={{ fontSize: '16px', color: 'rgba(255,255,255,0.60)', lineHeight: 1.75, marginBottom: '48px', maxWidth: '400px' }}>
                            O FlyWise transforma milhas em decisões inteligentes — analisando cenários, calculando o valor real das suas milhas e gerando o melhor plano de viagem.
                        </p>

                        {/* Popular destinations */}
                        <DestinationCards />
                    </motion.div>

                    {/* Right: Strategy form card */}
                    <motion.div
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.65, delay: 0.15 }}
                    >
                        <StrategyCard />
                    </motion.div>
                </div>
            </section>

            {/* ════════════════════
                COMO FUNCIONA
            ════════════════════ */}
            <section id="como-funciona" style={{ padding: '96px 24px', background: 'var(--snow)' }}>
                <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '60px' }}>
                        <span className="pill pill-light" style={{ marginBottom: '16px' }}>Como Funciona</span>
                        <h2 style={{ fontSize: 'clamp(28px,4vw,42px)', fontWeight: 700, color: 'var(--graphite)', letterSpacing: '-0.03em', lineHeight: 1.2, marginBottom: '14px' }}>Como o FlyWise Funciona</h2>
                        <p style={{ color: 'var(--text-muted)', fontSize: '16px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.7 }}>Três etapas para transformar suas milhas em estratégia real.</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                        {[
                            { step: '01', title: 'Analisa Cenários', desc: 'Informe origem, destino, datas e saldo de milhas. O FlyWise cruza todas as variáveis automaticamente.', color: 'var(--petrol-deep)', bg: 'rgba(15,47,58,0.06)', icon: '🔍' },
                            { step: '02', title: 'Compara Milhas vs Dinheiro', desc: 'Calculamos o CPM real, identificamos promoções de transferência ativas e mapeamos rotas alternativas.', color: 'var(--green-strat)', bg: 'rgba(14,107,87,0.07)', icon: '⚖️' },
                            { step: '03', title: 'Gera Estratégia', desc: 'Um plano em português claro: qual programa usar, quando transferir, como emitir. Passo a passo.', color: 'var(--petrol-mid)', bg: 'rgba(18,60,74,0.07)', icon: '💡' },
                        ].map((s, i) => (
                            <motion.div key={s.step} className="card" initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.12 }} style={{ padding: '32px', position: 'relative', overflow: 'hidden', cursor: 'default' }}>
                                <div style={{ position: 'absolute', top: '20px', right: '22px', fontSize: '52px', fontWeight: 800, color: 'rgba(0,0,0,0.04)', lineHeight: 1 }}>{s.step}</div>
                                <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', marginBottom: '20px' }}>{s.icon}</div>
                                <h3 style={{ fontSize: '17px', fontWeight: 700, color: 'var(--graphite)', marginBottom: '10px', letterSpacing: '-0.02em' }}>{s.title}</h3>
                                <p style={{ fontSize: '14px', color: 'var(--text-body)', lineHeight: 1.7 }}>{s.desc}</p>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* PLANS → FAQ → FOOTER */}
            <Plans />
            <FAQ />

            {/* FOOTER */}
            <footer style={{ background: 'var(--petrol-deep)', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '48px 24px 32px' }}>
                <div style={{ maxWidth: '1080px', margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '40px', marginBottom: '48px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <div style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'var(--green-strat)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    <Plane size={12} color="#fff" strokeWidth={2.5} />
                                </div>
                                <span style={{ fontWeight: 700, fontSize: '15px', color: '#fff', letterSpacing: '-0.02em' }}>FlyWise</span>
                            </div>
                            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, maxWidth: '180px' }}>Inteligência estratégica para milhas e passagens aéreas.</p>
                        </div>
                        {[
                            { title: 'Produto', links: ['Como Funciona', 'Recursos', 'Planos', 'Novidades'] },
                            { title: 'Empresa', links: ['Sobre', 'Blog', 'Carreiras', 'Imprensa'] },
                            { title: 'Suporte', links: ['Central de Ajuda', 'Contato', 'Termos', 'Privacidade'] },
                        ].map(col => (
                            <div key={col.title}>
                                <p style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '16px' }}>{col.title}</p>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    {col.links.map(link => (
                                        <a key={link} href="#" style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', textDecoration: 'none', transition: 'color 0.2s' }}
                                            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                                            onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                                        >{link}</a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)' }}>© 2026 FlyWise · Todos os direitos reservados.</p>
                        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.2)' }}>Feito com inteligência ✦</p>
                    </div>
                </div>
            </footer>
        </div>
    )
}
