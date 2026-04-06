import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
    Search, ArrowRight, ArrowRightLeft, Users,
    ChevronDown, CheckCircle2, BarChart3, Globe, Zap, Shield,
    Twitter, Instagram, Linkedin, Youtube, Flame, Lock, ChevronUp,
    MapPin, CreditCard, BookOpen, ChevronLeft, Bell, CalendarDays, Loader2, X
} from 'lucide-react'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { NavBar } from '@/components/ui/tubelight-navbar'
import { FeaturesSectionWithHoverEffects } from '@/components/ui/feature-section-with-hover-effects'
import { PromotionsSection } from '@/components/PromotionsSection'
import { AirportInput } from '@/components/AirportInput'
import { DateRangePicker } from '@/components/DateRangePicker'
import { InteractiveGlobe } from '@/components/ui/interactive-globe'
import confetti from 'canvas-confetti'
import NumberFlow from '@number-flow/react'


// ─── Dados ───────────────────────────────────────────────────────────────────
// Preços verificados em passageirodeprimeira.com, melhores-destinos.com.br (2025/2026)
// Executiva/Econômica: menor preço em milhas encontrado via programas br (Smiles, LATAM, Flying Blue, Avios, ConnectMiles)
// Cash: passagem mais barata encontrada para o mesmo trecho/período
const DESTINATIONS = [
    { name: 'NOVA YORK',  country: 'Estados Unidos', route: 'GRU → JFK', miles: '84.200',  price: 'R$ 6.700', class: 'Executiva · Ida e Volta',  classKey: 'business', img: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=600&q=80' },
    { name: 'PARIS',      country: 'França',          route: 'GRU → CDG', miles: '89.500',  price: 'R$ 3.700', class: 'Executiva · Ida',          classKey: 'business', img: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=600&q=80' },
    { name: 'TÓQUIO',    country: 'Japão',            route: 'GRU → NRT', miles: '85.000',  price: 'R$ 4.600', class: 'Executiva · Ida',          classKey: 'business', img: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&q=80' },
    { name: 'LISBOA',     country: 'Portugal',         route: 'GRU → LIS', miles: '74.000',  price: 'R$ 1.560', class: 'Econômica · Ida e Volta',  classKey: 'economy',  img: 'https://images.unsplash.com/photo-1555881400-74d7acaacd8b?w=600&q=80' },
    { name: 'MIAMI',      country: 'Estados Unidos',   route: 'GRU → MIA', miles: '58.000',  price: 'R$ 1.570', class: 'Econômica · Ida e Volta',  classKey: 'economy',  img: 'https://images.unsplash.com/photo-1535498730771-e735b998cd64?w=600&q=80' },
    { name: 'CANCÚN',    country: 'México',            route: 'GRU → CUN', miles: '26.600',  price: 'R$ 1.680', class: 'Econômica · Ida e Volta',  classKey: 'economy',  img: 'https://images.unsplash.com/photo-1552074284-5e88ef1aef18?w=600&q=80' },
    { name: 'DUBAI',      country: 'Emirados Árabes',  route: 'GRU → DXB', miles: '85.000',  price: 'R$ 5.500', class: 'Executiva · Ida',          classKey: 'business', img: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=600&q=80' },
    { name: 'LONDRES',    country: 'Reino Unido',       route: 'GRU → LHR', miles: '110.000', price: 'R$ 3.450', class: 'Executiva · Ida',          classKey: 'business', img: 'https://images.unsplash.com/photo-1529655683826-aba9b3e77383?w=600&q=80' },
]

const CABIN_FILTERS = [
    { label: 'Todos',     value: 'all' },
    { label: 'Econômica', value: 'economy' },
    { label: 'Executiva', value: 'business' },
]

const STEPS = [
    { num: '01', icon: <Search size={22} color="#2A60C2" />, title: 'Analise Cenários', desc: 'Informe origem, destino, datas e saldo de milhas. O FlyWise cruza todas as variáveis automaticamente.' },
    { num: '02', icon: <BarChart3 size={22} color="#2A60C2" />, title: 'Compare Milhas vs Dinheiro', desc: 'Calculamos o CPM real, identificamos promoções de transferência ativas e mapeamos rotas alternativas.' },
    { num: '03', icon: <Zap size={22} color="#2A60C2" />, title: 'Gere sua Estratégia', desc: 'Um plano em português claro: qual programa usar, quando transferir, como emitir. Passo a passo.' },
]

const PROGRAMS_ROW1 = [
    { name: 'Smiles', iata: 'G3' },
    { name: 'TudoAzul', iata: 'AD' },
    { name: 'Latam Pass', iata: 'LA' },
    { name: 'American AAdvantage', iata: 'AA' },
    { name: 'Delta SkyMiles', iata: 'DL' },
    { name: 'United MileagePlus', iata: 'UA' },
    { name: 'Emirates Skywards', iata: 'EK' },
    { name: 'Qatar Airways', iata: 'QR' },
    { name: 'Singapore KrisFlyer', iata: 'SQ' },
    { name: 'Turkish Miles&Smiles', iata: 'TK' },
    { name: 'Lufthansa Miles & More', iata: 'LH' },
    { name: 'Air France Flying Blue', iata: 'AF' },
]

const PROGRAMS_ROW2 = [
    { name: 'Qantas Frequent Flyer', iata: 'QF' },
    { name: 'Etihad Guest', iata: 'EY' },
    { name: 'Air Canada Aeroplan', iata: 'AC' },
    { name: 'JetBlue TrueBlue', iata: 'B6' },
    { name: 'Alaska Mileage Plan', iata: 'AS' },
    { name: 'Virgin Atlantic', iata: 'VS' },
    { name: 'Copa ConnectMiles', iata: 'CM' },
    { name: 'Finnair Plus', iata: 'AY' },
    { name: 'Ethiopian ShebaMiles', iata: 'ET' },
    { name: 'SAS EuroBonus', iata: 'SK' },
    { name: 'Aeroméxico Club Premier', iata: 'AM' },
    { name: 'Saudia AlFursan', iata: 'SV' },
]

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
        name: 'Elite', price: 'R$ 59', priceAnual: 'R$ 38',
        priceVal: 59, priceAnualVal: 38,
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

const FAQS = [
    { q: 'O FlyWise mostra passagens em tempo real?', a: 'Não exibimos reservas diretas — somos uma ferramenta analítica que compara o valor das suas milhas com tarifas pagas para você decidir a melhor estratégia de resgate.' },
    { q: 'Quais programas de milhas são suportados?', a: 'Smiles (GOL), LATAM Pass, TudoAzul, Livelo, Esfera, Membership Rewards e 35+ outros programas parceiros.' },
    { q: 'Preciso ter milhas para usar o FlyWise?', a: 'Não. Você pode simular quantas milhas precisaria acumular para voar para determinado destino e calcular se vale mais a pena comprar, transferir ou acumular.' },
    { q: 'O plano Free tem limite de buscas?', a: 'Sim, o Free tem janela de pesquisa de 30 dias e apenas 1 estratégia. A partir do plano Essencial as buscas são ilimitadas.' },
    { q: 'Posso cancelar a assinatura a qualquer momento?', a: 'Sim. Sem fidelidade, sem multa. Você cancela quando quiser pelo painel de configurações.' },
]


// ─── Miles Programs (for locked teaser) ─────────────────────────────────────
const MILES_PROGRAMS = [
    { name: 'Smiles (GOL)', placeholder: 'Ex: 80.000 pts', color: '#E85D04' },
    { name: 'LATAM Pass', placeholder: 'Ex: 60.000 pts', color: '#E3000F' },
    { name: 'TudoAzul', placeholder: 'Ex: 45.000 pts', color: '#003DA5' },
]

// ─── SearchPill — usa componentes reais do dashboard ─────────────────────────
function SearchPill() {
    const navigate = useNavigate()
    const [tripType, setTripType] = useState<'round-trip' | 'one-way'>('round-trip')
    const [originLabel, setOriginLabel] = useState('')
    const [originIata, setOriginIata] = useState('')
    const [destLabel, setDestLabel] = useState('')
    const [destIata, setDestIata] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [pax, setPax] = useState(1)
    const [milesOpen, setMilesOpen] = useState(false)

    function handleSwap() {
        setOriginLabel(destLabel); setOriginIata(destIata)
        setDestLabel(originLabel); setDestIata(originIata)
    }

    return (
        <div style={{ fontFamily: 'Manrope, Inter, sans-serif', position: 'relative' }}>
            {/* Main search card */}
            <div style={{
                background: '#fff',
                borderRadius: '20px',
                boxShadow: '0 20px 70px rgba(14,42,85,0.22)',
                padding: '14px 18px 12px',
                border: '1px solid rgba(14,42,85,0.06)',
            }}>
                {/* Trip type toggle */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                    {(['round-trip', 'one-way'] as const).map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => setTripType(t)}
                            style={{
                                padding: '6px 14px', borderRadius: 10, border: 'none',
                                cursor: 'pointer', fontFamily: 'inherit',
                                fontSize: 12, fontWeight: 700,
                                background: tripType === t ? '#0E2A55' : '#F1F5F9',
                                color: tripType === t ? '#fff' : '#64748B',
                                transition: 'all 0.15s',
                            }}
                        >
                            {t === 'round-trip' ? '⇄ Ida e volta' : '→ Só ida'}
                        </button>
                    ))}
                </div>

                {/* Inputs row */}
                <div className="search-pill-inputs" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    {/* Origin */}
                    <div style={{
                        flex: '1 1 130px', border: '1.5px solid #E2EAF5', borderRadius: 12,
                        padding: '8px 12px', background: '#FAFBFF', minWidth: 120,
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Origem</div>
                        <AirportInput
                            value={originLabel}
                            iataCode={originIata}
                            onChange={(label, iata) => { setOriginLabel(label); setOriginIata(iata) }}
                            placeholder="São Paulo, GRU..."
                        />
                    </div>

                    {/* Swap */}
                    <button
                        type="button"
                        className="search-pill-swap"
                        onClick={handleSwap}
                        style={{
                            width: 34, height: 34, borderRadius: '50%',
                            background: '#EEF2F8', border: 'none',
                            cursor: 'pointer', display: 'flex', alignItems: 'center',
                            justifyContent: 'center', flexShrink: 0,
                        }}
                    >
                        <ArrowRightLeft size={14} color="#4A90E2" />
                    </button>

                    {/* Destination */}
                    <div style={{
                        flex: '1 1 130px', border: '1.5px solid #E2EAF5', borderRadius: 12,
                        padding: '8px 12px', background: '#FAFBFF', minWidth: 120,
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Destino</div>
                        <AirportInput
                            value={destLabel}
                            iataCode={destIata}
                            onChange={(label, iata) => { setDestLabel(label); setDestIata(iata) }}
                            placeholder="Nova York, JFK..."
                        />
                    </div>

                    {/* DateRangePicker */}
                    <div style={{ flexShrink: 0 }}>
                        <DateRangePicker
                            dateGo={dateGo}
                            dateBack={dateBack}
                            tripType={tripType}
                            onDateGoChange={setDateGo}
                            onDateBackChange={setDateBack}
                        />
                    </div>

                    {/* Pax + Analisar group */}
                    <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, flexShrink: 0 }}>
                        {/* Passengers */}
                        <div style={{
                            border: '1.5px solid #E2EAF5', borderRadius: 12,
                            padding: '8px 12px', background: '#FAFBFF',
                        }}>
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Pax</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Users size={12} color="#94A3B8" />
                                <button type="button" onClick={() => setPax(p => Math.max(1, p - 1))} style={{ width: 18, height: 18, borderRadius: '50%', background: '#E2EAF5', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: '18px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', color: '#0E2A55' }}>−</button>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55', minWidth: 12, textAlign: 'center' }}>{pax}</span>
                                <button type="button" onClick={() => setPax(p => Math.min(9, p + 1))} style={{ width: 18, height: 18, borderRadius: '50%', background: '#E2EAF5', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: '18px', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit', color: '#0E2A55' }}>+</button>
                            </div>
                        </div>

                        {/* CTA → goes to auth, never executes search */}
                        <button
                            type="button"
                            onClick={() => navigate('/auth')}
                            style={{
                                background: '#2A60C2', color: '#fff',
                                borderRadius: 12, padding: '10px 20px',
                                border: 'none', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontFamily: 'inherit', fontWeight: 800, fontSize: 13,
                                whiteSpace: 'nowrap',
                                boxShadow: '0 4px 16px rgba(42,96,194,0.35)',
                                transition: 'background 0.18s, transform 0.18s',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.background = '#1A4EA8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                            onMouseLeave={e => { e.currentTarget.style.background = '#2A60C2'; e.currentTarget.style.transform = 'translateY(0)' }}
                        >
                            <Search size={14} /> Analisar
                        </button>
                    </div>
                </div>

                {/* ─── Toggle "Busca avançada" at bottom of white card ─── */}
                <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 14, paddingTop: 10 }}>
                    <button
                        type="button"
                        onClick={() => setMilesOpen(o => !o)}
                        style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8,
                            color: '#64748B', fontFamily: 'Manrope, Inter, sans-serif',
                            fontSize: 12, fontWeight: 700, padding: '2px 0',
                            transition: 'color 0.15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.color = '#2A60C2')}
                        onMouseLeave={e => (e.currentTarget.style.color = '#64748B')}
                    >
                        <Lock size={12} color="#94A3B8" />
                        ✨ Busca avançada com milhas
                        {milesOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                    </button>
                </div>
            </div>{/* end white card */}

            {/* Programs panel — in-flow, pushes content below */}
            <AnimatePresence>
                {milesOpen && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.28, ease: 'easeInOut' }}
                        style={{ overflow: 'hidden', marginTop: 8 }}
                    >
                        <div className="search-pill-miles-grid" style={{
                            background: '#fff',
                            borderRadius: 16,
                            border: '1px solid #E2EAF5',
                            boxShadow: '0 8px 32px rgba(14,42,85,0.14)',
                            padding: '16px 20px',
                            display: 'grid',
                            gridTemplateColumns: 'repeat(3, 1fr)',
                            gap: 12,
                        }}>
                            {MILES_PROGRAMS.map(prog => (
                                <div key={prog.name}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                                        {prog.name}
                                    </div>
                                    <div style={{
                                        display: 'flex', alignItems: 'center', gap: 8,
                                        background: '#F8FAFF',
                                        border: '1.5px solid #E2EAF5',
                                        borderRadius: 10, padding: '9px 12px',
                                        cursor: 'not-allowed', opacity: 0.65,
                                    }}>
                                        <Lock size={12} color="#94A3B8" style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: 13, fontWeight: 500, color: '#94A3B8', fontFamily: 'Manrope, Inter, sans-serif' }}>
                                            {prog.placeholder}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            <div style={{ gridColumn: '1 / -1', textAlign: 'center', marginTop: 4 }}>
                                <Link
                                    to="/auth?tab=signup"
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                        color: '#fff', fontSize: 12, fontWeight: 700,
                                        textDecoration: 'none',
                                        background: '#2A60C2',
                                        padding: '8px 20px', borderRadius: 10,
                                        boxShadow: '0 4px 12px rgba(42,96,194,0.30)',
                                        transition: 'background 0.15s',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.background = '#1A4EA8')}
                                    onMouseLeave={e => (e.currentTarget.style.background = '#2A60C2')}
                                >
                                    Criar conta <ArrowRight size={13} />
                                </Link>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
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


// ─── Stats Grid ───────────────────────────────────────────────────────────────

const STATS = [
    { prefix: '', value: 2, startFrom: 1, suffix: 'k+', label: 'Usuários', color: '#0E2A55' },
    { prefix: 'R$ ', value: 1, startFrom: 0, suffix: 'M', label: 'Em economias', color: '#2A60C2' },
    { prefix: '', value: 95, startFrom: 55, suffix: '%', label: 'Satisfação', color: '#2A60C2' },
    { prefix: '', value: 40, startFrom: 22, suffix: '+', label: 'Programas', color: '#0E2A55' },
]

function StatsGrid() {
    const ref = useRef<HTMLDivElement>(null)
    const inView = useInView(ref, { once: true, margin: '-80px' })
    return (
        <div ref={ref} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {STATS.map((s, i) => (
                <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.92 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * i }}
                    style={{ background: '#fff', borderRadius: '16px', padding: '28px 24px', boxShadow: '0 4px 16px rgba(14,42,85,0.07)', border: '1px solid #E2EAF5' }}
                >
                    <div style={{ fontSize: '36px', fontWeight: 900, color: s.color, letterSpacing: '-0.03em', lineHeight: 1, display: 'flex', alignItems: 'center' }}>
                        {s.prefix}
                        <NumberFlow
                            value={inView ? s.value : s.startFrom}
                            transformTiming={{ duration: 2000, easing: 'ease-out' }}
                            spinTiming={{ duration: 600, easing: 'ease-out' }}
                            opacityTiming={{ duration: 400, easing: 'ease-out' }}
                        />
                        {s.suffix}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6B7A99', marginTop: '6px', fontWeight: 500 }}>{s.label}</div>
                </motion.div>
            ))}
        </div>
    )
}

// ─── Destinations Carousel ────────────────────────────────────────────────────
function DestinationsCarousel() {
    const navigate = useNavigate()
    const trackRef = useRef<HTMLDivElement>(null)
    const [filter, setFilter] = useState('all')
    const [activeId, setActiveId] = useState<string | null>(null)

    const filtered = filter === 'all' ? DESTINATIONS : DESTINATIONS.filter(d => d.classKey === filter)

    function scroll(dir: 1 | -1) {
        trackRef.current?.scrollBy({ left: dir * 280, behavior: 'smooth' })
    }

    return (
        <div>
            <style>{`
                .dest-track::-webkit-scrollbar { display: none; }
                .dest-filter-bar::-webkit-scrollbar { display: none; }
                .dest-nav-btn { background: #fff; border: 1px solid #E2EAF5; box-shadow: 0 4px 16px rgba(14,42,85,0.10); transition: all 0.18s; }
                .dest-nav-btn:hover { box-shadow: 0 6px 20px rgba(14,42,85,0.18); border-color: #C0CFEA; }
                @media (max-width: 768px) { .dest-nav-btn { display: none !important; } }
            `}</style>

            {/* Filter tabs */}
            <div className="dest-filter-bar" style={{
                display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none',
                marginBottom: 28, paddingBottom: 2,
            }}>
                {CABIN_FILTERS.map(f => (
                    <button
                        key={f.value}
                        onClick={() => { setFilter(f.value); setActiveId(null) }}
                        style={{
                            padding: '9px 20px', borderRadius: 24, border: 'none', cursor: 'pointer',
                            background: filter === f.value ? '#0E2A55' : '#EEF2F8',
                            color: filter === f.value ? '#fff' : '#6B7A99',
                            fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap', flexShrink: 0,
                            transition: 'all 0.2s', fontFamily: 'inherit',
                            boxShadow: filter === f.value ? '0 4px 14px rgba(14,42,85,0.25)' : 'none',
                        }}
                    >{f.label}</button>
                ))}
            </div>

            {/* Carousel wrapper */}
            <div style={{ position: 'relative' }}>

                {/* Nav arrows — desktop only */}
                {(['prev', 'next'] as const).map(side => (
                    <button
                        key={side}
                        className="dest-nav-btn"
                        onClick={() => scroll(side === 'next' ? 1 : -1)}
                        style={{
                            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
                            [side === 'prev' ? 'left' : 'right']: '-20px',
                            zIndex: 10, width: 40, height: 40, borderRadius: '50%',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer',
                        }}
                    >
                        {side === 'prev'
                            ? <ChevronLeft size={18} color="#2A60C2" />
                            : <ArrowRight size={18} color="#2A60C2" />}
                    </button>
                ))}

                {/* Scrollable track */}
                <div
                    ref={trackRef}
                    className="dest-track"
                    style={{
                        display: 'flex', gap: '20px',
                        overflowX: 'auto', scrollSnapType: 'x mandatory',
                        scrollbarWidth: 'none', paddingBottom: '8px',
                        paddingLeft: '2px', paddingRight: '2px',
                    }}
                >
                    <AnimatePresence mode="popLayout">
                        {filtered.map(d => {
                            const isActive = activeId === d.name
                            return (
                                <motion.div
                                    key={d.name}
                                    layout
                                    initial={{ opacity: 0, scale: 0.93 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.93 }}
                                    transition={{ duration: 0.22 }}
                                    style={{
                                        flex: '0 0 260px', scrollSnapAlign: 'start',
                                        borderRadius: 22, overflow: 'hidden',
                                        position: 'relative', cursor: 'pointer',
                                        height: 340,
                                    }}
                                    onMouseEnter={() => setActiveId(d.name)}
                                    onMouseLeave={() => setActiveId(null)}
                                    onClick={() => setActiveId(prev => prev === d.name ? null : d.name)}
                                >
                                    {/* Background image */}
                                    <img
                                        src={d.img}
                                        alt={d.name}
                                        style={{
                                            width: '100%', height: '100%', objectFit: 'cover',
                                            display: 'block',
                                            transition: 'transform 0.5s ease',
                                            transform: isActive ? 'scale(1.07)' : 'scale(1)',
                                        }}
                                    />

                                    {/* Default overlay: name + miles always visible */}
                                    <motion.div
                                        animate={{ opacity: isActive ? 0 : 1 }}
                                        transition={{ duration: 0.2 }}
                                        style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'linear-gradient(to top, rgba(6,15,31,0.88) 0%, rgba(6,15,31,0.3) 60%, transparent 100%)',
                                            padding: '64px 20px 20px',
                                            pointerEvents: 'none',
                                        }}
                                    >
                                        <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{d.name}</div>
                                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', marginTop: 4 }}>
                                            {d.miles} pts · {d.country}
                                        </div>
                                    </motion.div>

                                    {/* Reveal panel: slides up on hover/tap */}
                                    <motion.div
                                        initial={false}
                                        animate={{ y: isActive ? 0 : '100%' }}
                                        transition={{ duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
                                        style={{
                                            position: 'absolute', bottom: 0, left: 0, right: 0,
                                            background: 'linear-gradient(to top, rgba(6,15,31,0.97) 0%, rgba(6,15,31,0.88) 100%)',
                                            padding: '24px 20px 22px',
                                            backdropFilter: 'blur(8px)',
                                            WebkitBackdropFilter: 'blur(8px)',
                                        }}
                                    >
                                        <div style={{
                                            display: 'inline-block',
                                            background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.9)',
                                            fontSize: 11, fontWeight: 700, borderRadius: 8,
                                            padding: '4px 10px', marginBottom: 12, letterSpacing: '0.04em',
                                        }}>{d.class}</div>
                                        <div style={{ fontSize: 20, fontWeight: 900, color: '#fff', marginBottom: 4, letterSpacing: '-0.01em' }}>{d.name}</div>
                                        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginBottom: 18 }}>{d.route}</div>
                                        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
                                            <div>
                                                <div style={{ fontSize: 24, fontWeight: 900, color: '#60A5FA', letterSpacing: '-0.02em', lineHeight: 1 }}>{d.miles}</div>
                                                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 5 }}>pontos · ou {d.price}</div>
                                            </div>
                                            <button
                                                onClick={e => { e.stopPropagation(); navigate('/auth') }}
                                                style={{
                                                    background: '#2A60C2', color: '#fff',
                                                    border: 'none', borderRadius: 12, padding: '10px 16px',
                                                    fontWeight: 800, fontSize: 13, cursor: 'pointer',
                                                    display: 'flex', alignItems: 'center', gap: 6,
                                                    fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                                                    boxShadow: '0 4px 14px rgba(42,96,194,0.45)',
                                                }}
                                            >
                                                <ArrowRight size={13} /> Analisar
                                            </button>
                                        </div>
                                    </motion.div>
                                </motion.div>
                            )
                        })}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    )
}

