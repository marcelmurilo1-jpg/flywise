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

async function buildPromoString(programs: string[], sb: ReturnType<typeof createClient>): Promise<string> {
    try {
        let q = sb.from('promocoes').select('titulo,programa,tipo,bonus_pct,parceiro,valid_until')
            .or('valid_until.is.null,valid_until.gt.' + new Date().toISOString())
            .limit(5)
        if (programs.length > 0) q = q.in('programa', programs)
        const { data } = await q
        if (!data?.length) return 'Nenhuma promoção ativa registrada.'
        return data.map((p: Record<string, unknown>, i: number) => {
            const parts = [`${i + 1}. ${p.programa ?? 'Geral'}`]
            if (p.bonus_pct) parts.push(`+${p.bonus_pct}% bônus`)
            if (p.parceiro) parts.push(`via ${p.parceiro}`)
            parts.push(`— ${String(p.titulo ?? '').slice(0, 100)}`)
            if (p.valid_until) parts.push(`(expira ${new Date(p.valid_until as string).toLocaleDateString('pt-BR')})`)
            return parts.join(' ')
        }).join('\n')
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
  "programa_recomendado": "<nome do programa>",
  "motivo": "<máx 2 frases>",
  "steps": ["<passo 1>", "<passo 2>", "<passo 3>"],
  "milhas_necessarias": <número>,
  "taxas_estimadas_brl": <número>,
  "economia_pct": <número 0-100>,
  "promocao_ativa": "<descrição breve ou null>",
  "alternativa": "<segundo programa ou null>",
  "aviso": "<aviso importante ou null>"
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

        // 2. Build context pieces
        const iata = extractIata(flight.companhia)
        const programs = AIRLINE_PROGRAMS[iata] ?? ['Livelo']
        const priceMilesEst = flight.preco_brl ? Math.round((flight.preco_brl * 55) / 1000) * 1000 : 0

        const [flightStr, promoStr, userStr] = await Promise.all([
            Promise.resolve(buildFlightString(flight as FlightRow)),
            buildPromoString(programs, sb),
            userId ? buildUserString(userId, priceMilesEst, sb) : Promise.resolve(''),
        ])

        // 3. Assemble prompt
        const sections = [
            '=== VOO SELECIONADO ===', flightStr,
            '\n=== PROMOÇÕES ATIVAS ===', promoStr,
        ]
        if (userStr) sections.push('\n=== SALDO DO USUÁRIO ===', userStr)
        sections.push(`\nResponda APENAS com JSON neste formato:\n${JSON_SCHEMA}`)
        const userPrompt = sections.join('\n')

        const approxTokens = Math.ceil(userPrompt.length / 4)
        console.log(`[strategy] Flight ${flightId} | ~${approxTokens} input tokens`)

        // 4. Call OpenAI
        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set in Edge Function secrets')

        const llmRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'Você é FlyWise, especialista em milhas aéreas. Responda APENAS em JSON válido sem texto adicional.' },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 500,
                temperature: 0.3,
            }),
        })

        const llmData = await llmRes.json()
        if (!llmRes.ok) throw new Error(llmData.error?.message ?? 'OpenAI error')

        const strategyJson = llmData.choices?.[0]?.message?.content ?? '{}'
        const tokensUsed = llmData.usage?.total_tokens ?? 0
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(strategyJson) } catch { /* raw fallback */ }

        // 5. Save to strategies table
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
