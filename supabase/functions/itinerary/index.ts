// Supabase Edge Function: /itinerary
// Runtime: Deno (Supabase Functions)
// Deploy: supabase functions deploy itinerary
//
// Env vars required:
//   ANTHROPIC_API_KEY         — your Anthropic key (claude-sonnet-4-6)
//   SUPABASE_URL              — automatically injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — automatically injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ResearchSnippets {
    tripadvisor_top?: string
    locals_recommend?: string
    restaurantes?: string
    tendencias?: string
}

interface ResearchRow {
    destination: string
    snippets: ResearchSnippets
    created_at: string
}

// ─── Research cache (itinerary_research, TTL 7 days) ─────────────────────────

async function fetchResearchCache(
    destination: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sb: any,
): Promise<ResearchSnippets | null> {
    try {
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data } = await sb
            .from('itinerary_research')
            .select('snippets, created_at')
            .eq('destination', destination.toLowerCase())
            .gt('created_at', sevenDaysAgo)
            .single()
        return (data as ResearchRow | null)?.snippets ?? null
    } catch {
        return null
    }
}

// ─── Date context ────────────────────────────────────────────────────────────

interface DateContext {
    ano: number
    mes: string
    dataCompleta: string
    estacaoBrasil: string   // estação no Brasil (para calibrar hemisférios)
    dicaEpoca: string       // dica contextual para o mês
}

function buildDateContext(): DateContext {
    const now = new Date()
    const ano = now.getUTCFullYear()
    const mesNum = now.getUTCMonth() + 1 // 1-12

    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                   'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    const mes = meses[mesNum - 1]

    // Estação no Brasil (hemisfério sul)
    let estacaoBrasil: string
    let dicaEpoca: string
    if (mesNum >= 12 || mesNum <= 2) {
        estacaoBrasil = 'Verão'
        dicaEpoca = 'Calor intenso no Brasil; destinos no hemisfério norte em inverno (menos turistas, preços menores); Europa e América do Norte com neve e festivais de Natal/Ano Novo.'
    } else if (mesNum <= 5) {
        estacaoBrasil = 'Outono'
        dicaEpoca = 'Clima ameno no Brasil; primavera no hemisfério norte (flores, turismo crescente); Páscoa pode estar próxima.'
    } else if (mesNum <= 8) {
        estacaoBrasil = 'Inverno'
        dicaEpoca = 'Alta temporada no hemisfério norte (verão europeu, americano); destinos tropicais com clima mais seco; alta demanda e preços mais altos na Europa.'
    } else {
        estacaoBrasil = 'Primavera'
        dicaEpoca = 'Primavera no Brasil; outono no hemisfério norte (folhas coloridas na Europa e América do Norte); clima agradável na maioria dos destinos.'
    }

    return {
        ano,
        mes,
        dataCompleta: `${mes} de ${ano}`,
        estacaoBrasil,
        dicaEpoca,
    }
}

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildResearchContext(destination: string, snippets: ResearchSnippets | null, dateCtx: DateContext): string {
    if (snippets && Object.keys(snippets).length > 0) {
        const lines: string[] = [`[CONTEXTO DE PESQUISA — dados curados para ${destination}]`]
        if (snippets.tripadvisor_top) lines.push(`Destaques em ${destination}:\n${snippets.tripadvisor_top}`)
        if (snippets.locals_recommend) lines.push(`Recomendado por locais:\n${snippets.locals_recommend}`)
        if (snippets.restaurantes) lines.push(`Restaurantes em alta:\n${snippets.restaurantes}`)
        if (snippets.tendencias) lines.push(`Tendências em ${dateCtx.ano}:\n${snippets.tendencias}`)
        return lines.join('\n\n')
    }

    return `[CONTEXTO DO DESTINO — usando conhecimento de treinamento]
Período da viagem: ${dateCtx.dataCompleta} | Estação no Brasil: ${dateCtx.estacaoBrasil}
${dateCtx.dicaEpoca}

Para ${destination} em ${dateCtx.mes} de ${dateCtx.ano}, considere:
- Clima e condições típicas para este mês no destino
- Alta ou baixa temporada (impacto em preços, filas, disponibilidade)
- Eventos, festivais ou épocas especiais que normalmente ocorrem neste período
- O que está em alta entre viajantes experientes EM ${dateCtx.ano} (não apenas clássicos genéricos)
- Estabelecimentos ou experiências com buzz atual entre quem realmente conhece o destino`
}

