// Supabase Edge Function: /chat-busca
// Deploy: supabase functions deploy chat-busca --no-verify-jwt
//
// Env vars required:
//   ANTHROPIC_API_KEY   — Anthropic (Claude) key
//   SEATS_AERO_API_KEY  — Seats.aero Partner API key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)

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

const AIRPORT_MAP: Record<string, string[]> = {
    // Brazil
    'sao paulo': ['GRU', 'CGH'], 'são paulo': ['GRU', 'CGH'], 'guarulhos': ['GRU'], 'gru': ['GRU'],
    'congonhas': ['CGH'], 'cgh': ['CGH'], 'campinas': ['VCP'], 'viracopos': ['VCP'], 'vcp': ['VCP'],
    'rio de janeiro': ['GIG', 'SDU'], 'galeao': ['GIG'], 'gig': ['GIG'], 'santos dumont': ['SDU'], 'sdu': ['SDU'],
    'brasilia': ['BSB'], 'brasília': ['BSB'],
    'belo horizonte': ['CNF'], 'confins': ['CNF'],
    'salvador': ['SSA'], 'recife': ['REC'], 'fortaleza': ['FOR'],
    'manaus': ['MAO'], 'porto alegre': ['POA'], 'curitiba': ['CWB'],
    'florianopolis': ['FLN'], 'florianópolis': ['FLN'], 'floripa': ['FLN'],
    'natal': ['NAT'], 'maceio': ['MCZ'], 'maceió': ['MCZ'],
    'belem': ['BEL'], 'belém': ['BEL'], 'goiania': ['GYN'], 'goiânia': ['GYN'],
    // USA
    'miami': ['MIA'], 'mia': ['MIA'],
    'orlando': ['MCO'], 'mco': ['MCO'],
    'nova york': ['JFK', 'EWR', 'LGA'], 'new york': ['JFK', 'EWR', 'LGA'], 'nova iorque': ['JFK', 'EWR'],
    'jfk': ['JFK'], 'ewr': ['EWR'],
    'los angeles': ['LAX'], 'lax': ['LAX'],
    'san francisco': ['SFO'], 'sfo': ['SFO'],
    'chicago': ['ORD', 'MDW'], 'ord': ['ORD'],
    'boston': ['BOS'], 'dallas': ['DFW'], 'dfw': ['DFW'],
    'houston': ['IAH'], 'washington': ['IAD', 'DCA'],
    'atlanta': ['ATL'], 'seattle': ['SEA'], 'las vegas': ['LAS'],
    'denver': ['DEN'], 'phoenix': ['PHX'], 'minneapolis': ['MSP'],
    'estados unidos': ['MIA', 'JFK', 'LAX', 'ORD', 'DFW'],
    'eua': ['MIA', 'JFK', 'LAX', 'ORD'],
    'usa': ['MIA', 'JFK', 'LAX', 'ORD'],
    // Europe
    'paris': ['CDG', 'ORY'], 'cdg': ['CDG'],
    'london': ['LHR', 'LGW'], 'londres': ['LHR', 'LGW'], 'lhr': ['LHR'],
    'frankfurt': ['FRA'], 'fra': ['FRA'],
    'amsterdam': ['AMS'], 'ams': ['AMS'],
    'madrid': ['MAD'], 'mad': ['MAD'],
    'barcelona': ['BCN'], 'bcn': ['BCN'],
    'lisbon': ['LIS'], 'lisboa': ['LIS'], 'lis': ['LIS'],
    'rome': ['FCO'], 'roma': ['FCO'], 'fco': ['FCO'],
    'milan': ['MXP', 'LIN'], 'milao': ['MXP'], 'milão': ['MXP'], 'mxp': ['MXP'],
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
    'doha': ['DOH'], 'qatar': ['DOH'],
    'europa': ['LIS', 'MAD', 'CDG', 'LHR', 'FRA', 'ZRH', 'VIE'],
    // Asia & Oceania
    'tokyo': ['NRT', 'HND'], 'toquio': ['NRT', 'HND'], 'tóquio': ['NRT', 'HND'],
    'nrt': ['NRT'], 'hnd': ['HND'],
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
}

