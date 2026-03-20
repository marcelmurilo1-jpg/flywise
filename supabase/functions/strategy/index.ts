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
        const { data } = await sb.from('buscas').select('user_miles')
            .eq('user_id', userId).not('user_miles', 'eq', '{}')
            .order('created_at', { ascending: false }).limit(1).single()
        if (!data?.user_miles) return ''
        const balances = Object.entries(data.user_miles as Record<string, number>)
            .filter(([, pts]) => pts > 0).sort((a, b) => b[1] - a[1])
        if (!balances.length) return ''
        const str = balances.map(([prog, pts]) =>
            `${prog}: ${pts.toLocaleString('pt-BR')} pts${pts >= neededMiles ? ' ✓ suficiente' : ''}`
        ).join(' | ')
        return `Saldo do usuário: ${str}`
    } catch { return '' }
}

const JSON_SCHEMA = `{
  "programa_recomendado": "<ex: Smiles | LATAM Pass | TudoAzul | Livelo>",
  "motivo": "<máx 2 frases explicando por que este programa é o melhor para esta rota>",
  "steps": [
    "<Passo 1 — Acumular: qual cartão de crédito solicitar ou qual parceiro transferir para chegar às milhas necessárias. Inclua o nome do cartão e banco.>",
    "<Passo 2 — Transferir: quando e como transferir pontos para o programa, aproveitando bônus de transferência se houver promoção ativa.>",
    "<Passo 3 — Emitir: como emitir o bilhete pelo site/app do programa — rota exata, cabine, dica de disponibilidade.>",
    "<Passo 4 — Timing: melhor época para reservar, lista de espera se lotado, ou alternativa de programa caso não haja disponibilidade.>"
  ],
  "milhas_necessarias": <número inteiro — milhas para emitir este voo no programa recomendado>,
  "taxas_estimadas_brl": <número inteiro — taxas e sobretaxas em R$ além das milhas>,
  "economia_pct": <número 0-100 — percentual de economia vs preço cash>,
  "promocao_ativa": "<se houver promoção de transferência ou bônus relevante, descreva: 'Ex: 80% bônus Nubank→Smiles até 30/04' ou null>",
  "alternativa": "<segundo programa recomendado caso o principal não tenha disponibilidade, ou null>",
  "aviso": "<aviso importante: ex: 'Este voo tem cobranças de combustível elevadas no programa X' ou null>"
}`

serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

    try {
        const { flightId, userId } = await req.json()
        if (!flightId) return new Response(JSON.stringify({ error: 'flightId required' }), { status: 400, headers: corsHeaders })

        // Init Supabase with service role (can bypass RLS to read flight owned by user)
        const sb = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
        )

        // 1. Load flight
        const { data: flight, error: fErr } = await sb.from('resultados_voos').select('*').eq('id', flightId).single()
        if (fErr || !flight) return new Response(JSON.stringify({ error: 'Flight not found' }), { status: 404, headers: corsHeaders })

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
            }
            const limit = LIMITS[plan] ?? LIMITS['free']

            if (limit.lifetime !== null) {
                const { count } = await sb
                    .from('strategies')
                    .select('id', { count: 'exact', head: true })
                    .eq('user_id', userId)
                if ((count ?? 0) >= limit.lifetime) {
                    return new Response(JSON.stringify({ error: 'plan_limit_reached', plan }), {
                        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
                    return new Response(JSON.stringify({ error: 'plan_limit_reached', plan }), {
                        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                    })
                }
            }
        }

        // 3. Check cache — return existing strategy if generated in the last 24h
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        const { data: cached } = await sb
            .from('strategies')
            .select('structured_result, tokens_used')
            .eq('flight_id', flightId)
            .gte('created_at', oneDayAgo)
            .not('structured_result', 'is', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .single()

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
            '\n=== PROMOÇÕES ATIVAS ===', promoStr,
        ]
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
                        content: `Você é FlyWise, especialista em programas de fidelidade e milhas aéreas do Brasil (Smiles, LATAM Pass, TudoAzul, Livelo, Esfera, Membership Rewards, Elo Mais).
Sua função: analisar o voo selecionado e gerar a estratégia MAIS ECONÔMICA para emiti-lo com milhas.
Regras:
- Priorize promoções de transferência ativas para reduzir milhas necessárias
- Os steps devem ser ACIONÁVEIS e ESPECÍFICOS: mencione nome de cartão, banco, app, prazo
- Calcule milhas_necessarias com base no programa recomendado (Smiles BR→USA economy: ~35.000-45.000 milhas; business: ~55.000-70.000)
- taxas_estimadas_brl: Smiles cobra baixas taxas; LATAM Pass cobra combustível (pode ser R$400+)
- Responda APENAS em JSON válido sem texto adicional.`,
                    },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 600,
                temperature: 0.2,
            }),
        })

        const llmData = await llmRes.json()
        if (!llmRes.ok) throw new Error(llmData.error?.message ?? 'OpenAI error')

        const strategyJson = llmData.choices?.[0]?.message?.content ?? '{}'
        const tokensUsed = llmData.usage?.total_tokens ?? 0
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(strategyJson) } catch { /* raw fallback */ }

        // 6. Save to strategies table
        if (userId) {
            const busca = await sb.from('buscas').select('id').eq('user_id', userId)
                .order('created_at', { ascending: false }).limit(1).single()

            await sb.from('strategies').insert({
                user_id: userId,
                busca_id: busca.data?.id ?? null,
                flight_id: flightId,
                strategy_text: (parsed.steps as string[] ?? []).join('\n\n'),
                tags: [parsed.programa_recomendado, iata, 'llm'].filter(Boolean),
                economia_pct: parsed.economia_pct ?? null,
                preco_cash: flight.preco_brl,
                preco_estrategia: parsed.taxas_estimadas_brl ?? null,
                structured_result: parsed,
                llm_model: 'gpt-4o-mini',
                tokens_used: tokensUsed,
            })
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
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