function buildSystemPrompt(dateCtx: DateContext): string {
    return `Você é um especialista em viagens com conhecimento profundo sobre destinos ao redor do mundo — bairros, atrações, restaurantes, experiências culturais e dicas práticas. Seu conhecimento vem de extenso treinamento em guias especializados, blogs de viagem de alto nível, publicações como Lonely Planet, Timeout, Condé Nast Traveler e relatos de viajantes experientes.

CONTEXTO TEMPORAL — CRÍTICO:
- Mês e ano atual: ${dateCtx.dataCompleta}
- Estação atual no Brasil: ${dateCtx.estacaoBrasil}
- ${dateCtx.dicaEpoca}
- ADAPTE o roteiro ao que é relevante em ${dateCtx.mes} de ${dateCtx.ano}: clima, movimento turístico, eventos sazonais, horários de funcionamento típicos deste período.

REGRAS ABSOLUTAS:
1. LUGARES REAIS E ESPECÍFICOS: Recomende apenas lugares que genuinamente existem e são reconhecidos por quem entende de viagens — não o óbvio turístico de segunda linha. Prefira o que é autêntico e bem avaliado por quem realmente conhece o destino.
2. ANTI-GENÉRICO: Nunca recomende algo apenas por ser "famoso". Se um lugar tem uma versão melhor ou mais autêntica, recomende essa. Quem usa o FlyWise quer o que os melhores roteiristas locais indicariam.
3. SAZONALIDADE REAL: Mencione se algo é especialmente bom ou ruim no mês atual. Ex: "Evite este museu em ${dateCtx.mes} — filas de até 2h". Seja honesto sobre o período.
4. DETALHES PRÁTICOS: Para cada atividade informe o melhor momento para visitar (melhor_epoca) e o que evitar (filas, horários ruins, armadilhas turísticas).
5. DURAÇÃO REALISTA + TRÂNSITO: Calcule horários somando duração + deslocamento:
   - Café/lanche: 30-45min | Almoço/jantar: 1h-1h30 | Monumento/catedral: 45min-1h30 | Museu pequeno: 1h-2h | Museu grande: 2h-3h | Bairro: 1h30-2h
   - Deslocamento a pé: 10-20min | Metro/ônibus: 20-30min
6. PERÍODO COMPLETO: manhã=4h(08h-12h), tarde=5h(13h-18h), noite=3h30(19h-22h30). Gere 2 a 4 atividades por período.
7. COORDENADAS PRECISAS: lat e lng do local ESPECÍFICO, nunca do centro da cidade.
8. ORÇAMENTO: Respeite 100% o nível de orçamento definido.
9. Responda APENAS em JSON válido, sem texto fora do JSON.
10. CONCISÃO OBRIGATÓRIA: cada campo de texto deve ter no máximo 12 palavras. Seja direto.`
}