// ─── Mapa do Roteiro (Landing) ────────────────────────────────────────────────
const PARIS_PINS = [
    { lat: 48.8584, lng: 2.2945, color: '#F59E0B', label: 'Torre Eiffel',         period: 'Manhã', time: '09:00', local: 'Champ de Mars' },
    { lat: 48.8606, lng: 2.3376, color: '#4A90E2', label: 'Museu do Louvre',       period: 'Tarde', time: '14:00', local: 'Rue de Rivoli' },
    { lat: 48.8867, lng: 2.3431, color: '#7C3AED', label: 'Jantar em Montmartre',  period: 'Noite', time: '20:00', local: 'Butte Montmartre' },
]

function buildLandingPin(color: string, n: number) {
    return L.divIcon({
        html: `<div style="width:26px;height:26px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:800;border:2.5px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.28);font-family:Inter,system-ui,sans-serif">${n}</div>`,
        className: '',
        iconSize: [26, 26],
        iconAnchor: [13, 13],
    })
}

function FitParisBounds({ positions }: { positions: [number, number][] }) {
    const map = useMap()
    useEffect(() => {
        if (positions.length > 1) map.fitBounds(L.latLngBounds(positions), { padding: [28, 28], maxZoom: 14 })
        else if (positions.length === 1) map.setView(positions[0], 14)
    }, [map]) // eslint-disable-line react-hooks/exhaustive-deps
    return null
}

