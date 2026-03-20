import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Stethoscope, LayoutGrid, MapPin, Thermometer, DollarSign, Shield,
    Train, Star, Play, ChevronDown, ArrowLeft, Plus, Building2,
    Users, ChevronRight, Shirt, BadgeCheck, Car,
} from 'lucide-react'
import { Header } from '@/components/Header'
import { ExpandableTabs } from '@/components/ui/expandable-tabs'

// ─── Tab bar ──────────────────────────────────────────────────────────────────

const C1_TABS = [
    { title: 'Meu Intercâmbio', icon: Stethoscope },
    { title: 'Hub C1%', icon: LayoutGrid },
]
const C1_ROUTES = ['/c1/intercambio', '/c1']

export function C1TabBar({ active }: { active: 'intercambio' | 'hub' }) {
    const navigate = useNavigate()
    const activeIndex = active === 'intercambio' ? 0 : 1
    return (
        <ExpandableTabs
            tabs={C1_TABS}
            activeIndex={activeIndex}
            onSelect={(index) => navigate(C1_ROUTES[index])}
        />
    )
}

// ─── Mock data ─────────────────────────────────────────────────────────────────

type City = {
    id: string
    name: string
    state: string
    gradient: string
    photo: string
    tagline: string
    hospitals: number
    transport: string[]
    neighborhoods: { name: string; tag: string; color: string }[]
    raioX: { label: string; value: string; icon: typeof DollarSign; color: string }[]
    hospitalIds: string[]
}

type Hospital = {
    id: string
    name: string
    city: string
    state: string
    gradient: string
    photo: string
    specialty: string[]
    rating: number
    handsOn: number
    preceptorRating: number
    reviews: number
    flix: { title: string; author: string; duration: string; gradient: string }[]
    logistica: { icon: typeof Shirt; title: string; content: string }[]
}

const CITIES: City[] = [
    {
        id: 'boston',
        name: 'Boston',
        state: 'MA',
        gradient: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #0ea5e9 100%)',
        photo: '/c1-photos/city-boston.jpg',
        tagline: 'Capital da medicina americana',
        hospitals: 6,
        transport: ['MBTA (metrô)', 'Ônibus 24h', 'Lyft/Uber', 'Bicicleta (Bluebikes)'],
        neighborhoods: [
            { name: 'Longwood', tag: 'Médico', color: '#2563EB' },
            { name: 'Back Bay', tag: 'Seguro', color: '#059669' },
            { name: 'South End', tag: 'Agitado', color: '#D97706' },
            { name: 'Roxbury', tag: 'Evitar', color: '#DC2626' },
        ],
        raioX: [
            { label: 'Custo de vida', value: 'Alto', icon: DollarSign, color: '#D97706' },
            { label: 'Temperatura média', value: '12°C', icon: Thermometer, color: '#2563EB' },
            { label: 'Segurança', value: 'Boa', icon: Shield, color: '#059669' },
            { label: 'Hospitais', value: '6', icon: Building2, color: '#7C3AED' },
        ],
        hospitalIds: ['brigham', 'mgh', 'bch'],
    },
    {
        id: 'nyc',
        name: 'New York',
        state: 'NY',
        gradient: 'linear-gradient(135deg, #1a1a2e 0%, #7c2d8b 50%, #ec4899 100%)',
        photo: '/c1-photos/city-nyc.jpg',
        tagline: 'A cidade que nunca dorme (nem você)',
        hospitals: 8,
        transport: ['Metrô 24h', 'Ônibus MTA', 'Citi Bike', 'Ferry'],
        neighborhoods: [
            { name: 'Upper East Side', tag: 'Médico', color: '#2563EB' },
            { name: 'Midtown', tag: 'Central', color: '#059669' },
            { name: 'Brooklyn', tag: 'Custo-benef.', color: '#D97706' },
            { name: 'Bronx', tag: 'Evitar', color: '#DC2626' },
        ],
        raioX: [
            { label: 'Custo de vida', value: 'Muito alto', icon: DollarSign, color: '#DC2626' },
            { label: 'Temperatura média', value: '13°C', icon: Thermometer, color: '#2563EB' },
            { label: 'Segurança', value: 'Média', icon: Shield, color: '#D97706' },
            { label: 'Hospitais', value: '8', icon: Building2, color: '#7C3AED' },
        ],
        hospitalIds: ['mtsinai', 'columbia', 'nyu'],
    },
    {
        id: 'chicago',
        name: 'Chicago',
        state: 'IL',
        gradient: 'linear-gradient(135deg, #064e3b 0%, #065f46 50%, #10b981 100%)',
        photo: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=700&q=80&auto=format&fit=crop',
        tagline: 'The Windy City com hospitais de elite',
        hospitals: 5,
        transport: ['CTA (metrô/ônibus)', 'Divvy (bike)', 'Metra (trem)'],
        neighborhoods: [
            { name: 'Lincoln Park', tag: 'Seguro', color: '#059669' },
            { name: 'River North', tag: 'Agitado', color: '#D97706' },
            { name: 'Hyde Park', tag: 'Universitário', color: '#2563EB' },
            { name: 'South Side', tag: 'Evitar', color: '#DC2626' },
        ],
        raioX: [
            { label: 'Custo de vida', value: 'Moderado', icon: DollarSign, color: '#059669' },
            { label: 'Temperatura média', value: '10°C', icon: Thermometer, color: '#2563EB' },
            { label: 'Segurança', value: 'Média', icon: Shield, color: '#D97706' },
            { label: 'Hospitais', value: '5', icon: Building2, color: '#7C3AED' },
        ],
        hospitalIds: ['northwestern', 'uchicago'],
    },
]