function buildUserPrompt(
    destination: string,
    duration: number,
    travelerLabel: string,
    styleList: string,
    budgetLabel: string,
    snippets: ResearchSnippets | null,
    dateCtx: DateContext,
): string {
    const researchContext = buildResearchContext(destination, snippets, dateCtx)

    // For trips > 3 days use a compact schema to stay within Haiku's 8192 output token limit.
    // Full schema for 2 days uses ~7000 output tokens; scaling linearly 7 days would need ~20000.
    const longTrip = duration > 3

    const activitySchema = longTrip
        ? `{
            "horario": "08:00",
            "atividade": "string",
            "local": "string",
            "dica": "string — fonte + melhor horário + o que evitar, máx 12 palavras",
            "lat": 0.0,
            "lng": 0.0
          }`
        : `{
            "horario": "08:00",
            "atividade": "string",
            "local": "string",
            "dica": "string",
            "fonte": "string — ex: TripAdvisor #1, Lonely Planet Best-Of, recomendado por locais",
            "popularidade": 5,
            "melhor_epoca": "string — ex: manhã antes das 9h, dias úteis",
            "evitar": "string — ex: fins de semana, horário 12h-14h",
            "lat": 0.0,
            "lng": 0.0
          }`

    const extrasSchema = longTrip
        ? `[{ "nome": "string", "descricao": "string", "lat": 0.0, "lng": 0.0 }]`
        : `[{ "nome": "string", "descricao": "string", "dica": "string", "fonte": "string", "popularidade": 5, "lat": 0.0, "lng": 0.0 }]`

    const activitiesRule = longTrip
        ? `- Cada período deve ter EXATAMENTE 2 atividades (6 por dia). Seja conciso.`
        : `- Cada período deve ter 2 a 4 atividades cobrindo o período inteiro com horários calculados.`

    const extrasRule = longTrip
        ? `- "extras": 2-3 itens por categoria com coordenadas precisas.`
        : `- "extras": 3-4 itens por categoria com coordenadas precisas, fonte e popularidade.\n- "fonte" deve ser específico e real (ex: "TripAdvisor #3 em ${destination}", "Michelin Guide").\n- "popularidade" de 1 a 5 — seja honesto.\n- "melhor_epoca" e "evitar" são OBRIGATÓRIOS em cada atividade.`

    return `${researchContext}

---

[ROTEIRO SOLICITADO]
- Destino: ${destination}
- Duração: ${duration} dia${duration > 1 ? 's' : ''}
- Perfil do viajante: ${travelerLabel}
- Estilo de viagem: ${styleList}
- Nível de orçamento: ${budgetLabel}

Com base EXCLUSIVAMENTE nas informações de pesquisa acima (priorizando-as) e complementando com seu conhecimento, gere um roteiro completo.

Responda SOMENTE em JSON com esta estrutura:
{
  "titulo": "string",
  "resumo": "string",
  "dias": [
    {
      "dia": 1,
      "tema": "string",
      "manha": {
        "atividades": [${activitySchema}]
      },
      "tarde": { "atividades": [] },
      "noite": { "atividades": [] }
    }
  ],
  "dicas_gerais": ["string"],
  "orcamento_estimado": "string",
  "extras": {
    "gastronomia": ${extrasSchema},
    "cultura":     ${extrasSchema},
    "natureza":    ${extrasSchema},
    "compras":     ${extrasSchema}
  }
}

Regras:
- Gere exatamente ${duration} dias.
${activitiesRule}
- lat e lng devem ser coordenadas REAIS e PRECISAS do local específico.
${extrasRule}`
}

// ─── Anthropic API call ───────────────────────────────────────────────────────

async function callClaude(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
): Promise<{ content: string; tokensUsed: number }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 8192,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
        }),
    })

    if (!res.ok) {
        const errText = await res.text()
        console.error('[itinerary] Anthropic error:', res.status, errText)
        throw new Error(`Anthropic API error: ${res.status}`)
    }

    const data = await res.json()
    const content: string = data.content?.[0]?.text ?? '{}'
    const tokensUsed: number = (data.usage?.input_tokens ?? 0) + (data.usage?.output_tokens ?? 0)
    return { content, tokensUsed }
}

// ─── JSON extraction ─────────────────────────────────────────────────────────
// Claude às vezes envolve o JSON em ```json ... ```, então extraímos com segurança.

