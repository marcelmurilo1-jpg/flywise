// Supabase Edge Function: /strategy
// Runtime: Deno (Supabase Functions)
// Deploy: supabase functions deploy strategy
//
// Env vars required (Supabase Dashboard → Project Settings → Edge Functions → Secrets):
//   OPENAI_API_KEY   — your OpenAI key (GPT-4o-mini)
//   SUPABASE_URL     — automatically injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — automatically injected by Supabase

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Interfaces (duplicated here to avoid import issues in Deno) ──────────────

interface FlightRow {
    id: number; companhia: string | null; preco_brl: number | null
    preco_milhas: number | null; taxas_brl: number | null; cpm: number | null
    partida: string | null; chegada: string | null
    origem: string | null; destino: string | null
    duracao_min: number | null; cabin_class: string | null
    segmentos: unknown; detalhes: unknown
}

const AIRLINE_PROGRAMS: Record<string, string[]> = {
    'LA': ['LATAM Pass', 'Smiles', 'Livelo'], 'JJ': ['LATAM Pass', 'Smiles', 'Livelo'],
    'G3': ['Smiles', 'Livelo'], 'AD': ['TudoAzul', 'Livelo'],
    'AC': ['Smiles', 'Aeroplan', 'Livelo'], 'AA': ['Smiles', 'AAdvantage', 'Livelo'],
    'UA': ['Smiles', 'MileagePlus', 'Livelo'], 'DL': ['Smiles', 'SkyMiles', 'Livelo'],
    'TP': ['Miles&Go', 'Smiles', 'Livelo'], 'AF': ['Flying Blue', 'Smiles', 'Livelo'],
    'KL': ['Flying Blue', 'Smiles', 'Livelo'], 'LH': ['Miles&More', 'Smiles', 'Livelo'],
    'AV': ['Lifemiles', 'Smiles', 'Livelo'], 'CM': ['ConnectMiles', 'Smiles', 'Livelo'],
    'TK': ['Miles&Smiles', 'Smiles', 'Livelo'], 'ET': ['ShebaMiles', 'Smiles'],
}

function extractIata(companhia: string | null): string {
    if (!companhia) return ''
    const m = companhia.match(/\(([A-Z]{2,3})\)/)
    if (m) return m[1]
    if (/^[A-Z]{2,3}$/.test(companhia.trim())) return companhia.trim()
    return ''
}