function extractIATACodes(text: string): string[] {
    if (!text?.trim()) return []

    const parenMatch = text.match(/\(([A-Z]{3})\)/g)
    if (parenMatch) return parenMatch.map(m => m.replace(/[()]/g, ''))

    const upperMatch = text.match(/\b([A-Z]{3})\b/g)
    if (upperMatch?.length) return upperMatch.slice(0, 3)

    const normalized = text.toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z\s]/g, ' ').trim()

    const sortedKeys = Object.keys(AIRPORT_MAP).sort((a, b) => b.length - a.length)
    for (const key of sortedKeys) {
        const normKey = key.normalize('NFD').replace(/[̀-ͯ]/g, '')
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
        const end = new Date(today)
        end.setDate(end.getDate() + 90)
        return { startDate: toISO(today), endDate: toISO(end) }
    }

    if (/^\d{4}-\d{2}$/.test(dateGo)) {
        const [year, month] = dateGo.split('-').map(Number)
        const start = new Date(year, month - 1, 1)
        const end = new Date(year, month, 0)
        return { startDate: toISO(start), endDate: toISO(end) }
    }

    const center = new Date(dateGo + 'T00:00:00Z')
    const start = new Date(center)
    const end = new Date(center)
    start.setDate(start.getDate() - 5)
    end.setDate(end.getDate() + 5)
    const startFinal = start < today ? today : start
    return { startDate: toISO(startFinal), endDate: toISO(end) }
}

function toISO(d: Date): string {
    return d.toISOString().split('T')[0]
}

// ─── Seats.aero API ───────────────────────────────────────────────────────────

