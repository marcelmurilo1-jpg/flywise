import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import { X, ArrowRight, Search, Tag, Wallet, Plane, Minus, Plus, Check, Zap, Shield, Sparkles, Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { generateMockFlights } from '@/lib/mockFlights'

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

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
        label: 'Modo Hacker 🔥',
        desc: 'Rotas divididas em 2 reservas separadas para máxima economia.',
    },
]

type WizardData = {
    destination: string
    origin: string
    flexibleOrigin: boolean
    dateMode: 'exact' | 'month' | 'any'
    hackerMode: 'comfort' | 'value' | 'hacker'
    dateGo: string
    dateReturn: string
    selectedMonths: number[]
    passengers: number
    cabinClass: string
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
        dateMode: 'exact',
        hackerMode: 'value',
        dateGo: '',
        dateReturn: '',
        selectedMonths: [],
        passengers: 1,
        cabinClass: 'economy',
    })

    const nextStep = () => setStep(s => Math.min(s + 1, TOTAL_STEPS))
    const prevStep = () => setStep(s => Math.max(s - 1, 1))

    const handleFinish = async () => {
        if (!user) return
        setSubmitting(true)
        setSubmitError('')
        try {
            // Determine the date to use
            const dateGoFinal = data.dateMode === 'exact' ? data.dateGo
                : data.dateMode === 'month' && data.selectedMonths.length > 0
                    ? `${new Date().getFullYear()}-${String(data.selectedMonths[0] + 1).padStart(2, '0')}-01`
                    : new Date().toISOString().split('T')[0]

            const { data: buscaData, error: buscaErr } = await supabase
                .from('buscas')
                .insert({
                    user_id: user.id,
                    origem: data.origin,
                    destino: data.destination,
                    data_ida: dateGoFinal,
                    passageiros: data.passengers,
                    bagagem: 'sem_bagagem',
                    user_miles: {},
                })
                .select()
                .single()

            if (buscaErr) throw buscaErr

            const mocks = generateMockFlights(data.origin, data.destination, dateGoFinal, data.passengers, {})
            const voosToInsert = mocks.map(m => ({ ...m, busca_id: buscaData.id, user_id: user.id }))
            await supabase.from('resultados_voos').insert(voosToInsert)

            navigate(`/resultados?buscaId=${buscaData.id}`)
        } catch (err: unknown) {
            setSubmitError(err instanceof Error ? err.message : 'Erro ao processar.')
            setSubmitting(false)
        }
    }

    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            if (step === 1 && data.destination.trim()) nextStep()
            if (step === 2 && data.origin.trim()) nextStep()
        }
    }

    const toggleMonth = (idx: number) => {
        setData(d => ({
            ...d,
            selectedMonths: d.selectedMonths.includes(idx)
                ? d.selectedMonths.filter(m => m !== idx)
                : [...d.selectedMonths, idx],
        }))
    }

    const variants = {
        initial: { y: 40, opacity: 0 },
        animate: { y: 0, opacity: 1 },
        exit: { y: -40, opacity: 0 },
    }


    const nextDisabled =
        (step === 1 && !data.destination.trim()) ||
        (step === 2 && !data.origin.trim()) ||
        (step === 3 && data.dateMode === 'exact' && !data.dateGo) ||
        (step === 3 && data.dateMode === 'month' && data.selectedMonths.length === 0)

    return (
        <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans relative overflow-hidden">
            {/* Subtle background blobs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#4a90e2]/6 blur-[140px] rounded-full" />
                <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] bg-[#4a90e2]/5 blur-[120px] rounded-full" />
            </div>

            {/* ─── HEADER ─── */}
            <header style={{
                background: 'rgba(255,255,255,0.90)',
                backdropFilter: 'blur(12px)',
                borderBottom: '1px solid rgba(14,42,85,0.07)',
                position: 'sticky',
                top: 0,
                zIndex: 30,
            }}>
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr',
                    alignItems: 'center',
                    height: '72px',
                    padding: '0 16px',
                    maxWidth: '960px',
                    margin: '0 auto',
                }}>
                    {/* Logo */}
                    <Link to="/home" style={{ justifySelf: 'start', display: 'flex', alignItems: 'center' }}>
                        <img src="/logo.png" alt="FlyWise" style={{ height: '56px', objectFit: 'contain' }} />
                    </Link>

                    {/* Nav icons */}
                    {user && (
                        <nav style={{ display: 'flex', alignItems: 'center', gap: '8px', justifySelf: 'center' }}>
                            {NAV_ITEMS.map(item => {
                                const isActive = location.pathname.startsWith(item.to)
                                return (
                                    <Link
                                        key={item.to}
                                        to={item.to}
                                        title={item.label}
                                        style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            width: '38px', height: '38px', borderRadius: '10px',
                                            textDecoration: 'none', transition: 'all 0.2s',
                                            background: isActive ? 'rgba(74,144,226,0.10)' : 'rgba(14,42,85,0.04)',
                                            color: isActive ? '#4a90e2' : 'var(--text-muted)',
                                            border: isActive ? '1.5px solid rgba(74,144,226,0.25)' : '1px solid transparent',
                                        }}
                                    >
                                        {item.icon}
                                    </Link>
                                )
                            })}
                        </nav>
                    )}

                    {/* Close */}
                    <div style={{ justifySelf: 'end' }}>
                        <button
                            onClick={() => navigate('/home')}
                            style={{
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
            <main className="flex-1 flex flex-col items-center justify-center p-6 z-10 pt-10 pb-10">
                <div className="w-full max-w-2xl">
                    <AnimatePresence mode="wait">

                        {/* STEP 1: DESTINATION */}
                        {step === 1 && (
                            <motion.div key="step1" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-6">
                                <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight">
                                    Para onde você quer <span className="font-semibold text-[#4a90e2]">viajar?</span>
                                </h1>
                                <p className="text-slate-500 text-lg">Pode ser uma cidade específica, país ou região.</p>
                                <div className="relative">
                                    <input
                                        type="text" autoFocus
                                        placeholder="Ex: Paris, Europa, Maldivas..."
                                        value={data.destination}
                                        onChange={e => setData({ ...data, destination: e.target.value })}
                                        onKeyDown={handleKeyDown}
                                        className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#4a90e2] text-3xl md:text-4xl text-slate-900 py-4 outline-none transition-colors placeholder:text-slate-300 font-light"
                                    />
                                </div>
                                <div className="flex justify-end mt-4">
                                    <WizardNextBtn disabled={!data.destination.trim()} onClick={nextStep} label="Próximo" />
                                </div>
                            </motion.div>
                        )}

                        {/* STEP 2: ORIGIN */}
                        {step === 2 && (
                            <motion.div key="step2" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-6">
                                <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight">
                                    De onde você vai <span className="font-semibold text-[#4a90e2]">sair?</span>
                                </h1>
                                <p className="text-slate-500 text-lg">Normalmente o aeroporto mais próximo de você.</p>
                                <div className="relative">
                                    <input
                                        type="text" autoFocus
                                        placeholder="Ex: São Paulo, GRU..."
                                        value={data.origin}
                                        onChange={e => setData({ ...data, origin: e.target.value })}
                                        onKeyDown={handleKeyDown}
                                        className="w-full bg-transparent border-b-2 border-slate-200 focus:border-[#4a90e2] text-3xl md:text-4xl text-slate-900 py-4 outline-none transition-colors placeholder:text-slate-300 font-light"
                                    />
                                </div>
                                {/* Flexible Toggle */}
                                <div
                                    onClick={() => setData({ ...data, flexibleOrigin: !data.flexibleOrigin })}
                                    className={`mt-2 p-5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all duration-200 ${data.flexibleOrigin ? 'border-[#4a90e2] bg-[#4a90e2]/5' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                                >
                                    <div>
                                        <h3 className="text-slate-800 font-semibold text-base">✈️ Aeroportos flexíveis</h3>
                                        <p className="text-slate-500 text-sm mt-1">Buscar em aeroportos próximos para encontrar tarifas menores</p>
                                    </div>
                                    <div className={`w-12 h-7 rounded-full p-1 transition-colors duration-300 flex-shrink-0 ml-4 ${data.flexibleOrigin ? 'bg-[#4a90e2]' : 'bg-slate-300'}`}>
                                        <motion.div
                                            className="w-5 h-5 bg-white rounded-full shadow"
                                            animate={{ x: data.flexibleOrigin ? 20 : 0 }}
                                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                                        />
                                    </div>
                                </div>
                                <WizardNav onBack={prevStep} onNext={nextStep} nextDisabled={!data.origin.trim()} />
                            </motion.div>
                        )}

                        {/* STEP 3: DATES */}
                        {step === 3 && (
                            <motion.div key="step3" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-6">
                                <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight">
                                    Quando você pretende <span className="font-semibold text-[#4a90e2]">viajar?</span>
                                </h1>
                                <p className="text-slate-500 text-lg">Datas flexíveis podem economizar até 70% no valor das passagens.</p>

                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'exact', label: 'Datas Exatas', emoji: '📅', desc: 'Férias definidas' },
                                        { id: 'month', label: 'Mês Específico', emoji: '🗓️', desc: 'Tenho preferência' },
                                        { id: 'any', label: 'Qualquer Data', emoji: '🌍', desc: 'Maior flexibilidade' },
                                    ].map(opt => (
                                        <OptionCard
                                            key={opt.id}
                                            selected={data.dateMode === opt.id}
                                            onClick={() => setData({ ...data, dateMode: opt.id as any })}
                                            emoji={opt.emoji}
                                            label={opt.label}
                                            desc={opt.desc}
                                        />
                                    ))}
                                </div>

                                <AnimatePresence mode="popLayout">
                                    {data.dateMode === 'exact' && (
                                        <motion.div key="exact-dates"
                                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                                            className="grid grid-cols-2 gap-4">
                                            <DateField label="Ida" value={data.dateGo} onChange={v => setData({ ...data, dateGo: v })} />
                                            <DateField label="Volta (Opcional)" value={data.dateReturn} onChange={v => setData({ ...data, dateReturn: v })} />
                                        </motion.div>
                                    )}

                                    {data.dateMode === 'month' && (
                                        <motion.div key="month-picker"
                                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                                            className="flex flex-col gap-3">
                                            <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Selecione um ou mais meses</p>
                                            <div className="grid grid-cols-4 gap-2">
                                                {MONTHS.map((m, idx) => {
                                                    const sel = data.selectedMonths.includes(idx)
                                                    return (
                                                        <button key={idx} onClick={() => toggleMonth(idx)}
                                                            className={`relative py-3 px-2 rounded-xl text-sm font-medium border-2 transition-all duration-200 ${sel ? 'border-[#4a90e2] bg-[#4a90e2]/8 text-[#4a90e2]' : 'border-slate-200 text-slate-600 hover:border-[#4a90e2]/50 hover:bg-[#4a90e2]/5'}`}
                                                            style={{ background: sel ? 'rgba(74,144,226,0.08)' : undefined }}
                                                        >
                                                            {sel && (
                                                                <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#4a90e2] flex items-center justify-center">
                                                                    <Check className="w-2.5 h-2.5 text-white" />
                                                                </span>
                                                            )}
                                                            {m}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </motion.div>
                                    )}

                                    {data.dateMode === 'any' && (
                                        <motion.div key="any-msg"
                                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
                                            className="p-5 rounded-2xl border border-[#4a90e2]/30 bg-[#4a90e2]/5 text-[#357abd] text-base font-medium">
                                            🎯 Perfeito! Vamos encontrar a janela mais barata do próximo ano para o seu destino.
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <WizardNav onBack={prevStep} onNext={nextStep} nextDisabled={nextDisabled} />
                            </motion.div>
                        )}

                        {/* STEP 4: PASSENGERS & CABIN */}
                        {step === 4 && (
                            <motion.div key="step4" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-8">
                                <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight">
                                    Quem vai <span className="font-semibold text-[#4a90e2]">viajar?</span>
                                </h1>

                                {/* Passenger counter */}
                                <div className="flex items-center justify-between p-5 rounded-2xl border border-slate-200 bg-slate-50">
                                    <div>
                                        <h3 className="text-slate-800 font-semibold text-base">Passageiros</h3>
                                        <p className="text-slate-500 text-sm mt-0.5">Número de adultos</p>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <button
                                            onClick={() => setData(d => ({ ...d, passengers: Math.max(1, d.passengers - 1) }))}
                                            disabled={data.passengers <= 1}
                                            className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#4a90e2] hover:text-[#4a90e2] disabled:opacity-30 transition-all"
                                        >
                                            <Minus className="w-4 h-4" />
                                        </button>
                                        <span className="text-2xl font-semibold text-slate-800 w-8 text-center">{data.passengers}</span>
                                        <button
                                            onClick={() => setData(d => ({ ...d, passengers: Math.min(9, d.passengers + 1) }))}
                                            disabled={data.passengers >= 9}
                                            className="w-10 h-10 rounded-xl border-2 border-slate-200 flex items-center justify-center text-slate-500 hover:border-[#4a90e2] hover:text-[#4a90e2] disabled:opacity-30 transition-all"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                {/* Cabin class */}
                                <div className="flex flex-col gap-3">
                                    <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Classe da cabine</p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {CABIN_CLASSES.map(c => {
                                            const sel = data.cabinClass === c.id
                                            return (
                                                <button key={c.id} onClick={() => setData({ ...data, cabinClass: c.id })}
                                                    className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all duration-200 ${sel ? 'border-[#4a90e2] bg-[#4a90e2]/5' : 'border-slate-200 hover:border-slate-300 bg-white'}`}
                                                >
                                                    <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center mt-0.5 transition-all ${sel ? 'border-[#4a90e2] bg-[#4a90e2]' : 'border-slate-300'}`}>
                                                        {sel && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold text-sm ${sel ? 'text-[#4a90e2]' : 'text-slate-800'}`}>{c.label}</p>
                                                        <p className="text-xs text-slate-500 mt-0.5">{c.desc}</p>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>

                                <WizardNav onBack={prevStep} onNext={nextStep} nextDisabled={false} />
                            </motion.div>
                        )}

                        {/* STEP 5: HACKER MODE */}
                        {step === 5 && (
                            <motion.div key="step5" variants={variants} initial="initial" animate="animate" exit="exit"
                                transition={{ duration: 0.35, ease: 'easeOut' }} className="flex flex-col gap-6">
                                <h1 className="text-4xl md:text-5xl font-light text-slate-800 tracking-tight">
                                    Qual é a sua <span className="font-semibold text-[#4a90e2]">estratégia?</span>
                                </h1>
                                <p className="text-slate-500 text-lg">Escolha o perfil da sua busca. Você pode mudar depois.</p>

                                <div className="flex flex-col gap-3">
                                    {HACKER_MODES.map(m => {
                                        const sel = data.hackerMode === m.id
                                        return (
                                            <button key={m.id}
                                                onClick={() => setData({ ...data, hackerMode: m.id as any })}
                                                className={`flex items-center gap-4 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${sel ? 'border-[#4a90e2] bg-[#4a90e2]/5 shadow-[0_8px_24px_rgba(74,144,226,0.12)]' : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}
                                            >
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

                                {submitError && (
                                    <p className="text-sm text-red-500 font-medium">{submitError}</p>
                                )}
                                <div className="flex justify-between items-center mt-4">
                                    <button onClick={prevStep} className="text-slate-400 hover:text-slate-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-100 transition-all">
                                        ← Voltar
                                    </button>
                                    <button
                                        onClick={handleFinish}
                                        disabled={submitting}
                                        className="flex items-center gap-2 bg-gradient-to-r from-[#4a90e2] to-[#1a5db5] hover:from-[#357abd] hover:to-[#154fa0] text-white disabled:opacity-60 disabled:cursor-not-allowed rounded-full px-8 py-4 text-base font-semibold shadow-[0_4px_20px_rgba(74,144,226,0.4)] transition-all"
                                    >
                                        {submitting ? (
                                            <><Loader2 className="w-4 h-4 animate-spin" /> Analisando...</>
                                        ) : (
                                            <>Analisar Estratégia ✨ <ArrowRight className="w-4 h-4" /></>
                                        )}
                                    </button>
                                </div>
                            </motion.div>
                        )}

                    </AnimatePresence>
                </div>
            </main>

            {/* ─── PROGRESS FOOTER ─── */}
            <footer className="sticky bottom-0 w-full z-10 bg-white/80 backdrop-blur-sm border-t border-slate-100">
                <div className="max-w-2xl mx-auto px-6 py-3 flex items-center gap-3">
                    <span className="text-xs text-slate-400 font-medium w-16">Passo {step} de {TOTAL_STEPS}</span>
                    <div className="flex gap-1.5 flex-1">
                        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                            <div key={i}
                                className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i + 1 === step ? 'bg-[#4a90e2]' : i + 1 < step ? 'bg-[#4a90e2]/40' : 'bg-slate-100'}`}
                            />
                        ))}
                    </div>
                    <span className="text-xs text-[#4a90e2] font-semibold w-16 text-right">{Math.round((step / TOTAL_STEPS) * 100)}%</span>
                </div>
            </footer>
        </div>
    )
}

// ─── Shared Components ───────────────────────────────────────────────────────

function WizardNextBtn({ onClick, disabled, label, className = '' }: {
    onClick: () => void
    disabled: boolean
    label: string
    className?: string
}) {
    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`flex items-center gap-2 bg-[#4a90e2] hover:bg-[#357abd] text-white disabled:opacity-40 disabled:cursor-not-allowed rounded-full px-8 py-4 text-base font-semibold shadow-[0_4px_16px_rgba(74,144,226,0.3)] hover:shadow-[0_6px_20px_rgba(74,144,226,0.4)] transition-all ${className}`}
        >
            {label}
            <ArrowRight className="w-4 h-4" />
        </button>
    )
}