// ─── Landing Page Principal ───────────────────────────────────────────────────
export default function Landing() {
    const [billing, setBilling] = useState<'mensal' | 'anual'>('mensal')

    // ── Checkout anônimo (landing → AbacatePay → auth) ──
    const [checkoutPlan, setCheckoutPlan] = useState<typeof PLANS[number] | null>(null)
    const [coName, setCoName] = useState('')
    const [coEmail, setCoEmail] = useState('')
    const [coCpf, setCoCpf] = useState('')
    const [coPhone, setCoPhone] = useState('')
    const [coLoading, setCoLoading] = useState(false)
    const [coError, setCoError] = useState('')

    async function handleAnonymousCheckout() {
        const cpf = coCpf.replace(/\D/g, '')
        const phone = coPhone.replace(/\D/g, '')
        if (!coName.trim()) { setCoError('Nome obrigatório.'); return }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(coEmail)) { setCoError('E-mail inválido.'); return }
        if (cpf.length !== 11) { setCoError('CPF inválido. Digite os 11 dígitos.'); return }
        if (phone.length < 10) { setCoError('Telefone inválido.'); return }
        setCoError('')
        setCoLoading(true)
        try {
            const priceVal = billing === 'anual'
                ? checkoutPlan!.priceAnualVal! * 12
                : checkoutPlan!.priceVal!
            const res = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    origin: 'PLANO',
                    destination: checkoutPlan!.name.toUpperCase(),
                    totalBrl: priceVal,
                    outboundCompany: `FlyWise ${checkoutPlan!.name}`,
                    customerName: coName,
                    customerEmail: coEmail,
                    customerTaxId: cpf,
                    customerPhone: phone,
                    billingType: billing,
                    paymentMethod: 'ambos',
                    returnPath: '/auth?tab=signup',
                }),
            })
            const data = await res.json()
            if (!res.ok || data.error) throw new Error(data.error || 'Erro ao criar cobrança')
            if (!data.url) throw new Error('URL de pagamento não retornada pela AbacatePay')
            sessionStorage.setItem('flywise_pending_billing', data.id)
            sessionStorage.setItem('flywise_pending_plan', checkoutPlan!.name)
            window.location.href = data.url
        } catch (err: any) {
            setCoError(err.message)
            setCoLoading(false)
        }
    }

    // ── Hero animated words ──
    const heroTitles = useMemo(() => ['Inteligência.', 'Economia.', 'Estratégia.', 'Liberdade.'], [])
    const [titleNumber, setTitleNumber] = useState(0)
    useEffect(() => {
        const id = setTimeout(() => {
            setTitleNumber(n => (n === heroTitles.length - 1 ? 0 : n + 1))
        }, 4000)
        return () => clearTimeout(id)
    }, [titleNumber, heroTitles])

    // ── Alertas reais do banco ──
    const [alertCards, setAlertCards] = useState<Array<{
        prog: string
        deal: string
        time: string
        badge: string
        badgeColor: string
        badgeBg: string
        categoria: string
    }>>([])

    useEffect(() => {
        const CACHE_KEY = 'fw_alert_cards_v1'
        const today = new Date().toISOString().split('T')[0]
        try {
            const raw = localStorage.getItem(CACHE_KEY)
            if (raw) {
                const { date, cards } = JSON.parse(raw)
                if (date === today && cards?.length) { setAlertCards(cards); return }
            }
        } catch {}

        const now = Date.now()
        const makeCard = (p: Record<string, unknown>, cat: string) => {
            const tags = p.programas_tags as string[] | null
            const prog = tags?.[0] ?? (cat === 'clube' ? 'Clube' : cat === 'passagens' ? 'Passagens' : 'Milhas')
            const created = new Date(p.created_at as string).getTime()
            const diffMin = Math.round((now - created) / 60000)
            const time = diffMin < 2 ? 'agora mesmo'
                : diffMin < 60 ? `${diffMin} min atrás`
                : diffMin < 1440 ? `${Math.round(diffMin / 60)}h atrás`
                : `${Math.round(diffMin / 1440)}d atrás`
            const validUntil = p.valid_until as string | null
            const isUrgent = validUntil && (new Date(validUntil).getTime() - now) < 86400000
            const badge = isUrgent ? 'Urgente' : cat === 'clube' ? 'Clube' : cat === 'transferencia' ? 'Transferência' : 'Passagem'
            const badgeColor = isUrgent ? '#F87171' : cat === 'clube' ? '#A78BFA' : cat === 'transferencia' ? '#34D399' : '#60A5FA'
            const badgeBg = isUrgent ? 'rgba(248,113,113,0.15)' : cat === 'clube' ? 'rgba(167,139,250,0.15)' : cat === 'transferencia' ? 'rgba(52,211,153,0.15)' : 'rgba(96,165,250,0.15)'
            return { prog, deal: (p.titulo as string) ?? 'Promoção disponível', time, badge, badgeColor, badgeBg, categoria: cat }
        }

        const base = 'valid_until.is.null,valid_until.gt.' + new Date().toISOString()
        const sel = 'titulo, programas_tags, subcategoria, categoria, valid_until, created_at'
        Promise.all([
            supabase.from('promocoes').select(sel).eq('categoria', 'passagens').or(base).order('created_at', { ascending: false }).limit(1),
            supabase.from('promocoes').select(sel).eq('categoria', 'transferencia').or(base).order('created_at', { ascending: false }).limit(1),
            supabase.from('promocoes').select(sel).in('categoria', ['clube']).or(base).order('created_at', { ascending: false }).limit(1),
        ]).then(([r1, r2, r3]) => {
            const cards = [
                ...(r1.data ?? []).map(p => makeCard(p as Record<string, unknown>, 'passagens')),
                ...(r2.data ?? []).map(p => makeCard(p as Record<string, unknown>, 'transferencia')),
                ...(r3.data ?? []).map(p => makeCard(p as Record<string, unknown>, 'clube')),
            ]
            if (cards.length > 0) {
                setAlertCards(cards)
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ date: today, cards })) } catch {}
            }
        })
    }, [])

    const switchToAnual = useCallback(() => {
        if (billing === 'mensal') {
            setBilling('anual')
            confetti({
                particleCount: 120,
                spread: 80,
                origin: { y: 0.55 },
                colors: ['#2A60C2', '#4A90E2', '#67e8f9', '#fff'],
            })
        } else {
            setBilling('mensal')
        }
    }, [billing])

    return (
        <div style={{ minHeight: '100vh', background: '#fff', fontFamily: 'Inter, system-ui, sans-serif' }}>

            {/* ████ 1. HERO ████ */}
            <section style={{ position: 'relative', background: '#060F1F', overflow: 'hidden', paddingTop: 'env(safe-area-inset-top, 0px)' }}>

                {/* Ambient glow */}
                <div style={{ position: 'absolute', top: 0, right: '25%', width: '500px', height: '500px', borderRadius: '50%', background: 'rgba(74,144,226,0.05)', filter: 'blur(80px)', pointerEvents: 'none' }} />

                {/* HEADER */}
                <header className="landing-hero-header" style={{
                    position: 'relative', zIndex: 20,
                    width: '100%',
                    display: 'flex',
                    justifyContent: 'center',
                    padding: '24px 0',
                }}>
                    <div className="landing-hero-header-inner" style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        alignItems: 'center',
                        gap: '24px',
                        width: 'calc(100% - 80px)',
                        maxWidth: '1200px',
                    }}>
                        {/* Logo */}
                        <Link to="/" className="landing-hero-logo-link" style={{ textDecoration: 'none', justifySelf: 'start' }}>
                            <img src="/logoLP.png" alt="FlyWise" className="landing-hero-logo" style={{ height: '100px', objectFit: 'contain' }} />
                        </Link>

                        {/* Nav — oculto em mobile */}
                        <div className="landing-hero-nav" style={{ justifySelf: 'center' }}>
                            <NavBar items={[
                                { name: 'Como Funciona', url: '#como-funciona', icon: BookOpen },
                                { name: 'Promoções', url: '#promocoes', icon: Flame },
                                { name: 'Destinos', url: '#destinos', icon: MapPin },
                                { name: 'Planos', url: '#planos', icon: CreditCard },
                            ]} />
                        </div>

                        {/* CTAs — link "Entrar" oculto em mobile (botões ficam no hero text) */}
                        <div className="landing-hero-ctas" style={{ display: 'flex', gap: '8px', alignItems: 'center', justifySelf: 'end' }}>
                            <Link to="/auth" className="landing-hero-cta-enter" style={{
                                color: 'rgba(255,255,255,0.75)', fontSize: '13.5px', fontWeight: 600,
                                textDecoration: 'none', padding: '8px 18px', borderRadius: '10px',
                                border: '1px solid rgba(255,255,255,0.15)',
                                background: 'rgba(255,255,255,0.05)',
                                transition: 'all 0.18s ease',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.40)'; e.currentTarget.style.color = '#fff' }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
                            >Entrar</Link>
                            <Link to="/auth?tab=signup" style={{
                                background: '#2A60C2', color: '#fff', fontSize: '13.5px', fontWeight: 700,
                                textDecoration: 'none', padding: '8px 20px', borderRadius: '10px',
                                boxShadow: '0 4px 14px rgba(42,96,194,0.45)',
                                transition: 'background 0.18s ease, transform 0.18s ease',
                                whiteSpace: 'nowrap',
                            }}
                                onMouseEnter={e => { e.currentTarget.style.background = '#1A4EA8'; e.currentTarget.style.transform = 'translateY(-1px)' }}
                                onMouseLeave={e => { e.currentTarget.style.background = '#2A60C2'; e.currentTarget.style.transform = 'translateY(0)' }}
                            >Começar grátis</Link>
                        </div>
                    </div>
                </header>

                {/* HERO CONTENT — dois painéis lado a lado (desktop) / texto com globo ao fundo (mobile) */}
                <div className="landing-hero-content" style={{
                    position: 'relative', zIndex: 10,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: 'calc(100% - 80px)',
                    maxWidth: '1200px',
                    margin: '0 auto',
                    minHeight: '520px',
                    paddingBottom: '80px',
                    gap: '40px',
                }}>
                    {/* Painel esquerdo — texto */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.7, ease: 'easeOut' }}
                        className="landing-hero-text"
                        style={{ flex: '1 1 0', minWidth: 0, position: 'relative', zIndex: 2 }}
                    >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '999px', padding: '6px 16px', marginBottom: '28px' }}>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#34d399', display: 'inline-block' }} />
                            <span style={{ color: 'rgba(255,255,255,0.80)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.02em' }}>Inteligência estratégica para milhas</span>
                        </div>

                        <h1 style={{ fontSize: 'clamp(32px, 4.5vw, 62px)', fontWeight: 900, color: '#fff', lineHeight: 1.08, letterSpacing: '-0.04em', marginBottom: 0 }}>
                            Viaje com Mais
                        </h1>
                        {/* Palavra animada */}
                        <div style={{ fontSize: 'clamp(32px, 4.5vw, 62px)', fontWeight: 900, lineHeight: 1.3, letterSpacing: '-0.04em', marginBottom: '20px', position: 'relative', display: 'inline-block' }}>
                            {/* Spacer — define a largura pelo texto mais largo */}
                            <span style={{ visibility: 'hidden', pointerEvents: 'none' }}>Inteligência.</span>
                            <AnimatePresence mode="popLayout" initial={false}>
                                <motion.span
                                    key={titleNumber}
                                    initial={{ opacity: 0, y: 50 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -50 }}
                                    transition={{ type: 'tween', duration: 0.6, ease: 'easeInOut' }}
                                    style={{
                                        position: 'absolute',
                                        top: 0,
                                        left: 0,
                                        background: 'linear-gradient(90deg, #4A90E2, #67e8f9)',
                                        WebkitBackgroundClip: 'text',
                                        WebkitTextFillColor: 'transparent',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {heroTitles[titleNumber]}
                                </motion.span>
                            </AnimatePresence>
                        </div>






                        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '16px', lineHeight: 1.65, marginBottom: '32px', maxWidth: '440px' }}>
                            Compare milhas e dinheiro em tempo real. Nossa IA gera sua estratégia de resgate passo a passo.
                        </p>

                    </motion.div>

                    {/* Painel direito — Globo (oculto em mobile) */}
                    <motion.div
                        className="landing-hero-globe"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
                        style={{ flex: '0 0 auto', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                        <InteractiveGlobe size={480} />
                    </motion.div>
                </div>

            </section>


            {/* SearchPill — floating between hero and destinos */}
            <div style={{ background: '#F7F9FC' }}>
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.35 }}
                    className="landing-search-pill-wrapper"
                    style={{
                        position: 'relative',
                        zIndex: 20,
                        width: 'calc(100% - 80px)',
                        maxWidth: '960px',
                        margin: '-100px auto 0',
                        padding: '0',
                    }}
                >
                    <SearchPill />
                </motion.div>
            </div>

            {/* ████ 2. FLYWISE NÃO É APENAS UM BUSCADOR ████ */}
            <section id="sobre" style={{ padding: '180px 60px 100px', background: '#F7F9FC', overflow: 'hidden' }}>
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
                    <StatsGrid />
                </div>
            </section>

            {/* ████ 3. COMO FUNCIONA — TRÊS PASSOS ████ */}
            <section id="como-funciona" style={{ padding: '100px 60px', maxWidth: '1280px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '64px' }}>
                    <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Como Funciona</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Três passos para voar melhor</h2>
                    <p style={{ color: '#6B7A99', fontSize: '17px', maxWidth: '480px', margin: '0 auto', lineHeight: 1.65 }}>Sem complexidade, sem achismo. Estratégia real baseada nos seus dados.</p>
                </div>
                <FeaturesSectionWithHoverEffects features={STEPS.map(s => ({ num: s.num, title: s.title, description: s.desc, icon: s.icon }))} />
            </section>

            {/* ████ 4. PROGRAMAS — FAIXA NAVY ████ */}
            <section style={{ background: '#0E2A55', padding: '56px 0', overflow: 'hidden' }}>
                <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.40)', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '32px' }}>
                    Programas de milhas suportados
                </p>

                {/* Linha 1 — scroll para esquerda */}
                <div style={{ overflow: 'hidden', marginBottom: '20px' }}>
                    <motion.div
                        animate={{ x: '-50%' }}
                        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'flex', gap: '0', width: 'max-content' }}
                    >
                        {[...PROGRAMS_ROW1, ...PROGRAMS_ROW1].map((prog, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 28px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                                <img
                                    src={`https://www.gstatic.com/flights/airline_logos/70px/${prog.iata}.png`}
                                    alt={prog.name}
                                    style={{ height: '22px', width: '22px', objectFit: 'contain', opacity: 0.85, borderRadius: '4px' }}
                                    onError={e => (e.currentTarget.style.display = 'none')}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
                                    {prog.name}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                </div>

                {/* Linha 2 — scroll para direita (inverso) */}
                <div style={{ overflow: 'hidden' }}>
                    <motion.div
                        animate={{ x: '0%' }}
                        initial={{ x: '-50%' }}
                        transition={{ duration: 40, repeat: Infinity, ease: 'linear' }}
                        style={{ display: 'flex', gap: '0', width: 'max-content' }}
                    >
                        {[...PROGRAMS_ROW2, ...PROGRAMS_ROW2].map((prog, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 28px', flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.07)' }}>
                                <img
                                    src={`https://www.gstatic.com/flights/airline_logos/70px/${prog.iata}.png`}
                                    alt={prog.name}
                                    style={{ height: '22px', width: '22px', objectFit: 'contain', opacity: 0.85, borderRadius: '4px' }}
                                    onError={e => (e.currentTarget.style.display = 'none')}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.65)', fontSize: '13.5px', fontWeight: 600, whiteSpace: 'nowrap', letterSpacing: '0.01em' }}>
                                    {prog.name}
                                </span>
                            </div>
                        ))}
                    </motion.div>
                </div>
            </section>

            {/* ████ 5. ÚLTIMAS PROMOÇÕES ████ */}
            <section id="promocoes" className="landing-section" style={{ padding: '100px 60px', maxWidth: '1280px', margin: '0 auto' }}>
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
                <PromotionsSection limit={4} landingMode />
            </section>

            {/* ████ 5.5. ALERTAS DE NOTIFICAÇÃO ████ */}
            <section className="landing-section" style={{ background: '#0E2A55', padding: '100px 60px' }}>
                <div className="landing-alerts-grid" style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>

                    {/* Texto esquerda */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                    >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.10)', color: 'rgba(255,255,255,0.9)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '24px' }}>
                            <Bell size={12} /> Alertas em Tempo Real
                        </div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 20px' }}>
                            Nunca perca uma<br /><span style={{ color: '#60A5FA' }}>promoção de milhas</span>
                        </h2>
                        <p style={{ color: 'rgba(255,255,255,0.60)', fontSize: '16px', lineHeight: 1.65, marginBottom: '36px', maxWidth: '420px' }}>
                            Configure seus programas favoritos e receba alertas automáticos por e-mail assim que surgirem promoções de passagens ou transferências de milhas.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {[
                                { icon: <Zap size={17} color="#60A5FA" />, title: 'Passagens aéreas em promoção', desc: 'Alertas de voos baratos em milhas: nacionais, internacionais, ida e volta' },
                                { icon: <Bell size={17} color="#60A5FA" />, title: 'Bônus de transferência', desc: 'Saiba na hora quando surgirem bônus para transferir pontos para milhas aéreas' },
                                { icon: <CheckCircle2 size={17} color="#60A5FA" />, title: 'Promoções de clube', desc: 'Clube Smiles, Clube Livelo e benefícios por plano — sem perder nenhum prazo' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#fff', fontSize: '14px', marginBottom: '3px' }}>{item.title}</div>
                                        <div style={{ color: 'rgba(255,255,255,0.50)', fontSize: '13px', lineHeight: 1.5 }}>{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <motion.div
                            whileHover={{ scale: 1.04, y: -2 }}
                            transition={{ type: 'tween', duration: 0.18 }}
                            style={{ display: 'inline-block', marginTop: '36px' }}
                        >
                            <Link to="/auth?tab=signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#2A60C2', color: '#fff', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 16px rgba(42,96,194,0.45)' }}>
                                Ativar alertas grátis <ArrowRight size={15} />
                            </Link>
                        </motion.div>
                    </motion.div>

                    {/* Mockup de notificações */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                        {/* Ícones Gmail + WhatsApp */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>Receba via</span>
                            {/* Gmail */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(234,67,53,0.18)', border: '1.5px solid rgba(234,67,53,0.45)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 0 14px rgba(234,67,53,0.15)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <rect width="24" height="24" rx="4" fill="none"/>
                                    {/* Gmail M shape */}
                                    <path d="M2 6.5C2 5.4 2.9 4.5 4 4.5H20C21.1 4.5 22 5.4 22 6.5V17.5C22 18.6 21.1 19.5 20 19.5H4C2.9 19.5 2 18.6 2 17.5V6.5Z" fill="rgba(234,67,53,0.12)" stroke="rgba(234,67,53,0.6)" strokeWidth="1.5"/>
                                    <path d="M2 6.5L12 13.5L22 6.5" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    <path d="M2 6.5L7 11M22 6.5L17 11" stroke="#EA4335" strokeWidth="1.3" strokeLinecap="round" strokeOpacity="0.6"/>
                                </svg>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>Gmail</span>
                            </div>
                            {/* WhatsApp */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(37,211,102,0.18)', border: '1.5px solid rgba(37,211,102,0.45)', borderRadius: '12px', padding: '8px 14px', boxShadow: '0 0 14px rgba(37,211,102,0.12)' }}>
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                                    <path d="M12 2C6.48 2 2 6.48 2 12C2 13.85 2.51 15.58 3.39 17.07L2 22L7.06 20.63C8.52 21.49 10.21 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" fill="rgba(37,211,102,0.15)" stroke="rgba(37,211,102,0.6)" strokeWidth="1.5"/>
                                    <path d="M9 8.5C9 8.5 9.5 9.8 10.8 11C12.1 12.2 13.5 12.8 13.5 12.8L14.8 11.8C14.8 11.8 15.6 12.1 16.5 12.7C16.5 12.7 16.5 14.5 15.2 15C13.9 15.5 10.3 14.2 8.5 12.5C6.7 10.8 5.3 7.5 5.8 6.1C6.3 4.7 8 4.8 8 4.8L9.3 6.5C9.3 6.5 9 7.8 9 8.5Z" fill="#25D366"/>
                                </svg>
                                <span style={{ fontSize: '13px', fontWeight: 800, color: '#fff' }}>WhatsApp</span>
                            </div>
                        </div>
                        {([
                            { key: 'passagens',    label: 'Passagens Aéreas',      color: '#60A5FA', fallback: { prog: 'Smiles',            deal: 'GRU → MIA · 29.000 pts · Econômica I+V',         time: 'agora mesmo',  badge: 'Passagem',      badgeColor: '#60A5FA', badgeBg: 'rgba(96,165,250,0.15)',   categoria: 'passagens'    } },
                            { key: 'transferencia', label: 'Bônus de Transferência', color: '#34D399', fallback: { prog: 'Itaú Iupp → Smiles', deal: 'Bônus 100% na transferência · só hoje 23:59',    time: '12 min atrás', badge: 'Urgente',       badgeColor: '#F87171', badgeBg: 'rgba(248,113,113,0.15)', categoria: 'transferencia' } },
                            { key: 'clube',        label: 'Promoções de Clube',     color: '#A78BFA', fallback: { prog: 'Clube Smiles',        deal: 'Plano 1k com 70% de bônus · válido até 31/03',    time: '1h atrás',     badge: 'Clube',         badgeColor: '#A78BFA', badgeBg: 'rgba(167,139,250,0.15)', categoria: 'clube'        } },
                        ]).map((cat, ci) => {
                            const card = alertCards.find(c => c.categoria === cat.key) ?? cat.fallback
                            return (
                                <div key={cat.key}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8, marginTop: ci > 0 ? 4 : 0 }}>
                                        <div style={{ width: 3, height: 13, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                                        <span style={{ fontSize: 10.5, fontWeight: 700, color: cat.color, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{cat.label}</span>
                                    </div>
                                    <motion.div
                                        initial={{ opacity: 0, x: 20 }}
                                        whileInView={{ opacity: 1, x: 0 }}
                                        whileHover={{ scale: 1.025, y: -3, boxShadow: '0 8px 32px rgba(0,0,0,0.25)', transition: { type: 'tween', duration: 0.3, delay: 0 } }}
                                        transition={{ delay: ci * 0.1, duration: 0.4 }}
                                        viewport={{ once: true }}
                                        style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${cat.color}30`, borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '13px', cursor: 'pointer' }}
                                    >
                                        <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: `${cat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <Bell size={17} color={cat.color} />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '4px' }}>
                                                <span style={{ fontWeight: 700, color: '#fff', fontSize: '13px' }}>{card.prog}</span>
                                                <span style={{ fontSize: '10px', fontWeight: 700, color: card.badgeColor, background: card.badgeBg, padding: '2px 8px', borderRadius: '999px', flexShrink: 0 }}>{card.badge}</span>
                                            </div>
                                            <div className="landing-alert-deal" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.deal}</div>
                                        </div>
                                        <div className="landing-alert-time" style={{ fontSize: '11px', color: 'rgba(255,255,255,0.30)', flexShrink: 0 }}>{card.time}</div>
                                    </motion.div>
                                </div>
                            )
                        })}
                        <div style={{ textAlign: 'center', marginTop: '8px' }}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', color: 'rgba(255,255,255,0.35)', fontSize: '12px' }}>
                                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', flexShrink: 0 }} />
                                Sistema monitorando promoções em tempo real
                            </div>
                        </div>
                    </div>

                </div>
            </section>

            {/* ████ 6. DESTINOS ESTRATÉGICOS ████ */}
            <section id="destinos" className="landing-section" style={{ padding: '80px 60px 100px', background: '#F7F9FC', maxWidth: '100%' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
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

                    <DestinationsCarousel />
                </div>
            </section>

            {/* ████ 6.5. ROTEIRO COM IA ████ */}
            <section className="landing-section" style={{ padding: '100px 60px', background: '#fff' }}>
                <div className="landing-roteiro-grid" style={{ maxWidth: '1280px', margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '80px', alignItems: 'center' }}>

                    {/* Mockup visual lado esquerdo */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                        viewport={{ once: true }}
                        className="landing-roteiro-mockup"
                        style={{
                            background: '#F7F9FC',
                            borderRadius: '24px',
                            padding: '28px',
                            border: '1px solid #E2EAF5',
                            boxShadow: '0 8px 32px rgba(14,42,85,0.08)',
                        }}
                    >
                        {/* Cabeçalho do card */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '8px' }}>
                            <div>
                                <div style={{ fontWeight: 800, color: '#0E2A55', fontSize: '16px' }}>Paris, França</div>
                                <div style={{ fontSize: '13px', color: '#6B7A99', marginTop: '2px' }}>5 dias · Casal · Cultural & Gastronômico</div>
                            </div>
                            <div style={{ background: '#EEF2F8', borderRadius: '10px', padding: '7px 12px', fontSize: '12px', fontWeight: 700, color: '#2A60C2', flexShrink: 0 }}>
                                Dia 1 de 5
                            </div>
                        </div>

                        {/* Tema do dia */}
                        <div style={{ background: 'linear-gradient(135deg, #0E2A55, #2A60C2)', borderRadius: '14px', padding: '16px 18px', marginBottom: '14px', color: '#fff' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.65, marginBottom: '4px' }}>Tema do dia</div>
                            <div style={{ fontSize: '15px', fontWeight: 800 }}>Descobrindo o coração de Paris</div>
                        </div>

                        {/* Períodos */}
                        {[
                            { period: 'Manhã', time: '09:00', activity: 'Torre Eiffel', local: 'Champ de Mars', emoji: '🌅' },
                            { period: 'Tarde', time: '14:00', activity: 'Museu do Louvre', local: 'Rue de Rivoli', emoji: '☀️' },
                            { period: 'Noite', time: '20:00', activity: 'Jantar em Montmartre', local: 'Butte Montmartre', emoji: '🌙' },
                        ].map((p, i) => (
                            <motion.div
                                key={i}
                                whileHover={{ x: 5, backgroundColor: '#f0f5ff' }}
                                transition={{ type: 'tween', duration: 0.18 }}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '12px',
                                    padding: '12px 14px',
                                    background: '#fff',
                                    borderRadius: '12px',
                                    marginBottom: i < 2 ? '8px' : '14px',
                                    border: '1px solid #E2EAF5',
                                    cursor: 'default',
                                }}
                            >
                                <span style={{ fontSize: '18px', flexShrink: 0 }}>{p.emoji}</span>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontSize: '11px', fontWeight: 700, color: '#2A60C2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{p.period} · {p.time}</div>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#0E2A55', marginTop: '2px' }}>{p.activity}</div>
                                    <div style={{ fontSize: '12px', color: '#6B7A99' }}>{p.local}</div>
                                </div>
                            </motion.div>
                        ))}

                        {/* Mapa real */}
                        <div style={{ borderRadius: '14px', overflow: 'hidden', border: '1px solid #E2EAF5', boxShadow: '0 2px 12px rgba(14,42,85,0.07)' }}>
                            <div style={{ padding: '10px 14px', background: '#fff', borderBottom: '1px solid #E2EAF5', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <MapPin size={13} color="#2A60C2" />
                                    <span style={{ fontWeight: 800, color: '#0E2A55', fontSize: '13px' }}>Mapa do Roteiro</span>
                                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#6B7A99' }}>({PARIS_PINS.length} locais)</span>
                                </div>
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    {[{ label: 'Manhã', color: '#F59E0B' }, { label: 'Tarde', color: '#4A90E2' }, { label: 'Noite', color: '#7C3AED' }].map(p => (
                                        <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color }} />
                                            <span style={{ fontSize: '10px', color: '#6B7A99', fontWeight: 600 }}>{p.label}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div style={{ height: '220px' }}>
                                <MapContainer
                                    center={[48.868, 2.325]}
                                    zoom={13}
                                    style={{ height: '100%', width: '100%' }}
                                    zoomControl={true}
                                    scrollWheelZoom={false}
                                    dragging={true}
                                    touchZoom={true}
                                    doubleClickZoom={true}
                                    keyboard={false}
                                    attributionControl={false}
                                >
                                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                                    <FitParisBounds positions={PARIS_PINS.map(p => [p.lat, p.lng])} />
                                    {PARIS_PINS.map((pin, i) => (
                                        <Marker key={i} position={[pin.lat, pin.lng]} icon={buildLandingPin(pin.color, i + 1)}>
                                            <Popup>
                                                <div style={{ fontFamily: 'Inter, system-ui, sans-serif', minWidth: '140px' }}>
                                                    <div style={{ fontSize: '10px', fontWeight: 700, color: pin.color, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>
                                                        {pin.period} · {pin.time}
                                                    </div>
                                                    <div style={{ fontSize: '13px', fontWeight: 800, color: '#0E2A55', marginBottom: '3px' }}>{pin.label}</div>
                                                    <div style={{ fontSize: '11px', color: '#6B7A99' }}>{pin.local}</div>
                                                </div>
                                            </Popup>
                                        </Marker>
                                    ))}
                                </MapContainer>
                            </div>
                        </div>
                    </motion.div>

                    {/* Texto direita */}
                    <motion.div
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, delay: 0.15 }}
                        viewport={{ once: true }}
                    >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '24px' }}>
                            <CalendarDays size={12} /> Roteiro com IA
                        </div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.04em', lineHeight: 1.1, margin: '0 0 20px' }}>
                            Seu roteiro de viagem<br /><span style={{ color: '#4A90E2' }}>gerado por IA</span>
                        </h2>
                        <p style={{ color: '#6B7A99', fontSize: '16px', lineHeight: 1.65, marginBottom: '36px', maxWidth: '420px' }}>
                            Informe destino, duração e estilo de viagem. Nossa IA monta um roteiro completo, dia a dia, com atividades para manhã, tarde e noite — tudo no mapa.
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                            {[
                                { icon: <Zap size={17} color="#2A60C2" />, title: 'Roteiro em segundos', desc: 'IA cria seu plano personalizado com base no perfil e estilo de viagem' },
                                { icon: <MapPin size={17} color="#2A60C2" />, title: 'Mapa interativo', desc: 'Veja todos os pontos do roteiro georreferenciados e navegáveis' },
                                { icon: <BookOpen size={17} color="#2A60C2" />, title: 'Salve e organize', desc: 'Guarde múltiplos roteiros e acesse quando quiser, em qualquer dispositivo' },
                            ].map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EEF2F8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                        {item.icon}
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, color: '#0E2A55', fontSize: '14px', marginBottom: '3px' }}>{item.title}</div>
                                        <div style={{ color: '#6B7A99', fontSize: '13px', lineHeight: 1.5 }}>{item.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <motion.div
                            whileHover={{ scale: 1.04, y: -2 }}
                            transition={{ type: 'tween', duration: 0.18 }}
                            style={{ display: 'inline-block', marginTop: '36px' }}
                        >
                            <Link to="/auth?tab=signup" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#0E2A55', color: '#fff', padding: '14px 28px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 16px rgba(14,42,85,0.20)' }}>
                                Gerar meu roteiro <ArrowRight size={15} />
                            </Link>
                        </motion.div>
                    </motion.div>

                </div>
            </section>

            {/* ████ 7. PLANOS ████ */}
            <section id="planos" className="landing-section" style={{ padding: '100px 60px', background: '#F7F9FC' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div style={{ textAlign: 'center', marginBottom: '48px' }}>
                        <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Planos</div>
                        <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: '0 0 14px' }}>Para Viajantes Estratégicos</h2>
                        <p style={{ color: '#6B7A99', fontSize: '17px', maxWidth: '440px', margin: '0 auto 32px', lineHeight: 1.65 }}>Escolha o plano que melhor se adapta ao seu ritmo de viagem.</p>

                        {/* ── Billing toggle ── */}
                        <div style={{ display: 'inline-flex', alignItems: 'center', background: '#F1F5F9', borderRadius: '999px', padding: '5px', gap: '2px', position: 'relative' }}>
                            {(['mensal', 'anual'] as const).map(freq => (
                                <button
                                    key={freq}
                                    onClick={freq === 'anual' ? switchToAnual : () => setBilling('mensal')}
                                    style={{
                                        position: 'relative', padding: '8px 20px', borderRadius: '999px',
                                        border: 'none', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                                        fontSize: '13px', fontWeight: 700, transition: 'color 0.2s',
                                        background: 'transparent',
                                        color: billing === freq ? '#0E2A55' : '#94A3B8',
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        zIndex: 1,
                                    }}
                                >
                                    {billing === freq && (
                                        <motion.span
                                            layoutId="billing-pill"
                                            transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                                            style={{
                                                position: 'absolute', inset: 0, borderRadius: '999px',
                                                background: '#fff',
                                                boxShadow: '0 1px 6px rgba(14,42,85,0.10)',
                                                zIndex: -1,
                                            }}
                                        />
                                    )}
                                    <span style={{ position: 'relative', zIndex: 1, textTransform: 'capitalize' }}>{freq}</span>
                                    {freq === 'anual' && (
                                        <span style={{
                                            position: 'relative', zIndex: 1,
                                            background: billing === 'anual' ? '#EEF2F8' : '#2A60C2',
                                            color: billing === 'anual' ? '#2A60C2' : '#fff',
                                            fontSize: '10px', fontWeight: 800,
                                            padding: '2px 8px', borderRadius: '999px',
                                            letterSpacing: '0.04em', whiteSpace: 'nowrap',
                                            transition: 'background 0.3s, color 0.3s',
                                        }}>Economize 35%</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px', alignItems: 'start' }}>
                        {PLANS.map((plan, i) => {
                            return (
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
                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginBottom: '8px', minHeight: '52px' }}>
                                        {plan.priceVal !== null ? (
                                            <>
                                                <span style={{ fontSize: '42px', fontWeight: 900, color: plan.featured ? '#4A90E2' : '#0E2A55', letterSpacing: '-0.04em', lineHeight: 1 }}>R$&nbsp;</span>
                                                <NumberFlow
                                                    value={billing === 'anual' ? plan.priceAnualVal! : plan.priceVal}
                                                    transformTiming={{ duration: 700, easing: 'ease-out' }}
                                                    spinTiming={{ duration: 700, easing: 'ease-out' }}
                                                    opacityTiming={{ duration: 350, easing: 'ease-out' }}
                                                    style={{
                                                        fontSize: '42px', fontWeight: 900,
                                                        color: plan.featured ? '#4A90E2' : '#0E2A55',
                                                        letterSpacing: '-0.04em', lineHeight: 1,
                                                        fontVariantNumeric: 'tabular-nums',
                                                    }}
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
                                    {plan.price === 'Grátis' ? (
                                        <Link
                                            to="/auth?tab=signup"
                                            style={{
                                                display: 'block', textAlign: 'center', padding: '14px', borderRadius: '12px', textDecoration: 'none', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s',
                                                background: 'transparent', color: '#2A60C2', border: '2px solid #2A60C2',
                                            }}
                                        >Começar grátis</Link>
                                    ) : (
                                        <button
                                            onClick={() => { setCheckoutPlan(plan); setCoName(''); setCoEmail(''); setCoCpf(''); setCoPhone(''); setCoError('') }}
                                            style={{
                                                display: 'block', width: '100%', textAlign: 'center', padding: '14px', borderRadius: '12px', fontWeight: 700, fontSize: '14px', transition: 'all 0.2s', cursor: 'pointer', fontFamily: 'inherit',
                                                background: plan.featured ? '#2A60C2' : 'transparent',
                                                color: plan.featured ? '#fff' : '#2A60C2',
                                                border: plan.featured ? 'none' : '2px solid #2A60C2',
                                                boxShadow: plan.featured ? '0 4px 16px rgba(42,96,194,0.40)' : 'none',
                                            }}
                                        >Assinar agora</button>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                </div>
            </section>

            {/* ████ 7. FAQ ████ */}
            <section className="landing-section" style={{ padding: '100px 60px', maxWidth: '860px', margin: '0 auto' }}>
                <div style={{ textAlign: 'center', marginBottom: '56px' }}>
                    <div style={{ display: 'inline-block', background: '#EEF2F8', color: '#2A60C2', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', borderRadius: '999px', padding: '5px 14px', marginBottom: '16px' }}>Dúvidas Frequentes</div>
                    <h2 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.03em', margin: 0 }}>Tudo que você precisa saber</h2>
                </div>
                {FAQS.map(f => <FaqItem key={f.q} q={f.q} a={f.a} />)}
            </section>

            {/* ████ 8. CTA FINAL ████ */}
            <section className="landing-section" style={{ background: '#0E2A55', padding: '100px 60px', textAlign: 'center' }}>
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
            <footer className="landing-footer" style={{ background: '#060F1F', padding: '72px 60px 40px' }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                    <div className="landing-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: '48px', marginBottom: '60px' }}>
                        <div className="landing-footer-brand">
                            <div style={{ marginBottom: '16px' }}>
                                <a href="#" style={{ display: 'inline-block', textDecoration: 'none', marginLeft: '-8px' }}>
                                    <img src="/logoLP.png" alt="FlyWise" style={{ height: '72px', display: 'block' }} />
                                </a>
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
                    </div>
                </div>
            </footer>

            {/* ── Modal checkout anônimo ── */}
            <AnimatePresence>
                {checkoutPlan && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ position: 'fixed', inset: 0, background: 'rgba(14,42,85,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16, backdropFilter: 'blur(4px)' }}
                        onClick={e => { if (e.target === e.currentTarget && !coLoading) setCheckoutPlan(null) }}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }}
                            style={{ background: '#fff', borderRadius: 24, padding: '32px 28px', maxWidth: 420, width: '100%', boxShadow: '0 24px 80px rgba(14,42,85,0.20)', display: 'flex', flexDirection: 'column', gap: 20 }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <div style={{ fontSize: 18, fontWeight: 800, color: '#0E2A55' }}>Assinar plano {checkoutPlan.name}</div>
                                    <div style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>Preencha seus dados para prosseguir ao pagamento</div>
                                </div>
                                <button onClick={() => { if (!coLoading) setCheckoutPlan(null) }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', flexShrink: 0 }}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {([
                                    { label: 'Nome completo', value: coName, set: setCoName, placeholder: 'Seu nome', type: 'text' },
                                    { label: 'E-mail', value: coEmail, set: setCoEmail, placeholder: 'seu@email.com', type: 'email' },
                                ] as const).map(f => (
                                    <div key={f.label} style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{f.label}</label>
                                        <input
                                            type={f.type}
                                            value={f.value}
                                            onChange={e => { f.set(e.target.value as any); setCoError('') }}
                                            placeholder={f.placeholder}
                                            disabled={coLoading}
                                            style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E2EAF5', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55' }}
                                        />
                                    </div>
                                ))}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>CPF</label>
                                    <input
                                        value={coCpf}
                                        onChange={e => { setCoCpf(maskCPF(e.target.value)); setCoError('') }}
                                        placeholder="000.000.000-00"
                                        disabled={coLoading}
                                        style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E2EAF5', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55' }}
                                    />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Telefone (WhatsApp)</label>
                                    <input
                                        value={coPhone}
                                        onChange={e => { setCoPhone(maskPhone(e.target.value)); setCoError('') }}
                                        placeholder="(11) 99999-9999"
                                        disabled={coLoading}
                                        style={{ padding: '11px 14px', borderRadius: 10, border: '1.5px solid #E2EAF5', fontSize: 14, fontFamily: 'inherit', outline: 'none', color: '#0E2A55' }}
                                    />
                                </div>
                                {coError && <div style={{ fontSize: 12, color: '#DC2626' }}>{coError}</div>}
                            </div>

                            <button
                                onClick={handleAnonymousCheckout}
                                disabled={coLoading}
                                style={{ padding: '13px', borderRadius: 12, border: 'none', background: '#0E2A55', color: '#fff', fontSize: 14, fontWeight: 700, cursor: coLoading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: coLoading ? 0.75 : 1 }}
                            >
                                {coLoading ? <><Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> Aguarde…</> : 'Ir para pagamento'}
                            </button>
                            <div style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center' }}>
                                Após o pagamento, você criará sua conta para acessar a plataforma.
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
