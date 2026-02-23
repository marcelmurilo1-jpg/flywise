import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Loader2, CheckCircle, ChevronDown, ChevronUp, SlidersHorizontal, Plane, ArrowLeftRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { generateMockFlights } from '@/lib/mockFlights'
import { useAuth } from '@/contexts/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'
import { Header } from '@/components/Header'
import type { Busca } from '@/lib/supabase'

const STEPS_LIST = ['Salvando busca...', 'Gerando cenários...', 'Calculando estratégias...']
const PROGRAMS = ['Smiles', 'LATAM Pass', 'TudoAzul']

/* ─────────────────────────────────────────
   SIDEBAR FILTER COMPONENT
───────────────────────────────────────── */
interface FilterState {
    programs: string[]
    stops: string[]
    cabin: string
    minMiles: string
    maxMiles: string
}

function Sidebar({ filters, setFilters }: { filters: FilterState, setFilters: (f: FilterState) => void }) {
    const [sections, setSections] = useState({ programs: true, stops: true, cabin: true, miles: false })
    const toggle = (k: keyof typeof sections) => setSections(s => ({ ...s, [k]: !s[k] }))

    const toggleProgram = (p: string) => {
        const next = filters.programs.includes(p)
            ? filters.programs.filter(x => x !== p)
            : [...filters.programs, p]
        setFilters({ ...filters, programs: next })
    }
    const toggleStop = (s: string) => {
        const next = filters.stops.includes(s)
            ? filters.stops.filter(x => x !== s)
            : [...filters.stops, s]
        setFilters({ ...filters, stops: next })
    }

    const SectionHeader = ({ label, k }: { label: string, k: keyof typeof sections }) => (
        <button onClick={() => toggle(k)} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            width: '100%', background: 'none', border: 'none', borderBottom: '1px solid var(--border-light)',
            padding: '14px 0', cursor: 'pointer', fontFamily: 'inherit',
        }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--graphite)' }}>{label}</span>
            {sections[k] ? <ChevronUp size={15} color="var(--text-muted)" /> : <ChevronDown size={15} color="var(--text-muted)" />}
        </button>
    )

    const CheckRow = ({ label, checked, onChange }: { label: string, checked: boolean, onChange: () => void }) => (
        <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '6px 0' }}>
            <div onClick={onChange} style={{
                width: '17px', height: '17px', borderRadius: '5px', flexShrink: 0,
                border: `2px solid ${checked ? 'var(--green-strat)' : 'var(--border-mid)'}`,
                background: checked ? 'var(--green-strat)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', transition: 'all 0.15s',
            }}>
                {checked && <CheckCircle size={10} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: '13px', color: 'var(--text-body)' }}>{label}</span>
        </label>
    )

    return (
        <aside style={{
            width: '230px', flexShrink: 0,
            background: '#fff',
            border: '1px solid var(--border-light)',
            borderRadius: '16px',
            padding: '20px',
            height: 'fit-content',
            position: 'sticky',
            top: '80px',
            boxShadow: 'var(--shadow-xs)',
        }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '4px' }}>
                Filtros
            </p>

            {/* Programs */}
            <SectionHeader label="Programas de Milhas" k="programs" />
            {sections.programs && (
                <div style={{ padding: '8px 0' }}>
                    {PROGRAMS.map(p => (
                        <CheckRow key={p} label={p} checked={filters.programs.includes(p)} onChange={() => toggleProgram(p)} />
                    ))}
                </div>
            )}

            {/* Stops */}
            <SectionHeader label="Conexões" k="stops" />
            {sections.stops && (
                <div style={{ padding: '8px 0' }}>
                    {[['Direto', 'direct'], ['1 conexão', '1stop'], ['2+ conexões', '2plus']].map(([label, val]) => (
                        <CheckRow key={val} label={label} checked={filters.stops.includes(val)} onChange={() => toggleStop(val)} />
                    ))}
                </div>
            )}

            {/* Cabin */}
            <SectionHeader label="Classe" k="cabin" />
            {sections.cabin && (
                <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {[['Econômica', 'economy'], ['Executiva', 'business'], ['Primeira', 'first']].map(([label, val]) => (
                        <button key={val} onClick={() => setFilters({ ...filters, cabin: val })} style={{
                            padding: '7px 12px', borderRadius: '8px', border: `1px solid ${filters.cabin === val ? 'var(--green-strat)' : 'var(--border-light)'}`,
                            background: filters.cabin === val ? 'rgba(14,107,87,0.08)' : 'transparent',
                            fontFamily: 'inherit', fontSize: '13px', fontWeight: 500,
                            color: filters.cabin === val ? 'var(--green-strat)' : 'var(--text-body)',
                            cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s',
                        }}>{label}</button>
                    ))}
                </div>
            )}

            {/* Clear */}
            <button onClick={() => setFilters({ programs: [], stops: [], cabin: 'economy', minMiles: '', maxMiles: '' })}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600 }}>
                <X size={12} /> Limpar filtros
            </button>
        </aside>
    )
}

