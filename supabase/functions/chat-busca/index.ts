// Supabase Edge Function: /chat-busca
// Deploy: supabase functions deploy chat-busca --no-verify-jwt
//
// Env vars required:
//   OPENAI_API_KEY      — your OpenAI key
//   SEATS_AERO_API_KEY  — Seats.aero Partner API key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface WizardData {
    destination: string
    origin: string
    flexibleOrigin: boolean
    tripType: 'one-way' | 'round-trip'
    dateGo: string
    dateReturn: string
    passengers: number
    cabinClass: string
    hackerMode: 'comfort' | 'value' | 'hacker'
    observations: string
}

interface Message {
    role: 'user' | 'assistant'
    content: string
}

// ─── Airport code extraction ──────────────────────────────────────────────────

// Common airport lookups (city/region → IATA codes)
const AIRPORT_MAP: Record<string, string[]> = {
    // Brazil
    'sao paulo': ['GRU'], 'são paulo': ['GRU'], 'guarulhos': ['GRU'], 'gru': ['GRU'],
    'congonhas': ['CGH'], 'cgh': ['CGH'],
    'rio de janeiro': ['GIG', 'SDU'], 'galeao': ['GIG'], 'gig': ['GIG'],
    'brasilia': ['BSB'], 'brasília': ['BSB'],
    'belo horizonte': ['CNF'], 'confins': ['CNF'],
    'salvador': ['SSA'], 'recife': ['REC'], 'fortaleza': ['FOR'],
    'manaus': ['MAO'], 'porto alegre': ['POA'], 'curitiba': ['CWB'],
    'florianopolis': ['FLN'], 'florianópolis': ['FLN'],
    'natal': ['NAT'], 'maceio': ['MCZ'], 'maceió': ['MCZ'],
    // USA
    'miami': ['MIA'], 'mia': ['MIA'],
    'orlando': ['MCO'], 'mco': ['MCO'],
    'nova york': ['JFK', 'EWR'], 'new york': ['JFK', 'EWR'], 'nova iorque': ['JFK', 'EWR'],
    'jfk': ['JFK'], 'ewr': ['EWR'],
    'los angeles': ['LAX'], 'lax': ['LAX'],
    'san francisco': ['SFO'], 'sfo': ['SFO'],
    'chicago': ['ORD'], 'ord': ['ORD'],
    'boston': ['BOS'], 'dallas': ['DFW'], 'dfw': ['DFW'],
    'houston': ['IAH'], 'washington': ['IAD', 'DCA'],
    'atlanta': ['ATL'], 'seattle': ['SEA'], 'las vegas': ['LAS'],
    'denver': ['DEN'], 'phoenix': ['PHX'], 'minneapolis': ['MSP'],
    'estados unidos': ['MIA', 'JFK', 'LAX', 'ORD', 'DFW'],
    'eua': ['MIA', 'JFK', 'LAX', 'ORD'],
    'usa': ['MIA', 'JFK', 'LAX', 'ORD'],
    'america do norte': ['MIA', 'JFK', 'LAX'],
    // Europe
    'paris': ['CDG'], 'cdg': ['CDG'],
    'london': ['LHR'], 'londres': ['LHR'], 'lhr': ['LHR'],
    'frankfurt': ['FRA'], 'fra': ['FRA'],
    'amsterdam': ['AMS'], 'ams': ['AMS'],
    'madrid': ['MAD'], 'mad': ['MAD'],
    'barcelona': ['BCN'], 'bcn': ['BCN'],
    'lisbon': ['LIS'], 'lisboa': ['LIS'], 'lis': ['LIS'],
    'rome': ['FCO'], 'roma': ['FCO'], 'fco': ['FCO'],
    'milan': ['MXP'], 'milao': ['MXP'], 'milão': ['MXP'], 'mxp': ['MXP'],
    'zurich': ['ZRH'], 'zurique': ['ZRH'], 'zrh': ['ZRH'],
    'vienna': ['VIE'], 'viena': ['VIE'], 'vie': ['VIE'],
    'munich': ['MUC'], 'munique': ['MUC'], 'muc': ['MUC'],
    'berlin': ['BER'], 'berlim': ['BER'], 'ber': ['BER'],
    'copenhagen': ['CPH'], 'copenhague': ['CPH'],
    'stockholm': ['ARN'], 'estocolmo': ['ARN'],
    'oslo': ['OSL'], 'helsinki': ['HEL'],
    'tromso': ['TOS'], 'tromsø': ['TOS'],
    'athens': ['ATH'], 'atenas': ['ATH'],
    'istanbul': ['IST'], 'istambul': ['IST'],
    'dubai': ['DXB'], 'abu dhabi': ['AUH'],
    'europa': ['LIS', 'MAD', 'CDG', 'LHR', 'FRA', 'ZRH', 'VIE'],
    // Asia & Oceania
    'tokyo': ['NRT', 'HND'], 'toquio': ['NRT', 'HND'], 'tóquio': ['NRT', 'HND'],
    'osaka': ['KIX'], 'seoul': ['ICN'], 'seul': ['ICN'],
    'beijing': ['PEK'], 'pequim': ['PEK'],
    'shanghai': ['PVG'], 'shangai': ['PVG'],
    'hong kong': ['HKG'], 'bangkok': ['BKK'],
    'singapore': ['SIN'], 'singapura': ['SIN'],
    'bali': ['DPS'], 'sydney': ['SYD'], 'melbourne': ['MEL'],
    'auckland': ['AKL'],
    'asia': ['DXB', 'SIN', 'BKK', 'NRT'], 'ásia': ['DXB', 'SIN', 'BKK', 'NRT'],
    'oceania': ['SYD', 'MEL', 'AKL'],
    // Latin America
    'buenos aires': ['EZE', 'AEP'], 'santiago': ['SCL'],
    'lima': ['LIM'], 'bogota': ['BOG'], 'bogotá': ['BOG'],
    'cancun': ['CUN'], 'cancún': ['CUN'],
    'mexico city': ['MEX'], 'cidade do mexico': ['MEX'],
    'toronto': ['YYZ'], 'vancouver': ['YVR'],
    'canada': ['YYZ', 'YVR'], 'canadá': ['YYZ', 'YVR'],
    // Africa
    'johannesburg': ['JNB'], 'joanesburgo': ['JNB'],
    'cape town': ['CPT'], 'cairo': ['CAI'],
    'africa do sul': ['JNB'],
}

