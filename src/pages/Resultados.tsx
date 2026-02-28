import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, SlidersHorizontal, CheckCircle, Loader2 } from 'lucide-react'
import { supabase, type ResultadoVoo, type Busca } from '@/lib/supabase'
import { generateMockFlights } from '@/lib/mockFlights'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { FlightResultsGrouped } from '@/components/FlightResultsGrouped'
import { PlaneWindowLoader } from '@/components/PlaneWindowLoader'
import { Sidebar, type FilterState } from '@/components/Sidebar'
import { SearchBarTop } from '@/components/SearchBarTop'
import { motion, AnimatePresence } from 'framer-motion'

const STEPS_LIST = ['Salvando busca...', 'Gerando cenários...', 'Calculando estratégias...']

export default function Resultados() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user } = useAuth()
    const buscaId = parseInt(searchParams.get('buscaId') ?? '0', 10)

    const [flights, setFlights] = useState<ResultadoVoo[]>([])
    const [busca, setBusca] = useState<Busca | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')

    // Search Bar State
    const [origin, setOrigin] = useState('')
    const [dest, setDest] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [pax, setPax] = useState(1)

    // New Search State
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchStep, setSearchStep] = useState(-1)
    const [searchError, setSearchError] = useState('')
    const searchStepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    // Sidebar State
    const [filters, setFilters] = useState<FilterState>({ programs: [], stops: [], cabin: 'economy', minMiles: '', maxMiles: '' })
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [activeTab, setActiveTab] = useState(0)

    useEffect(() => {
        if (!user || !buscaId) { navigate('/home'); return }
        const MIN_ANIM_MS = 3500 // garante que a animação da janela sempre toca completa
        const load = async () => {
            setLoading(true)
            try {
                const [voosRes, buscaRes] = await Promise.all([
                    supabase.from('resultados_voos').select('*').eq('busca_id', buscaId).eq('user_id', user.id).order('companhia'),
                    supabase.from('buscas').select('*').eq('id', buscaId).eq('user_id', user.id).single(),
                    new Promise<void>(r => setTimeout(r, MIN_ANIM_MS)),
                ])
                if (voosRes.error) throw voosRes.error
                if (buscaRes.error) throw buscaRes.error

                setFlights(voosRes.data ?? [])
                setBusca(buscaRes.data)

                // Initialize top bar with current search
                if (buscaRes.data) {
                    setOrigin(buscaRes.data.origem)
                    setDest(buscaRes.data.destino)
                    setDateGo(buscaRes.data.data_ida)
                    setPax(buscaRes.data.passageiros)
                }
            } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Erro ao carregar resultados.')
            } finally { setLoading(false) }
        }
        load()
    }, [user, buscaId, navigate])

    useEffect(() => () => { searchStepTimers.current.forEach(clearTimeout) }, [])

    const handleNewSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        setSearchError('')
        if (!origin.trim() || !dest.trim()) return setSearchError('Preencha origem e destino.')
        if (!dateGo) return setSearchError('Informe a data de ida.')
        if (!user) return setSearchError('Faça login para buscar voos.')

        setSearchLoading(true); setSearchStep(0)
        searchStepTimers.current.push(setTimeout(() => setSearchStep(1), 900))
        searchStepTimers.current.push(setTimeout(() => setSearchStep(2), 1800))

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
            setSearchStep(3)
            await new Promise(r => setTimeout(r, 300))

            // Navigate to the same page with new buscaId to reload
            navigate(`/resultados?buscaId=${buscaData.id}`)
            setSearchLoading(false)
            setSearchStep(-1)
        } catch (err: unknown) {
            setSearchError(err instanceof Error ? err.message : 'Erro ao buscar.')
            setSearchLoading(false); setSearchStep(-1)
        }
    }

    if (loading) return <PlaneWindowLoader />

    return (
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif' }}>

            {/* ════════════════════════════
                DARK APP HEADER & SEARCH
            ════════════════════════════ */}
            <div style={{
                background: 'var(--bg-white)',
                borderBottom: '1px solid var(--border-light)',
                position: 'sticky', top: 0, zIndex: 50,
            }}>
                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 28px' }}>
                    <Header variant="app" />
                </div>

                <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '14px 28px 18px' }}>
                    <SearchBarTop
                        origin={origin} setOrigin={setOrigin}
                        dest={dest} setDest={setDest}
                        dateGo={dateGo} setDateGo={setDateGo}
                        pax={pax} setPax={setPax}
                        loading={searchLoading} error={searchError}
                        onSubmit={handleNewSearch}
                    />

                    <AnimatePresence>
                        {searchLoading && searchStep >= 0 && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                style={{ display: 'flex', gap: '20px', marginTop: '10px', flexWrap: 'wrap' }}>
                                {STEPS_LIST.map((s, i) => (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', opacity: i <= searchStep ? 1 : 0.35 }}>
                                        {i < searchStep ? <CheckCircle size={12} color="var(--blue-medium)" /> : i === searchStep ? <Loader2 size={12} color="rgba(255,255,255,0.7)" className="spin" /> : <div style={{ width: 12, height: 12, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)' }} />}
                                        <span style={{ fontSize: '11.5px', color: i === searchStep ? '#fff' : 'rgba(255,255,255,0.45)', fontWeight: i === searchStep ? 600 : 400 }}>{s}</span>
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

                    {error ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px', color: '#f87171' }}>
                            <AlertCircle size={40} />
                            <p style={{ fontSize: '15px' }}>{error}</p>
                            <button onClick={() => navigate('/home')} className="btn" style={{ background: 'var(--blue-medium)', color: '#fff' }}>Voltar para busca</button>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

                            {/* Tabs à la Fly Society */}
                            <div style={{
                                display: 'flex', gap: '0',
                                background: '#fff', border: '1px solid var(--border-light)',
                                borderRadius: '14px', padding: '6px', marginBottom: '20px',
                                boxShadow: 'var(--shadow-xs)',
                            }}>
                                {[['Melhor Estratégia', '⚡'], ['Mais Econômico', '💰'], ['Mais Rápido', '🕐']].map(([label, icon], i) => (
                                    <button key={label} onClick={() => setActiveTab(i)} style={{
                                        flex: 1, padding: '10px 16px', borderRadius: '10px',
                                        border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                                        fontSize: '13px', fontWeight: activeTab === i ? 700 : 500,
                                        background: activeTab === i ? 'var(--petrol-deep)' : 'transparent',
                                        color: activeTab === i ? '#fff' : 'var(--text-muted)',
                                        boxShadow: activeTab === i ? '0 2px 8px rgba(15,47,58,0.2)' : 'none',
                                        transition: 'all 0.18s',
                                    }}>
                                        {icon} {label}
                                    </button>
                                ))}
                            </div>

                            <FlightResultsGrouped
                                flights={flights} buscaId={buscaId}
                                searchInfo={busca ? { origem: busca.origem, destino: busca.destino, data_ida: busca.data_ida, passageiros: busca.passageiros } : undefined}
                                onNewSearch={() => { (document.querySelector('input[placeholder="De — GRU"]') as HTMLInputElement)?.focus() }}
                            />
                        </motion.div>
                    )}
                </div>
            </div>
        </div>
    )
}
