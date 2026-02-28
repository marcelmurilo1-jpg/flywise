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

    // Search bar state
    const [origin, setOrigin] = useState('')
    const [originIata, setOriginIata] = useState('')
    const [dest, setDest] = useState('')
    const [destIata, setDestIata] = useState('')
    const [dateGo, setDateGo] = useState('')
    const [dateBack, setDateBack] = useState('')
    const [tripType, setTripType] = useState<'one-way' | 'round-trip'>('round-trip')
    const [pax, setPax] = useState(1)
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState('')
    const searchStepTimers = useRef<ReturnType<typeof setTimeout>[]>([])

    // Sidebar state
    const [filters, setFilters] = useState<FilterState>({ programs: [], stops: [], cabin: 'economy', minMiles: '', maxMiles: '' })
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [activeTab, setActiveTab] = useState(0)

    useEffect(() => {
        if (!user || !buscaId) { navigate('/home'); return }

        // Read URL params at effect setup time
        const orig = searchParams.get('orig')
        const destP = searchParams.get('dest')
        const date = searchParams.get('date')
        const ret = searchParams.get('ret')
        const paxP = parseInt(searchParams.get('pax') ?? '1', 10)

        const MIN_ANIM_MS = 3500

        const load = async () => {
            setLoading(true)
            setError('')
            try {
                // 1. Load busca metadata
                const buscaRes = await supabase.from('buscas').select('*')
                    .eq('id', buscaId).eq('user_id', user.id).single()
                if (buscaRes.error) throw buscaRes.error

                const buscaData = buscaRes.data
                setBusca(buscaData)
                if (buscaData) {
                    setOrigin(buscaData.origem); setOriginIata(buscaData.origem)
                    setDest(buscaData.destino); setDestIata(buscaData.destino)
                    setDateGo(buscaData.data_ida); setPax(buscaData.passageiros)
                }

                // 2. Check for already-saved results
                const { data: cached, error: cacheErr } = await supabase
                    .from('resultados_voos').select('*')
                    .eq('busca_id', buscaId).eq('user_id', user.id)
                    .order('preco_brl')
                if (cacheErr) throw cacheErr

                if (cached && cached.length > 0) {
                    // Already have results — just wait for animation
                    await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
                    setFlights(cached)
                    return
                }

                // 3. No cached results — call Amadeus IN PARALLEL with animation timer
                if (!orig || !destP || !date) {
                    console.warn('[Resultados] No search params in URL, cannot call Amadeus')
                    await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
                    setFlights([])
                    return
                }

                console.log('[Resultados] Calling Amadeus:', orig, '→', destP, date, ret ? `return:${ret}` : 'one-way')

                const [offers] = await Promise.all([
                    searchFlights({
                        origin: orig,
                        destination: destP,
                        departureDate: date,
                        adults: paxP,
                        max: 20,
                        returnDate: ret ?? undefined,
                    }),
                    new Promise<void>(r => setTimeout(r, MIN_ANIM_MS)),
                ])

                console.log('[Resultados] Got', offers.length, 'offers from Amadeus')

                if (offers.length === 0) {
                    setFlights([])
                    return
                }

                const rows = offers.map(o => ({
                    busca_id: buscaId,
                    user_id: user.id,
                    provider: o.provider,
                    companhia: o.companhia,
                    preco_brl: o.preco_brl,
                    preco_milhas: null,
                    taxas_brl: o.taxas_brl,
                    cpm: null,
                    partida: o.partida,
                    chegada: o.chegada,
                    origem: o.origem,
                    destino: o.destino,
                    duracao_min: o.duracao_min,
                    cabin_class: o.cabin_class,
                    flight_key: o.flight_key,
                    estrategia_disponivel: true,
                    moeda: 'BRL',
                    segmentos: o.segmentos,
                    detalhes: { paradas: o.paradas, voo_numero: o.voo_numero },
                }))

                const { data: saved, error: saveErr } = await supabase
                    .from('resultados_voos').insert(rows).select()
                if (saveErr) console.error('[Resultados] Save error:', saveErr)

                setFlights(saved ?? (rows as unknown as ResultadoVoo[]))

            } catch (e: unknown) {
                console.error('[Resultados] load error:', e)
                const msg = e instanceof Error ? e.message : 'Erro ao carregar resultados.'
                setError(msg)
                await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
            } finally {
                setLoading(false)
            }
        }

        load()
        // searchParams is captured at render time — buscaId change triggers re-run with fresh params
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user, buscaId, navigate])

    useEffect(() => () => { searchStepTimers.current.forEach(clearTimeout) }, [])

    const handleNewSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        setSearchError('')
        const originCode = originIata || origin.trim().toUpperCase()
        const destCode = destIata || dest.trim().toUpperCase()
        if (!originCode || !destCode) return setSearchError('Selecione origem e destino.')
        if (originCode.length !== 3) return setSearchError('Selecione um aeroporto válido na origem.')
        if (destCode.length !== 3) return setSearchError('Selecione um aeroporto válido no destino.')
        if (!dateGo) return setSearchError('Informe a data de ida.')
        if (!user) return setSearchError('Faça login para buscar voos.')

        setSearchLoading(true)
        try {
            const insertData: Record<string, unknown> = {
                user_id: user.id, origem: originCode, destino: destCode,
                data_ida: dateGo, passageiros: pax, bagagem: 'sem_bagagem', user_miles: {},
            }
            if (tripType === 'round-trip' && dateBack) insertData.data_volta = dateBack

            const { data: buscaData, error: buscaErr } = await supabase
                .from('buscas').insert(insertData).select().single()
            if (buscaErr) throw buscaErr

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

            {/* ══════════════  HEADER + SEARCH BAR  ══════════════ */}
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

            {/* ══════════════  MAIN CONTENT — 2 COLUMNS  ══════════════ */}
            <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 28px 80px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                <Sidebar filters={filters} setFilters={setFilters} />

                <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => setShowMobileFilters(!showMobileFilters)}
                        style={{ display: 'none', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: '#fff', border: '1px solid var(--border-light)', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, color: 'var(--graphite)', cursor: 'pointer' }}>
                        <SlidersHorizontal size={14} /> Filtros
                    </button>

                    {error ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px', color: '#f87171' }}>
                            <AlertCircle size={40} />
                            <p style={{ fontSize: '15px', textAlign: 'center' }}>{error}</p>
                            <button onClick={() => navigate('/home')} className="btn" style={{ background: 'var(--blue-medium)', color: '#fff' }}>Voltar para busca</button>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {/* Tabs */}
                            <div style={{
                                display: 'flex', background: '#fff',
                                border: '1px solid var(--border-light)',
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