function extractIATACodes(text: string): string[] {
    if (!text?.trim()) return []

    // 1. Direct 3-letter uppercase codes in parentheses: "Guarulhos (GRU)"
    const parenMatch = text.match(/\(([A-Z]{3})\)/g)
    if (parenMatch) return parenMatch.map(m => m.replace(/[()]/g, ''))

    // 2. Standalone 3-letter uppercase codes: "GRU" or "MIA"
    const upperMatch = text.match(/\b([A-Z]{3})\b/g)
    if (upperMatch?.length) return upperMatch.slice(0, 3)

    // 3. Normalize and look up in map
    const normalized = text.toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z\s]/g, ' ').trim()

    // Try longest matching key first
    const sortedKeys = Object.keys(AIRPORT_MAP).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
        const normKey = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        if (normalized.includes(normKey)) {
            return AIRPORT_MAP[key]
        }
    }

    return []
}

// ─── Date range helpers ───────────────────────────────────────────────────────

function getDateRange(dateGo: string): { startDate: string; endDate: string } {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)

    if (!dateGo) {
        // No date: search next 90 days
        const end = new Date(today)
        end.setDate(end.getDate() + 90)
        return { startDate: toISO(today), endDate: toISO(end) }
    }

    if (/^\d{4}-\d{2}$/.test(dateGo)) {
        // Month format: search whole month
        const [year, month] = dateGo.split('-').map(Number)
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0) // last day of month
        return { startDate: toISO(start), endDate: toISO(end) }
    }

    // Specific date: search ±5 days around it
    const center = new Date(dateGo + 'T00:00:00Z')
    const start = new Date(center)
    const end = new Date(center)
    start.setDate(start.getDate() - 5)
    end.setDate(end.getDate() + 5)
    // Don't go before today
    const startFinal = start < today ? today : start
    return { startDate: toISO(startFinal), endDate: toISO(end) }
}

