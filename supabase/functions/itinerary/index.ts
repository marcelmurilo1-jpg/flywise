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

// ─── Prompt builders ─────────────────────────────────────────────────────────

function buildResearchContext(destination: string, snippets: ResearchSnippets | null): string {
    if (snippets && Object.keys(snippets).length > 0) {
        const lines: string[] = ['[CONTEXTO DE PESQUISA — dados reais coletados]']
        if (snippets.tripadvisor_top) lines.push(`TripAdvisor Top ${destination}:\n${snippets.tripadvisor_top}`)
        if (snippets.locals_recommend) lines.push(`Recomendado por locais:\n${snippets.locals_recommend}`)
        if (snippets.restaurantes) lines.push(`Restaurantes em alta:\n${snippets.restaurantes}`)
        if (snippets.tendencias) lines.push(`Tendências e novidades:\n${snippets.tendencias}`)
        return lines.join('\n\n')
    }

    // Sem dados externos: instrui o modelo a usar seu próprio conhecimento curado
    return `[CONTEXTO DE PESQUISA — sem dados externos disponíveis]
Use seu conhecimento atualizado sobre ${destination} para responder as seguintes questões antes de montar o roteiro:
- Quais são os 10 pontos mais bem avaliados no TripAdvisor e Google Maps?
- O que moradores locais e viajantes experientes MAIS recomendam?
- Quais restaurantes e experiências gastronômicas estão em alta?
- Quais são os "hidden gems" menos conhecidos pelos turistas convencionais?
- O que está em tendência para viajantes em 2025?
Priorize SEMPRE essas informações ao selecionar atividades.`
}

function buildSystemPrompt(): string {
    return `Você é um curador de viagens de elite com acesso a avaliações reais do TripAdvisor, Google Maps, Lonely Planet, Timeout e guias locais. Seu diferencial: você só recomenda o que tem comprovação de qualidade — seja pelo volume de avaliações, pela consistência das notas ou pela recomendação de viajantes experientes.

REGRAS ABSOLUTAS:
1. QUALIDADE COMPROVADA: Cada atividade deve ter uma fonte real ou reconhecível (TripAdvisor, Google, Lonely Planet, guia local, etc.) e um score de popularidade honesto de 1-5.
2. DETALHES PRÁTICOS: Para cada atividade informe o melhor momento para visitar (melhor_epoca) e o que evitar (filas, horários ruins, armadilhas turísticas).
3. DURAÇÃO REALISTA + TRÂNSITO: Calcule horários somando duração + deslocamento:
   - Café/lanche: 30-45min | Almoço/jantar: 1h-1h30 | Monumento/catedral: 45min-1h30 | Museu pequeno: 1h-2h | Museu grande: 2h-3h | Bairro: 1h30-2h
   - Deslocamento a pé: 10-20min | Metro/ônibus: 20-30min
4. PERÍODO COMPLETO: manhã=4h(08h-12h), tarde=5h(13h-18h), noite=3h30(19h-22h30). Gere 2 a 4 atividades por período.
5. COORDENADAS PRECISAS: lat e lng do local ESPECÍFICO, nunca do centro da cidade.
6. ORÇAMENTO: Respeite 100% o nível de orçamento definido.
7. Responda APENAS em JSON válido, sem texto fora do JSON.`
}

function buildUserPrompt(
    destination: string,
    duration: number,
    travelerLabel: string,
    styleList: string,
    budgetLabel: string,
    snippets: ResearchSnippets | null,
): string {
    const researchContext = buildResearchContext(destination, snippets)

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
        "atividades": [
          {
            "horario": "08:00",
            "atividade": "string",
            "local": "string",
            "dica": "string",
            "fonte": "string — ex: TripAdvisor #1, Lonely Planet Best-Of, recomendado por locais, tendência 2025",
            "popularidade": 5,
            "melhor_epoca": "string — ex: manhã antes das 9h, dias úteis, evitar alta temporada",
            "evitar": "string — ex: fins de semana, horário 12h-14h, filas longas sem reserva",
            "lat": 0.0,
            "lng": 0.0
          }
        ]
      },
      "tarde": { "atividades": [] },
      "noite": { "atividades": [] }
    }
  ],
  "dicas_gerais": ["string"],
  "orcamento_estimado": "string",
  "extras": {
    "gastronomia": [{ "nome": "string", "descricao": "string", "dica": "string", "fonte": "string", "popularidade": 5, "lat": 0.0, "lng": 0.0 }],
    "cultura":     [{ "nome": "string", "descricao": "string", "dica": "string", "fonte": "string", "popularidade": 5, "lat": 0.0, "lng": 0.0 }],
    "natureza":    [{ "nome": "string", "descricao": "string", "dica": "string", "fonte": "string", "popularidade": 5, "lat": 0.0, "lng": 0.0 }],
    "compras":     [{ "nome": "string", "descricao": "string", "dica": "string", "fonte": "string", "popularidade": 5, "lat": 0.0, "lng": 0.0 }]
  }
}

Regras:
- Gere exatamente ${duration} dias.
- Cada período deve ter 2 a 4 atividades cobrindo o período inteiro com horários calculados.
- "fonte" deve ser específico e real (ex: "TripAdvisor #3 em ${destination}", "Michelin Guide", "Time Out Best Restaurants").
- "popularidade" de 1 a 5 — seja honesto. Lugares menos conhecidos podem ter 3-4 se forem ótimos.
- "melhor_epoca" e "evitar" são OBRIGATÓRIOS em cada atividade.
- lat e lng devem ser coordenadas REAIS e PRECISAS do local específico.
- "extras": 3-4 itens por categoria com coordenadas precisas, fonte e popularidade.`
}

// ─── Anthropic API call ───────────────────────────────────────────────────────

async function callClaude(
    systemPrompt: string,
    userPrompt: string,
    apiKey: string,
    duration: number,
): Promise<{ content: string; tokensUsed: number }> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-sonnet-4-6',
            max_tokens: Math.min(16000, 4000 + duration * 2000),
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
        const systemPrompt = buildSystemPrompt()
        const userPrompt = buildUserPrompt(destination, duration, travelerLabel, styleList, budgetLabel, snippets)

        // 4. Call Claude
        const { content: rawContent, tokensUsed } = await callClaude(systemPrompt, userPrompt, anthropicKey, duration)

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
