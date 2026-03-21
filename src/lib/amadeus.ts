/**
 * amadeus.ts — Client para o proxy Amadeus rodando no servidor Express (server.js).
 * Backend: Railway (web-production-c819c.up.railway.app)
 *
 * As credenciais (CLIENT_ID / CLIENT_SECRET) ficam exclusivamente no servidor.
 * O frontend apenas chama o proxy em /api/amadeus/*.
 */

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? ''

// ─── Duration ISO8601 → minutes ───────────────────────────────────────────────
function parseDuration(iso: string): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
    if (!m) return 0
    return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0')
}

// ─── Airline code → name ──────────────────────────────────────────────────────
const AIRLINE_NAMES: Record<string, string> = {
    LA: 'LATAM Airlines', JJ: 'LATAM Airlines',
    G3: 'GOL Linhas Aéreas', AD: 'Azul Linhas Aéreas',
    AA: 'American Airlines', UA: 'United Airlines', DL: 'Delta Air Lines',
    AF: 'Air France', KL: 'KLM', LH: 'Lufthansa',
    TP: 'TAP Air Portugal', IB: 'Iberia', BA: 'British Airways',
    EK: 'Emirates', QR: 'Qatar Airways', TK: 'Turkish Airlines',
    LX: 'Swiss', OS: 'Austrian Airlines', AZ: 'ITA Airways',
    ET: 'Ethiopian Airlines', CM: 'Copa Airlines', AV: 'Avianca',
}

// ─── Cabin class mapping ──────────────────────────────────────────────────────
const CABIN_PT: Record<string, string> = {
    ECONOMY: 'economy', PREMIUM_ECONOMY: 'premium_economy',
    BUSINESS: 'business', FIRST: 'first',
}

// ─── Airport / Location search ────────────────────────────────────────────────
export interface Airport {
    iataCode: string
    name: string
    cityName: string
    countryCode: string
    label: string
}

/** Busca aeroportos via proxy do servidor (sem expor credenciais no frontend) */
export async function searchAirports(keyword: string): Promise<Airport[]> {
    if (!keyword || keyword.trim().length < 2) return []
    const url = `${API_BASE}/api/amadeus/airports?` + new URLSearchParams({ keyword: keyword.trim() })
    const res = await fetch(url).catch(() => null)
    if (!res || !res.ok) return []
    const data = await res.json()
    return (data.data ?? []).map((loc: any): Airport => ({
        iataCode: loc.iataCode,
        name: loc.name,
        cityName: loc.address?.cityName ?? '',
        countryCode: loc.address?.countryCode ?? '',
        label: `${loc.address?.cityName ?? loc.name} (${loc.iataCode}) — ${loc.address?.countryCode ?? ''}`,
    }))
}

// ─── Flight search ────────────────────────────────────────────────────────────
export interface FlightOffer {
    id: string
    companhia: string
    carrierCode: string
    preco_brl: number
    taxas_brl: number
    partida: string
    chegada: string
    origem: string
    destino: string
    duracao_min: number
    paradas: number
    returnPartida?: string
    returnChegada?: string
    returnOrigem?: string
    returnDestino?: string
    returnDuracaoMin?: number
    returnParadas?: number
    returnSegmentos?: unknown
    cabin_class: string
    voo_numero: string
    segmentos: unknown
    flight_key: string
    provider: 'amadeus' | 'google'
}

export interface SearchFlightsParams {
    origin: string
    destination: string
    departureDate: string
    adults?: number
    returnDate?: string
    cabin?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST'
    max?: number
    nonStop?: boolean
}

export interface FlightSearchResult {
    flights: FlightOffer[]
    inboundFlights: FlightOffer[]
}