interface SeatsAeroResult {
    date: string
    source: string
    origin: string
    destination: string
    economy: number | null
    premiumEconomy: number | null
    business: number | null
    first: number | null
    economyDirect: boolean
    businessDirect: boolean
    economyTaxes: number | null
    businessTaxes: number | null
    economyStops: number | null
    businessStops: number | null
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
    'flyingblue': 'Air France/KLM Flying Blue',
    'miles_and_more': 'Lufthansa Miles & More',
    'turkish': 'Turkish Miles&Smiles',
    'saudia': 'Saudia Alfursan',
    'singapore': 'Singapore KrisFlyer',
    'cathay': 'Cathay Asia Miles',
    'avianca': 'Avianca LifeMiles',
    'iberia': 'Iberia Plus',
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

function parseFloat2(v: unknown): number | null {
    if (!v || v === '' || v === '0') return null
    const n = parseFloat(String(v))
    return isNaN(n) || n === 0 ? null : Math.round(n * 100) / 100
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
        economyTaxes: parseFloat2(item.YTax),
        businessTaxes: parseFloat2(item.JTax ?? item.WTax ?? item.FTax),
        economyStops: item.YStops != null ? Number(item.YStops) : null,
        businessStops: item.JStops != null ? Number(item.JStops) : null,
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

function formatResults(results: SeatsAeroResult[], cabinClass: string): string {
    if (results.length === 0) return 'Nenhuma disponibilidade encontrada para este trecho e período.'

    const cabinField = CABIN_FIELD[cabinClass] ?? 'economy'
    const withCabin = results.filter(r => (r[cabinField] as number | null) !== null)
    const anyClass = results.filter(r => r.economy || r.premiumEconomy || r.business || r.first)
    const pool = withCabin.length > 0 ? withCabin : anyClass

    if (pool.length === 0) return `Nenhuma disponibilidade. API retornou ${results.length} resultados em outras cabines.`

    pool.sort((a, b) => {
        const aM = (a[cabinField] as number | null) ?? a.economy ?? a.premiumEconomy ?? a.business ?? a.first ?? 999999
        const bM = (b[cabinField] as number | null) ?? b.economy ?? b.premiumEconomy ?? b.business ?? b.first ?? 999999
        if (aM !== bM) return aM - bM
        return a.date.localeCompare(b.date)
    })

    const top = pool.slice(0, 30)

    const lines = top.map(r => {
        const miles = (r[cabinField] as number | null) ?? r.economy ?? r.premiumEconomy ?? r.business ?? r.first
        const cabinActual = r[cabinField] ? cabinClass
            : (r.economy ? 'economy' : r.premiumEconomy ? 'premium_economy' : r.business ? 'business' : 'first')
        const isDirect = cabinActual === 'economy' ? r.economyDirect : r.businessDirect
        const stops = cabinActual === 'economy' ? r.economyStops : r.businessStops
        const taxes = cabinActual === 'economy' ? r.economyTaxes : r.businessTaxes
        const directLabel = isDirect ? 'DIRETO' : (stops != null ? `${stops} escala(s)` : 'escala')
        const taxLabel = taxes ? ` +$${taxes} taxas` : ''
        const program = SOURCE_LABELS[r.source] ?? r.source
        const airlines = r.airlines ? ` [${r.airlines}]` : ''
        return `  ${r.date} | ${r.origin}→${r.destination} | ${program} | ${(miles ?? 0).toLocaleString()} mi | ${CABIN_PT[cabinActual] ?? cabinActual} | ${directLabel}${taxLabel}${airlines}`
    })

    const summary = `Total: ${results.length} disponibilidades, ${pool.length} na classe solicitada.`
    return `${summary}\n\nTop resultados (ordenados por milhas):\n${lines.join('\n')}`
}

// ─── Tool definition ──────────────────────────────────────────────────────────

const SEARCH_TOOL = {
    name: 'search_awards',
    description: `Busca disponibilidade real de assentos award (milhas) para uma rota via API Seats.aero.
Chame esta ferramenta para cada rota que quiser verificar. Você pode e deve chamar múltiplas vezes para:
- Múltiplos aeroportos de destino (ex: Tokyo tem NRT e HND — busque ambos)
- Modo hacker: rotas via hubs intermediários (DXB, DOH, IST, FRA, AMS, ICN)
- Direção de volta em voos ida e volta
- Origens alternativas quando flexibleOrigin=true
Seja estratégico: 2-5 buscas focadas são melhores do que buscas desnecessárias.`,
    input_schema: {
        type: 'object' as const,
        properties: {
            origin: { type: 'string', description: 'Código IATA da origem (ex: GRU)' },
            destination: { type: 'string', description: 'Código IATA do destino (ex: NRT)' },
            start_date: { type: 'string', description: 'Início do período YYYY-MM-DD' },
            end_date: { type: 'string', description: 'Fim do período YYYY-MM-DD' },
            cabin: {
                type: 'string',
                enum: ['economy', 'premium_economy', 'business', 'first'],
                description: 'Classe do serviço',
            },
        },
        required: ['origin', 'destination', 'start_date', 'end_date'],
    },
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    const { messages, wizard_data }: { messages: Message[]; wizard_data: WizardData } = await req.json()

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
        return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }

    const seatsKey = Deno.env.get('SEATS_AERO_API_KEY')

    // ─── SSE stream setup ─────────────────────────────────────────────────────
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()
    const encoder = new TextEncoder()

    const send = (event: object) => {
        writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
    }

    // ─── Agentic loop (runs in background) ───────────────────────────────────
    ;(async () => {
        try {
            const { startDate, endDate } = getDateRange(wizard_data.dateGo)
            const cabinPt = CABIN_PT[wizard_data.cabinClass] ?? wizard_data.cabinClass
            const datePeriod = wizard_data.dateGo
                ? (wizard_data.tripType === 'round-trip' && wizard_data.dateReturn
                    ? `${wizard_data.dateGo} a ${wizard_data.dateReturn}`
                    : wizard_data.dateGo)
                : 'datas flexíveis (próximos 90 dias)'

            // Fetch active promos (non-blocking)
            let passagensContext = ''
            try {
                const keyword = wizard_data.destination?.replace(/\b[A-Z]{3}\b/g, '').trim() || wizard_data.destination
                if (keyword && keyword.length >= 3) {
                    const { data: passPromos } = await sbAdmin
                        .from('vw_promocoes_ativas')
                        .select('titulo, valid_until')
                        .eq('categoria', 'passagens')
                        .ilike('titulo', `%${keyword}%`)
                        .order('valid_until', { ascending: true, nullsFirst: false })
                        .limit(3)
                    if (passPromos && passPromos.length > 0) {
                        const lines = passPromos.map((p: Record<string, unknown>, i: number) => {
                            const expiry = p.valid_until
                                ? ` (expira ${new Date(p.valid_until as string).toLocaleDateString('pt-BR')})`
                                : ''
                            return `${i + 1}. ${p.titulo}${expiry}`
                        })
                        passagensContext = '\n\nPROMOÇÕES DE PASSAGENS ATIVAS:\n' + lines.join('\n')
                    }
                }
            } catch { /* silencioso */ }

            const systemPrompt = `Você é o FlyWise AI, especialista em milhas aéreas e viagens para brasileiros.

DADOS DA BUSCA:
- Rota: ${wizard_data.origin} → ${wizard_data.destination}
- Tipo: ${wizard_data.tripType === 'round-trip' ? 'Ida e Volta' : 'Só Ida'}
- Período: ${datePeriod}
- Passageiros: ${wizard_data.passengers}
- Classe desejada: ${cabinPt}
- Estratégia: ${wizard_data.hackerMode === 'comfort' ? 'Conforto (prioriza direto)' : wizard_data.hackerMode === 'hacker' ? 'Avançada — Modo Hacker (2 reservas separadas, hubs, qualquer programa)' : 'Melhor Custo-Benefício'}
- Origem flexível: ${wizard_data.flexibleOrigin ? 'Sim' : 'Não'}
${wizard_data.observations ? `- Observações: ${wizard_data.observations}` : ''}
${passagensContext}

Você tem acesso à ferramenta search_awards com dados reais do Seats.aero.

ESTRATÉGIA DE BUSCA:
- Sempre busque a rota principal primeiro
- São Paulo: origem pode ser GRU ou CGH — use o mais relevante (GRU para voos internacionais)
- Destinos com múltiplos aeroportos: busque todos (Tokyo: NRT + HND; London: LHR + LGW)
- Modo Hacker: inclua buscas via hubs intermediários (DXB, DOH, IST, FRA, AMS) onde faz sentido
- Ida e volta: busque as duas direções separadamente
- Origem flexível: busque dos aeroportos alternativos mais próximos

FORMATO DA ANÁLISE FINAL:
1. **Melhores opções encontradas** — tabela com: programa | milhas | data | cia operadora | direto/escalas | taxas
2. **Transferências de pontos** — quais cartões brasileiros transferem para esses programas e em qual ratio (Amex Membership Rewards, C6 Bank, Nubank Ultravioleta, Itaú, Bradesco, Livelo, Smiles, Azul Fidelidade, LATAM Pass)
3. **Disponibilidade** — avalie se está escassa, moderada ou abundante e quando reservar
4. **Próximo passo** — instrução clara e prática para o usuário agir agora

Use markdown com tabelas quando listar opções. Seja ESPECÍFICO: use os números reais dos dados.
Para FOLLOW-UPS: responda usando os dados já buscados, sem refazer buscas desnecessárias.`

            // Build conversation
            const loopMessages: any[] = messages.map((m: Message) => ({
                role: m.role,
                content: m.content,
            }))

            if (messages.length === 0) {
                loopMessages.push({
                    role: 'user',
                    content: [
                        `Analise a disponibilidade de voos com milhas para ${wizard_data.origin} → ${wizard_data.destination}`,
                        `em ${cabinPt}`,
                        wizard_data.dateGo ? `para ${datePeriod}` : 'com datas flexíveis (próximos 90 dias)',
                        wizard_data.observations ? `Observações: ${wizard_data.observations}` : null,
                        `Faça as buscas necessárias e apresente as melhores opções.`,
                    ].filter(Boolean).join('. '),
                })
            }

            // ── Phase 1: Haiku decides what to search (non-streaming, fast) ──────
            if (seatsKey) {
                const planRes = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'x-api-key': anthropicKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json',
                    },
                    body: JSON.stringify({
                        model: 'claude-haiku-4-5-20251001',
                        max_tokens: 1024,
                        system: systemPrompt,
                        tools: [SEARCH_TOOL],
                        tool_choice: { type: 'auto' },
                        messages: loopMessages,
                    }),
                })

                if (planRes.ok) {
                    const planJson = await planRes.json()
                    const toolUseBlocks: any[] = planJson.content?.filter((b: any) => b.type === 'tool_use') ?? []

                    if (toolUseBlocks.length > 0) {
                        // Send searching events to client before executing
                        for (const tool of toolUseBlocks) {
                            send({
                                type: 'searching',
                                origin: tool.input.origin,
                                destination: tool.input.destination,
                                label: `${tool.input.origin} → ${tool.input.destination}`,
                            })
                        }

                        // Execute all searches in parallel
                        const toolResults = await Promise.all(
                            toolUseBlocks.map(async (tool: any) => {
                                const args = tool.input
                                const { startDate: sd, endDate: ed } = (args.start_date && args.end_date)
                                    ? { startDate: args.start_date, endDate: args.end_date }
                                    : getDateRange(wizard_data.dateGo)

                                try {
                                    const results = await searchSeatsAero(seatsKey, args.origin, args.destination, sd, ed)
                                    const formatted = formatResults(results, args.cabin ?? wizard_data.cabinClass)
                                    return { type: 'tool_result', tool_use_id: tool.id, content: formatted }
                                } catch (e) {
                                    return {
                                        type: 'tool_result',
                                        tool_use_id: tool.id,
                                        content: `Erro ao buscar ${args.origin}→${args.destination}: ${(e as Error).message}`,
                                    }
                                }
                            })
                        )

                        // Add assistant tool-use + results to conversation
                        loopMessages.push({ role: 'assistant', content: planJson.content })
                        loopMessages.push({ role: 'user', content: toolResults })
                    }
                }
            }

            // ── Phase 2: Sonnet streams the final analysis ────────────────────
            const streamRes = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'x-api-key': anthropicKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 2048,
                    stream: true,
                    system: systemPrompt,
                    messages: loopMessages,
                }),
            })

            if (!streamRes.ok) {
                const err = await streamRes.text()
                throw new Error(`Claude error: ${err}`)
            }

            const reader = streamRes.body!.getReader()
            const decoder = new TextDecoder()
            let buf = ''

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buf += decoder.decode(value, { stream: true })
                const lines = buf.split('\n')
                buf = lines.pop() ?? ''

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue
                    const data = line.slice(6).trim()
                    if (!data || data === '[DONE]') continue
                    try {
                        const event = JSON.parse(data)
                        if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                            send({ type: 'text', delta: event.delta.text })
                        }
                    } catch { /* malformed chunk */ }
                }
            }

            send({ type: 'done' })
        } catch (err) {
            send({ type: 'error', message: String(err) })
        } finally {
            writer.close()
        }
    })()

    return new Response(readable, {
        headers: {
            ...corsHeaders,
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
        },
    })
})
