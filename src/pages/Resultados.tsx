import { useEffect, useState, useRef, useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { AlertCircle, SlidersHorizontal, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { supabase, type ResultadoVoo, type Busca } from '@/lib/supabase'
import { searchFlights } from '@/lib/amadeus'
import { useAuth } from '@/contexts/AuthContext'
import { Header } from '@/components/Header'
import { FlightResultsGrouped } from '@/components/FlightResultsGrouped'
import { StrategyPanel, type SeatsContext } from '@/components/StrategyPanel'
import { PlaneWindowLoader } from '@/components/PlaneWindowLoader'
import { Sidebar, type FilterState } from '@/components/Sidebar'
import { SearchBarTop } from '@/components/SearchBarTop'
import { motion, AnimatePresence } from 'framer-motion'

// Global guard (multi-layer) to prevent infinite loops even if component remounts
let GLOBAL_LAST_BUSCA_ID: number | null = null;

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
    const [activeView, setActiveView] = useState<'reais' | 'milhas'>('reais')
    const [seatsPhase, setSeatsPhase] = useState<'ida' | 'volta' | 'summary'>('ida')
    const [seatsIdaSel, setSeatsIdaSel] = useState<any | null>(null)
    const [seatsVoltaSel, setSeatsVoltaSel] = useState<any | null>(null)
    const [seatsDetailOpen, setSeatsDetailOpen] = useState<Set<string>>(new Set())

    // Strategy panel state (opened from milhas summary)
    const [stratOpen, setStratOpen] = useState(false)
    const [stratContext, setStratContext] = useState<SeatsContext | null>(null)
    const [stratCashPrice, setStratCashPrice] = useState(0)

    // Sidebar state
    const [filters, setFilters] = useState<FilterState>({ sortBy: 'best', stops: [], airlines: [], maxPrice: null })
    const [showMobileFilters, setShowMobileFilters] = useState(false)

    // Derived values for sidebar
    const allAirlines = useMemo(() =>
        [...new Set(flights.map(f => f.companhia).filter(Boolean) as string[])].sort()
    , [flights])
    const priceMax = useMemo(() =>
        Math.max(...flights.map(f => f.preco_brl ?? 0), 0)
    , [flights])

    // Guard: prevent re-running load() for the same buscaId
    const lastBuscaId = useRef<number | null>(null)

    useEffect(() => {
        const userId = user?.id
        if (!userId || !buscaId) {
            if (!authLoading && !userId) {
                console.log('[Resultados] Usuário não logado, enviando para home')
                navigate('/home')
            }
            return
        }

        console.log('[Resultados] useEffect disparado. buscaId:', buscaId, 'last:', lastBuscaId.current)

        if (lastBuscaId.current === buscaId || GLOBAL_LAST_BUSCA_ID === buscaId) {
            console.log('[Resultados] 🛑 BLOQUEIO: Busca já em curso para este ID:', buscaId)
            return
        }

        lastBuscaId.current = buscaId
        GLOBAL_LAST_BUSCA_ID = buscaId
        console.log('[Resultados] 🚀 INICIANDO LOGICA DE CARREGAMENTO PARA ID:', buscaId)

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

            // Fail-safe: force loading = false after 75s (Google Flights scraper pode levar ~30-60s)
            const loadingTimeout = setTimeout(() => {
                console.warn('[Resultados] FAIL-SAFE: Forçando carregamento = false após 75s')
                setLoading(false)
            }, 75000)

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
                    // Set return date from DB or URL param
                    const retDate = buscaData.data_volta ?? ret ?? ''
                    setDateBack(retDate)
                    if (retDate) setTripType('round-trip')
                }

                // 2. Check for already-saved results
                const { data: cached, error: cacheErr } = await supabase
                    .from('resultados_voos').select('*')
                    .eq('busca_id', buscaId).eq('user_id', user.id)
                    .order('preco_brl')
                if (cacheErr) throw cacheErr

                if (cached && cached.length > 0) {
                    // Already have results — split outbound/inbound by isReturn flag
                    const outbound = cached.filter(f => !(f.detalhes as any)?.isReturn)
                    const inbound = cached.filter(f => !!(f.detalhes as any)?.isReturn)
                    await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
                    setFlights(outbound)
                    setInboundFlights(inbound)
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

                // 3.1 Fetch Seats.aero in parallel (non-blocking)
                setSeatsLoading(true)
                console.log('[Resultados] Iniciando fetch Seats.aero para:', orig, destP)
                fetch(`${import.meta.env.VITE_API_BASE_URL ?? ''}/api/search-flights`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        origem: orig,
                        destino: destP,
                        data_ida: date,
                        data_volta: ret || undefined
                    })
                })
                    .then(res => {
                        console.log('[Resultados] Resposta Seats.aero recebida:', res.status)
                        return res.json()
                    })
                    .then(data => {
                        console.log('[Resultados] Dados Seats.aero:', data)
                        if (data.voos) setSeatsFlights(data.voos)
                    })
                    .catch(err => console.error('[Resultados] Erro ao buscar seatsaero:', err))
                    .finally(() => {
                        console.log('[Resultados] Finalizado seatsLoading')
                        setSeatsLoading(false)
                    })

                const [searchResult] = await Promise.all([
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

                const offers = searchResult.flights
                const inboundOffers = searchResult.inboundFlights

                console.log('[Resultados] Got', offers.length, 'offers from Amadeus', inboundOffers.length, 'inbound')

                if (offers.length === 0) {
                    setFlights([])
                    return
                }

                // Display results immediately - don't wait for Supabase save
                const rows = offers.map(o => ({
                    id: 0,
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
                    // Store all return leg info + stops in detalhes
                    detalhes: {
                        paradas: o.paradas,
                        voo_numero: o.voo_numero,
                        layoverCity: (o as any).layoverCity,
                        layoverDurations: (o as any).layoverDurations,
                        numeroVoos: (o as any).numeroVoos,
                        aeronaves: (o as any).aeronaves,
                        returnPartida: o.returnPartida,
                        returnChegada: o.returnChegada,
                        returnOrigem: o.returnOrigem,
                        returnDestino: o.returnDestino,
                        returnDuracaoMin: o.returnDuracaoMin,
                        returnParadas: o.returnParadas,
                        returnSegmentos: o.returnSegmentos,
                    },
                    created_at: new Date().toISOString(),
                } as unknown as ResultadoVoo))

                // Map inbound flights to ResultadoVoo rows
                const inboundRows = inboundOffers.map(o => ({
                    id: 0,
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
                    estrategia_disponivel: false,
                    moeda: 'BRL',
                    segmentos: o.segmentos,
                    detalhes: {
                        paradas: o.paradas,
                        voo_numero: o.voo_numero,
                        layoverCity: (o as any).layoverCity,
                        layoverDurations: (o as any).layoverDurations,
                        numeroVoos: (o as any).numeroVoos,
                        aeronaves: (o as any).aeronaves,
                    },
                    created_at: new Date().toISOString(),
                } as unknown as ResultadoVoo))

                // Show results right away
                setFlights(rows)
                setInboundFlights(inboundRows)

                // Save outbound + inbound to Supabase in background (non-blocking)
                // Use .select() to get back DB-assigned IDs and update local state
                const insertRows = rows.map(r => { const { id, ...rest } = r; return rest })
                const insertInbound = inboundRows.map(r => {
                    const { id, ...rest } = r
                    return { ...rest, detalhes: { ...(rest.detalhes as object ?? {}), isReturn: true } }
                })
                supabase
                    .from('resultados_voos')
                    .insert([...insertRows, ...insertInbound])
                    .select('id, origem, destino, partida, companhia')
                    .then(({ data: saved, error: saveErr }) => {
                        if (saveErr) {
                            console.error('[Resultados] Save error (non-blocking):', saveErr)
                            return
                        }
                        if (!saved?.length) return
                        // Build lookup: "ORIGEM|DESTINO|PARTIDA|COMPANHIA" → id
                        const key = (r: { origem?: string | null, destino?: string | null, partida?: string | null, companhia?: string | null }) =>
                            `${r.origem}|${r.destino}|${r.partida}|${r.companhia}`
                        const idMap = new Map(saved.map(r => [key(r), r.id as number]))
                        setFlights(prev => prev.map(f => ({ ...f, id: idMap.get(key(f)) ?? f.id })))
                        setInboundFlights(prev => prev.map(f => ({ ...f, id: idMap.get(key(f)) ?? f.id })))
                    })

            } catch (e: unknown) {
                console.error('[Resultados] load error:', e)
                const msg = e instanceof Error ? e.message : 'Erro ao carregar resultados.'
                setError(msg)
                await new Promise<void>(r => setTimeout(r, MIN_ANIM_MS))
            } finally {
                clearTimeout(loadingTimeout)
                console.log('[Resultados] load() finalizado, removendo tela de loading')
                setLoading(false)
            }
        }

        load()
        // searchParams is captured at render time — buscaId change triggers re-run with fresh params
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, authLoading, buscaId, navigate])

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

    // Reset seat selection when new results arrive
    useEffect(() => {
        setSeatsPhase('ida')
        setSeatsIdaSel(null)
        setSeatsVoltaSel(null)
        setSeatsDetailOpen(new Set())
    }, [seatsFlights])

    // Seats.aero helpers
    const AIRLINE_FULL: Record<string, string> = {
        LA: 'LATAM Airlines', JJ: 'LATAM Airlines', G3: 'GOL', AD: 'Azul',
        AA: 'American Airlines', UA: 'United Airlines', DL: 'Delta Air Lines',
        AC: 'Air Canada', WS: 'WestJet', AF: 'Air France', KL: 'KLM',
        LH: 'Lufthansa', LX: 'Swiss', OS: 'Austrian Airlines', SN: 'Brussels Airlines',
        BA: 'British Airways', SK: 'SAS', AZ: 'ITA Airways', TP: 'TAP Portugal',
        IB: 'Iberia', AV: 'Avianca', CM: 'Copa Airlines', AM: 'Aeromexico',
        AR: 'Aerolíneas Argentinas', UX: 'Air Europa', ET: 'Ethiopian Airlines',
        TK: 'Turkish Airlines', EK: 'Emirates', QR: 'Qatar Airways',
        SQ: 'Singapore Airlines', JL: 'Japan Airlines', NH: 'ANA',
        CX: 'Cathay Pacific', MH: 'Malaysia Airlines', B6: 'JetBlue',
        AS: 'Alaska Airlines', WN: 'Southwest', VS: 'Virgin Atlantic',
        EI: 'Aer Lingus', FR: 'Ryanair',
    }
    const SOURCE_PROGRAM: Record<string, { name: string; color: string; bg: string }> = {
        smiles:         { name: 'Smiles',        color: '#F97316', bg: '#FFF7ED' },
        delta:          { name: 'SkyMiles',       color: '#003DA5', bg: '#EFF6FF' },
        american:       { name: 'AAdvantage',     color: '#B91C1C', bg: '#FEF2F2' },
        united:         { name: 'MileagePlus',    color: '#004B87', bg: '#EFF6FF' },
        aeroplan:       { name: 'Aeroplan',       color: '#CC0000', bg: '#FEF2F2' },
        flyingblue:     { name: 'Flying Blue',    color: '#003087', bg: '#EFF6FF' },
        lifemiles:      { name: 'Lifemiles',      color: '#E63946', bg: '#FEF2F2' },
        virginatlantic: { name: 'Virgin Points',  color: '#E10A0A', bg: '#FEF2F2' },
        alaska:         { name: 'Mileage Plan',   color: '#01426A', bg: '#EFF6FF' },
        latam:          { name: 'LATAM Pass',     color: '#E31837', bg: '#FEF2F2' },
        azul:           { name: 'TudoAzul',       color: '#003DA5', bg: '#EFF6FF' },
        emirates:       { name: 'Skywards',       color: '#C09846', bg: '#FFFBEB' },
        turkish:        { name: 'Miles&Smiles',   color: '#C8102E', bg: '#FEF2F2' },
        jetblue:        { name: 'TrueBlue',       color: '#003876', bg: '#EFF6FF' },
        iberia:         { name: 'Iberia Plus',    color: '#C41E3A', bg: '#FEF2F2' },
        singapore:      { name: 'KrisFlyer',      color: '#1A3C5E', bg: '#EFF6FF' },
        qatar:          { name: 'Avios (Qatar)',   color: '#5C0632', bg: '#FDF2F8' },
        british:        { name: 'Avios (BA)',      color: '#2B5FA5', bg: '#EFF6FF' },
        avianca:        { name: 'Lifemiles',      color: '#E63946', bg: '#FEF2F2' },
    }
    const CABIN_COLOR: Record<string, string> = {
        'Economy': '#2A60C2', 'Premium Economy': '#7C3AED',
        'Business': '#0E2A55', 'First': '#92400E',
    }
    const fmtDurSeats = (min?: number | null) => {
        if (!min) return null
        return `${Math.floor(min / 60)}h${min % 60 > 0 ? ` ${min % 60}min` : ''}`
    }
    const stopLabelSeats = (n: number, escalas?: string[]) => {
        if (n === 0) return 'Direto'
        const via = escalas?.length ? ` via ${escalas.join(', ')}` : ''
        return `${n} ${n === 1 ? 'conexão' : 'conexões'}${via}`
    }
    const idaFlights = seatsFlights.filter(sf => sf.tipo === 'ida')
    const voltaFlights = seatsFlights.filter(sf => sf.tipo === 'volta')

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

            {/* ══════════════  HEADER + SEARCH BAR  ══════════════ */}
            <div style={{
                background: 'var(--bg-white)',
                borderBottom: '1px solid var(--border-light)',
                position: 'sticky', top: 0, zIndex: 50,
            }}>
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

            {/* ══════════════  MAIN CONTENT — 2 COLUMNS  ══════════════ */}
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
                            {/* ── Toggle de view ──────────────────────────────── */}
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
                                {/* Section 1: Amadeus / BRL Results */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '4px', height: '20px', background: 'var(--blue-medium)', borderRadius: '4px' }}></div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0 }}>
                                            Melhores Preços em Reais
                                        </h2>
                                    </div>
                                    <FlightResultsGrouped
                                        flights={flights}
                                        inboundFlights={inboundFlights}
                                        buscaId={buscaId}
                                        searchInfo={busca ? { origem: busca.origem, destino: busca.destino, data_ida: busca.data_ida, passageiros: busca.passageiros } : undefined}
                                        onNewSearch={() => { (document.querySelector('input[placeholder="De — GRU"]') as HTMLInputElement)?.focus() }}
                                        sidebarFilters={filters}
                                        returnDate={dateBack || undefined}
                                    />
                                </div>

                                {/* Divider */}
                                <div style={{ height: '1px', background: 'var(--border-light)', margin: '8px 0' }}></div>

                                {/* Section 2: Seats.aero / Miles Results */}
                                <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                                        <div style={{ width: '4px', height: '20px', background: '#16A34A', borderRadius: '4px' }}></div>
                                        <h2 style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', margin: 0 }}>
                                            Oportunidades em Milhas (Seats.aero)
                                        </h2>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        {seatsLoading ? (
                                            <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Buscando passagens emissíveis por milhas na base Pro (Seats.aero)...</p>
                                            </div>
                                        ) : seatsFlights.length === 0 ? (
                                            <div style={{ padding: '40px', textAlign: 'center', background: '#fff', borderRadius: '16px', border: '1px solid var(--border-light)' }}>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Nenhum voo encontrado no Seats.aero para esta rota.</p>
                                            </div>
                                        ) : (
                                            <>
                                            {seatsPhase === 'summary' ? (
                                                /* ── Resumo da seleção ── */
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                        <CheckCircle2 size={20} color="#16A34A" />
                                                        <span style={{ fontSize: 15, fontWeight: 800, color: '#16A34A' }}>Viagem selecionada</span>
                                                    </div>
                                                    {[seatsIdaSel, seatsVoltaSel].filter(Boolean).map((sf, i) => {
                                                        const ac = sf.companhiaAerea ?? ''
                                                        return (
                                                            <div key={i} style={{ background: '#fff', border: '2px solid #16A34A', borderRadius: 16, padding: '14px 20px' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                        {ac && <img src={`https://pics.avs.io/60/30/${ac}.png`} alt="" style={{ height: 24, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                                                                        <div>
                                                                            <div style={{ fontSize: 14, fontWeight: 700, color: '#0E2A55' }}>{AIRLINE_FULL[ac] ?? ac}</div>
                                                                            <div style={{ fontSize: 11, color: '#94A3B8' }}>{sf.tipo === 'ida' ? 'Ida' : 'Volta'} · {sf.dataVoo} · {sf.origem} → {sf.destino}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ textAlign: 'right' }}>
                                                                        <div style={{ fontSize: 11, color: sf.paradas === 0 ? '#16A34A' : '#64748B', fontWeight: 600, marginBottom: 2 }}>{stopLabelSeats(sf.paradas ?? 0, sf.escalas)}</div>
                                                                        <div style={{ fontSize: 20, fontWeight: 900, color: '#0E2A55' }}>{typeof sf.precoMilhas === 'number' ? sf.precoMilhas.toLocaleString('pt-BR') : sf.precoMilhas} pts</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })}
                                                    {/* Total em milhas */}
                                                    <div style={{ background: '#0E2A55', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                                                        <div>
                                                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>
                                                                {seatsVoltaSel ? 'Total ida + volta' : 'Total ida'}
                                                            </div>
                                                            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>
                                                                {((seatsIdaSel?.precoMilhas ?? 0) + (seatsVoltaSel?.precoMilhas ?? 0)).toLocaleString('pt-BR')} pts
                                                            </div>
                                                            {(() => {
                                                                const bestCash = Math.min(...flights.filter(f => (f.preco_brl ?? 0) > 0).map(f => f.preco_brl!))
                                                                return isFinite(bestCash) ? (
                                                                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                                                                        Melhor preço em dinheiro: R$ {bestCash.toLocaleString('pt-BR')}
                                                                    </div>
                                                                ) : null
                                                            })()}
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const sf = seatsIdaSel
                                                                const bestCash = Math.min(...flights.filter(f => (f.preco_brl ?? 0) > 0).map(f => f.preco_brl!))
                                                                const ctx: SeatsContext = {
                                                                    airlineCode: sf.companhiaAerea ?? '',
                                                                    airlineName: AIRLINE_FULL[sf.companhiaAerea ?? ''] ?? sf.companhiaAerea ?? '',
                                                                    origem: sf.origem ?? '',
                                                                    destino: sf.destino ?? '',
                                                                    cabin: sf.cabineEncontrada ?? 'Economy',
                                                                    program: SOURCE_PROGRAM[sf.source?.toLowerCase() ?? '']?.name ?? sf.source ?? '',
                                                                    idaMilhas: sf.precoMilhas ?? 0,
                                                                    voltaMilhas: seatsVoltaSel?.precoMilhas,
                                                                    totalMilhas: (sf.precoMilhas ?? 0) + (seatsVoltaSel?.precoMilhas ?? 0),
                                                                    isRoundTrip: !!seatsVoltaSel,
                                                                    dataVoo: sf.dataVoo ?? '',
                                                                    taxas: sf.taxas,
                                                                }
                                                                setStratContext(ctx)
                                                                setStratCashPrice(isFinite(bestCash) ? bestCash : 0)
                                                                setStratOpen(true)
                                                            }}
                                                            style={{
                                                                background: 'linear-gradient(135deg, #16A34A, #22C55E)',
                                                                color: '#fff', border: 'none', borderRadius: 10,
                                                                padding: '10px 20px', fontSize: 13, fontWeight: 700,
                                                                cursor: 'pointer', fontFamily: 'inherit',
                                                                display: 'flex', alignItems: 'center', gap: 6,
                                                                boxShadow: '0 4px 12px rgba(22,163,74,0.4)',
                                                                whiteSpace: 'nowrap' as const,
                                                            }}
                                                        >
                                                            ⚡ Gerar Estratégia
                                                        </button>
                                                    </div>
                                                    <button onClick={() => { setSeatsPhase('ida'); setSeatsIdaSel(null); setSeatsVoltaSel(null) }} style={{ alignSelf: 'flex-start', background: 'none', border: '1px solid #CBD5E1', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 600, color: '#64748B', cursor: 'pointer', fontFamily: 'inherit' }}>← Escolher novamente</button>
                                                </div>
                                            ) : (
                                                <>
                                                    {/* Ida selecionada — card completo com badge verde */}
                                                    {seatsPhase === 'volta' && seatsIdaSel && (() => {
                                                        const sf = seatsIdaSel
                                                        const ac = sf.companhiaAerea ?? ''
                                                        const prog = SOURCE_PROGRAM[sf.source?.toLowerCase() ?? '']
                                                        const cab = sf.cabineEncontrada ?? 'Economy'
                                                        return (
                                                            <div style={{ background: '#fff', border: '2px solid #16A34A', borderRadius: 16, overflow: 'hidden' }}>
                                                                <div style={{ background: '#16A34A', padding: '6px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                        <CheckCircle2 size={13} color="#fff" />
                                                                        <span style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.05em' }}>IDA SELECIONADA</span>
                                                                    </div>
                                                                    <button onClick={() => { setSeatsPhase('ida'); setSeatsIdaSel(null) }} style={{ background: 'none', border: 'none', fontSize: 11, color: 'rgba(255,255,255,0.85)', cursor: 'pointer', fontFamily: 'inherit', padding: 0, fontWeight: 600 }}>← Mudar ida</button>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #F0FDF4' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                        {ac && <img src={`https://pics.avs.io/60/30/${ac}.png`} alt="" style={{ height: 24, objectFit: 'contain' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                                                                        <div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' as const }}>
                                                                                <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{AIRLINE_FULL[ac] ?? ac}</span>
                                                                                <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: CABIN_COLOR[cab] ?? '#0E2A55', color: '#fff' }}>{cab}</span>
                                                                                {prog && <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: prog.bg, color: prog.color }}>{prog.name}</span>}
                                                                            </div>
                                                                            <span style={{ fontSize: 10, color: '#94A3B8' }}>{sf.dataVoo}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span style={{ fontSize: 18, fontWeight: 900, color: '#0E2A55' }}>{typeof sf.precoMilhas === 'number' ? sf.precoMilhas.toLocaleString('pt-BR') : sf.precoMilhas} pts</span>
                                                                </div>
                                                                <div style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
                                                                    <div style={{ textAlign: 'center', minWidth: 40 }}>
                                                                        {sf.partida && <div style={{ fontSize: 16, fontWeight: 800, color: '#0E2A55' }}>{sf.partida}</div>}
                                                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{sf.origem}</div>
                                                                    </div>
                                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                                                                        <div style={{ position: 'relative', height: 1, background: '#BBF7D0', width: '100%' }}>
                                                                            <span style={{ position: 'absolute', right: -1, top: -5, fontSize: 10, color: '#16A34A' }}>✈</span>
                                                                        </div>
                                                                        <span style={{ fontSize: 9, color: sf.paradas === 0 ? '#16A34A' : '#94A3B8', fontWeight: sf.paradas === 0 ? 700 : 400 }}>{stopLabelSeats(sf.paradas ?? 0, sf.escalas)}</span>
                                                                    </div>
                                                                    <div style={{ textAlign: 'center', minWidth: 40 }}>
                                                                        {sf.chegada && <div style={{ fontSize: 16, fontWeight: 800, color: '#0E2A55' }}>{sf.chegada}</div>}
                                                                        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748B' }}>{sf.destino}</div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )
                                                    })()}

                                                    {/* Divider de volta */}
                                                    {seatsPhase === 'volta' && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 12px' }}>
                                                            <div style={{ flex: 1, height: '1px', background: '#BBF7D0' }} />
                                                            <span style={{ fontSize: '11px', fontWeight: 700, color: '#16A34A', letterSpacing: '0.06em', textTransform: 'uppercase' as const }}>✈ Selecione a volta</span>
                                                            <div style={{ flex: 1, height: '1px', background: '#BBF7D0' }} />
                                                        </div>
                                                    )}

                                                    {/* Cards de voo */}
                                                    {(seatsPhase === 'ida' ? idaFlights : voltaFlights).map((sf, sfIdx) => {
                                                        const cardKey = `${sf.companhiaAerea}-${sf.source}-${sf.dataVoo}-${sfIdx}`
                                                        const isDetailOpen = seatsDetailOpen.has(cardKey)
                                                        const toggleDetail = () => setSeatsDetailOpen(prev => {
                                                            const next = new Set(prev)
                                                            if (next.has(cardKey)) next.delete(cardKey)
                                                            else next.add(cardKey)
                                                            return next
                                                        })
                                                        const airlineCode = sf.companhiaAerea ?? ''
                                                        const airlineName = AIRLINE_FULL[airlineCode] ?? airlineCode
                                                        const program = SOURCE_PROGRAM[sf.source?.toLowerCase() ?? '']
                                                        const activeCabin = sf.cabineEncontrada ?? 'Economy'
                                                        return (
                                                            <motion.div key={cardKey} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: sfIdx * 0.03 }}
                                                                style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow-xs)' }}>
                                                                {/* Cabeçalho */}
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid #F0FDF4' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                        {airlineCode && <img src={`https://pics.avs.io/60/30/${airlineCode}.png`} alt={airlineName} style={{ height: 28, objectFit: 'contain', borderRadius: 4 }} onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />}
                                                                        <div>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' as const }}>
                                                                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#0E2A55' }}>{airlineName}</span>
                                                                                <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 7px', borderRadius: '4px', background: CABIN_COLOR[activeCabin] ?? '#0E2A55', color: '#fff' }}>{activeCabin}</span>
                                                                                {program && <span style={{ fontSize: '10px', fontWeight: 800, padding: '2px 8px', borderRadius: '4px', background: program.bg, color: program.color, border: `1px solid ${program.color}33` }}>{program.name}</span>}
                                                                            </div>
                                                                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>{sf.dataVoo}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                        <div style={{ textAlign: 'right' }}>
                                                                            <div style={{ fontSize: '22px', fontWeight: 900, color: '#0E2A55', letterSpacing: '-0.02em' }}>{typeof sf.precoMilhas === 'number' ? sf.precoMilhas.toLocaleString('pt-BR') : sf.precoMilhas} pts</div>
                                                                            {sf.taxas && sf.taxas !== '0' && <div style={{ fontSize: '11px', color: '#94A3B8' }}>+ {sf.taxas} taxas</div>}
                                                                        </div>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (seatsPhase === 'ida') {
                                                                                    setSeatsIdaSel(sf)
                                                                                    if (voltaFlights.length > 0) setSeatsPhase('volta')
                                                                                    else setSeatsPhase('summary')
                                                                                } else {
                                                                                    setSeatsVoltaSel(sf)
                                                                                    setSeatsPhase('summary')
                                                                                }
                                                                            }}
                                                                            style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' as const }}>
                                                                            Selecionar →
                                                                        </button>
                                                                    </div>
                                                                </div>

                                                                {/* Timeline do voo */}
                                                                <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                                    <div style={{ textAlign: 'center', minWidth: 44 }}>
                                                                        {sf.partida && <div style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{sf.partida}</div>}
                                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginTop: 2 }}>{sf.origem || sf.rota?.split('→')[0]?.trim()}</div>
                                                                    </div>
                                                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                                                                        {fmtDurSeats(sf.duracaoMin) && <span style={{ fontSize: '11px', fontWeight: 600, color: '#64748B' }}>{fmtDurSeats(sf.duracaoMin)}</span>}
                                                                        <div style={{ position: 'relative', height: 1, background: '#BBF7D0', width: '100%' }}>
                                                                            <span style={{ position: 'absolute', right: -1, top: -5, fontSize: 11, color: '#16A34A' }}>✈</span>
                                                                        </div>
                                                                        <span style={{ fontSize: '10px', color: sf.paradas === 0 ? '#16A34A' : '#94A3B8', fontWeight: sf.paradas === 0 ? 700 : 400 }}>
                                                                            {stopLabelSeats(sf.paradas ?? 0, sf.escalas)}
                                                                        </span>
                                                                    </div>
                                                                    <div style={{ textAlign: 'center', minWidth: 44 }}>
                                                                        {sf.chegada && <div style={{ fontSize: '18px', fontWeight: 800, color: '#0E2A55', lineHeight: 1 }}>{sf.chegada}</div>}
                                                                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginTop: 2 }}>{sf.destino || sf.rota?.split('→').at(-1)?.trim()}</div>
                                                                    </div>
                                                                    {(sf.economy || sf.premiumEconomy || sf.business || sf.first) && (
                                                                        <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                                                                            {[
                                                                                { label: 'Eco', val: sf.economy, color: '#2A60C2' },
                                                                                { label: 'Prem', val: sf.premiumEconomy, color: '#7C3AED' },
                                                                                { label: 'Bus', val: sf.business, color: '#0E2A55' },
                                                                                { label: '1ª', val: sf.first, color: '#92400E' },
                                                                            ].filter(c => c.val != null).map(c => (
                                                                                <div key={c.label} style={{ textAlign: 'center', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: '4px 8px' }}>
                                                                                    <div style={{ fontSize: 9, fontWeight: 700, color: c.color, textTransform: 'uppercase' as const }}>{c.label}</div>
                                                                                    <div style={{ fontSize: 11, fontWeight: 800, color: '#0E2A55' }}>{typeof c.val === 'number' ? `${(c.val / 1000).toFixed(0)}k` : c.val}</div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                {/* Botão de detalhes */}
                                                                <div style={{ padding: '0 20px 10px' }}>
                                                                    <button onClick={toggleDetail} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#64748B', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', padding: 0 }}>
                                                                        {isDetailOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                                        {isDetailOpen ? 'Ocultar detalhes' : 'Ver detalhes do voo'}
                                                                    </button>
                                                                </div>

                                                                {/* Painel de detalhes */}
                                                                <AnimatePresence>
                                                                    {isDetailOpen && (
                                                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                                                                            style={{ overflow: 'hidden', borderTop: '1px solid #F0FDF4', background: '#F8FFF8' }}>
                                                                            <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                                                                                <div style={{ fontSize: 11, fontWeight: 800, color: '#64748B', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Detalhes do trajeto</div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' as const }}>
                                                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{sf.origem}</span>
                                                                                    {sf.escalas && sf.escalas.length > 0 && sf.escalas.map((esc: string, i: number) => (
                                                                                        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                            <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
                                                                                            <span style={{ fontSize: 12, fontWeight: 600, color: '#F97316', background: '#FFF7ED', padding: '2px 8px', borderRadius: 6 }}>{esc} (conexão)</span>
                                                                                        </span>
                                                                                    ))}
                                                                                    <span style={{ fontSize: 11, color: '#94A3B8' }}>→</span>
                                                                                    <span style={{ fontSize: 13, fontWeight: 700, color: '#0E2A55' }}>{sf.destino}</span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' as const }}>
                                                                                    <span style={{ fontSize: 12, color: '#64748B' }}><strong>Paradas:</strong> {sf.paradas === 0 ? 'Voo direto ✓' : `${sf.paradas} ${sf.paradas === 1 ? 'conexão' : 'conexões'}`}</span>
                                                                                    {sf.duracaoMin && <span style={{ fontSize: 12, color: '#64748B' }}><strong>Duração:</strong> {fmtDurSeats(sf.duracaoMin)}</span>}
                                                                                    <span style={{ fontSize: 12, color: '#64748B' }}><strong>Programa:</strong> {program?.name ?? sf.source}</span>
                                                                                </div>
                                                                            </div>
                                                                        </motion.div>
                                                                    )}
                                                                </AnimatePresence>
                                                            </motion.div>
                                                        )
                                                    })}
                                                </>
                                            )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            </div>
        </div>

        {/* Strategy Panel — opened from milhas summary */}
        {stratOpen && stratContext && (
            <StrategyPanel
                open={stratOpen}
                seatsContext={stratContext}
                cashPrice={stratCashPrice}
                buscaId={buscaId}
                onClose={() => setStratOpen(false)}
            />
        )}
        </>
    )
}