const HOSPITALS: Hospital[] = [
    {
        id: 'brigham',
        name: 'Brigham and Women\'s Hospital',
        city: 'Boston', state: 'MA',
        gradient: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
        photo: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=700&q=80&auto=format&fit=crop',
        specialty: ['Cardiologia', 'Oncologia', 'Neuro'],
        rating: 4.9, handsOn: 82, preceptorRating: 95, reviews: 34,
        flix: [
            { title: 'Meu primeiro dia no Brigham', author: 'Dr. Lucas S.', duration: '12min', gradient: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' },
            { title: 'Rounds matinais na UTI', author: 'Dra. Camila R.', duration: '18min', gradient: 'linear-gradient(135deg, #312e81, #6366f1)' },
            { title: 'Como consegui a carta de recomendação', author: 'Dr. Pedro H.', duration: '8min', gradient: 'linear-gradient(135deg, #0f172a, #1d4ed8)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs azuis fornecidos pelo hospital para a UTI. Outros setores: scrubs próprios em tons neutros (azul, verde, cinza). Jalecos obrigatórios em consultórios.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Dirigir-se ao Pavilhão Francis Street, sala G-002, das 8h às 15h (seg-sex). Necessário: passaporte, carta de aceite, comprovante de vacinas e foto 3x4.' },
            { icon: Car, title: 'Transporte noturno', content: 'Shuttle gratuito 24h conectando o campus ao metrô Longwood (Linha Verde). App BW Safe Ride disponível para destinos próximos após meia-noite.' },
        ],
    },
    {
        id: 'mgh',
        name: 'Massachusetts General Hospital',
        city: 'Boston', state: 'MA',
        gradient: 'linear-gradient(135deg, #0c4a6e 0%, #0284c7 100%)',
        photo: 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=700&q=80&auto=format&fit=crop',
        specialty: ['Neurologia', 'Psiquiatria', 'Cirurgia'],
        rating: 5.0, handsOn: 78, preceptorRating: 98, reviews: 51,
        flix: [
            { title: 'Grand rounds no MGH', author: 'Dra. Fernanda L.', duration: '22min', gradient: 'linear-gradient(135deg, #0c4a6e, #0ea5e9)' },
            { title: 'Vida em Cambridge', author: 'Dr. Rafael B.', duration: '15min', gradient: 'linear-gradient(135deg, #164e63, #06b6d4)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs azul-marinho ou cinza. No pronto-socorro, equipamentos de proteção são fornecidos. Visitante clínico deve usar jaleco branco com nome a todo momento.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Edifício principal, Bulfinch Building, sala 1-103. Horário: 7h30 às 16h. Processo leva ~45 min. Trazer todos os documentos em inglês certificados.' },
            { icon: Car, title: 'Transporte noturno', content: 'MBTA Linha Vermelha (parada Charles/MGH) opera até meia-noite. After hours: MGH Escort Service (ramais internos disponíveis) + Uber/Lyft do estacionamento principal.' },
        ],
    },
    {
        id: 'mtsinai',
        name: 'Mount Sinai Hospital',
        city: 'New York', state: 'NY',
        gradient: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
        photo: 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=700&q=80&auto=format&fit=crop',
        specialty: ['Cardiologia', 'Endocrinologia', 'Genética'],
        rating: 4.8, handsOn: 75, preceptorRating: 91, reviews: 28,
        flix: [
            { title: 'Intercâmbio em NY — vale a pena?', author: 'Dra. Mariana C.', duration: '20min', gradient: 'linear-gradient(135deg, #4c1d95, #a855f7)' },
            { title: 'Morando em Manhattan com bolsa', author: 'Dr. Thiago A.', duration: '11min', gradient: 'linear-gradient(135deg, #3b0764, #7c3aed)' },
            { title: 'Minhas rotações no Mount Sinai', author: 'Dr. Bruno V.', duration: '16min', gradient: 'linear-gradient(135deg, #1e1b4b, #4338ca)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs fornecidos pelo hospital somente para cirurgia e UTI. Demais áreas: scrubs próprios em cores sólidas. Identificação com nome completo obrigatória.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Guggenheimer Pavilion, térreo, sala G-01. Das 9h às 17h (seg-sex). Apresentar: visto J-1, cartas de aceite, imunização completa.' },
            { icon: Car, title: 'Transporte noturno', content: 'Metrô NYC 24h (linha 4,5,6 — parada 86th St). Hospital oferece táxi compartilhado para residências parceiras após 23h mediante solicitação no balcão de segurança.' },
        ],
    },
    {
        id: 'northwestern',
        name: 'Northwestern Memorial Hospital',
        city: 'Chicago', state: 'IL',
        gradient: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
        photo: 'https://images.unsplash.com/photo-1504439468489-c8920d796a29?w=700&q=80&auto=format&fit=crop',
        specialty: ['Hepatologia', 'Transplante', 'Reumatologia'],
        rating: 4.7, handsOn: 80, preceptorRating: 89, reviews: 19,
        flix: [
            { title: 'Chicago além dos hospitais', author: 'Dra. Ana P.', duration: '14min', gradient: 'linear-gradient(135deg, #064e3b, #10b981)' },
            { title: 'Rotação de transplante hepático', author: 'Dr. Marcos F.', duration: '25min', gradient: 'linear-gradient(135deg, #065f46, #34d399)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs NMH (cor cinza ou azul-petróleo) para enfermaria e pronto-socorro. Jaleco obrigatório para ambulatório. Calçados fechados e sem adornos excessivos.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Prentice Women\'s Hospital, entrada principal, setor de visitantes. Seg-sex, 8h às 15h30. Lista de documentos enviada por email após aceite.' },
            { icon: Car, title: 'Transporte noturno', content: 'CTA opera 24h. Para trajetos após 23h, hospital disponibiliza SafeRide (app interno) com destinos no raio de 5km do campus. Solicitar com 30min de antecedência.' },
        ],
    },
    {
        id: 'columbia',
        name: 'Columbia University Medical Center',
        city: 'New York', state: 'NY',
        gradient: 'linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)',
        photo: 'https://images.unsplash.com/photo-1602526216145-0e2e2f0bcb2e?w=700&q=80&auto=format&fit=crop',
        specialty: ['Neurologia', 'Cardiologia', 'Oncologia'],
        rating: 4.8, handsOn: 70, preceptorRating: 87, reviews: 22,
        flix: [
            { title: 'Columbia x NYU — qual escolher?', author: 'Dra. Julia M.', duration: '17min', gradient: 'linear-gradient(135deg, #7f1d1d, #ef4444)' },
            { title: 'Minha experiência em Neurologia', author: 'Dr. Diego S.', duration: '9min', gradient: 'linear-gradient(135deg, #450a0a, #b91c1c)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Trajes profissionais (business casual) para clínica. Scrubs azuis ou verdes em procedimentos. Proibido usar jeans ou roupas casuais no ambiente hospitalar.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Black Building, sala 1-101, Washington Heights. Horário: 9h às 16h. ID com foto + carta institucional obrigatórios.' },
            { icon: Car, title: 'Transporte noturno', content: 'Linha 1 do metrô (parada 168th St) até 1h. Após isso, CUMC Night Safety Escort disponível para trajetos no campus e proximidades.' },
        ],
    },
    {
        id: 'bch',
        name: 'Boston Children\'s Hospital',
        city: 'Boston', state: 'MA',
        gradient: 'linear-gradient(135deg, #0369a1 0%, #38bdf8 100%)',
        photo: 'https://images.unsplash.com/photo-1597764690523-15bea4c581c9?w=700&q=80&auto=format&fit=crop',
        specialty: ['Pediatria', 'Cirurgia Pediátrica', 'Neonatologia'],
        rating: 4.9, handsOn: 88, preceptorRating: 96, reviews: 41,
        flix: [
            { title: 'Pediatria no melhor hospital do mundo', author: 'Dra. Sofia R.', duration: '19min', gradient: 'linear-gradient(135deg, #0369a1, #0ea5e9)' },
            { title: 'Como lidar emocionalmente com a Pediatria', author: 'Dra. Leticia B.', duration: '13min', gradient: 'linear-gradient(135deg, #075985, #38bdf8)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs coloridos (não-brancos) encorajados para criar ambiente acolhedor para crianças. Jalecos obrigatórios em reuniões clínicas e apresentações.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Prédio Enders, sala EN-107. Horário estendido: 7h às 17h30. BCH exige treinamento online de 2h antes da retirada do badge.' },
            { icon: Car, title: 'Transporte noturno', content: 'Shuttle BCH–MBTA disponível até 23h. Hospital oferece parceria com Lyft com código de desconto para funcionários e visitantes clínicos.' },
        ],
    },
    {
        id: 'uchicago',
        name: 'UChicago Medicine',
        city: 'Chicago', state: 'IL',
        gradient: 'linear-gradient(135deg, #1c1917 0%, #78350f 50%, #d97706 100%)',
        photo: 'https://images.unsplash.com/photo-1551190822-a9333d879b1f?w=700&q=80&auto=format&fit=crop',
        specialty: ['Oncologia', 'Endocrinologia', 'Pesquisa Clínica'],
        rating: 4.6, handsOn: 72, preceptorRating: 90, reviews: 15,
        flix: [
            { title: 'Pesquisa clínica: como participar', author: 'Dr. Henrique L.', duration: '21min', gradient: 'linear-gradient(135deg, #1c1917, #d97706)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs escuros (preto, cinza chumbo, azul marinho) para clínica e enfermaria. Jaleco com nome e instituição obrigatório durante rounds.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Center for Care and Discovery, entrada leste, sala L-004. Horário: 8h às 15h. Processo inclui foto e impressão digital.' },
            { icon: Car, title: 'Transporte noturno', content: 'Linha Metra Universitária + ônibus CTA 55. UChicago Night Ride disponível das 19h às 5h para raio de 1,5km do campus mediante solicitação online.' },
        ],
    },
    {
        id: 'nyu',
        name: 'NYU Langone Health',
        city: 'New York', state: 'NY',
        gradient: 'linear-gradient(135deg, #3730a3 0%, #6366f1 100%)',
        photo: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=700&q=80&auto=format&fit=crop',
        specialty: ['Ortopedia', 'Otorrinolaringologia', 'Cirurgia Plástica'],
        rating: 4.7, handsOn: 68, preceptorRating: 85, reviews: 18,
        flix: [
            { title: 'NYU Langone — expectativa vs realidade', author: 'Dr. Caio M.', duration: '16min', gradient: 'linear-gradient(135deg, #3730a3, #818cf8)' },
            { title: 'Ortopedia nos EUA — oportunidades', author: 'Dr. Gabriel T.', duration: '12min', gradient: 'linear-gradient(135deg, #1e1b4b, #6366f1)' },
        ],
        logistica: [
            { icon: Shirt, title: 'Dress code', content: 'Scrubs azuis para visitantes. Cirurgia: scrubs fornecidos na área restrita. Ambiente ambulatorial: business casual + jaleco.' },
            { icon: BadgeCheck, title: 'Retirada do badge', content: 'Tisch Hospital, entrada principal, balcão de segurança. Disponível 7h às 18h. Necessário comprovante de seguro saúde ativo nos EUA.' },
            { icon: Car, title: 'Transporte noturno', content: 'Metrô NYC 24h (linhas 4,5,6 e L). Campus próprio de Manhattan tem serviço de segurança 24h com acompanhamento em trajetos internos.' },
        ],
    },
]

// ─── City Gallery ──────────────────────────────────────────────────────────────

function CityGallery({ onSelect }: { onSelect: (c: City) => void }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {CITIES.map((city, i) => (
                <motion.div
                    key={city.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08, duration: 0.4 }}
                    onClick={() => onSelect(city)}
                    whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.1)' }}
                    style={{
                        cursor: 'pointer', borderRadius: '16px', overflow: 'hidden',
                        border: '1px solid #E2E8F0', background: '#fff',
                        display: 'flex', flexDirection: 'column', height: '320px',
                    }}
                >
                    {/* Cover */}
                    <div style={{ height: '160px', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                        <img src={city.photo} alt={city.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, rgba(0,0,0,0.1) 60%)' }} />
                        <div style={{ position: 'absolute', bottom: '14px', left: '16px', zIndex: 1 }}>
                            <div style={{ fontSize: '22px', fontWeight: 800, color: '#fff', lineHeight: 1 }}>{city.name}</div>
                            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.75)', marginTop: '2px' }}>{city.state} · {city.hospitals} hospitais recomendados</div>
                        </div>
                    </div>
                    {/* Footer */}
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflow: 'hidden' }}>
                        <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.6, margin: 0, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{city.tagline}</p>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', overflow: 'hidden', maxHeight: '48px' }}>
                            {city.raioX.map(rx => (
                                <span key={rx.label} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: '#F1F5F9', color: '#475569', border: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>
                                    {rx.label}: <strong style={{ color: '#0F172A' }}>{rx.value}</strong>
                                </span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', color: '#2563EB', fontSize: '13px', fontWeight: 600, gap: '4px', marginTop: 'auto' }}>
                            Explorar <ChevronRight size={14} />
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

// ─── City Detail ───────────────────────────────────────────────────────────────

function CityDetail({ city, onBack }: { city: City; onBack: () => void }) {
    const cityHospitals = HOSPITALS.filter(h => city.hospitalIds.includes(h.id))

    return (
        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
            {/* Hero */}
            <div style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '28px', position: 'relative', height: '220px' }}>
                <img src={city.photo} alt={city.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', position: 'absolute', inset: 0, display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
                <button onClick={onBack} style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <ArrowLeft size={14} /> Voltar
                </button>
                <div style={{ position: 'absolute', bottom: '20px', left: '24px', zIndex: 1 }}>
                    <div style={{ fontSize: '32px', fontWeight: 900, color: '#fff', letterSpacing: '-0.03em' }}>{city.name}</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={13} /> {city.state} · {city.tagline}</div>
                </div>
            </div>

            {/* Raio-X */}
            <SectionLabel label="Raio-X da Cidade" />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '14px', marginBottom: '28px' }}>
                {city.raioX.map(rx => (
                    <div key={rx.label} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                        <div style={{ width: 38, height: 38, borderRadius: '10px', background: rx.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <rx.icon size={17} color={rx.color} />
                        </div>
                        <div>
                            <div style={{ fontSize: '17px', fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{rx.value}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>{rx.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Guia de Sobrevivência */}
            <SectionLabel label="Guia de Sobrevivência" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '28px' }}>
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <MapPin size={15} color="#2563EB" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Bairros</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                        {city.neighborhoods.map(n => (
                            <div key={n.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '13px', color: '#334155' }}>{n.name}</span>
                                <span style={{ fontSize: '11px', padding: '2px 10px', borderRadius: '20px', background: n.color + '15', color: n.color, fontWeight: 600 }}>{n.tag}</span>
                            </div>
                        ))}
                    </div>
                </div>
                <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', padding: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                        <Train size={15} color="#059669" />
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>Transporte</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                        {city.transport.map(t => (
                            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#059669', flexShrink: 0 }} />
                                <span style={{ fontSize: '13px', color: '#334155' }}>{t}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Hospitais recomendados */}
            <SectionLabel label={`Hospitais Recomendados em ${city.name}`} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' }}>
                {cityHospitals.map(h => (
                    <div key={h.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                        <div style={{ height: '72px', background: h.gradient }} />
                        <div style={{ padding: '14px 16px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', marginBottom: '6px' }}>{h.name}</div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {h.specialty.map(s => (
                                    <span key={s} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '20px', background: '#EFF6FF', color: '#2563EB' }}>{s}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </motion.div>
    )
}

// ─── Hospital Gallery ──────────────────────────────────────────────────────────

function HospitalGallery({ onSelect }: { onSelect: (h: Hospital) => void }) {
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
            {HOSPITALS.map((h, i) => (
                <motion.div
                    key={h.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06, duration: 0.4 }}
                    onClick={() => onSelect(h)}
                    whileHover={{ y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.1)' }}
                    style={{
                        cursor: 'pointer', borderRadius: '16px', overflow: 'hidden',
                        border: '1px solid #E2E8F0', background: '#fff',
                        display: 'flex', flexDirection: 'column', height: '310px',
                    }}
                >
                    {/* Cover */}
                    <div style={{ height: '130px', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
                        <img src={h.photo} alt={h.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', display: 'block' }} />
                        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.05) 60%)' }} />
                        <div style={{ position: 'absolute', bottom: '10px', left: '14px', zIndex: 1, display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Star size={12} fill="#F59E0B" color="#F59E0B" />
                            <span style={{ fontSize: '12px', fontWeight: 700, color: '#fff' }}>{h.rating.toFixed(1)}</span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.65)' }}>({h.reviews} reviews)</span>
                        </div>
                    </div>
                    {/* Footer */}
                    <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflow: 'hidden' }}>
                        <div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{h.name}</div>
                            <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <MapPin size={11} /> {h.city}, {h.state}
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', overflow: 'hidden', maxHeight: '44px' }}>
                            {h.specialty.map(s => (
                                <span key={s} style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '20px', background: '#F5F3FF', color: '#7C3AED', border: '1px solid #EDE9FE', whiteSpace: 'nowrap' }}>{s}</span>
                            ))}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto' }}>
                            <div style={{ display: 'flex', gap: '14px' }}>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#059669' }}>{h.handsOn}%</div>
                                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>Hands-on</div>
                                </div>
                                <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#2563EB' }}>{h.preceptorRating}%</div>
                                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>Preceptor</div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', color: '#2563EB', fontSize: '13px', fontWeight: 600, gap: '4px' }}>
                                Ver mais <ChevronRight size={14} />
                            </div>
                        </div>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}

// ─── Hospital Detail ───────────────────────────────────────────────────────────

function HospitalDetail({ hospital, onBack }: { hospital: Hospital; onBack: () => void }) {
    const [openLog, setOpenLog] = useState<Set<number>>(new Set())

    function toggleLog(i: number) {
        setOpenLog(prev => {
            const next = new Set(prev)
            next.has(i) ? next.delete(i) : next.add(i)
            return next
        })
    }

    return (
        <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -24 }} transition={{ duration: 0.3 }}>
            {/* Hero */}
            <div style={{ borderRadius: '20px', overflow: 'hidden', marginBottom: '28px', position: 'relative', height: '220px' }}>
                <img src={hospital.photo} alt={hospital.name} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', position: 'absolute', inset: 0, display: 'block' }} />
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)' }} />
                <button onClick={onBack} style={{ position: 'absolute', top: '16px', left: '16px', zIndex: 2, display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <ArrowLeft size={14} /> Voltar
                </button>
                <div style={{ position: 'absolute', bottom: '20px', left: '24px', zIndex: 1 }}>
                    <div style={{ fontSize: '26px', fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', maxWidth: '500px', lineHeight: 1.2 }}>{hospital.name}</div>
                    <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={13} /> {hospital.city}, {hospital.state}
                        <span style={{ opacity: 0.4 }}>·</span>
                        <Star size={12} fill="#F59E0B" color="#F59E0B" />
                        <span>{hospital.rating.toFixed(1)} ({hospital.reviews} reviews)</span>
                    </div>
                </div>
            </div>

            {/* CTA */}
            <div style={{ background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)', border: '1px solid #DBEAFE', borderRadius: '16px', padding: '20px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', marginBottom: '4px' }}>Adicionar ao Meu Intercâmbio</div>
                    <p style={{ fontSize: '13px', color: '#64748B', margin: 0 }}>Salve este hospital como alvo e acompanhe seus documentos e datas.</p>
                </div>
                <button style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '11px 22px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563EB, #7C3AED)', border: 'none', color: '#fff', fontSize: '14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    <Plus size={15} /> Adicionar Hospital
                </button>
            </div>

            {/* C1% Flix */}
            <SectionLabel label="C1% Flix — Diários de Intercâmbio" />
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '28px', scrollbarWidth: 'none' }}>
                {hospital.flix.map((v, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.07 }}
                        whileHover={{ scale: 1.03 }}
                        style={{ flexShrink: 0, width: '200px', borderRadius: '14px', overflow: 'hidden', border: '1px solid #E2E8F0', cursor: 'pointer', background: '#fff' }}
                    >
                        <div style={{ height: '120px', background: v.gradient, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(255,255,255,0.3)' }}>
                                <Play size={15} fill="#fff" color="#fff" style={{ marginLeft: '2px' }} />
                            </div>
                            <div style={{ position: 'absolute', bottom: '8px', right: '10px', fontSize: '11px', padding: '2px 7px', borderRadius: '6px', background: 'rgba(0,0,0,0.55)', color: '#fff', fontWeight: 600 }}>
                                {v.duration}
                            </div>
                        </div>
                        <div style={{ padding: '12px 14px' }}>
                            <div style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A', lineHeight: 1.3, marginBottom: '4px' }}>{v.title}</div>
                            <div style={{ fontSize: '11px', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <Users size={10} /> {v.author}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Review Médico */}
            <SectionLabel label="Review Médico" />
            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '16px', padding: '22px 24px', marginBottom: '28px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                    <MetricBar label="Experiência Hands-on" value={hospital.handsOn} color="#059669" />
                    <MetricBar label="Qualidade do Preceptor" value={hospital.preceptorRating} color="#2563EB" />
                    <MetricBar label="Satisfação Geral" value={Math.round((hospital.handsOn + hospital.preceptorRating) / 2)} color="#7C3AED" />
                    <MetricBar label="Recomendaria" value={Math.round(hospital.rating / 5 * 100)} color="#D97706" />
                </div>
                <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Star size={14} fill="#F59E0B" color="#F59E0B" />
                    <span style={{ fontSize: '22px', fontWeight: 900, color: '#0F172A' }}>{hospital.rating.toFixed(1)}</span>
                    <span style={{ fontSize: '13px', color: '#64748B' }}>nota média · baseado em {hospital.reviews} avaliações de ex-intercambistas</span>
                </div>
            </div>

            {/* Logística Hospitalar */}
            <SectionLabel label="Logística Hospitalar" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {hospital.logistica.map((item, i) => (
                    <div key={i} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '14px', overflow: 'hidden' }}>
                        <button
                            onClick={() => toggleLog(i)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'none', border: 'none', color: '#0F172A', fontSize: '14px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', gap: '12px' }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <item.icon size={16} color="#2563EB" />
                                {item.title}
                            </div>
                            <motion.div animate={{ rotate: openLog.has(i) ? 180 : 0 }} transition={{ duration: 0.2 }}>
                                <ChevronDown size={16} color="#94A3B8" />
                            </motion.div>
                        </button>
                        <AnimatePresence>
                            {openLog.has(i) && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.25 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <div style={{ padding: '0 20px 18px 46px', fontSize: '13px', color: '#64748B', lineHeight: 1.7 }}>
                                        {item.content}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                ))}
            </div>
        </motion.div>
    )
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
    return (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#94A3B8', whiteSpace: 'nowrap' }}>{label}</span>
            <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
        </div>
    )
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '12px', color: '#64748B' }}>{label}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color }}>{value}%</span>
            </div>
            <div style={{ height: '6px', borderRadius: '4px', background: '#F1F5F9', overflow: 'hidden' }}>
                <motion.div initial={{ width: 0 }} animate={{ width: `${value}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} style={{ height: '100%', borderRadius: '4px', background: color }} />
            </div>
        </div>
    )
}

// ─── Main ──────────────────────────────────────────────────────────────────────

type Tab = 'cidade' | 'hospital'

export default function ExploreDestinos() {
    const [activeTab, setActiveTab] = useState<Tab>('cidade')
    const [selectedCity, setSelectedCity] = useState<City | null>(null)
    const [selectedHospital, setSelectedHospital] = useState<Hospital | null>(null)

    const isDetail = selectedCity !== null || selectedHospital !== null

    function handleTabChange(tab: Tab) {
        setActiveTab(tab)
        setSelectedCity(null)
        setSelectedHospital(null)
    }

    return (
        <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: 'Manrope, system-ui, sans-serif' }}>
            <Header variant="app" />

            <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '40px 24px 80px' }}>

                {/* C1 Tab bar */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '28px' }}>
                    <C1TabBar active="hub" />
                </div>

                {/* Page title */}
                {!isDetail && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: '32px' }}>
                        <h1 style={{ fontSize: '28px', fontWeight: 800, color: '#0F172A', letterSpacing: '-0.025em', marginBottom: '6px' }}>
                            Explorar Destinos
                        </h1>
                        <p style={{ fontSize: '14px', color: '#64748B', lineHeight: 1.7, maxWidth: '480px' }}>
                            Descubra cidades e hospitais recomendados para intercâmbio médico nos EUA.
                        </p>
                    </motion.div>
                )}

                {/* Inner tab toggle */}
                {!isDetail && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '28px', background: '#F1F5F9', padding: '5px', borderRadius: '12px', width: 'fit-content', border: '1px solid #E2E8F0' }}>
                        {(['cidade', 'hospital'] as Tab[]).map(tab => (
                            <button
                                key={tab}
                                onClick={() => handleTabChange(tab)}
                                style={{
                                    padding: '8px 20px', borderRadius: '9px', border: 'none', cursor: 'pointer',
                                    fontSize: '13px', fontWeight: 600, fontFamily: 'inherit',
                                    display: 'flex', alignItems: 'center', gap: '7px',
                                    background: activeTab === tab ? '#fff' : 'transparent',
                                    color: activeTab === tab ? '#2563EB' : '#94A3B8',
                                    boxShadow: activeTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {tab === 'cidade' ? <><MapPin size={14} /> Por Cidade</> : <><Building2 size={14} /> Por Hospital</>}
                            </button>
                        ))}
                    </div>
                )}

                {/* Content */}
                <AnimatePresence mode="wait">
                    {selectedCity ? (
                        <CityDetail key="city-detail" city={selectedCity} onBack={() => setSelectedCity(null)} />
                    ) : selectedHospital ? (
                        <HospitalDetail key="hospital-detail" hospital={selectedHospital} onBack={() => setSelectedHospital(null)} />
                    ) : activeTab === 'cidade' ? (
                        <motion.div key="city-gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <CityGallery onSelect={setSelectedCity} />
                        </motion.div>
                    ) : (
                        <motion.div key="hospital-gallery" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
                            <HospitalGallery onSelect={setSelectedHospital} />
                        </motion.div>
                    )}
                </AnimatePresence>

            </main>
        </div>
    )
}