function toISO(d: Date): string {
    return d.toISOString().split('T')[0]
}

// ─── Seats.aero API ───────────────────────────────────────────────────────────

interface SeatsAeroResult {
    date: string
    source: string // program name (e.g., "united", "lifemiles")
    origin: string
    destination: string
    economy: number | null
    premiumEconomy: number | null
    business: number | null
    first: number | null
    economyDirect: boolean
    businessDirect: boolean
    airlines: string
}

const SOURCE_LABELS: Record<string, string> = {
    'united': 'United MileagePlus',
    'lifemiles': 'Avianca LifeMiles',
    'aeroplan': 'Air Canada Aeroplan',
    'delta': 'Delta SkyMiles',
    'aeromexico': 'Aeromexico Club Premier',
    'american': 'American AAdvantage',
    'alaska': 'Alaska Mileage Plan',
    'jetblue': 'JetBlue TrueBlue',
    'southwest': 'Southwest Rapid Rewards',
    'flyingblue': 'Air France/KLM Flying Blue',
    'miles_and_more': 'Lufthansa Miles & More',
    'turkish': 'Turkish Miles&Smiles',
    'saudia': 'Saudia Alfursan',
    'singapore': 'Singapore KrisFlyer',
    'cathay': 'Cathay Asia Miles',
    'avianca': 'Avianca LifeMiles',
    'iberia': 'Iberia Plus',
    'vueling': 'Vueling Club',
    'velocity': 'Virgin Australia Velocity',
    'virgin_atlantic': 'Virgin Atlantic Flying Club',
    'emirates': 'Emirates Skywards',
    'etihad': 'Etihad Guest',
    'smiles': 'Smiles (GOL)',
    'azul': 'Azul Fidelidade',
    'latam_pass': 'LATAM Pass',
}

function parseNum(v: unknown): number | null {
    if (!v || v === '' || v === '0') return null
    const n = parseInt(String(v).replace(/,/g, ''), 10)
    return isNaN(n) || n === 0 ? null : n
}