function formatMins(mins: number | null): string {
    if (!mins) return ''
    return `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}min` : ''}`
}

function buildFlightString(f: FlightRow): string {
    const det = (f.detalhes as Record<string, unknown>) ?? {}
    const iata = extractIata(f.companhia)
    const programs = (AIRLINE_PROGRAMS[iata] ?? ['Livelo']).slice(0, 5).join(', ')
    const priceMilesEst = f.preco_brl ? Math.round((f.preco_brl * 55) / 1000) * 1000 : 0
    const lines = [
        `Rota: ${f.origem ?? '?'} → ${f.destino ?? '?'} | ${f.companhia ?? iata} (${iata})`,
        `Preço cash: R$ ${f.preco_brl?.toLocaleString('pt-BR')} | Milhas est.: ~${priceMilesEst.toLocaleString('pt-BR')} pts`,
        `Cabine: ${f.cabin_class ?? 'economy'} | Paradas: ${(det.paradas as number) ?? 0} | Duração: ${formatMins(f.duracao_min)}`,
        `Ida: ${(f.partida ?? '').slice(11, 16)} → ${(f.chegada ?? '').slice(11, 16)}`,
    ]
    if (det.returnPartida) lines.push(`Volta: ${(det.returnPartida as string).slice(11, 16)} → ${(det.returnChegada as string | undefined ?? '').slice(11, 16)}`)
    lines.push(`Programas aceitos: ${programs}`)
    return lines.join('\n')
}

function formatPromoLine(p: Record<string, unknown>, i: number): string {
    const tipo = p.tipo as string | null
    const tipoLabel = tipo === 'bonus_transferencia' ? '[transferência]'
        : tipo === 'clube' ? '[clube]'
        : tipo === 'boas_vindas' ? '[boas-vindas]'
        : tipo === 'milhas_compra' ? '[compra-milhas]'
        : '[promoção]'
    const parts = [`${i + 1}. ${tipoLabel} ${p.programa ?? 'Geral'}`]
    if (p.bonus_pct) parts.push(`+${p.bonus_pct}% bônus`)
    if (p.parceiro) parts.push(`via ${p.parceiro}`)
    parts.push(`— ${String(p.titulo ?? '').slice(0, 80)}`)
    if (p.valid_until) parts.push(`(expira ${new Date(p.valid_until as string).toLocaleDateString('pt-BR')})`)
    return parts.join(' ')
}

async function buildPromoString(programs: string[], sb: ReturnType<typeof createClient>): Promise<string> {
    try {
        const now = new Date().toISOString()

        // Busca até 12 promos dos programas relevantes, ordenadas por bonus_pct desc e urgência
        const { data: all } = await sb.from('promocoes')
            .select('titulo,programa,tipo,bonus_pct,parceiro,valid_until')
            .or('valid_until.is.null,valid_until.gt.' + now)
            .in('programa', programs.length > 0 ? programs : ['Smiles', 'LATAM Pass', 'Livelo'])
            .order('bonus_pct', { ascending: false, nullsFirst: false })
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(12)

        const rows = all ?? []

        // Prioriza por tipo: transferência (2) → clube/boas-vindas (1) → outros (1) = máx 4
        const transfer = rows.filter(p => p.tipo === 'bonus_transferencia').slice(0, 2)
        const clube = rows.filter(p => p.tipo === 'clube' || p.tipo === 'boas_vindas').slice(0, 1)
        const outros = rows.filter(p =>
            p.tipo !== 'bonus_transferencia' && p.tipo !== 'clube' && p.tipo !== 'boas_vindas'
        ).slice(0, 1)

        const selected = [...transfer, ...clube, ...outros]

        // Fallback: qualquer promo ativa se não encontrou nada nos programas
        if (selected.length === 0) {
            const { data: fallback } = await sb.from('promocoes')
                .select('titulo,programa,tipo,bonus_pct,parceiro,valid_until')
                .or('valid_until.is.null,valid_until.gt.' + now)
                .order('bonus_pct', { ascending: false, nullsFirst: false })
                .limit(3)
            return (fallback ?? []).length
                ? (fallback ?? []).map(formatPromoLine).join('\n')
                : 'Nenhuma promoção ativa registrada.'
        }

        return selected.map(formatPromoLine).join('\n')
    } catch { return 'Nenhuma promoção disponível.' }
}

async function buildUserString(userId: string, neededMiles: number, sb: ReturnType<typeof createClient>): Promise<string> {
    try {
        // Lê user_metadata via Admin API (onde a Wallet salva os saldos)
        const { data: { user }, error } = await sb.auth.admin.getUserById(userId)
        if (error || !user) return ''

        const meta = user.user_metadata ?? {}
        const miles = (meta.miles ?? {}) as Record<string, number>
        const activeCards: string[] = meta.activeCards ?? []
        const activeClubs: string[] = meta.activeClubs ?? []
        const clubTiers: Record<string, string> = meta.activeClubTiers ?? {}

        const parts: string[] = []

        // Saldos de milhas
        const balances = Object.entries(miles)
            .filter(([, pts]) => pts > 0)
            .sort((a, b) => b[1] - a[1])
        if (balances.length > 0) {
            const balStr = balances
                .map(([prog, pts]) => `${prog}: ${pts.toLocaleString('pt-BR')} pts${pts >= neededMiles ? ' ✓' : ''}`)
                .join(' | ')
            parts.push(`Saldo carteira: ${balStr}`)
        }

        // Cartões de crédito ativos (relevantes para acúmulo)
        if (activeCards.length > 0) {
            parts.push(`Cartões ativos: ${activeCards.slice(0, 4).join(', ')}`)
        }

        // Clubes de fidelidade e tier
        if (activeClubs.length > 0) {
            const clubStr = activeClubs.map(c => {
                const tier = clubTiers[c]
                return tier ? `${c} (${tier})` : c
            }).join(', ')
            parts.push(`Clubes: ${clubStr}`)
        }

        return parts.length > 0 ? parts.join('\n') : ''
    } catch { return '' }
}

const JSON_SCHEMA = `{
  "programa_recomendado": "<ex: Smiles | LATAM Pass | TudoAzul | Livelo>",
  "motivo": "<máx 2 frases explicando por que este programa é o melhor para esta rota>",
  "steps": [
    "<Passo 1 — título curto (máx 8 palavras): ex: 'Transferir pontos Livelo → Smiles'>",
    "<Passo 2 — título curto: ex: 'Aproveitar bônus de transferência ativo'>",
    "<Passo 3 — título curto: ex: 'Emitir bilhete no site Smiles'>",
    "<Passo 4 — título curto: ex: 'Timing: quando reservar para garantir disponibilidade'>"
  ],
  "step_details": [
    "<Passo 1 detalhado — explicação completa em 2-4 frases para leigos: o que fazer, onde acessar, o que clicar, quanto tempo leva. Foque em transferência de pontos já existentes, compra de milhas bonificada, ou uso de clube.>",
    "<Passo 2 detalhado — mesma estrutura>",
    "<Passo 3 detalhado — mesma estrutura>",
    "<Passo 4 detalhado — mesma estrutura>"
  ],
  "milhas_necessarias": <número inteiro>,
  "taxas_estimadas_brl": <número inteiro>,
  "economia_pct": <número 0-100>,
  "promocao_ativa": "<descrição breve da promoção usada na estratégia ou null>",
  "alternativa": "<segundo programa ou null>",
  "aviso": "<aviso principal ou null>",
  "regras_promocoes": [
    "<Regra ou condição importante sobre alguma promoção ou programa citado. Ex: 'Bônus de transferência Nubank→Smiles não acumula com outros bônus do mês'>",
    "<outra regra se houver>"
  ]
}`

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { flightId, userId, cashPrice, seatsContext } = await req.json()
        if (!flightId && !seatsContext) return new Response(JSON.stringify({ ok: false, error: 'flightId or seatsContext required' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

        // Init Supabase with service role (can bypass RLS to read flight owned by user)
        const sb = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // 1. Load flight (from DB if flightId given, or build synthetic row from seatsContext)
        let flight: FlightRow | null = null
        if (flightId) {
            const { data, error: fErr } = await sb.from('resultados_voos').select('*').eq('id', flightId).single()
            if (fErr || !data) return new Response(JSON.stringify({ ok: false, error: 'Flight not found' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
            flight = data as FlightRow
        } else if (seatsContext) {
            // Build synthetic FlightRow from Seats.aero data
            flight = {
                id: 0,
                companhia: `${seatsContext.airlineName} (${seatsContext.airlineCode})`,
                preco_brl: cashPrice || null,
                preco_milhas: seatsContext.totalMilhas,
                taxas_brl: null, cpm: null,
                partida: null, chegada: null,
                origem: seatsContext.origem,
                destino: seatsContext.destino,
                duracao_min: null,
                cabin_class: seatsContext.cabin?.toLowerCase() ?? 'economy',
                segmentos: null, detalhes: null,
            }
        }
        if (!flight) return new Response(JSON.stringify({ ok: false, error: 'No flight data' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

        // 2. Enforce plan limits (server-side)
        if (userId) {
            const { data: profile } = await sb
                .from('user_profiles')
                .select('plan, plan_expires_at')
                .eq('id', userId)
                .single()

            const rawPlan = (profile?.plan ?? 'free').toLowerCase()
            const isExpired = profile?.plan_expires_at && new Date(profile.plan_expires_at) < new Date()
            const plan = isExpired ? 'free' : rawPlan

            const LIMITS: Record<string, { lifetime: number | null; perMonth: number | null }> = {
                free:      { lifetime: 1,    perMonth: null },
                essencial: { lifetime: null, perMonth: 3   },
                pro:       { lifetime: null, perMonth: 5   },
                elite:     { lifetime: null, perMonth: 10  },
                admin:     { lifetime: null, perMonth: null }, // sem limite
            }
            const limit = LIMITS[plan] ?? LIMITS['free']
            // admin (ambos null) → sem verificação de limite
            if (limit.lifetime !== null || limit.perMonth !== null) {
                if (limit.lifetime !== null) {
                    const { count } = await sb
                        .from('strategies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                    if ((count ?? 0) >= limit.lifetime) {
                        return new Response(JSON.stringify({ ok: false, error: 'plan_limit_reached', plan }), {
                            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        })
                    }
                } else if (limit.perMonth !== null) {
                    const monthStart = new Date()
                    monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
                    const { count } = await sb
                        .from('strategies')
                        .select('id', { count: 'exact', head: true })
                        .eq('user_id', userId)
                        .gte('created_at', monthStart.toISOString())
                    if ((count ?? 0) >= limit.perMonth) {
                        return new Response(JSON.stringify({ ok: false, error: 'plan_limit_reached', plan }), {
                            status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                        })
                    }
                }
            }
        }

        // 3. Check cache — only when flightId is provided (seatsContext flow has no DB flight)
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        let cached: { structured_result: unknown; tokens_used: number | null } | null = null
        if (flightId) {
            const { data } = await sb
                .from('strategies')
                .select('structured_result, tokens_used')
                .eq('flight_id', flightId)
                .gte('created_at', oneDayAgo)
                .not('structured_result', 'is', null)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()
            cached = data
        }

        if (cached?.structured_result) {
            console.log(`[strategy] Cache hit for flight ${flightId}`)
            return new Response(JSON.stringify({
                ok: true,
                strategy: cached.structured_result,
                tokens_used: cached.tokens_used ?? 0,
                cached: true,
            }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }

        // 3. Build context pieces (cache miss)
        const iata = extractIata(flight.companhia)
        const programs = AIRLINE_PROGRAMS[iata] ?? ['Livelo']
        const priceMilesEst = flight.preco_brl ? Math.round((flight.preco_brl * 55) / 1000) * 1000 : 0

        const [flightStr, promoStr, userStr] = await Promise.all([
            Promise.resolve(buildFlightString(flight as FlightRow)),
            buildPromoString(programs, sb),
            userId ? buildUserString(userId, priceMilesEst, sb) : Promise.resolve(''),
        ])

        // 4. Assemble prompt
        const sections = [
            '=== VOO SELECIONADO ===', flightStr,
        ]
        // Contexto de milhas do Seats.aero (disponibilidade real encontrada)
        if (seatsContext) {
            const roundTrip = seatsContext.isRoundTrip
            const lines = [
                `Disponibilidade REAL encontrada no Seats.aero:`,
                `  Programa: ${seatsContext.program}`,
                `  Ida: ${seatsContext.idaMilhas.toLocaleString('pt-BR')} pts (${seatsContext.origem} → ${seatsContext.destino})`,
            ]
            if (roundTrip && seatsContext.voltaMilhas) {
                lines.push(`  Volta: ${seatsContext.voltaMilhas.toLocaleString('pt-BR')} pts (${seatsContext.destino} → ${seatsContext.origem})`)
            }
            lines.push(`  Total: ${seatsContext.totalMilhas.toLocaleString('pt-BR')} pts`)
            if (seatsContext.taxas) lines.push(`  Taxas: ${seatsContext.taxas}`)
            lines.push(`  Cabine: ${seatsContext.cabin}`)
            sections.push(`\n=== DISPONIBILIDADE EM MILHAS (Seats.aero) ===`, lines.join('\n'))
        }
        // Preço cash de referência para comparação
        if (cashPrice && cashPrice > 0) {
            const totalBrl = Number(cashPrice)
            sections.push(
                `\n=== PREÇO EM DINHEIRO (referência de comparação) ===`,
                `Melhor preço encontrado em dinheiro: R$ ${totalBrl.toLocaleString('pt-BR')}`,
                `Use este valor para calcular economia_pct: quanto o usuário economiza pagando com milhas vs dinheiro.`,
            )
        }
        sections.push('\n=== PROMOÇÕES ATIVAS ===', promoStr)
        if (userStr) sections.push('\n=== SALDO DO USUÁRIO ===', userStr)
        sections.push(`\nResponda APENAS com JSON neste formato:\n${JSON_SCHEMA}`)
        const userPrompt = sections.join('\n')

        const approxTokens = Math.ceil(userPrompt.length / 4)
        console.log(`[strategy] Flight ${flightId} | ~${approxTokens} input tokens`)

        // 5. Call OpenAI
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set in Edge Function secrets')

        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    {
                        role: 'system',
                        content: `Você é FlyWise, especialista em milhas e programas de fidelidade aéreos do Brasil.