function extractJson(raw: string): string {
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (fenceMatch) return fenceMatch[1].trim()
    const firstBrace = raw.indexOf('{')
    const lastBrace = raw.lastIndexOf('}')
    if (firstBrace !== -1 && lastBrace !== -1) return raw.slice(firstBrace, lastBrace + 1)
    return raw
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

        const supabase = createClient(supabaseUrl, serviceRoleKey)

        // Function deployed with --no-verify-jwt because new Supabase projects
        // use the sb_publishable_... key format which breaks gateway-level JWT
        // verification. We verify the user's JWT manually here instead.
        const authHeader = req.headers.get('Authorization') ?? ''
        const jwt = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
        if (!jwt) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }
        const { data: { user: jwtUser }, error: jwtError } = await supabase.auth.getUser(jwt)
        if (jwtError || !jwtUser) {
            console.error('[itinerary] JWT verification failed:', jwtError?.message)
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { itinerary_id } = await req.json()
        if (!itinerary_id) {
            return new Response(JSON.stringify({ error: 'itinerary_id is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!anthropicKey) {
            console.error('[itinerary] ANTHROPIC_API_KEY not set')
            return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY não configurada nos secrets da Edge Function.' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 1. Fetch itinerary record
        const { data: itinerary, error: fetchErr } = await supabase
            .from('itineraries')
            .select('*')
            .eq('id', itinerary_id)
            .single()

        if (fetchErr || !itinerary) {
            return new Response(JSON.stringify({ error: 'Itinerary not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { destination, duration, traveler_type, travel_style, budget } = itinerary

        const styleList = Array.isArray(travel_style) && travel_style.length > 0
            ? travel_style.join(', ')
            : 'Geral'

        const budgetMap: Record<number, string> = {
            1: 'Orçamento zero — apenas passeios, parques, museus com entrada gratuita e atividades sem nenhum custo',
            2: 'Econômico — atividades muito baratas, comida de rua de alta qualidade, atrações com ingressos de baixo custo e restaurantes locais acessíveis',
            3: 'Moderado — excelente custo-benefício, atrações pagas padrão, restaurantes de qualidade com preços justos e bistrôs casuais',
            4: 'Premium — experiências de alto padrão, ingressos com fura-fila, restaurantes renomados e de alta gastronomia, tours privados ou semi-privados',
        }
        const budgetLabel = budgetMap[budget ?? 2] ?? budgetMap[2]

        const travelerMap: Record<string, string> = {
            solo: 'Solo (viajante individual)',
            casal: 'Casal',
            familia: 'Família com crianças',
            amigos: 'Grupo de amigos',
        }
        const travelerLabel = travelerMap[traveler_type] ?? traveler_type

        // 2. Check research cache (itinerary_research, TTL 7 days)
        const snippets = await fetchResearchCache(destination, supabase)
        console.log(`[itinerary] Research cache: ${snippets ? 'HIT' : 'MISS'} — ${destination}`)

        // 3. Build prompts
        const dateCtx = buildDateContext()
        console.log(`[itinerary] Date context: ${dateCtx.dataCompleta} | ${dateCtx.estacaoBrasil}`)
        const systemPrompt = buildSystemPrompt(dateCtx)
        const userPrompt = buildUserPrompt(destination, duration, travelerLabel, styleList, budgetLabel, snippets, dateCtx)

        // 4. Call Claude
        const { content: rawContent, tokensUsed } = await callClaude(systemPrompt, userPrompt, anthropicKey)

        // 5. Parse JSON
        const jsonStr = extractJson(rawContent)
        let result: Record<string, unknown>
        try {
            result = JSON.parse(jsonStr)
        } catch (parseErr) {
            console.error('[itinerary] JSON parse error:', parseErr, '\nRaw:', rawContent.slice(0, 1000))
            return new Response(JSON.stringify({ error: 'A IA retornou uma resposta inválida. Tente novamente.' }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 6. Validate required fields
        if (!result.titulo || !Array.isArray(result.dias) || result.dias.length === 0) {
            console.error('[itinerary] Missing required fields in result')
            return new Response(JSON.stringify({ error: 'A IA retornou um roteiro incompleto. Tente novamente.' }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 7. Save result back to itineraries table
        await supabase
            .from('itineraries')
            .update({ result, tokens_used: tokensUsed })
            .eq('id', itinerary_id)

        return new Response(JSON.stringify({ result, tokens_used: tokensUsed }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        console.error('[itinerary] Edge function error:', err)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
