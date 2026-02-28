/**
 * amadeus.ts — Client for Amadeus for Developers API
 * Docs: https://developers.amadeus.com
 *
 * Uses the TEST environment (test.api.amadeus.com).
 * To switch to production, change BASE_URL to https://api.amadeus.com
 */

const BASE_URL = 'https://test.api.amadeus.com'
const CLIENT_ID = import.meta.env.VITE_AMADEUS_CLIENT_ID as string
const CLIENT_SECRET = import.meta.env.VITE_AMADEUS_CLIENT_SECRET as string

// ─── Token cache (in-memory per session) ────────────────────────────────────
let _token: string | null = null
let _tokenExpiresAt = 0

async function getToken(): Promise<string> {
    const now = Date.now()
    if (_token && _tokenExpiresAt > now + 60_000) return _token

    if (!CLIENT_ID || !CLIENT_SECRET) {
        console.error('[Amadeus] MISSING env vars: VITE_AMADEUS_CLIENT_ID / VITE_AMADEUS_CLIENT_SECRET')
        throw new Error('Credenciais Amadeus não configuradas. Verifique as variáveis de ambiente na Vercel.')
    }

    console.log('[Amadeus] Requesting token...')
    const res = await fetch(`${BASE_URL}/v1/security/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
        }),
    })

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const msg = err.error_description ?? 'Falha ao autenticar com Amadeus'
        console.error('[Amadeus] Auth error:', msg)
        throw new Error(msg)
    }

    const data = await res.json()
    _token = data.access_token as string
    _tokenExpiresAt = now + (data.expires_in as number) * 1000
    console.log('[Amadeus] Token OK, expires in', data.expires_in, 's')
    return _token
}

// ─── Airline code → name ─────────────────────────────────────────────────────
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

// ─── Duration ISO8601 → minutes ──────────────────────────────────────────────
function parseDuration(iso: string): number {
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
    if (!m) return 0
    return (parseInt(m[1] ?? '0') * 60) + parseInt(m[2] ?? '0')
}

// ─── Airport / Location search ────────────────────────────────────────────────
export interface Airport {
    iataCode: string
    name: string
    cityName: string
    countryCode: string
    label: string  // display string
}

/** Search airports by keyword (city name or IATA code) */
export async function searchAirports(keyword: string): Promise<Airport[]> {
    if (!keyword || keyword.trim().length < 2) return []
    const token = await getToken()
    const url = `${BASE_URL}/v1/reference-data/locations?` + new URLSearchParams({
        keyword: keyword.trim(),
        subType: 'AIRPORT',
        'page[limit]': '6',
        sort: 'analytics.travelers.score',
        view: 'LIGHT',
    })
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return []
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
    // Outbound leg
    partida: string
    chegada: string
    origem: string
    destino: string
    duracao_min: number
    paradas: number
    // Return leg (only for round-trips)
    returnPartida?: string
    returnChegada?: string
    returnOrigem?: string
    returnDestino?: string
    returnDuracaoMin?: number
    returnParadas?: number
    returnSegmentos?: unknown
    // Other
    cabin_class: string
    voo_numero: string
    segmentos: unknown
    flight_key: string
    provider: 'amadeus'
}

export interface SearchFlightsParams {
    origin: string          // IATA
    destination: string     // IATA
    departureDate: string   // YYYY-MM-DD
    adults?: number
    returnDate?: string
    cabin?: 'ECONOMY' | 'PREMIUM_ECONOMY' | 'BUSINESS' | 'FIRST'
    max?: number
    nonStop?: boolean
}

/** Search flight offers via Amadeus and return normalized results */
export async function searchFlights(params: SearchFlightsParams): Promise<FlightOffer[]> {
    const token = await getToken()

    const qp: Record<string, string> = {
        originLocationCode: params.origin.trim().toUpperCase(),
        destinationLocationCode: params.destination.trim().toUpperCase(),
        departureDate: params.departureDate,
        adults: String(params.adults ?? 1),
        currencyCode: 'BRL',
        max: String(params.max ?? 20),
    }
    if (params.returnDate) qp.returnDate = params.returnDate
    if (params.cabin) qp.travelClass = params.cabin
    if (params.nonStop) qp.nonStop = 'true'

    console.log('[Amadeus] searchFlights:', qp.toString())
    const res = await fetch(
        `${BASE_URL}/v2/shopping/flight-offers?${new URLSearchParams(qp)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    )

    if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const detail = err.errors?.[0]?.detail ?? err.errors?.[0]?.title ?? 'Erro ao buscar voos'
        console.error('[Amadeus] Flight search error:', detail, err)
        throw new Error(detail)
    }

    const data = await res.json()
    console.log('[Amadeus] Flight search result:', data.data?.length, 'offers')
    const offers: any[] = data.data ?? []

    return offers.map((offer): FlightOffer => {
        const itin0 = offer.itineraries[0]
        const segs0: any[] = itin0.segments
        const first0 = segs0[0]
        const last0 = segs0[segs0.length - 1]
        const carrier = first0.carrierCode as string
        const totalBrl = parseFloat(offer.price.grandTotal ?? offer.price.total)
        const baseBrl = parseFloat(offer.price.base ?? '0')
        const taxas = Math.max(0, totalBrl - baseBrl)
        const cabin = (offer.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.cabin as string | undefined) ?? 'ECONOMY'

        // Return leg (itineraries[1] exists for round-trips)
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
            flight_key: `${carrier}-${first0.number}-${params.departureDate}-${first0.departure.iataCode}-${last0.arrival.iataCode}`,
            provider: 'amadeus',
            ...returnFields,
        }
    })
}