Sua função: gerar a estratégia MAIS ECONÔMICA para emitir o voo usando milhas que o usuário JÁ POSSUI ou pode obter SEM solicitar cartão de crédito novo.

REGRAS OBRIGATÓRIAS:
- NUNCA sugira solicitar, contratar ou pedir um novo cartão de crédito. Isso é proibido.
- Foque apenas em: (1) transferência de pontos já existentes entre programas, (2) compra de milhas bonificada quando disponível, (3) uso de clubes de assinatura com bônus (ex: Smiles Clube Diamante, LATAM Pass Clube)
- SE o usuário tem saldo suficiente (marcado com ✓), o passo 1 DEVE usar esse saldo
- SE há promoção de bônus de transferência ativa, PRIORIZE e explique como aproveitar
- SE o usuário tem clube, cite o bônus de tier no passo relevante
- steps: apenas o TÍTULO curto de cada passo (máx 8 palavras)
- step_details: explicação detalhada e didática para quem nunca usou milhas — diga onde clicar, qual site/app, quanto tempo leva, o que esperar
- regras_promocoes: liste regras/condições importantes sobre promoções ou programas usados (validade, limite, cumulatividade, etc.)
- Calcule milhas_necessarias realistas: Smiles BR→USA economy ~35k-45k; business ~55k-70k; BR→EUR economy ~45k-60k
- taxas_estimadas_brl: Smiles ~R$50-150; LATAM Pass ~R$300-600+
- Responda APENAS em JSON válido sem texto adicional.`,
                    },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 900,
                temperature: 0.2,
            }),
        })

        const llmData = await llmRes.json()
        if (!llmRes.ok) throw new Error(llmData.error?.message ?? 'OpenAI error')

        const strategyJson = llmData.choices?.[0]?.message?.content ?? '{}'
        const tokensUsed = llmData.usage?.total_tokens ?? 0
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(strategyJson) } catch { /* raw fallback */ }

        // 6. Save to strategies table (non-blocking — don't let DB errors fail the response)
        if (userId) {
            try {
                const busca = await sb.from('buscas').select('id').eq('user_id', userId)
                    .order('created_at', { ascending: false }).limit(1).single()

                await sb.from('strategies').insert({
                    user_id: userId,
                    busca_id: busca.data?.id ?? null,
                    flight_id: flightId ?? null,
                    strategy_text: (parsed.steps as string[] ?? []).join('\n\n'),
                    tags: [parsed.programa_recomendado, iata, 'llm'].filter(Boolean),
                    economia_pct: parsed.economia_pct ?? null,
                    preco_cash: flight.preco_brl,
                    preco_estrategia: parsed.taxas_estimadas_brl ?? null,
                    structured_result: parsed,
                    llm_model: 'gpt-4o-mini',
                    tokens_used: tokensUsed,
                })
            } catch (saveErr) {
                console.error('[strategy] DB save failed (non-blocking):', saveErr)
            }
        }

        return new Response(JSON.stringify({
            ok: true,
            strategy: parsed,
            tokens_used: tokensUsed,
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (err) {
        console.error('[strategy] Error:', err)
        return new Response(JSON.stringify({ ok: false, error: String(err) }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