function WizardNav({ onBack, onNext, nextDisabled, nextLabel = 'Próximo', nextClassName = '' }: {
    onBack: () => void
    onNext: () => void
    nextDisabled: boolean
    nextLabel?: string
    nextClassName?: string
}) {
    return (
        <div className="flex justify-between items-center mt-4">
            <button onClick={onBack} className="text-slate-400 hover:text-slate-700 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-100 transition-all">
                ← Voltar
            </button>
            <WizardNextBtn onClick={onNext} disabled={nextDisabled} label={nextLabel} className={nextClassName} />
        </div>
    )
}

function OptionCard({ selected, onClick, emoji, label, desc }: {
    selected: boolean; onClick: () => void; emoji: string; label: string; desc: string
}) {
    return (
        <button onClick={onClick}
            className={`flex flex-col items-start gap-2 p-5 rounded-2xl border-2 text-left transition-all duration-200 ${selected ? 'border-[#4a90e2] bg-[#4a90e2]/5 shadow-[0_8px_20px_rgba(74,144,226,0.12)]' : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50'}`}
        >
            <div className="flex items-center justify-between w-full">
                <span className="text-2xl">{emoji}</span>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${selected ? 'border-[#4a90e2] bg-[#4a90e2]' : 'border-slate-300'}`}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                </div>
            </div>
            <p className={`font-semibold text-sm ${selected ? 'text-[#4a90e2]' : 'text-slate-800'}`}>{label}</p>
            <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
        </button>
    )
}

function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
    return (
        <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
            <input
                type="date"
                value={value}
                onChange={e => onChange(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 focus:border-[#4a90e2] rounded-xl px-4 py-3 text-slate-700 outline-none transition-all text-sm"
            />
        </div>
    )
}
