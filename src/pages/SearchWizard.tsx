import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { X, ArrowRight, Search, Tag, Wallet, Plane, Minus, Plus, Check, Zap, Shield, Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isAfter, isBefore, isToday, startOfDay, getDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// ─── Inline date picker just for the wizard ───────────────────────────────────
const DAYS_PT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

function parseYMD(s: string): Date | null {
    if (!s) return null
    const [y, m, d] = s.split('-').map(Number)
    return new Date(y, m - 1, d)
}
function toYMD(d: Date) { return format(d, 'yyyy-MM-dd') }
function fmtPt(s: string) {
    const d = parseYMD(s)
    return d ? format(d, "d 'de' MMM yyyy", { locale: ptBR }) : ''
}

function WizardDatePicker({ dateGo, dateReturn, tripType, onDateGoChange, onDateReturnChange }: {
    dateGo: string; dateReturn: string
    tripType: 'one-way' | 'round-trip'
    onDateGoChange: (v: string) => void
    onDateReturnChange: (v: string) => void
}) {
    const today = startOfDay(new Date())
    const [viewMonth, setViewMonth] = useState(startOfMonth(parseYMD(dateGo) || today))

    const days = eachDayOfInterval({ start: startOfMonth(viewMonth), end: endOfMonth(viewMonth) })
    const startPad = getDay(startOfMonth(viewMonth))
    const selGo = parseYMD(dateGo)
    const selRet = parseYMD(dateReturn)

    // What to select next: ida first, then volta
    const phase: 'go' | 'return' = (!dateGo || (dateGo && dateReturn)) ? 'go' : 'return'

    function handleDay(d: Date) {
        if (isBefore(d, today)) return
        if (phase === 'go') {
            onDateGoChange(toYMD(d))
            onDateReturnChange('')
        } else {
            // return date must be after go
            if (selGo && (isBefore(d, selGo) || isSameDay(d, selGo))) {
                // clicked before go → reset go
                onDateGoChange(toYMD(d))
                onDateReturnChange('')
            } else {
                onDateReturnChange(toYMD(d))
            }
        }
    }

    function isInRange(d: Date) {
        if (!selGo || !selRet) return false
        return (isAfter(d, selGo) || isSameDay(d, selGo)) && (isBefore(d, selRet) || isSameDay(d, selRet))
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Selected dates display */}
            <div style={{ display: 'flex', gap: 8 }}>
                <div style={{
                    flex: 1, padding: '10px 14px', borderRadius: 12,
                    border: `2px solid ${phase === 'go' ? '#2A60C2' : '#e2e8f0'}`,
                    background: phase === 'go' ? '#EEF4FF' : '#fff',
                    cursor: 'pointer', transition: 'all 0.15s',
                }} onClick={() => { onDateGoChange(''); onDateReturnChange('') }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Ida</div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: dateGo ? '#0E2A55' : '#CBD5E1' }}>
                        {fmtPt(dateGo) || 'Selecione'}
                    </div>
                </div>
                {tripType !== 'one-way' && (
                    <div style={{
                        flex: 1, padding: '10px 14px', borderRadius: 12,
                        border: `2px solid ${phase === 'return' ? '#2A60C2' : '#e2e8f0'}`,
                        background: phase === 'return' ? '#EEF4FF' : '#fff',
                        transition: 'all 0.15s',
                    }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Volta</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: dateReturn ? '#0E2A55' : '#CBD5E1' }}>
                            {fmtPt(dateReturn) || (dateGo ? 'Selecione' : '—')}
                        </div>
                    </div>
                )}
            </div>

            {/* Hint */}
            <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                {!dateGo ? 'Selecione a data de ida' : tripType !== 'one-way' && !dateReturn ? 'Agora selecione a data de volta' : '✓ Datas selecionadas'}
            </p>

            {/* Calendar */}
            <div style={{ background: '#fff', border: '1px solid #D4E2F4', borderRadius: 16, padding: '16px 20px' }}>
                {/* Month nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <button type="button" onClick={() => setViewMonth(v => subMonths(v, 1))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronLeft size={16} color="#64748B" />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0E2A55', textTransform: 'capitalize' }}>
                        {format(viewMonth, 'MMMM yyyy', { locale: ptBR })}
                    </span>
                    <button type="button" onClick={() => setViewMonth(v => addMonths(v, 1))}
                        style={{ width: 32, height: 32, borderRadius: 8, border: 'none', background: '#F1F5F9', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <ChevronRight size={16} color="#64748B" />
                    </button>
                </div>

                {/* Day labels */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
                    {DAYS_PT.map(d => (
                        <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#94A3B8', paddingBottom: 4 }}>{d}</div>
                    ))}
                </div>

                {/* Days */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
                    {Array.from({ length: startPad }).map((_, i) => <div key={`p${i}`} />)}
                    {days.map(day => {
                        const isPast = isBefore(day, today)
                        const isGo = selGo ? isSameDay(day, selGo) : false
                        const isRet = selRet ? isSameDay(day, selRet) : false
                        const inRange = isInRange(day)
                        const isT = isToday(day)
                        const dow = getDay(day)

                        let bg = 'transparent'
                        let color = '#1E293B'
                        let borderRadius = '10px'

                        if (isGo || isRet) {
                            bg = '#2A60C2'; color = '#fff'
                            borderRadius = isGo && isRet ? '10px' : isGo ? '10px 0 0 10px' : '0 10px 10px 0'
                        } else if (inRange) {
                            bg = '#EEF4FF'; color = '#2A60C2'; borderRadius = dow === 0 ? '10px 0 0 10px' : dow === 6 ? '0 10px 10px 0' : '0'
                        }

                        return (
                            <button key={day.toISOString()} type="button"
                                disabled={isPast}
                                onClick={() => handleDay(day)}
                                style={{
                                    padding: 0, border: 'none', background: 'none',
                                    cursor: isPast ? 'default' : 'pointer',
                                }}>
                                <div style={{
                                    margin: '1px 0',
                                    background: inRange && !isGo && !isRet ? '#EEF4FF' : 'transparent',
                                    borderRadius: inRange && !isGo && !isRet ? (dow === 0 ? '10px 0 0 10px' : dow === 6 ? '0 10px 10px 0' : '0') : undefined,
                                }}>
                                    <div style={{
                                        height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        borderRadius, background: bg, color,
                                        fontSize: 13, fontWeight: isGo || isRet ? 700 : 500,
                                        opacity: isPast ? 0.3 : 1,
                                        ...(isT && !isGo && !isRet ? { outline: '1.5px solid #2A60C2', outlineOffset: '-1px', borderRadius: '10px' } : {}),
                                        transition: 'background 0.1s',
                                    }}>
                                        {format(day, 'd')}
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

// ─── Month picker for the wizard ──────────────────────────────────────────────
const MONTHS_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
const MONTHS_FULL_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function fmtMonth(ym: string) {
    if (!ym) return ''
    const [y, m] = ym.split('-').map(Number)
    return `${MONTHS_FULL_PT[m - 1]} ${y}`
}

function WizardMonthPicker({ selected, onSelect }: {
    selected: string
    onSelect: (v: string) => void
}) {
    const now = new Date()
    const [viewYear, setViewYear] = useState(now.getFullYear())
    const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Selected month display */}
            <div style={{
                padding: '10px 14px', borderRadius: 12,
                border: `2px solid ${selected ? '#2A60C2' : '#e2e8f0'}`,
                background: selected ? '#EEF4FF' : '#fff',
            }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 2 }}>Mês selecionado</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: selected ? '#0E2A55' : '#CBD5E1' }}>
                    {fmtMonth(selected) || 'Selecione um mês'}
                </div>
            </div>

            {/* Month grid */}
            <div style={{ background: '#fff', border: '1px solid #D4E2F4', borderRadius: 16, padding: '16px 20px' }}>
                {/* Year nav */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <button type="button" onClick={() => setViewYear(y => y - 1)}
                        disabled={viewYear <= now.getFullYear()}
                        style={{
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            background: '#F1F5F9', cursor: viewYear <= now.getFullYear() ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: viewYear <= now.getFullYear() ? 0.3 : 1,
                        }}>
                        <ChevronLeft size={16} color="#64748B" />
                    </button>
                    <span style={{ fontSize: 15, fontWeight: 700, color: '#0E2A55' }}>{viewYear}</span>
                    <button type="button" onClick={() => setViewYear(y => y + 1)}
                        disabled={viewYear >= now.getFullYear() + 2}
                        style={{
                            width: 32, height: 32, borderRadius: 8, border: 'none',
                            background: '#F1F5F9', cursor: viewYear >= now.getFullYear() + 2 ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: viewYear >= now.getFullYear() + 2 ? 0.3 : 1,
                        }}>
                        <ChevronRight size={16} color="#64748B" />
                    </button>
                </div>

                {/* Months grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                    {MONTHS_PT.map((label, idx) => {
                        const ym = `${viewYear}-${String(idx + 1).padStart(2, '0')}`
                        const isPast = ym < currentYM
                        const isSel = ym === selected

                        return (
                            <button key={ym} type="button"
                                disabled={isPast}
                                onClick={() => !isPast && onSelect(ym)}
                                style={{
                                    padding: '10px 6px', borderRadius: 10, border: 'none',
                                    fontFamily: 'inherit', fontSize: 13, fontWeight: isSel ? 700 : 500,
                                    cursor: isPast ? 'default' : 'pointer',
                                    opacity: isPast ? 0.3 : 1,
                                    background: isSel ? '#2A60C2' : 'transparent',
                                    color: isSel ? '#fff' : '#1E293B',
                                    transition: 'background 0.1s',
                                }}>
                                {label}
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

const CABIN_CLASSES = [
    { id: 'economy', label: 'Econômica', desc: 'Melhor custo-benefício' },
    { id: 'premium_economy', label: 'Premium Economy', desc: 'Mais espaço e conforto' },
    { id: 'business', label: 'Executiva', desc: 'Flat bed e lounges' },
    { id: 'first', label: 'Primeira Classe', desc: 'Experiência máxima' },
]

const HACKER_MODES = [
    {
        id: 'comfort',
        icon: <Shield className="w-6 h-6" />,
        label: 'Conforto',
        desc: 'Voo direto, sem conexões longas. Prioridade na experiência.',
    },
    {
        id: 'value',
        icon: <Sparkles className="w-6 h-6" />,
        label: 'Melhor Custo-Benefício',
        desc: 'Conexões inteligentes e programas de pontos otimizados.',
    },
    {
        id: 'hacker',
        icon: <Zap className="w-6 h-6" />,
        label: 'Estratégia Avançada',
        desc: 'Rotas divididas em reservas separadas para máxima economia de milhas.',
    },
]

type WizardData = {
    destination: string
    origin: string
    flexibleOrigin: boolean
    tripType: 'one-way' | 'round-trip'
    dateMode: 'specific-date' | 'specific-month' | null
    dateGo: string
    dateReturn: string
    passengers: number
    cabinClass: string
    hackerMode: 'comfort' | 'value' | 'hacker'
    observations: string
}

const TOTAL_STEPS = 5

const NAV_ITEMS = [
    { to: '/home', icon: <Search size={16} strokeWidth={2.5} />, label: 'Buscar' },
    { to: '/promotions', icon: <Tag size={16} strokeWidth={2.5} />, label: 'Promoções' },
    { to: '/wallet', icon: <Wallet size={16} strokeWidth={2.5} />, label: 'Carteira' },
    { to: '/saved-strategies', icon: <Plane size={16} strokeWidth={2.5} />, label: 'Estratégias' },
]

export default function SearchWizard() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user } = useAuth()
    const [step, setStep] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState('')
    const [data, setData] = useState<WizardData>({
        destination: '',
        origin: 'São Paulo (Todas)',
        flexibleOrigin: true,
        tripType: 'round-trip',
        dateMode: null,
        dateGo: '',
        dateReturn: '',
        passengers: 1,
        cabinClass: 'economy',
        hackerMode: 'value',
        observations: '',
    })

    const nextStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS))
    const prevStep = () => setStep(s => Math.max(s - 1, 1))

    const handleFinish = async () => {
        if (!user) return
        setSubmitting(true)
        setSubmitError('')
        try {
            const title = `${data.origin.split('(')[0].trim()} → ${data.destination}`

            const { data: conv, error } = await supabase
                .from('chat_conversations')
                .insert({
                    user_id: user.id,
                    title,
                    wizard_data: data,
                    messages: [],
                })
                .select()
                .single()

            if (error) throw error
            if (!conv?.id) throw new Error('Conversa não foi criada. Tente novamente.')

            navigate(`/chat/${conv.id}`)
        } catch (err: unknown) {
            const msg = err instanceof Error
                ? err.message
                : (err as any)?.message ?? JSON.stringify(err)
            setSubmitError(msg || 'Erro desconhecido')
            setSubmitting(false)
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (step === 1 && data.destination.trim()) nextStep()
            if (step === 2 && data.origin.trim()) nextStep()
        }
    }

    const variants = {
        initial: { y: 40, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -40, opacity: 0 },
    }

    const nextDisabled =
        (step === 1 && !data.destination.trim()) ||
        (step === 2 && !data.origin.trim()) ||
        (step === 3 && (!data.dateMode || !data.dateGo))

    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans relative overflow-hidden" style={{ overflowX: 'hidden' }}>
            <style>{`
                @media (max-width: 768px) {
                    .sw-nav { display: none !important; }
                    .sw-header-grid { grid-template-columns: auto 1fr auto !important; height: 60px !important; }
                    .sw-main { padding-top: 24px !important; padding-bottom: 100px !important; }
                    .sw-finish-actions { flex-direction: column-reverse !important; gap: 10px !important; }
                    .sw-finish-actions button { width: 100% !important; justify-content: center !important; }
                }
            `}</style>
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4a90e2]/6 blur-[140px] rounded-full" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-[#4a90e2]/5 blur-[120px] rounded-full" />
            </div>

            {/* ─── HEADER ─── */}
            <header style={{
                background: 'rgba(255,255,255,0.90)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(14,42,85,0.07)',
                position: 'sticky', top: 0, zIndex: 30,
            }}>
                <div className="sw-header-grid" style={{
                    display: 'grid', gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center', height: '72px',
                    padding: '0 16px', maxWidth: '960px', margin: '0 auto',
                }}>
                    <Link to="/home" style={{ justifySelf: 'start', display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" alt="FlyWise" style={{ height: '56px', objectFit: 'contain' }} />
                    </Link>
                    {user && (
                        <nav className="sw-nav" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'center' }}>
                            {NAV_ITEMS.map(item => {
                                const isActive = location.pathname.startsWith(item.to)
                                return (
                                    <Link key={item.to} to={item.to} title={item.label} style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        width: '38px', height: '38px', borderRadius: '10px',
                                        textDecoration: 'none', transition: 'all 0.2s',
                                        background: isActive ? 'rgba(74,144,226,0.10)' : 'rgba(14,42,85,0.04)',
                                        color: isActive ? '#4a90e2' : 'var(--text-muted)',
                                        border: isActive ? '1.5px solid rgba(74,144,226,0.25)' : '1px solid transparent',
                                    }}>
                                        {item.icon}
                                    </Link>
                                )
                            })}
                        </nav>
                    )}
                    <div style={{ justifySelf: 'end' }}>
                        <button onClick={() => navigate('/home')} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '36px', height: '36px', borderRadius: '50%',
                            border: 'none', background: 'rgba(14,42,85,0.06)',
                            cursor: 'pointer', transition: 'background 0.2s', color: 'var(--text-muted)',
                        }}
                            onMouseEnter={e => e.currentTarget.style.background = 'rgba(14,42,85,0.10)'}
                            onMouseLeave={e => e.currentTarget.style.background = 'rgba(14,42,85,0.06)'}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </header>

            {/* ─── MAIN ─── */}
            <main className="sw-main flex-1 flex flex-col items-center justify-center p-6 z-10" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
                <div className="w-full max-w-xl">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: DESTINATION */}
                        {step === 1 && (
                            <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-8">
                                <StepDots current={step} total={TOTAL_STEPS} />
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight leading-tight">
                                        Para onde você quer <span className="font-semibold text-[#4a90e2]">viajar?</span>
                                    </h1>
                                    <p className="text-slate-400 text-base">Pode ser uma cidade específica, país ou região.</p>
                                </div>
                                <input
                                    type="text" autoFocus
                                    placeholder="Ex: Paris, Europa, Maldivas..."
                                    value={data.destination}
                                    onChange={e => setData({ ...data, destination: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#4a90e2] text-3xl md:text-4xl text-slate-900 py-4 outline-none transition-colors placeholder:text-slate-300 font-light"
                                />
                                <div className="flex justify-end">
                                    <NextBtn disabled={!data.destination.trim()} onClick={nextStep}>Próximo</NextBtn>
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: ORIGIN */}
                        {step === 2 && (
                            <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-8">
                                <StepDots current={step} total={TOTAL_STEPS} />
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight leading-tight">
                                        De onde você vai <span className="font-semibold text-[#4a90e2]">sair?</span>
                                    </h1>
                                    <p className="text-slate-400 text-base">Normalmente o aeroporto mais próximo de você.</p>
                                </div>
                                <input
                                    type="text" autoFocus
                                    placeholder="Ex: São Paulo, GRU..."
                                    value={data.origin}
                                    onChange={e => setData({ ...data, origin: e.target.value })}
                                    onKeyDown={handleKeyDown}
                                    className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#4a90e2] text-3xl md:text-4xl text-slate-900 py-4 outline-none transition-colors placeholder:text-slate-300 font-light"
                                />
                                <ToggleCard
                                    active={data.flexibleOrigin}
                                    onToggle={() => setData({ ...data, flexibleOrigin: !data.flexibleOrigin })}
                                    title="✈️ Aeroportos flexíveis"
                                    desc="Buscar em aeroportos próximos para encontrar tarifas menores"
                                />
                                <WizardNav onBack={prevStep} onNext={nextStep} nextDisabled={!data.origin.trim()} />
                            </motion.div>
                        )}

                        {/* STEP 3: DATES */}
                        {step === 3 && (
                            <motion.div key="step3" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-8">
                                <StepDots current={step} total={TOTAL_STEPS} />
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight leading-tight">
                                        Quando você pretende <span className="font-semibold text-[#4a90e2]">viajar?</span>
                                    </h1>
                                    <p className="text-slate-400 text-base">
                                        {data.dateMode === null ? 'Escolha como prefere informar as datas.' : 'Selecione as datas de ida e volta.'}
                                    </p>
                                </div>

                                {/* Date mode selection */}
                                {data.dateMode === null && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {([
                                            { id: 'specific-date', emoji: '📅', label: 'Data específica', desc: 'Escolha um dia exato no calendário' },
                                            { id: 'specific-month', emoji: '🗓️', label: 'Mês específico', desc: 'Tenho flexibilidade dentro do mês' },
                                        ] as const).map(opt => (
                                            <button key={opt.id}
                                                onClick={() => setData(d => ({ ...d, dateMode: opt.id, dateGo: '', dateReturn: '' }))}
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: 16,
                                                    padding: '20px 24px', borderRadius: '16px',
                                                    border: '1.5px solid #e2e8f0', background: '#fff',
                                                    cursor: 'pointer', textAlign: 'left',
                                                    fontFamily: 'inherit', transition: 'all 0.2s',
                                                    boxShadow: '0 2px 8px rgba(14,42,85,0.04)',
                                                }}
                                                onMouseEnter={e => { e.currentTarget.style.border = '1.5px solid rgba(74,144,226,0.5)'; e.currentTarget.style.background = 'rgba(74,144,226,0.03)' }}
                                                onMouseLeave={e => { e.currentTarget.style.border = '1.5px solid #e2e8f0'; e.currentTarget.style.background = '#fff' }}
                                            >
                                                <div style={{
                                                    width: 52, height: 52, borderRadius: '14px',
                                                    background: 'rgba(74,144,226,0.08)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    fontSize: 24, flexShrink: 0,
                                                }}>
                                                    {opt.emoji}
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <p style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b', margin: 0 }}>{opt.label}</p>
                                                    <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 3 }}>{opt.desc}</p>
                                                </div>
                                                <ArrowRight style={{ width: 18, height: 18, color: '#cbd5e1', flexShrink: 0 }} />
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {/* Specific date picker */}
                                {data.dateMode === 'specific-date' && (
                                    <>
                                        <button onClick={() => setData(d => ({ ...d, dateMode: null, dateGo: '', dateReturn: '' }))}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                fontSize: '13px', fontWeight: 600, color: '#94a3b8',
                                                padding: 0, fontFamily: 'inherit', alignSelf: 'flex-start',
                                                marginTop: -16,
                                            }}>
                                            ← Mudar tipo de data
                                        </button>
                                        {/* Trip type toggle */}
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            {(['round-trip', 'one-way'] as const).map(type => (
                                                <button key={type}
                                                    onClick={() => setData({ ...data, tripType: type, dateReturn: type === 'one-way' ? '' : data.dateReturn })}
                                                    style={{
                                                        padding: '8px 18px', borderRadius: '10px', border: 'none',
                                                        fontFamily: 'inherit', fontSize: '14px', fontWeight: 600,
                                                        cursor: 'pointer', transition: 'all 0.2s',
                                                        background: data.tripType === type ? '#4a90e2' : 'rgba(14,42,85,0.06)',
                                                        color: data.tripType === type ? '#fff' : '#64748b',
                                                    }}
                                                >
                                                    {type === 'round-trip' ? 'Ida e Volta' : 'Só Ida'}
                                                </button>
                                            ))}
                                        </div>
                                        <WizardDatePicker
                                            dateGo={data.dateGo}
                                            dateReturn={data.dateReturn}
                                            tripType={data.tripType}
                                            onDateGoChange={v => setData(d => ({ ...d, dateGo: v }))}
                                            onDateReturnChange={v => setData(d => ({ ...d, dateReturn: v }))}
                                        />
                                    </>
                                )}

                                {/* Specific month picker */}
                                {data.dateMode === 'specific-month' && (
                                    <>
                                        <button onClick={() => setData(d => ({ ...d, dateMode: null, dateGo: '', dateReturn: '' }))}
                                            style={{
                                                display: 'inline-flex', alignItems: 'center', gap: 6,
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                fontSize: '13px', fontWeight: 600, color: '#94a3b8',
                                                padding: 0, fontFamily: 'inherit', alignSelf: 'flex-start',
                                                marginTop: -16,
                                            }}>
                                            ← Mudar tipo de data
                                        </button>
                                        <WizardMonthPicker
                                            selected={data.dateGo}
                                            onSelect={v => setData(d => ({ ...d, dateGo: v, dateReturn: '' }))}
                                        />
                                    </>
                                )}

                                {data.dateMode !== null && (
                                    <WizardNav onBack={prevStep} onNext={nextStep} nextDisabled={nextDisabled} />
                                )}
                                {data.dateMode === null && (
                                    <div className="flex justify-start">
                                        <BackBtn onClick={prevStep} />
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {/* STEP 4: PASSENGERS & CABIN */}
                        {step === 4 && (
                            <motion.div key="step4" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-8">
                                <StepDots current={step} total={TOTAL_STEPS} />
                                <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight leading-tight">
                                    Quem vai <span className="font-semibold text-[#4a90e2]">viajar?</span>
                                </h1>

                                {/* Passenger counter */}
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '20px 24px', borderRadius: '16px',
                                    border: '1.5px solid rgba(74,144,226,0.25)',
                                    background: 'rgba(74,144,226,0.04)',
                                }}>
                                    <div>
                                        <p style={{ fontWeight: 700, fontSize: '16px', color: '#1e293b', margin: 0 }}>Passageiros</p>
                                        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 3 }}>Adultos (acima de 12 anos)</p>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <button
                                            onClick={() => setData(d => ({ ...d, passengers: Math.max(1, d.passengers - 1) }))}
                                            disabled={data.passengers <= 1}
                                            style={{
                                                width: 40, height: 40, borderRadius: '12px',
                                                border: '1.5px solid #e2e8f0', background: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: data.passengers <= 1 ? 'not-allowed' : 'pointer',
                                                opacity: data.passengers <= 1 ? 0.3 : 1,
                                                color: '#4a90e2', transition: 'all 0.15s',
                                            }}>
                                            <Minus style={{ width: 16, height: 16 }} />
                                        </button>
                                        <span style={{ fontSize: '28px', fontWeight: 700, color: '#0E2A55', width: 36, textAlign: 'center' }}>{data.passengers}</span>
                                        <button
                                            onClick={() => setData(d => ({ ...d, passengers: Math.min(9, d.passengers + 1) }))}
                                            disabled={data.passengers >= 9}
                                            style={{
                                                width: 40, height: 40, borderRadius: '12px',
                                                border: '1.5px solid #e2e8f0', background: '#fff',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                cursor: data.passengers >= 9 ? 'not-allowed' : 'pointer',
                                                opacity: data.passengers >= 9 ? 0.3 : 1,
                                                color: '#4a90e2', transition: 'all 0.15s',
                                            }}>
                                            <Plus style={{ width: 16, height: 16 }} />
                                        </button>
                                    </div>
                                </div>

                                {/* Cabin class */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Classe da cabine</p>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {CABIN_CLASSES.map(c => {
                                            const sel = data.cabinClass === c.id
                                            return (
                                                <button key={c.id} onClick={() => setData({ ...data, cabinClass: c.id })}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 16,
                                                        padding: '16px 20px', borderRadius: '14px',
                                                        border: `1.5px solid ${sel ? 'rgba(74,144,226,0.6)' : '#e2e8f0'}`,
                                                        background: sel ? 'rgba(74,144,226,0.05)' : '#fff',
                                                        cursor: 'pointer', textAlign: 'left',
                                                        transition: 'all 0.2s', fontFamily: 'inherit',
                                                        boxShadow: sel ? '0 4px 16px rgba(74,144,226,0.10)' : 'none',
                                                    }}>
                                                    <div style={{
                                                        width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                                                        border: `2px solid ${sel ? '#4a90e2' : '#cbd5e1'}`,
                                                        background: sel ? '#4a90e2' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 0.2s',
                                                    }}>
                                                        {sel && <Check style={{ width: 11, height: 11, color: '#fff' }} />}
                                                    </div>
                                                    <div style={{ flex: 1 }}>
                                                        <p style={{ fontWeight: 700, fontSize: '15px', color: sel ? '#4a90e2' : '#1e293b', margin: 0 }}>{c.label}</p>
                                                        <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: 2 }}>{c.desc}</p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <WizardNav onBack={prevStep} onNext={nextStep} nextDisabled={false} />
                            </motion.div>
                        )}

                        {/* STEP 5: STRATEGY + OBSERVATIONS */}
                        {step === 5 && (
                            <motion.div key="step5" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-8">
                                <StepDots current={step} total={TOTAL_STEPS} />
                                <div className="flex flex-col gap-3">
                                    <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight leading-tight">
                                        Qual é a sua <span className="font-semibold text-[#4a90e2]">estratégia?</span>
                                    </h1>
                                    <p className="text-slate-400 text-base">Escolha o perfil e diga tudo o que a IA precisa saber.</p>
                                </div>

                                <div className="flex flex-col gap-3">
                                    {HACKER_MODES.map(m => {
                                        const sel = data.hackerMode === m.id
                                        return (
                                            <button key={m.id}
                                                onClick={() => setData({ ...data, hackerMode: m.id as any })}
                                                className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${sel ? 'border-[#4a90e2] bg-[#4a90e2]/5 shadow-[0_8px_24px_rgba(74,144,226,0.12)]' : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${sel ? 'bg-[#4a90e2] text-white' : 'bg-slate-100 text-slate-400'}`}>
                                                    {m.icon}
                                                </div>
                                                <div className="flex-1">
                                                    <p className={`font-semibold text-base ${sel ? 'text-[#4a90e2]' : 'text-slate-800'}`}>{m.label}</p>
                                                    <p className="text-sm text-slate-500 mt-0.5 leading-relaxed">{m.desc}</p>
                                                </div>
                                                <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${sel ? 'border-[#4a90e2] bg-[#4a90e2]' : 'border-slate-300'}`}>
                                                    {sel && <Check className="w-3 h-3 text-white" />}
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>

                                {/* Observations */}
                                <div className="flex flex-col gap-2">
                                    <label style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                        Observações e pedidos <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(opcional)</span>
                                    </label>
                                    <textarea
                                        rows={4}
                                        placeholder="Descreva suas preferências, restrições ou detalhes importantes para a IA considerar na análise..."
                                        value={data.observations}
                                        onChange={e => setData({ ...data, observations: e.target.value })}
                                        style={{
                                            width: '100%', padding: '14px 16px', borderRadius: '14px',
                                            border: '2px solid #e2e8f0', fontFamily: 'inherit',
                                            fontSize: '14px', color: '#1e293b', lineHeight: 1.6,
                                            resize: 'vertical', outline: 'none', transition: 'border-color 0.2s',
                                            background: '#fafafa', boxSizing: 'border-box',
                                        }}
                                        onFocus={e => e.currentTarget.style.borderColor = '#4a90e2'}
                                        onBlur={e => e.currentTarget.style.borderColor = '#e2e8f0'}
                                    />
                                    <p style={{ fontSize: '12px', color: '#94a3b8' }}>
                                        Quanto mais detalhar, mais precisa será a análise da IA.
                                    </p>
                                </div>

                                {submitError && (
                                    <p className="text-sm text-red-500 font-medium">{submitError}</p>
                                )}
                                <div className="sw-finish-actions flex justify-between items-center mt-4">
                                    <BackBtn onClick={prevStep} />
                                    <button
                                        onClick={handleFinish}
                                        disabled={submitting}
                                        style={{
                                            display: 'inline-flex', alignItems: 'center', gap: '8px',
                                            padding: '14px 28px', borderRadius: '14px',
                                            fontSize: '15px', fontWeight: 600, color: '#fff',
                                            background: submitting ? '#94a3b8' : '#4a90e2',
                                            border: 'none', cursor: submitting ? 'not-allowed' : 'pointer',
                                            boxShadow: submitting ? 'none' : '0 4px 14px rgba(74,144,226,0.35)',
                                            transition: 'all 0.18s ease', fontFamily: 'inherit',
                                        }}
                                        onMouseEnter={e => { if (!submitting) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(74,144,226,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
                                        onMouseLeave={e => { e.currentTarget.style.boxShadow = submitting ? 'none' : '0 4px 14px rgba(74,144,226,0.35)'; e.currentTarget.style.transform = 'none' }}
                                    >
                                        {submitting ? (
                                            <><Loader2 style={{ width: 16, height: 16 }} className="animate-spin" /> Criando busca...</>
                                        ) : (
                                            <>Fazer Busca com IA <ArrowRight style={{ width: 16, height: 16, flexShrink: 0 }} /></>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </main>
        </div>
    )
}

function StepDots({ current, total }: { current: number; total: number }) {
    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                {Array.from({ length: total }).map((_, i) => {
                    const done = i + 1 < current
                    const active = i + 1 === current
                    return (
                        <motion.div key={i}
                            animate={{ width: active ? 28 : 8, opacity: done ? 0.45 : active ? 1 : 0.2 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                            style={{ height: 8, borderRadius: 999, background: '#4a90e2', flexShrink: 0 }}
                        />
                    )
                })}
            </div>
            <p className="text-xs font-semibold text-slate-400 tracking-wide">{current} de {total}</p>
        </div>
    )
}

function NextBtn({ onClick, disabled, children }: { onClick: () => void; disabled: boolean; children: React.ReactNode }) {
    return (
        <button onClick={onClick} disabled={disabled} style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 28px', borderRadius: '14px',
            fontSize: '15px', fontWeight: 600, color: '#fff', background: '#4a90e2',
            border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.4 : 1,
            boxShadow: disabled ? 'none' : '0 4px 14px rgba(74,144,226,0.35)',
            transition: 'all 0.18s ease',
        }}
            onMouseEnter={e => { if (!disabled) { e.currentTarget.style.boxShadow = '0 6px 20px rgba(74,144,226,0.45)'; e.currentTarget.style.transform = 'translateY(-1px)' } }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = disabled ? 'none' : '0 4px 14px rgba(74,144,226,0.35)'; e.currentTarget.style.transform = 'none' }}
        >
            {children}
            <ArrowRight style={{ width: 16, height: 16, flexShrink: 0 }} />
        </button>
    )
}

function BackBtn({ onClick }: { onClick: () => void }) {
    return (
        <button onClick={onClick} style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '14px 20px', borderRadius: '14px', fontSize: '15px', fontWeight: 500,
            color: '#94a3b8', background: 'transparent', border: '1.5px solid #e2e8f0',
            cursor: 'pointer', transition: 'all 0.18s ease',
        }}
            onMouseEnter={e => { e.currentTarget.style.color = '#475569'; e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = '#f8fafc' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#94a3b8'; e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.background = 'transparent' }}
        >
            ← Voltar
        </button>
    )
}

function WizardNav({ onBack, onNext, nextDisabled }: { onBack: () => void; onNext: () => void; nextDisabled: boolean }) {
    return (
        <div className="flex justify-between items-center mt-2">
            <BackBtn onClick={onBack} />
            <NextBtn onClick={onNext} disabled={nextDisabled}>Próximo</NextBtn>
        </div>
    )
}

function ToggleCard({ active, onToggle, title, desc }: { active: boolean; onToggle: () => void; title: string; desc: string }) {
    return (
        <div onClick={onToggle} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px', borderRadius: '16px',
            border: active ? '1.5px solid rgba(74,144,226,0.6)' : '1.5px solid #e2e8f0',
            background: active ? 'rgba(74,144,226,0.05)' : '#fafafa',
            cursor: 'pointer', transition: 'all 0.2s', gap: '16px',
        }}>
            <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 600, fontSize: '15px', color: active ? '#4a90e2' : '#1e293b', margin: 0 }}>{title}</p>
                <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '3px' }}>{desc}</p>
            </div>
            <div style={{
                width: 44, height: 26, borderRadius: 999, background: active ? '#4a90e2' : '#cbd5e1',
                padding: 3, flexShrink: 0, transition: 'background 0.25s', position: 'relative',
            }}>
                <motion.div
                    style={{ width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.18)' }}
                    animate={{ x: active ? 18 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
            </div>
        </div>
    )
}