async function searchSeatsAero(
    apiKey: string,
    origin: string,
    destination: string,
    startDate: string,
    endDate: string,
): Promise<SeatsAeroResult[]> {
    const params = new URLSearchParams({
        origin_airport: origin,
        destination_airport: destination,
        start_date: startDate,
        end_date: endDate,
        take: '100',
    })

    const res = await fetch(`https://seats.aero/partnerapi/search?${params}`, {
        headers: {
            'Partner-Authorization': apiKey,
            'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
    })

    if (res.status === 429) throw new Error('Rate limit Seats.aero')
    if (res.status === 401) throw new Error('Seats.aero API key inválida')
    if (!res.ok) return []

    const json = await res.json()
    const items: unknown[] = json.data ?? []

    return items.map((item: any) => ({
        date: item.Date ?? '',
        source: item.Source ?? '',
        origin: item.Route?.OriginAirport ?? origin,
        destination: item.Route?.DestinationAirport ?? destination,
        economy: item.YAvailable ? parseNum(item.YMileageCost) : null,
        premiumEconomy: item.WAvailable ? parseNum(item.WMileageCost) : null,
        business: item.JAvailable ? parseNum(item.JMileageCost) : null,
        first: item.FAvailable ? parseNum(item.FMileageCost) : null,
        economyDirect: !!(item.YDirect),
        businessDirect: !!(item.JDirect || item.WDirect || item.FDirect),
        airlines: [item.YAirlines, item.WAirlines, item.JAirlines, item.FAirlines]
            .filter(Boolean).join(',').split(',').map((s: string) => s.trim())
            .filter((v: string, i: number, a: string[]) => a.indexOf(v) === i).join(', '),
    }))
}

// ─── Format results for LLM ───────────────────────────────────────────────────

const CABIN_FIELD: Record<string, keyof SeatsAeroResult> = {
    economy: 'economy',
    premium_economy: 'premiumEconomy',
    business: 'business',
    first: 'first',
}

const CABIN_PT: Record<string, string> = {
    economy: 'Econômica',
    premium_economy: 'Premium Economy',
    business: 'Executiva (Business)',
    first: 'Primeira Classe',
}

function formatResults(results: SeatsAeroResult[], cabinClass: string, dateGo: string): string {
    if (results.length === 0) return 'Nenhuma disponibilidade encontrada na API Seats.aero para este trecho e período.'

    const cabinField = CABIN_FIELD[cabinClass] ?? 'economy'

    // Filter to results with the requested cabin available
    const withCabin = results.filter(r => (r[cabinField] as number | null) !== null)
    const anyClass = results.filter(r => r.economy || r.premiumEconomy || r.business || r.first)

    const pool = withCabin.length > 0 ? withCabin : anyClass

    if (pool.length === 0) return `Nenhuma disponibilidade em ${CABIN_PT[cabinClass] ?? cabinClass} encontrada. API retornou ${results.length} resultados em outras cabines.`

    // Sort by miles in the requested cabin (or best available)
    pool.sort((a, b) => {
        const aM = (a[cabinField] as number | null) ?? a.economy ?? a.premiumEconomy ?? a.business ?? a.first ?? 999999
        const bM = (b[cabinField] as number | null) ?? b.economy ?? b.premiumEconomy ?? b.business ?? b.first ?? 999999
        if (aM !== bM) return aM - bM
        return a.date.localeCompare(b.date)
    })

    // Take top 25 results
    const top = pool.slice(0, 25)

    const lines = top.map(r => {
        const miles = (r[cabinField] as number | null) ?? r.economy ?? r.premiumEconomy ?? r.business ?? r.first
        const cabinActual = r[cabinField] ? cabinClass : (r.economy ? 'economy' : r.premiumEconomy ? 'premium_economy' : r.business ? 'business' : 'first')
        const direct = (cabinActual === 'economy' ? r.economyDirect : r.businessDirect) ? '✓ DIRETO' : 'escala'
        const program = SOURCE_LABELS[r.source] ?? r.source
        const airlines = r.airlines ? ` (${r.airlines})` : ''
        return `  ${r.date} | ${r.origin}→${r.destination} | ${program} | ${(miles ?? 0).toLocaleString()} milhas | ${CABIN_PT[cabinActual] ?? cabinActual} | ${direct}${airlines}`
    })

    const hasNoDate = !dateGo
    const summary = hasNoDate
        ? `Período pesquisado: próximos 90 dias. Total: ${results.length} disponibilidades, ${pool.length} em ${CABIN_PT[cabinClass] ?? cabinClass}.`
        : `Total: ${results.length} disponibilidades, ${pool.length} em ${CABIN_PT[cabinClass] ?? cabinClass}.`

    return `${summary}\n\nTop resultados (menor milhas):\n${lines.join('\n')}`
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { messages, wizard_data }: { messages: Message[]; wizard_data: WizardData } = await req.json()

        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set')

        const seatsKey = Deno.env.get('SEATS_AERO_API_KEY')

        // 1. Extract airport codes
        const originCodes = extractIATACodes(wizard_data.origin)
        const destCodes = extractIATACodes(wizard_data.destination).slice(0, 4)

        // 2. Get date range
        const { startDate, endDate } = getDateRange(wizard_data.dateGo)

        // 3. Search Seats.aero
        let flightContext = ''
        if (seatsKey && originCodes.length > 0 && destCodes.length > 0) {
            const originCode = originCodes[0]
            try {
                // Search in parallel for each destination code (max 3)
                const searches = destCodes.slice(0, 3).map(dest =>
                    searchSeatsAero(seatsKey, originCode, dest, startDate, endDate)
                        .catch(() => [] as SeatsAeroResult[])
                )
                const allResults = (await Promise.all(searches)).flat()

                flightContext = formatResults(allResults, wizard_data.cabinClass, wizard_data.dateGo)

                // If round trip, also search return direction
                if (wizard_data.tripType === 'round-trip' && wizard_data.dateReturn) {
                    const { startDate: retStart, endDate: retEnd } = getDateRange(wizard_data.dateReturn)
                    const retSearches = destCodes.slice(0, 3).map(dest =>
                        searchSeatsAero(seatsKey, dest, originCode, retStart, retEnd)
                            .catch(() => [] as SeatsAeroResult[])
                    )
                    const retResults = (await Promise.all(retSearches)).flat()
                    const retContext = formatResults(retResults, wizard_data.cabinClass, wizard_data.dateReturn)
                    flightContext += `\n\nVOO DE VOLTA:\n${retContext}`
                }
            } catch (e) {
                flightContext = `Erro ao consultar Seats.aero: ${(e as Error).message}`
            }
        } else if (!seatsKey) {
            flightContext = 'SEATS_AERO_API_KEY não configurada — buscando sem dados em tempo real.'
        } else if (originCodes.length === 0 || destCodes.length === 0) {
            flightContext = `Não foi possível identificar códigos IATA para: origem="${wizard_data.origin}", destino="${wizard_data.destination}". Responda com base em conhecimento geral.`
        }

        // 4. Build system prompt
        const cabinPt = CABIN_PT[wizard_data.cabinClass] ?? wizard_data.cabinClass
        const datePeriod = wizard_data.dateGo
            ? (wizard_data.tripType === 'round-trip' && wizard_data.dateReturn
                ? `${wizard_data.dateGo} a ${wizard_data.dateReturn}`
                : wizard_data.dateGo)
            : 'datas flexíveis (próximos 90 dias)'

        const systemPrompt = `Você é o FlyWise AI, especialista em milhas aéreas e viagens para brasileiros.

DADOS DA BUSCA DO USUÁRIO:
- Rota: ${wizard_data.origin} → ${wizard_data.destination}
- Tipo: ${wizard_data.tripType === 'round-trip' ? 'Ida e Volta' : 'Só Ida'}
- Período: ${datePeriod}
- Passageiros: ${wizard_data.passengers}
- Classe desejada: ${cabinPt}
- Estratégia: ${wizard_data.hackerMode === 'comfort' ? 'Conforto (priorizando direto)' : wizard_data.hackerMode === 'hacker' ? 'Avançada (2 reservas separadas)' : 'Melhor Custo-Benefício'}
${wizard_data.observations ? `- Observações: ${wizard_data.observations}` : ''}

DADOS EM TEMPO REAL DO SEATS.AERO (disponibilidade de voos com milhas):
${flightContext}

INSTRUÇÕES:
Você tem acesso a dados reais de disponibilidade de assentos award da API Seats.aero acima.

Na PRIMEIRA mensagem (sem histórico), faça uma análise completa e específica:
1. **Melhores opções encontradas** — liste as 3-5 melhores combinações de programa + data + milhas dos dados acima. Seja específico: programa, quantidade de milhas, data, companhia operadora, se é direto.
2. **Estratégia de acúmulo** — de quais cartões/bancos brasileiros transferir para esses programas (Amex, C6, Nubank, Itaú, Bradesco, Livelo, Smiles, etc.) e ratio de transferência.
3. **Alerta de disponibilidade** — se os dados mostram boa ou escassa disponibilidade, e quando reservar.
4. **Próximo passo** — instrução clara e prática sobre o que o usuário deve fazer agora.

Seja ESPECÍFICO e use os números reais dos dados acima. Não invente valores. Se os dados mostram 25.000 milhas no Miles & More, diga isso.
Formate com markdown. Use tabelas quando listar múltiplas opções.
Ao final convide para perguntas de follow-up.

Para MENSAGENS SEGUINTES: responda às perguntas mantendo o contexto dos dados acima. Se perguntarem sobre outras datas/rotas que não estão nos dados, deixe claro que está respondendo com conhecimento histórico, não dados em tempo real.`

        // 5. Call OpenAI
        const openaiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map((m: Message) => ({ role: m.role, content: m.content })),
        ]

        const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: openaiMessages,
                temperature: 0.5,
                max_tokens: 1800,
            }),
        })

        if (!aiRes.ok) {
            const err = await aiRes.text()
            throw new Error(`OpenAI error: ${err}`)
        }

        const result = await aiRes.json()
        const reply = result.choices?.[0]?.message?.content ?? 'Não consegui gerar uma resposta. Tente novamente.'

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
