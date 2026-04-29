import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, SlidersHorizontal } from 'lucide-react'
import { supabase, type ResultadoVoo, type Busca } from '@/lib/supabase'
import { searchFlights, type PriceGraph } from '@/lib/amadeus'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { FlightResultsGrouped } from '@/components/FlightResultsGrouped'
import { StrategyPanel, type SeatsContext } from '@/components/StrategyPanel'
import { PlaneWindowLoader } from '@/components/PlaneWindowLoader'
import { Sidebar, type FilterState } from '@/components/Sidebar'
import { SearchBarTop } from '@/components/SearchBarTop'
import { SeatsFlightPanel } from '@/components/SeatsFlightPanel'
import { motion } from 'framer-motion'
import { WatchlistModal, type WatchlistModalProps } from '@/components/WatchlistModal'
import { PriceGraphPanel } from '@/components/PriceGraphPanel'

export default function Resultados() {
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const { user, loading: authLoading } = useAuth()
    const buscaId = parseInt(searchParams.get('buscaId') ?? '0', 10)

    const [flights, setFlights] = useState<ResultadoVoo[]>([])
    const [inboundFlights, setInboundFlights] = useState<ResultadoVoo[]>([])
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

    // Seats.aero state
    const [seatsFlights, setSeatsFlights] = useState<any[]>([])
    const [seatsLoading, setSeatsLoading] = useState(false)
    const [seatsError, setSeatsError] = useState<string | null>(null)
    const [activeView, setActiveView] = useState<'reais' | 'milhas'>('reais')
    const [seatsTrigger, setSeatsTrigger] = useState(0)
    const seatsParamsRef = useRef<{ orig: string; dest: string; date: string; ret?: string } | null>(null)

    // Cash card selection (for price comparison in SeatsFlightPanel)
    const [cashIdaSel, setCashIdaSel] = useState<ResultadoVoo | null>(null)
    const [cashVoltaSel, setCashVoltaSel] = useState<ResultadoVoo | null>(null)

    // Strategy panel state
    const [stratOpen, setStratOpen] = useState(false)
    const [stratContext, setStratContext] = useState<SeatsContext | null>(null)
    const [stratCashPrice, setStratCashPrice] = useState(0)

    // Price graph from Google Flights
    const [priceGraph, setPriceGraph] = useState<PriceGraph | null>(null)

    // Sidebar + watchlist state
    const [filters, setFilters] = useState<FilterState>({ sortBy: 'best', stops: [], airlines: [], maxPrice: null })
    const [showMobileFilters, setShowMobileFilters] = useState(false)
    const [watchlistModal, setWatchlistModal] = useState<Omit<WatchlistModalProps, 'open' | 'onClose'> | null>(null)

    // Derived values for sidebar
    const allAirlines = useMemo(() =>
        [...new Set(flights.map(f => f.companhia).filter(Boolean) as string[])].sort()
    , [flights])
    const priceMax = useMemo(() =>
        Math.max(...flights.map(f => f.preco_brl ?? 0), 0)
    , [flights])

    // Ref guard: prevent re-running load() for the same buscaId within the same mount
    const lastBuscaId = useRef<number | null>(null)

    useEffect(() => {
        const userId = user?.id
        if (!userId || !buscaId) {
            if (!authLoading && !userId) navigate('/home')
            return
        }

        // Block duplicate runs for the same buscaId (e.g. auth state re-firing)
        if (lastBuscaId.current === buscaId) return
        lastBuscaId.current = buscaId

        const orig   = searchParams.get('orig')
        const destP  = searchParams.get('dest')
        const date   = searchParams.get('date')
        const ret    = searchParams.get('ret')
        const paxP   = parseInt(searchParams.get('pax') ?? '1', 10)
        const MIN_ANIM_MS = 3500

        const load = async () => {
            setLoading(true)
            setError('')

            const loadingTimeout = setTimeout(() => setLoading(false), 75000)

            try {
                // 1. Load busca metadata
                const { data: buscaData, error: buscaErr } = await supabase
                    .from('buscas').select('*')
                    .eq('id', buscaId).eq('user_id', userId).single()
                if (buscaErr) throw buscaErr

                setBusca(buscaData)
                setOrigin(buscaData.origem);      setOriginIata(buscaData.origem)
                setDest(buscaData.destino);       setDestIata(buscaData.destino)
                setDateGo(buscaData.data_ida);    setPax(buscaData.passageiros)
                const retDate = buscaData.data_volta ?? ret ?? ''
                setDateBack(retDate)
                if (retDate) setTripType('round-trip')

                // 2. Seats.aero — fire-and-forget with abort support
                const seatsOrig = orig ?? buscaData?.origem
                const seatsDest = destP ?? buscaData?.destino
                const seatsDate = date ?? buscaData?.data_ida
                const seatsRet  = ret ?? buscaData?.data_volta ?? undefined

                if (seatsOrig && seatsDest && seatsDate) {
                    seatsParamsRef.current = { orig: seatsOrig, dest: seatsDest, date: seatsDate, ret: seatsRet || undefined }
                    setSeatsTrigger(t => t + 1)
                }

                // 3. Check for cached Amadeus results
                const { data: cached, error: cacheErr } = await supabase
                    .from('resultados_voos').select('*')
                    .eq('busca_id', buscaId).eq('user_id', userId).order('preco_brl')
                if (cacheErr) throw cacheErr

                if (cached && cached.length > 0) {
                    const outbound = cached.filter(f => !(f.detalhes as any)?.isReturn)
                    const inbound  = cached.filter(f =>  !!(f.detalhes as any)?.isReturn)
                    await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
                    setFlights(outbound)
                    setInboundFlights(inbound)
                    return
                }

                // 4. No cache — call Amadeus
                if (!orig || !destP || !date) {
                    await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
                    setFlights([])
                    return
                }

                const [searchResult] = await Promise.all([
                    searchFlights({ origin: orig, destination: destP, departureDate: date, adults: paxP, max: 20, returnDate: ret ?? undefined }),
                    new Promise<void>(r => setTimeout(r, MIN_ANIM_MS)),
                ])

                const { flights: offers, inboundFlights: inboundOffers, priceGraph: pg } = searchResult
                if (pg) setPriceGraph(pg)

                if (offers.length === 0) throw new Error('Nenhum voo encontrado para esta rota. Tente novamente em alguns instantes.')

                const toRow = (o: any, isReturn = false): ResultadoVoo => ({
                    id: 0,
                    busca_id: buscaId,
                    user_id: userId,
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
                    estrategia_disponivel: !isReturn,
                    moeda: 'BRL',
                    segmentos: o.segmentos,
                    detalhes: {
                        paradas: o.paradas, voo_numero: o.voo_numero,
                        carrierCode: o.carrierCode, layoverCity: o.layoverCity,
                        layoverDurations: o.layoverDurations, numeroVoos: o.numeroVoos,
                        aeronaves: o.aeronaves,
                        isRoundtripTotal: o.isRoundtripTotal || false,
                        returnPartida: o.returnPartida, returnChegada: o.returnChegada,
                        returnOrigem: o.returnOrigem, returnDestino: o.returnDestino,
                        returnDuracaoMin: o.returnDuracaoMin, returnParadas: o.returnParadas,
                        returnSegmentos: o.returnSegmentos,
                        ...(isReturn ? { isReturn: true } : {}),
                    },
                    created_at: new Date().toISOString(),
                } as unknown as ResultadoVoo)

                const rows        = offers.map(o => toRow(o, false))
                const inboundRows = inboundOffers.map(o => toRow(o, true))

                setFlights(rows)
                setInboundFlights(inboundRows)

                // Save to Supabase in background and update IDs when done
                const insertRows    = rows.map(({ id: _id, created_at: _ca, ...rest }) => rest)
                const insertInbound = inboundRows.map(({ id: _id, created_at: _ca, ...rest }) => rest)
                supabase.from('resultados_voos').insert([...insertRows, ...insertInbound])
                    .select('id, origem, destino, partida, companhia')
                    .then(({ data: saved, error: saveErr }) => {
                        if (saveErr || !saved?.length) return
                        const key = (r: { origem?: string | null; destino?: string | null; partida?: string | null; companhia?: string | null }) =>
                            `${r.origem}|${r.destino}|${r.partida}|${r.companhia}`
                        const idMap = new Map(saved.map(r => [key(r), r.id as number]))
                        setFlights(prev => prev.map(f => ({ ...f, id: idMap.get(key(f)) ?? f.id })))
                        setInboundFlights(prev => prev.map(f => ({ ...f, id: idMap.get(key(f)) ?? f.id })))
                    })

                // Write back the minimum price to buscas so Home can display it without querying resultados_voos
                const prices = rows.map(r => r.preco_brl ?? 0).filter(p => p > 0)
                if (prices.length > 0) {
                    const precoMinimo = Math.min(...prices)
                    supabase.from('buscas').update({ preco_minimo_brl: precoMinimo }).eq('id', buscaId).then()
                }

            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : 'Erro ao carregar resultados.'
                setError(msg)
                await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
            } finally {
                clearTimeout(loadingTimeout)
                setLoading(false)
            }
        }

        load()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading, buscaId, navigate])

    useEffect(() => () => { searchStepTimers.current.forEach(clearTimeout) }, [])

    // Seats.aero fetch — isolated effect with 20s timeout and retry support
    useEffect(() => {
        if (seatsTrigger === 0) return
        const p = seatsParamsRef.current
        if (!p) return

        const sessionKey = `seats_${buscaId}`

        // Session cache restore (cleared by handleSeatsRetry on retry)
        try {
            const cached = sessionStorage.getItem(sessionKey)
            if (cached) {
                const parsed = JSON.parse(cached)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSeatsFlights(parsed)
                    return
                }
            }
        } catch { /* ignore */ }

        const abort = new AbortController()
        setSeatsLoading(true)
        setSeatsError(null)

        let timedOut = false
        const timeoutId = setTimeout(() => {
            timedOut = true
            if (!abort.signal.aborted) {
                setSeatsLoading(false)
                setSeatsError('A busca de milhas demorou mais de 20s. Tente novamente.')
            }
        }, 20000)

        fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/search-flights`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: abort.signal,
            body: JSON.stringify({ origem: p.orig, destino: p.dest, data_ida: p.date, data_volta: p.ret }),
        })
            .then(r => { if (!r.ok) throw new Error(`Servidor retornou ${r.status}`); return r.json() })
            .then(data => {
                if (timedOut) return
                if (data.error) { setSeatsError(data.error); return }
                if (Array.isArray(data.voos) && data.voos.length > 0) {
                    setSeatsFlights(data.voos)
                    try { sessionStorage.setItem(sessionKey, JSON.stringify(data.voos)) } catch { /* quota */ }
                } else {
                    setSeatsFlights([])
                }
            })
            .catch(err => {
                if (err.name === 'AbortError') return
                if (timedOut) return
                setSeatsError('Não foi possível buscar milhas. Verifique a conexão com o servidor.')
            })
            .finally(() => { clearTimeout(timeoutId); setSeatsLoading(false) })

        return () => { clearTimeout(timeoutId); abort.abort() }
    }, [seatsTrigger, buscaId])

    const handleSeatsRetry = () => {
        try { sessionStorage.removeItem(`seats_${buscaId}`) } catch { /* ignore */ }
        setSeatsFlights([])
        setSeatsTrigger(t => t + 1)
    }

    const handleNewSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        setSearchError('')
        const originCode = originIata || origin.trim().toUpperCase()
        const destCode   = destIata   || dest.trim().toUpperCase()
        if (!originCode || !destCode)          return setSearchError('Selecione origem e destino.')
        if (originCode.length !== 3)           return setSearchError('Selecione um aeroporto válido na origem.')
        if (destCode.length !== 3)             return setSearchError('Selecione um aeroporto válido no destino.')
        if (!dateGo)                           return setSearchError('Informe a data de ida.')
        if (!user)                             return setSearchError('Faça login para buscar voos.')

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
        } catch (err: unknown) {
            setSearchError(err instanceof Error ? err.message : 'Erro ao buscar.')
        } finally {
            setSearchLoading(false)
        }
    }

    if (loading) return <PlaneWindowLoader />

    return (
        <>
        <div style={{ minHeight: '100vh', background: 'var(--snow)', fontFamily: 'Manrope, system-ui, sans-serif' }}>
        <style>{`
            @media (max-width: 768px) {
                .fly-results-outer { padding: 16px 12px 100px !important; flex-direction: column !important; }
                .fly-sidebar-col { display: none; }
                .fly-sidebar-col.open { display: block; }
                .fly-mobile-filters-btn { display: flex !important; }
                .fly-results-header { padding: 0 12px 12px !important; }
                .fly-searchbar-wrap { padding: 8px 12px 12px !important; }
            }
        `}</style>

            {/* Header + Search Bar */}
            <div style={{ background: 'var(--bg-white)', borderBottom: '1px solid var(--border-light)', position: 'sticky', top: 0, zIndex: 50 }}>
                <div className="fly-results-header" style={{ maxWidth: '1280px', margin: '0 auto', padding: '0 28px' }}>
                    <Header variant="app" />
                </div>
                <div className="fly-searchbar-wrap" style={{ maxWidth: '1280px', margin: '0 auto', padding: '14px 28px 18px' }}>
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

            {/* Main Content */}
            <div className="fly-results-outer" style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 28px 80px', display: 'flex', gap: '24px', alignItems: 'flex-start' }}>

                <div className={`fly-sidebar-col${showMobileFilters ? ' open' : ''}`}>
                    <Sidebar filters={filters} setFilters={setFilters} allAirlines={allAirlines} priceMax={priceMax} />
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <button onClick={() => setShowMobileFilters(!showMobileFilters)}
                        className="fly-mobile-filters-btn"
                        style={{ display: 'none', alignItems: 'center', gap: '8px', marginBottom: '16px', padding: '10px 16px', background: '#fff', border: '1px solid var(--border-light)', borderRadius: '10px', fontFamily: 'inherit', fontSize: '13px', fontWeight: 600, color: 'var(--graphite)', cursor: 'pointer', width: '100%' }}>
                        <SlidersHorizontal size={14} /> {showMobileFilters ? 'Fechar Filtros' : 'Filtros'}
                    </button>

                    {error ? (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: '#fff', border: '1px solid var(--border-light)', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', padding: '60px', color: '#f87171' }}>
                            <AlertCircle size={40} />
                            <p style={{ fontSize: '15px', textAlign: 'center' }}>{error}</p>
                            <button onClick={() => navigate('/home')} className="btn" style={{ background: 'var(--blue-medium)', color: '#fff' }}>Voltar para busca</button>
                        </motion.div>
                    ) : (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            {/* View toggle */}
                            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                                {(['reais', 'milhas'] as const).map(v => (
                                    <button key={v} onClick={() => setActiveView(v)} style={{
                                        padding: '8px 20px', borderRadius: '10px', border: 'none',
                                        fontFamily: 'inherit', fontSize: '13px', fontWeight: 700,
                                        cursor: 'pointer', transition: 'all 0.15s',
                                        background: activeView === v ? '#0E2A55' : '#F1F5F9',
                                        color: activeView === v ? '#fff' : '#64748B',
                                    }}>
                                        {v === 'reais' ? 'Preços em Reais' : 'Preços em Milhas'}
                                    </button>
                                ))}
                            </div>

                            <div style={{ display: 'flex', flexDirection: activeView === 'milhas' ? 'column-reverse' : 'column', gap: '32px' }}>
                                {/* Section 1 — Amadeus / BRL */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '4px', height: '20px', background: 'var(--blue-medium)', borderRadius: '4px' }} />
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0 }}>Melhores Preços em Reais</h2>
                                    </div>
                                    {priceGraph && dateGo && (
                                        <PriceGraphPanel priceGraph={priceGraph} searchDate={dateGo} />
                                    )}
                                    <FlightResultsGrouped
                                        flights={flights}
                                        inboundFlights={inboundFlights}
                                        buscaId={buscaId}
                                        searchInfo={busca ? { origem: busca.origem, destino: busca.destino, data_ida: busca.data_ida, passageiros: busca.passageiros } : undefined}
                                        onNewSearch={() => { (document.querySelector('input[placeholder="De — GRU"]') as HTMLInputElement)?.focus() }}
                                        sidebarFilters={filters}
                                        returnDate={dateBack || undefined}
                                        cashIdaSel={cashIdaSel}
                                        onSelectCashIda={setCashIdaSel}
                                        cashVoltaSel={cashVoltaSel}
                                        onSelectCashVolta={setCashVoltaSel}
                                        onMonitorar={(flight) => setWatchlistModal({
                                            type: 'cash',
                                            origin: flight.origem || originIata || '',
                                            destination: flight.destino || destIata || '',
                                            currentPriceBrl: flight.preco_brl ?? 0,
                                            airline: flight.companhia ?? undefined,
                                            travelDate: flight.partida ? flight.partida.slice(0, 10) : (dateGo || undefined),
                                        })}
                                    />
                                </div>

                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '8px 0' }} />

                                {/* Section 2 — Seats.aero / Miles */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '4px', height: '20px', background: '#16A34A', borderRadius: '4px' }} />
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0 }}>Oportunidades em Milhas (Seats.aero)</h2>
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <SeatsFlightPanel
                                            seatsFlights={seatsFlights}
                                            seatsLoading={seatsLoading}
                                            seatsError={seatsError}
                                            flights={flights}
                                            inboundFlights={inboundFlights}
                                            cashIdaSel={cashIdaSel}
                                            cashVoltaSel={cashVoltaSel}
                                            originIata={originIata}
                                            destIata={destIata}
                                            onOpenStrategy={(ctx, cashPrice) => {
                                                setStratContext(ctx)
                                                setStratCashPrice(cashPrice)
                                                setStratOpen(true)
                                            }}
                                            onOpenWatchlist={setWatchlistModal}
                                            onRetry={handleSeatsRetry}
                                        />
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>

        {stratOpen && stratContext && (
            <StrategyPanel
                open={stratOpen}
                seatsContext={stratContext}
                cashPrice={stratCashPrice}
                buscaId={buscaId}
                onClose={() => setStratOpen(false)}
            />
        )}

        <WatchlistModal
            open={watchlistModal !== null}
            onClose={() => setWatchlistModal(null)}
            {...(watchlistModal ?? { type: 'cash', origin: '', destination: '' })}
        />
        </>
    )
}