/* ─────────────────────────────────────────
   RECENT SEARCH CARD
───────────────────────────────────────── */
function InsightCard({ busca }: { busca: Busca }) {
    const navigate = useNavigate()
    return (
        <motion.div whileHover={{ y: -2 }} onClick={() => navigate(`/resultados?buscaId=${busca.id}`)}
            style={{
                background: '#fff', border: '1px solid var(--border-light)', borderRadius: '14px',
                padding: '16px 18px', cursor: 'pointer', minWidth: '190px', flex: '1',
                boxShadow: 'var(--shadow-xs)', transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
            onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-xs)')}
        >
            <p style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Busca Recente</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--graphite)', letterSpacing: '0.04em' }}>{busca.origem}</span>
                <Plane size={12} color="var(--text-muted)" />
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--graphite)', letterSpacing: '0.04em' }}>{busca.destino}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ background: 'rgba(14,107,87,0.08)', borderRadius: '6px', padding: '4px 8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--green-strat)' }}>— pts</span>
                </div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '4px 0' }}>{busca.passageiros} pax</span>
            </div>
        </motion.div>
    )
}

/* ─────────────────────────────────────────
   INLINE SEARCH BAR (Fly Society style)
───────────────────────────────────────── */
function SearchBar({
    origin, setOrigin, dest, setDest, dateGo, setDateGo, pax, setPax,
    loading, error, onSubmit
}: {
    origin: string, setOrigin: (v: string) => void
    dest: string, setDest: (v: string) => void
    dateGo: string, setDateGo: (v: string) => void
    pax: number, setPax: (v: number) => void
    loading: boolean, error: string, onSubmit: (e: React.FormEvent) => void
}) {
    const swap = () => { setOrigin(dest); setDest(origin) }

    return (
        <form onSubmit={onSubmit}>
            <div style={{
                display: 'flex', alignItems: 'stretch', gap: '0',
                background: 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '14px',
                overflow: 'hidden',
                height: '52px',
            }}>
                {/* Origin */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '140px' }}>
                    <Plane size={14} color="rgba(255,255,255,0.5)" />
                    <input type="text" placeholder="De — GRU" value={origin} maxLength={3}
                        onChange={e => setOrigin(e.target.value.toUpperCase())}
                        style={{ border: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, width: '100%', outline: 'none', letterSpacing: '0.04em' }} />
                </div>

                {/* Swap */}
                <button type="button" onClick={swap} style={{
                    padding: '0 10px', background: 'none', border: 'none',
                    borderRight: '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer', color: 'rgba(255,255,255,0.5)',
                    transition: 'color 0.2s', flexShrink: 0,
                }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                    onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                >
                    <ArrowLeftRight size={14} />
                </button>

                {/* Destination */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', gap: '8px', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '140px' }}>
                    <Plane size={14} color="rgba(255,255,255,0.5)" style={{ transform: 'scaleX(-1)' }} />
                    <input type="text" placeholder="Para — JFK" value={dest} maxLength={3}
                        onChange={e => setDest(e.target.value.toUpperCase())}
                        style={{ border: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: '14px', fontWeight: 600, width: '100%', outline: 'none', letterSpacing: '0.04em' }} />
                </div>

                {/* Date */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 14px', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '150px' }}>
                    <input type="date" value={dateGo} onChange={e => setDateGo(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        style={{ border: 'none', background: 'transparent', color: dateGo ? '#fff' : 'rgba(255,255,255,0.45)', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 500, outline: 'none', cursor: 'pointer', width: '100%' }} />
                </div>

                {/* Passengers */}
                <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', borderRight: '1px solid rgba(255,255,255,0.1)', minWidth: '110px' }}>
                    <select value={pax} onChange={e => setPax(Number(e.target.value))}
                        style={{ border: 'none', background: 'transparent', color: '#fff', fontFamily: 'inherit', fontSize: '13.5px', fontWeight: 500, outline: 'none', cursor: 'pointer', width: '100%' }}>
                        {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n} style={{ background: '#0F2F3A' }}>{n} {n === 1 ? 'Adulto' : 'Adultos'}</option>)}
                    </select>
                </div>

                {/* Submit */}
                <button type="submit" disabled={loading} style={{
                    padding: '0 22px', background: 'var(--green-strat)', border: 'none',
                    color: '#fff', fontFamily: 'inherit', fontSize: '14px', fontWeight: 700,
                    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.75 : 1,
                    display: 'flex', alignItems: 'center', gap: '8px',
                    transition: 'background 0.18s', flexShrink: 0, letterSpacing: '0.01em',
                }}
                    onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'var(--green-soft)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--green-strat)' }}
                >
                    {loading ? <Loader2 size={16} className="spin" /> : <Search size={15} />}
                    {loading ? 'Analisando...' : 'Analisar'}
                </button>
            </div>

            {/* Error inline */}
            {error && (
                <p style={{ fontSize: '12px', color: '#f87171', marginTop: '8px', paddingLeft: '4px' }}>{error}</p>
            )}
        </form>
    )
}

