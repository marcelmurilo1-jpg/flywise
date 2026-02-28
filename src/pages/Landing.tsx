import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search, ArrowRight, ArrowRightLeft, Calendar, Users,
    ChevronDown, CheckCircle2, BarChart3, Globe, Zap, Shield, Star,
    Twitter, Instagram, Linkedin, Youtube, Flame
} from 'lucide-react'
import { PromotionsSection } from '@/components/PromotionsSection'


// ─── Dados ───────────────────────────────────────────────────────────────────
const DESTINATIONS = [
    { emoji: '🗽', name: 'NOVA YORK', country: 'Estados Unidos', route: 'GRU → JFK', miles: '40.000', price: 'R$ 1.680', class: 'Executiva · Ida e Volta', img: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80' },
    { emoji: '🗼', name: 'PARIS', country: 'França', route: 'GRU → CDG', miles: '55.000', price: 'R$ 2.100', class: 'Executiva · Ida e Volta', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80' },
    { emoji: '🏯', name: 'TÓQUIO', country: 'Japão', route: 'GRU → NRT', miles: '70.000', price: 'R$ 2.890', class: 'Business · Ida', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80' },
    { emoji: '🏰', name: 'LISBOA', country: 'Portugal', route: 'GRU → LIS', miles: '28.000', price: 'R$ 980', class: 'Economy · Ida e Volta', img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=400&q=80' },
]

const STEPS = [
    { num: '01', icon: <Search size={22} color="#2A60C2" />, title: 'Analise Cenários', desc: 'Informe origem, destino, datas e saldo de milhas. O FlyWise cruza todas as variáveis automaticamente.' },
    { num: '02', icon: <BarChart3 size={22} color="#2A60C2" />, title: 'Compare Milhas vs Dinheiro', desc: 'Calculamos o CPM real, identificamos promoções de transferência ativas e mapeamos rotas alternativas.' },
    { num: '03', icon: <Zap size={22} color="#2A60C2" />, title: 'Gere sua Estratégia', desc: 'Um plano em português claro: qual programa usar, quando transferir, como emitir. Passo a passo.' },
]

const STATS = [
    { value: '12k+', label: 'Usuários ativos' },
    { value: 'R$ 4M+', label: 'Em voos estratégicos' },
    { value: '98%', label: 'Satisfação' },
    { value: '40+', label: 'Companhias aéreas' },
]

const PLANS = [
    {
        name: 'Básico', price: 'Grátis', period: '', featured: false,
        desc: 'Para começar sua jornada com milhas.',
        features: ['5 análises por mês', 'Comparador básico', 'Relatórios simples', 'Suporte por e-mail'],
    },
    {
        name: 'Pro', price: 'R$ 49', period: '/mês', featured: true,
        desc: 'Para viajantes frequentes e estratégicos.',
        features: ['Análises ilimitadas', 'CPM em tempo real', 'Alertas de promoções', 'Relatórios avançados', 'Suporte prioritário'],
    },
    {
        name: 'Elite', price: 'R$ 149', period: '/mês', featured: false,
        desc: 'Para agências e power users.',
        features: ['Tudo do Pro', 'Multi-usuário (5 contas)', 'API de acesso', 'Relatórios white-label', 'Gerente de conta'],
    },
]

const FAQS = [
    { q: 'O FlyWise mostra passagens em tempo real?', a: 'Não exibimos reservas diretas — somos uma ferramenta analítica que compara o valor das suas milhas com tarifas pagas para você decidir a melhor estratégia de resgate.' },
    { q: 'Quais programas de milhas são suportados?', a: 'Smiles (GOL), LATAM Pass, TudoAzul, Livelo, Esfera, Membership Rewards e 35+ outros programas parceiros.' },
    { q: 'Preciso ter milhas para usar o FlyWise?', a: 'Não. Você pode simular quantas milhas precisaria acumular para voar para determinado destino e calcular se vale mais a pena comprar, transferir ou acumular.' },
    { q: 'O plano Básico tem limite de buscas?', a: 'Sim, o Básico permite 5 análises por mês. No plano Pro e Elite as análises são ilimitadas.' },
    { q: 'Posso cancelar a assinatura a qualquer momento?', a: 'Sim. Sem fidelidade, sem multa. Você cancela quando quiser pelo painel de configurações.' },
]

const NAV_LINKS = [
    { label: 'Como Funciona', href: '#como-funciona' },
    { label: 'Destinos', href: '#destinos' },
    { label: 'Planos', href: '#planos' },
    { label: 'Sobre', href: '#sobre' },
]

// ─── SearchPill Flutuante ─────────────────────────────────────────────────────
function SearchPill() {
    const [from, setFrom] = useState('GRU – São Paulo')
    const [to, setTo] = useState('')
    const [dateOut, setDateOut] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [pax, setPax] = useState('1 Adulto')

    return (
        <div style={{
            background: '#fff',
            borderRadius: '20px',
            boxShadow: '0 16px 60px rgba(14,42,85,0.18)',
            padding: '8px 8px 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '0',
            flexWrap: 'wrap',
            border: '1px solid rgba(14,42,85,0.06)',
        }}>
            {/* De */}
            <div style={{ flex: '1 1 140px', padding: '10px 20px', borderRight: '1px solid #E2EAF5', minWidth: '130px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>De</div>
                <input
                    value={from} onChange={e => setFrom(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0E2A55', background: 'transparent', width: '100%', fontFamily: 'Inter, sans-serif' }}
                    placeholder="Cidade ou aeroporto"
                />
            </div>
            {/* Swap */}
            <button
                onClick={() => { const t = from; setFrom(to); setTo(t) }}
                style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#EEF2F8', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, margin: '0 4px' }}
            >
                <ArrowRightLeft size={14} color="#4A90E2" />
            </button>
            {/* Para */}
            <div style={{ flex: '1 1 140px', padding: '10px 20px', borderRight: '1px solid #E2EAF5', minWidth: '130px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Para</div>
                <input
                    value={to} onChange={e => setTo(e.target.value)}
                    style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0E2A55', background: 'transparent', width: '100%', fontFamily: 'Inter, sans-serif' }}
                    placeholder="Destino"
                />
            </div>
            {/* Data Ida */}
            <div style={{ flex: '1 1 120px', padding: '10px 20px', borderRight: '1px solid #E2EAF5', minWidth: '110px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Data de Ida</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} color="#4A90E2" />
                    <input type="text" value={dateOut} onChange={e => setDateOut(e.target.value)} placeholder="DD/MM/AAAA"
                        style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0E2A55', background: 'transparent', width: '100%', fontFamily: 'Inter, sans-serif' }} />
                </div>
            </div>
            {/* Data Volta */}
            <div style={{ flex: '1 1 120px', padding: '10px 20px', borderRight: '1px solid #E2EAF5', minWidth: '110px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Data de Volta</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} color="#4A90E2" />
                    <input type="text" value={dateBack} onChange={e => setDateBack(e.target.value)} placeholder="DD/MM/AAAA"
                        style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0E2A55', background: 'transparent', width: '100%', fontFamily: 'Inter, sans-serif' }} />
                </div>
            </div>
            {/* Passageiros */}
            <div style={{ flex: '1 1 110px', padding: '10px 20px', minWidth: '100px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#6B7A99', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Passageiros</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={13} color="#4A90E2" />
                    <input value={pax} onChange={e => setPax(e.target.value)}
                        style={{ border: 'none', outline: 'none', fontSize: '14px', fontWeight: 600, color: '#0E2A55', background: 'transparent', width: '100%', fontFamily: 'Inter, sans-serif' }} />
                </div>
            </div>
            {/* Buscar */}
            <Link to="/auth"
                style={{
                    margin: '6px 8px 6px 12px',
                    background: '#2A60C2', color: '#fff',
                    borderRadius: '14px', padding: '14px 24px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                    textDecoration: 'none', fontWeight: 700, fontSize: '14px',
                    whiteSpace: 'nowrap', flexShrink: 0,
                    boxShadow: '0 4px 16px rgba(42,96,194,0.35)',
                    transition: 'background 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#1A4EA8')}
                onMouseLeave={e => (e.currentTarget.style.background = '#2A60C2')}
            >
                <Search size={16} />
                Analisar
            </Link>
        </div>
    )
}

// ─── FAQ Item ─────────────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false)
    return (
        <div style={{ borderBottom: '1px solid #E2EAF5' }}>
            <button
                onClick={() => setOpen(!open)}
                style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '22px 0', background: 'none', border: 'none', cursor: 'pointer',
                    textAlign: 'left',
                }}
            >
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#0E2A55', fontFamily: 'Inter, sans-serif' }}>{q}</span>
                <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}
                    style={{ flexShrink: 0, marginLeft: '16px', width: '32px', height: '32px', borderRadius: '50%', background: open ? '#2A60C2' : '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                    <ChevronDown size={16} color={open ? '#fff' : '#4A90E2'} />
                </motion.div>
            </button>
            <AnimatePresence>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22 }} style={{ overflow: 'hidden' }}>
                        <p style={{ paddingBottom: '22px', color: '#6B7A99', fontSize: '15px', lineHeight: 1.7, fontFamily: 'Inter, sans-serif' }}>{a}</p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ─── Landing Page Principal ───────────────────────────────────────────────────
export default function Landing() {

    return (
        <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ████ 1. HERO ████ */}
            <section style={{ position: 'relative', minHeight: '75vh', display: 'flex', flexDirection: 'column' }}>

                {/* Background foto + overlay — clipped ao hero */}
                <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 0 }}>
                    <div style={{
                        position: 'absolute', inset: 0,
                        backgroundImage: 'url(/hero-new.jpg)',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center center',
                    }} />
                    {/* Leve overlay — minimal, não pesado */}
                    <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(180deg, rgba(14,42,85,0.55) 0%, rgba(14,42,85,0.25) 55%, rgba(14,42,85,0.50) 100%)',
                    }} />
                </div>

                {/* HEADER — grid 3 colunas para nav absolutamente centralizado */}
                <header style={{
                    position: 'relative', zIndex: 20,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '24px 0',
                }}>
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        alignItems: 'center',
                        gap: '24px',
                        width: 'calc(100% - 80px)',
                        maxWidth: '1100px',
                    }}>
                        {/* Coluna 1 — Logo */}
                        <Link to="/" style={{ textDecoration: 'none', justifySelf: 'start' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <img src="/logo.png" alt="FlyWise" style={{ height: '120px', objectFit: 'contain' }} />
                            </div>
                        </Link>

                        {/* Coluna 2 — Nav centralizado */}
                        <nav style={{
                            display: 'flex', alignItems: 'center', gap: '4px',
                            background: 'rgba(255,255,255,0.10)',
                            backdropFilter: 'blur(16px)',
                            WebkitBackdropFilter: 'blur(16px)',
                            border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '14px',
                            padding: '5px',
                            justifySelf: 'center',
                        }}>
                            {NAV_LINKS.map(l => (
                                <a key={l.label} href={l.href}
                                    style={{
                                        color: 'rgba(255,255,255,0.80)', fontSize: '13.5px', fontWeight: 500,
                                        textDecoration: 'none', padding: '7px 16px', borderRadius: '10px',
                                        transition: 'background 0.18s ease, color 0.18s ease',
                                        whiteSpace: 'nowrap',
                                    }}
                                    onMouseEnter={e => {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)'
                                        e.currentTarget.style.color = '#fff'
                                    }}
                                    onMouseLeave={e => {
                                        e.currentTarget.style.background = 'transparent'
                                        e.currentTarget.style.color = 'rgba(255,255,255,0.80)'
                                    }}
                                >{l.label}</a>
                            ))}
                        </nav>

                        {/* Coluna 3 — CTAs */}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifySelf: 'end' }}>
                            <Link to="/auth"
                                style={{
                                    color: 'rgba(255,255,255,0.90)', fontSize: '13.5px', fontWeight: 600,
                                    textDecoration: 'none', padding: '8px 18px', borderRadius: '10px',
                                    border: '1.5px solid rgba(255,255,255,0.30)',
                                    background: 'rgba(255,255,255,0.07)',
                                    transition: 'all 0.18s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.7)'; e.currentTarget.style.background = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.30)'; e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = 'rgba(255,255,255,0.90)' }}
                            >Entrar</Link>
                            <Link to="/auth?tab=signup"
                                style={{
                                    background: '#2A60C2', color: '#fff', fontSize: '13.5px', fontWeight: 700,
                                    textDecoration: 'none', padding: '8px 20px', borderRadius: '10px',
                                    boxShadow: '0 4px 14px rgba(42,96,194,0.45)',
                                    transition: 'background 0.18s ease, transform 0.18s ease',
                                }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#1A4EA8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#2A60C2'; e.currentTarget.style.transform = 'translateY(0)' }}
                            >Começar grátis</Link>
                        </div>
                    </div>
                </header>

                {/* HERO CONTENT */}
                <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center', textAlign: 'left', padding: '0 0 48px', maxWidth: '1100px', width: 'calc(100% - 80px)', margin: '0 auto' }}>
                    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: 'easeOut' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: '999px', padding: '6px 16px', marginBottom: '28px' }}>
                            <Star size={13} color="#4A90E2" fill="#4A90E2" />
                            <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>Inteligência estratégica para milhas</span>
                        </div>
                        <h1 style={{ fontSize: 'clamp(40px, 6vw, 72px)', fontWeight: 900, color: '#fff', lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: '20px', maxWidth: '820px' }}>
                            Viaje com Mais<br />
                            <span style={{ color: '#4A90E2' }}>Inteligência.</span>
                        </h1>
                        <p style={{ color: 'rgba(255,255,255,0.80)', fontSize: '18px', fontWeight: 400, lineHeight: 1.6, maxWidth: '520px', margin: '0 0 44px 0' }}>
                            O FlyWise transforma suas milhas em decisões estratégicas — analisando cenários, calculando o valor real e gerando o melhor plano de viagem.
                        </p>
                    </motion.div>
                </div>

                {/* PILL FLUTUANTE — sobreposta entre hero e próxima seção */}
                <div style={{
                    position: 'absolute', bottom: '-36px', left: '50%',
                    transform: 'translateX(-50%)',
                    width: 'calc(100% - 80px)', maxWidth: '1100px',
                    zIndex: 30,
                }}>
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.35 }}
                    >
                        <SearchPill />
                    </motion.div>
                </div>
            </section>

            {/* Espaçador para a pill sobreposta */}
            <div style={{ height: '80px' }} />

            {/* ████ 2. DESTINOS ESTRATÉGICOS ████ */}
            <section id="destinos" style={{ padding: '100px 60px', maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ marginBottom: '56px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '14px' }}>Destinos Populares</div>
                        <h2 style={{ fontSize: 'clamp(30px, 4vw, 48px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
                            Destinos<br /><span style={{ color: '#4A90E2' }}>Estratégicos</span>
                        </h2>
                    </div>
                    <Link to="/auth" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2A60C2', fontWeight: 700, fontSize: '14px', textDecoration: 'none', letterSpacing: '0.01em' }}>
                        Ver todos os destinos <ArrowRight size={16} />
                    </Link>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '24px' }}>
                    {DESTINATIONS.map((d, i) => (
                        <motion.div
                            key={d.name}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.08 * i, duration: 0.5 }}
                            style={{ background: '#fff', borderRadius: '20px', boxShadow: '0 4px 20px rgba(14,42,85,0.07)', overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s ease, box-shadow 0.2s ease', border: '1px solid #E2EAF5' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-4px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 12px 40px rgba(14,42,85,0.13)' }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(14,42,85,0.07)' }}
                        >
                            {/* Imagem */}
                            <div style={{ height: '200px', overflow: 'hidden', borderRadius: '16px 16px 0 0' }}>
                                <img src={d.img} alt={d.name} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.4s ease' }}
                                    onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.05)')}
                                    onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                                />
                            </div>
                            <div style={{ padding: '20px 20px 22px' }}>
                                <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#6B7A99', fontSize: '11px', fontWeight: 600, borderRadius: '6px', padding: '3px 10px', marginBottom: '12px', letterSpacing: '0.02em' }}>{d.class}</div>
                                <div style={{ fontSize: '20px', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em', marginBottom: '4px' }}>{d.name}</div>
                                <div style={{ fontSize: '13px', color: '#6B7A99', marginBottom: '16px' }}>{d.route}</div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ fontSize: '22px', fontWeight: 800, color: '#2A60C2', letterSpacing: '-0.02em' }}>{d.miles} pts</div>
                                        <div style={{ fontSize: '12px', color: '#A0AECB', marginTop: '2px' }}>ou {d.price}</div>
                                    </div>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.2s' }}
                                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#2A60C2')}
                                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#EEF2F8')}
                                    >
                                        <ArrowRight size={16} color="#2A60C2" />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ████ 3. POR QUE FLYWISE — TIPOGRAFIA MISTA SKYWINKS ████ */}
            <section id="sobre" style={{ padding: '100px 60px', background: '#F7F9FC', overflow: 'hidden' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>
                    <div>
                        <h2 style={{ fontSize: 'clamp(36px, 5vw, 64px)', fontWeight: 900, lineHeight: 1.0, letterSpacing: '-0.04em', margin: '0 0 32px' }}>
                            <span style={{ display: 'block', color: '#0E2A55' }}>FLYWISE NÃO</span>
                            <span style={{ display: 'block', color: '#0E2A55' }}>É APENAS UM</span>
                            <span style={{ display: 'block', color: '#4A90E2' }}>BUSCADOR,</span>
                            <span style={{ display: 'block', color: '#2A60C2' }}>É SEU</span>
                            <span style={{ display: 'block', color: '#2A60C2' }}>ESTRATEGISTA</span>
                        </h2>
                        <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                            {[
                                { icon: <Shield size={18} color="#2A60C2" />, text: 'Análise independente, sem conflito de interesse com companhias aéreas' },
                                { icon: <Globe size={18} color="#2A60C2" />, text: 'Cobertura de 40+ programas de milhas nacionais e internacionais' },
                                { icon: <Zap size={18} color="#2A60C2" />, text: 'Estratégia personalizada em menos de 60 segundos' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {item.icon}
                                    </div>
                                    <p style={{ color: '#2C3E6B', fontSize: '15px', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                    {/* Visual lado direito */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {[
                            { val: '12k+', label: 'Usuários', color: '#0E2A55' },
                            { val: 'R$ 4M+', label: 'Em voos', color: '#2A60C2' },
                            { val: '98%', label: 'Satisfação', color: '#2A60C2' },
                            { val: '40+', label: 'Programas', color: '#0E2A55' },
                        ].map((s, i) => (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 * i }}
                                style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 4px 16px rgba(14,42,85,0.07)', border: '1px solid #E2EAF5' }}>
                                <div style={{ fontSize: '36px', fontWeight: 900, color: s.color, letterSpacing: '-0.03em', lineHeight: 1 }}>{s.val}</div>
                                <div style={{ fontSize: '13px', color: '#6B7A99', marginTop: '6px', fontWeight: 500 }}>{s.label}</div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ████ 3.5 PROMOÇÕES EM DESTAQUE ████ */}
            <section style={{ padding: '100px 60px', maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ marginBottom: '48px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
                    <div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '14px' }}>
                            <Flame size={13} /> Promoções em Destaque
                        </div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', lineHeight: 1.1, margin: 0 }}>
                            Últimas promoções<br />
                            <span style={{ color: '#4A90E2' }}>de milhas</span>
                        </h2>
                        <p style={{ color: '#6B7A99', fontSize: '15px', marginTop: '12px', maxWidth: '480px', lineHeight: 1.6 }}>
                            Colhidas automaticamente do maior blog de milhas do Brasil. Crie sua conta para acessar todas.
                        </p>
                    </div>
                    <Link to="/auth" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#2A60C2', fontWeight: 700, fontSize: '14px', textDecoration: 'none', letterSpacing: '0.01em' }}>
                        Ver todas as promoções <ArrowRight size={16} />
                    </Link>
                </div>
                <PromotionsSection limit={3} landingMode />
            </section>

            {/* ████ 4. COMO FUNCIONA ████ */}
            <section id="como-funciona" style={{ padding: '100px 60px', maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Como Funciona</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Três passos para voar melhor</h2>
                    <p style={{ color: '#6B7A99', fontSize: '17px', maxWidth: '480px', margin: '0 auto', lineHeight: 1.65 }}>Sem complexidade, sem achismo. Estratégia real baseada nos seus dados.</p>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
                    {STEPS.map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 * i }}
                            style={{ background: '#fff', borderRadius: '20px', padding: '36px 32px', border: '1px solid #E2EAF5', boxShadow: '0 4px 16px rgba(14,42,85,0.05)', position: 'relative', overflow: 'hidden' }}>
                            {/* Número grande decorativo */}
                            <div style={{ position: 'absolute', top: '16px', right: '24px', fontSize: '64px', fontWeight: 900, color: '#EEF2F8', lineHeight: 1, letterSpacing: '-0.06em', userSelect: 'none' }}>{s.num}</div>
                            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                                {s.icon}
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 800, color: '#0E2A55', marginBottom: '12px', letterSpacing: '-0.02em' }}>{s.title}</h3>
                            <p style={{ color: '#6B7A99', fontSize: '15px', lineHeight: 1.7, margin: 0 }}>{s.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ████ 5. STATS — FAIXA NAVY ████ */}
            <section style={{ background: '#0E2A55', padding: '80px 60px' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '40px', textAlign: 'center' }}>
                    {STATS.map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }}>
                            <div style={{ fontSize: '52px', fontWeight: 900, color: '#4A90E2', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.value}</div>
                            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '14px', fontWeight: 500, marginTop: '8px', letterSpacing: '0.02em' }}>{s.label}</div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* ████ 6. PLANOS ████ */}
            <section id="planos" style={{ padding: '100px 60px', background: '#F7F9FC' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                        <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Planos</div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Para Viajantes Estratégicos</h2>
                        <p style={{ color: '#6B7A99', fontSize: '17px', maxWidth: '440px', margin: '0 auto', lineHeight: 1.65 }}>Escolha o plano que melhor se adapta ao seu ritmo de viagem.</p>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
                        {PLANS.map((plan, i) => (
                            <motion.div key={plan.name} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.1 }}
                                style={{
                                    background: plan.featured ? '#0E2A55' : '#fff',
                                    borderRadius: '20px',
                                    padding: '36px 32px',
                                    border: plan.featured ? '2px solid #4A90E2' : '1px solid #E2EAF5',
                                    boxShadow: plan.featured ? '0 16px 48px rgba(14,42,85,0.25)' : '0 4px 16px rgba(14,42,85,0.06)',
                                    position: 'relative',
                                }}>
                                {plan.featured && (
                                    <div style={{ position: 'absolute', top: '-14px', left: '50%', transform: 'translateX(-50%)', background: '#2A60C2', color: '#fff', fontSize: '11px', fontWeight: 800, padding: '5px 16px', borderRadius: '999px', whiteSpace: 'nowrap', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Mais Popular</div>
                                )}
                                <div style={{ marginBottom: '8px', fontSize: '13px', fontWeight: 700, color: plan.featured ? 'rgba(255,255,255,0.6)' : '#6B7A99', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{plan.name}</div>
                                <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px' }}>
                                    <span style={{ fontSize: '42px', fontWeight: 900, color: plan.featured ? '#4A90E2' : '#0E2A55', letterSpacing: '-0.04em', lineHeight: 1 }}>{plan.price}</span>
                                    {plan.period && <span style={{ fontSize: '14px', color: plan.featured ? 'rgba(255,255,255,0.5)' : '#6B7A99' }}>{plan.period}</span>}
                                </div>
                                <p style={{ fontSize: '14px', color: plan.featured ? 'rgba(255,255,255,0.65)' : '#6B7A99', marginBottom: '28px', lineHeight: 1.6 }}>{plan.desc}</p>
                                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {plan.features.map(f => (
                                        <li key={f} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: plan.featured ? 'rgba(255,255,255,0.85)' : '#2C3E6B', fontWeight: 500 }}>
                                            <CheckCircle2 size={16} color={plan.featured ? '#4A90E2' : '#2A60C2'} />
                                            {f}
                                        </li>
                                    ))}
                                </ul>
                                <Link to="/auth?tab=signup"
                                    style={{
                                        display: 'block', textAlign: 'center', padding: '14px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s',
                                        background: plan.featured ? '#2A60C2' : 'transparent',
                                        color: plan.featured ? '#fff' : '#2A60C2',
                                        border: plan.featured ? 'none' : '2px solid #2A60C2',
                                        boxShadow: plan.featured ? '0 4px 16px rgba(42,96,194,0.40)' : 'none',
                                    }}
                                >{plan.price === 'Grátis' ? 'Começar grátis' : 'Assinar agora'}</Link>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ████ 7. FAQ ████ */}
            <section style={{ padding: '100px 60px', maxWidth: '860px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Dúvidas Frequentes</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: 0 }}>Tudo que você precisa saber</h2>
                </div>
                {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </section>

            {/* ████ 8. CTA FINAL ████ */}
            <section style={{ background: '#0E2A55', padding: '100px 60px', textAlign: 'center' }}>
                <div style={{ maxWidth: '680px', margin: '0 auto' }}>
                    <h2 style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '20px' }}>
                        Pronto para voar com<br /><span style={{ color: '#4A90E2' }}>estratégia real?</span>
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '17px', lineHeight: 1.65, marginBottom: '40px' }}>
                        Junte-se a 12.000+ viajantes estratégicos que já economizam com suas milhas.
                    </p>
                    <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link to="/auth?tab=signup" style={{ background: '#2A60C2', color: '#fff', padding: '16px 36px', borderRadius: '14px', textDecoration: 'none', fontWeight: 800, fontSize: '16px', boxShadow: '0 6px 24px rgba(42,96,194,0.45)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            Começar grátis <ArrowRight size={18} />
                        </Link>
                        <Link to="/auth" style={{ background: 'rgba(255,255,255,0.10)', color: '#fff', padding: '16px 36px', borderRadius: '14px', textDecoration: 'none', fontWeight: 700, fontSize: '16px', border: '1.5px solid rgba(255,255,255,0.20)' }}>
                            Já tenho conta
                        </Link>
                    </div>
                </div>
            </section>

            {/* ████ FOOTER ████ */}
            <footer style={{ background: '#060F1F', padding: '72px 60px 40px' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '48px', marginBottom: '60px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                <svg width="30" height="30" viewBox="0 0 48 48" fill="none">
                                    <rect x="2" y="2" width="44" height="44" rx="12" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                                    <path d="M12 30 Q18 18 24 24 Q30 30 36 18" stroke="#4A90E2" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                    <path d="M28 10 L38 6 L34 16" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                                </svg>
                                <span style={{ fontWeight: 800, fontSize: '18px', color: '#fff', letterSpacing: '-0.04em' }}>FlyWise</span>
                            </div>
                            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px', lineHeight: 1.7, maxWidth: '240px' }}>Inteligência estratégica para milhas e passagens aéreas.</p>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
                                {[Twitter, Instagram, Linkedin, Youtube].map((Icon, i) => (
                                    <a key={i} href="#" style={{ width: '36px', height: '36px', borderRadius: '9px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}
                                        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(74,144,226,0.25)')}
                                        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
                                    ><Icon size={14} color="rgba(255,255,255,0.55)" /></a>
                                ))}
                            </div>
                        </div>
                        {[
                            { title: 'Produto', links: ['Como Funciona', 'Recursos', 'Planos', 'Novidades'] },
                            { title: 'Empresa', links: ['Sobre', 'Blog', 'Carreiras', 'Imprensa'] },
                            { title: 'Suporte', links: ['Central de Ajuda', 'Contato', 'Termos', 'Privacidade'] },
                        ].map(col => (
                            <div key={col.title}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>{col.title}</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {col.links.map(l => (
                                        <a key={l} href="#" style={{ color: 'rgba(255,255,255,0.55)', fontSize: '14px', textDecoration: 'none', transition: 'color 0.15s' }}
                                            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.55)')}
                                        >{l}</a>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                        <span style={{ color: 'rgba(255,255,255,0.30)', fontSize: '13px' }}>© 2026 FlyWise. Todos os direitos reservados.</span>
                        <a href="#" style={{ color: '#4A90E2', fontSize: '13px', fontWeight: 600, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            Análise estratégica ✦
                        </a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