/** Busca voos via proxy do servidor com timeout de 12s */
export async function searchFlights(params: SearchFlightsParams): Promise<FlightSearchResult> {
    const qp: Record<string, string> = {
        originLocationCode: params.origin.trim().toUpperCase(),
        destinationLocationCode: params.destination.trim().toUpperCase(),
        departureDate: params.departureDate,
        adults: String(params.adults ?? 1),
        currencyCode: 'BRL',
        max: String(params.max ?? 50),
    }
    if (params.returnDate) qp.returnDate = params.returnDate
    if (params.cabin) qp.travelClass = params.cabin
    if (params.nonStop) qp.nonStop = 'true'

    console.log('[Amadeus] searchFlights:', qp)

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 120000)

    let data: any
    try {
        const res = await fetch(
            `${API_BASE}/api/amadeus/flights?${new URLSearchParams(qp)}`,
            { signal: controller.signal }
        ).catch((err: any) => {
            if (err?.name === 'AbortError') throw new Error('A busca demorou muito (timeout). Tente novamente.')
            throw new Error(`Servidor backend não está respondendo em ${API_BASE}. Certifique-se de que o servidor está rodando com: node server.js`)
        })
        data = await res.json()
        if (!res.ok) {
            const detail = data.errors?.[0]?.detail ?? data.errors?.[0]?.title ?? 'Erro ao buscar voos'
            console.error('[Amadeus] Flight search error:', detail)
            throw new Error(detail)
        }
    } finally {
        clearTimeout(timeoutId)
    }

    console.log('[Amadeus] Flight search result:', data.data?.length, 'offers')
    const offers: any[] = data.data ?? []

    // Se o backend já retornou dados mapeados (Google Flights scraper), devolve direto
    if (data.meta?.source === 'google-flights-scraper') {
        return {
            flights: offers as FlightOffer[],
            inboundFlights: (data.inbound ?? []) as FlightOffer[],
        }
    }

    const mappedFlights = offers.filter((offer: any) => offer?.itineraries?.length).map((offer): FlightOffer => {
        const itin0 = offer.itineraries[0]
        const segs0: any[] = itin0.segments
        const first0 = segs0[0]
        const last0 = segs0[segs0.length - 1]
        const carrier = first0.carrierCode as string
        const totalBrl = parseFloat(offer.price.grandTotal ?? offer.price.total)
        const baseBrl = parseFloat(offer.price.base ?? '0')
        const taxas = Math.max(0, totalBrl - baseBrl)
        const cabin = (offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin as string | undefined) ?? 'ECONOMY'

        const itin1 = offer.itineraries[1]
        let returnFields: Partial<FlightOffer> = {}
        if (itin1) {
            const segs1: any[] = itin1.segments
            const first1 = segs1[0]
            const last1 = segs1[segs1.length - 1]
            returnFields = {
                returnPartida: first1.departure.at,
                returnChegada: last1.arrival.at,
                returnOrigem: first1.departure.iataCode,
                returnDestino: last1.arrival.iataCode,
                returnDuracaoMin: parseDuration(itin1.duration),
                returnParadas: segs1.length - 1,
                returnSegmentos: segs1.map((s: any) => ({
                    origem: s.departure.iataCode,
                    partida: s.departure.at,
                    destino: s.arrival.iataCode,
                    chegada: s.arrival.at,
                    companhia: AIRLINE_NAMES[s.carrierCode] ?? s.carrierCode,
                    numero: `${s.carrierCode}${s.number}`,
                    duracao_min: parseDuration(s.duration),
                })),
            }
        }

        return {
            id: offer.id,
            companhia: AIRLINE_NAMES[carrier] ?? carrier,
            carrierCode: carrier,
            preco_brl: totalBrl,
            taxas_brl: taxas,
            partida: first0.departure.at,
            chegada: last0.arrival.at,
            origem: first0.departure.iataCode,
            destino: last0.arrival.iataCode,
            duracao_min: parseDuration(itin0.duration),
            cabin_class: CABIN_PT[cabin] ?? 'economy',
            paradas: segs0.length - 1,
            voo_numero: `${carrier}${first0.number}`,
            segmentos: segs0.map((s: any) => ({
                origem: s.departure.iataCode,
                partida: s.departure.at,
                destino: s.arrival.iataCode,
                chegada: s.arrival.at,
                companhia: AIRLINE_NAMES[s.carrierCode] ?? s.carrierCode,
                numero: `${s.carrierCode}${s.number}`,
                duracao_min: parseDuration(s.duration),
            })),
            flight_key: `${offer.id}-${carrier}-${first0.number}-${params.departureDate}-${first0.departure.iataCode}-${last0.arrival.iataCode}`,
            provider: 'amadeus',
            ...returnFields,
        }
    })
    return { flights: mappedFlights, inboundFlights: [] }
}