/* ─────────────────────────────────────────
   MAIN HOME
───────────────────────────────────────── */
export default function Home() {
    const [origin, setOrigin] = useState('')
    const [dest, setDest] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [pax, setPax] = useState(1)
    const [loading, setLoading] = useState(false)
    const [step, setStep] = useState(-1)
    const [error, setError] = useState('')
    const [recentSearches, setRecentSearches] = useState<Busca[]>([])
    const [filters, setFilters] = useState<FilterState>({ programs: [], stops: [], cabin: 'economy', minMiles: '', maxMiles: '' })
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    const { user } = useAuth()
    const navigate = useNavigate()
    const stepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    useEffect(() => () => { stepTimers.current.forEach(clearTimeout) }, [])

    useEffect(() => {
        if (!user) return
        supabase.from('buscas').select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(4)
            .then(({ data }) => { if (data) setRecentSearches(data) })
    }, [user])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        if (!origin.trim() || !dest.trim()) return setError('Preencha origem e destino.')
        if (!dateGo) return setError('Informe a data de ida.')
        if (!user) return setError('Faça login para buscar voos.')
        setLoading(true); setStep(0)
        stepTimers.current.push(setTimeout(() => setStep(1), 900))
        stepTimers.current.push(setTimeout(() => setStep(2), 1800))
        try {
            const { data: buscaData, error: buscaErr } = await supabase.from('buscas').insert({
                user_id: user.id, origem: origin, destino: dest,
                data_ida: dateGo, passageiros: pax, bagagem: 'sem_bagagem', user_miles: {},
            }).select().single()
            if (buscaErr) throw buscaErr
            const mocks = generateMockFlights(origin, dest, dateGo, pax, {})
            const voosToInsert = mocks.map(m => ({ ...m, busca_id: buscaData.id, user_id: user.id }))
            await supabase.from('resultados_voos').insert(voosToInsert)
            await new Promise(r => setTimeout(r, 600))
            setStep(3)
            await new Promise(r => setTimeout(r, 300))
            navigate(`/resultados?buscaId=${buscaData.id}`)
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Erro ao buscar.')
            setLoading(false); setStep(-1)
        }
    }

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif' }}>

            {/* ════════════════════════════
                DARK APP HEADER — FLY SOCIETY STYLE
            ════════════════════════════ */}
            <div style={{
                background: 'var(--petrol-deep)',
                borderBottom: '1px solid rgba(255,255,255,0.07)',
                position: 'sticky', top: 0, zIndex: 50,
            }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 28px' }}>
                    {/* Top row: logo + user nav */}
                    <Header variant="app" />
                </div>

                {/* Search bar row */}
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '14px 28px 18px' }}>
                    <SearchBar
                        origin={origin} setOrigin={setOrigin}
                        dest={dest} setDest={setDest}
                        dateGo={dateGo} setDateGo={setDateGo}
                        pax={pax} setPax={setPax}
                        loading={loading} error={error}
                        onSubmit={handleSubmit}
                    />

                    {/* Step progress */}
                    <AnimatePresence>
                        {loading && step >= 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                                {STEPS_LIST.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: i <= step ? 1 : 0.35 }}>
                                        {i < step ? <CheckCircle size={12} color="var(--green-soft)" /> : i === step ? <Loader2 size={12} color="rgba(255,255,255,0.7)" className="spin" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)' }} />}
                                        <span style={{ fontSize: '11.5px', color: i === step ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: i === step ? 600 : 400 }}>{s}</span>
                                    </div>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>

            {/* ════════════════════════════
                MAIN CONTENT — 2 COLUMNS
            ════════════════════════════ */}
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 28px 80px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                {/* SIDEBAR */}
                <Sidebar filters={filters} setFilters={setFilters} />

                {/* MAIN AREA */}
                <div style={{ flex: 1, minWidth: 0 }}>

                    {/* Mobile filters toggle */}
                    <button onClick={() => setShowMobileFilters(!showMobileFilters)}
                        style={{ display: 'none', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: '#fff', border: '1px solid var(--border-light)', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, color: 'var(--graphite)', cursor: 'pointer' }}>
                        <SlidersHorizontal size={14} /> Filtros
                    </button>

                    {/* Welcome / empty state */}
                    {recentSearches.length === 0 ? (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.4 }}
                            style={{
                                background: '#fff',
                                border: '1px solid var(--border-light)',
                                borderRadius: '20px',
                                padding: '64px 40px',
                                textAlign: 'center',
                                boxShadow: 'var(--shadow-xs)',
                            }}
                        >
                            <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: 'rgba(14,107,87,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: '28px' }}>✦</div>
                            <h2 style={{ fontSize: '22px', fontWeight: 700, color: 'var(--graphite)', marginBottom: '10px', letterSpacing: '-0.03em' }}>
                                Pronto para a sua primeira análise?
                            </h2>
                            <p style={{ fontSize: '15px', color: 'var(--text-muted)', maxWidth: '380px', margin: '0 auto 28px', lineHeight: 1.7 }}>
                                Use a barra de busca acima para analisar sua rota. O FlyWise calcula o melhor cenário entre milhas e dinheiro.
                            </p>
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
                                {[['GRU → JFK', 'Nova York'], ['GRU → LIS', 'Lisboa'], ['GRU → MIA', 'Miami']].map(([route, city]) => (
                                    <div key={city} style={{
                                        background: 'var(--snow)', border: '1px solid var(--border-light)',
                                        borderRadius: '12px', padding: '12px 18px', cursor: 'pointer',
                                        transition: 'all 0.18s',
                                    }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--green-strat)'; e.currentTarget.style.background = 'rgba(14,107,87,0.04)' }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-light)'; e.currentTarget.style.background = 'var(--snow)' }}
                                    >
                                        <p style={{ fontSize: '14px', fontWeight: 700, color: 'var(--graphite)', letterSpacing: '0.04em' }}>{route}</p>
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{city}</p>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <>
                            {/* Tabs à la Fly Society */}
                            <div style={{
                                display: 'flex', gap: '0',
                                background: '#fff', border: '1px solid var(--border-light)',
                                borderRadius: '14px', padding: '6px', marginBottom: '20px',
                                boxShadow: 'var(--shadow-xs)',
                            }}>
                                {[['Melhor Estratégia', '⚡'], ['Mais Econômico', '💰'], ['Mais Rápido', '🕐']].map(([label, icon], i) => (
                                    <button key={label} style={{
                                        flex: 1, padding: '10px 16px', borderRadius: '10px',
                                        border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                                        fontSize: '13px', fontWeight: i === 0 ? 700 : 500,
                                        background: i === 0 ? 'var(--petrol-deep)' : 'transparent',
                                        color: i === 0 ? '#fff' : 'var(--text-muted)',
                                        boxShadow: i === 0 ? '0 2px 8px rgba(15,47,58,0.2)' : 'none',
                                        transition: 'all 0.18s',
                                    }}>
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>

                            {/* Recent searches info */}
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '14px', fontWeight: 600 }}>
                                {recentSearches.length} busca{recentSearches.length !== 1 ? 's' : ''} recente{recentSearches.length !== 1 ? 's' : ''}
                            </p>

                            {/* Result cards */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                {recentSearches.map((busca, i) => (
                                    <motion.div key={busca.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                    >
                                        <InsightCard busca={busca} />
                                    </motion.div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}
