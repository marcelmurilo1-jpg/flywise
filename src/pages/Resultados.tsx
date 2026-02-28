import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, SlidersHorizontal } from 'lucide-react'
import { supabase, type ResultadoVoo, type Busca } from '@/lib/supabase'
import { searchFlights } from '@/lib/amadeus'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { FlightResultsGrouped } from '@/components/FlightResultsGrouped'
import { PlaneWindowLoader } from '@/components/PlaneWindowLoader'
import { Sidebar, type FilterState } from '@/components/Sidebar'
import { SearchBarTop } from '@/components/SearchBarTop'
import { motion } from 'framer-motion'


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
    const [originIata, setOriginIata] = useState('')
    const [dest, setDest] = useState('')
    const [destIata, setDestIata] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('round-trip')
    const [pax, setPax] = useState(1)

    // New Search State
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState('')
    const searchStepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    // Sidebar State
    const [filters, setFilters] = useState<FilterState>({ programs: [], stops: [], cabin: 'economy', minMiles: '', maxMiles: '' })
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [activeTab, setActiveTab] = useState(0)

    useEffect(() => {
        if (!user || !buscaId) { navigate('/home'); return }
        const MIN_ANIM_MS = 3500
        const orig = searchParams.get('orig')
        const destP = searchParams.get('dest')
        const date = searchParams.get('date')
        const ret = searchParams.get('ret')
        const paxP = parseInt(searchParams.get('pax') ?? '1', 10)

        const load = async () => {
            setLoading(true)
            try {
                const [buscaRes] = await Promise.all([
                    supabase.from('buscas').select('*').eq('id', buscaId).eq('user_id', user.id).single(),
                    new Promise<void>(r => setTimeout(r, MIN_ANIM_MS)),
                ])
                if (buscaRes.error) throw buscaRes.error
                setBusca(buscaRes.data)
                if (buscaRes.data) {
                    setOrigin(buscaRes.data.origem); setOriginIata(buscaRes.data.origem)
                    setDest(buscaRes.data.destino); setDestIata(buscaRes.data.destino)
                    setDateGo(buscaRes.data.data_ida); setPax(buscaRes.data.passageiros)
                }

                // Try cached results first
                const voosRes = await supabase.from('resultados_voos').select('*')
                    .eq('busca_id', buscaId).eq('user_id', user.id).order('preco_brl')
                if (voosRes.error) throw voosRes.error

                if (voosRes.data && voosRes.data.length > 0) {
                    setFlights(voosRes.data)
                } else if (orig && destP && date) {
                    // Call Amadeus — Home navigated here before API call
                    const offers = await searchFlights({
                        origin: orig, destination: destP,
                        departureDate: date, adults: paxP, max: 20,
                        returnDate: ret ?? undefined,
                    })
                    const rows = offers.map(o => ({
                        busca_id: buscaId, user_id: user.id,
                        provider: o.provider, companhia: o.companhia,
                        preco_brl: o.preco_brl, preco_milhas: null,
                        taxas_brl: o.taxas_brl, cpm: null,
                        partida: o.partida, chegada: o.chegada,
                        origem: o.origem, destino: o.destino,
                        duracao_min: o.duracao_min, cabin_class: o.cabin_class,
                        flight_key: o.flight_key, estrategia_disponivel: true,
                        moeda: 'BRL', segmentos: o.segmentos,
                        detalhes: { paradas: o.paradas, voo_numero: o.voo_numero },
                    }))
                    if (rows.length > 0) {
                        const { data: saved } = await supabase.from('resultados_voos').insert(rows).select()
                        setFlights(saved ?? [])
                    }
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
        const originCode = originIata || origin.trim().toUpperCase()
        const destCode = destIata || dest.trim().toUpperCase()
        if (!originCode || !destCode) return setSearchError('Selecione origem e destino.')
        if (!dateGo) return setSearchError('Informe a data de ida.')
        if (!user) return setSearchError('Faça login para buscar voos.')

        setSearchLoading(true)
        searchStepTimers.current.forEach(clearTimeout)
        searchStepTimers.current = []

        try {
            const { data: buscaData, error: buscaErr } = await supabase.from('buscas').insert({
                user_id: user.id, origem: originCode, destino: destCode,
                data_ida: dateGo, passageiros: pax, bagagem: 'sem_bagagem', user_miles: {},
            }).select().single()
            if (buscaErr) throw buscaErr
            // Navigate — Resultados will call Amadeus on fresh buscaId
            const retParam = tripType === 'round-trip' && dateBack ? `&ret=${dateBack}` : ''
            navigate(`/resultados?buscaId=${buscaData.id}&orig=${originCode}&dest=${destCode}&date=${dateGo}${retParam}&pax=${pax}`)
            setSearchLoading(false)
        } catch (err: unknown) {
            setSearchError(err instanceof Error ? err.message : 'Erro ao buscar.')
            setSearchLoading(false)
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
                        originIata={originIata} setOriginIata={setOriginIata}
                        dest={dest} setDest={setDest}
                        destIata={destIata} setDestIata={setDestIata}
                        dateGo={dateGo} setDateGo={setDateGo}
                        dateBack={dateBack} setDateBack={setDateBack}
                        tripType={tripType} setTripType={setTripType}
                        pax={pax} setPax={setPax}
                        loading={searchLoading} error={searchError}
                        onSubmit={handleNewSearch}
                    />

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
