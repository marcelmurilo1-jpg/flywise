// Supabase Edge Function: /itinerary
// Runtime: Deno (Supabase Functions)
// Deploy: supabase functions deploy itinerary
//
// Env vars required:
//   OPENAI_API_KEY            — your OpenAI key (GPT-4o-mini)
//   SUPABASE_URL              — automatically injected by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — automatically injected by Supabase

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { itinerary_id } = await req.json()
        if (!itinerary_id) {
            return new Response(JSON.stringify({ error: 'itinerary_id is required' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const supabaseUrl = Deno.env.get('SUPABASE_URL')!
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        const openaiKey = Deno.env.get('OPENAI_API_KEY')!

        const supabase = createClient(supabaseUrl, serviceRoleKey)

        // Fetch itinerary record
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

        const systemPrompt = `Você é um especialista em turístico de elite com experiência em +50 países. Seu diferencial: você pesquisa os roteiros MAIS FAMOSOS e MAIS FEITOS por viajantes experientes em cada cidade, como os roteiros do Rick Steves, Lonely Planet Best-Of e "must-do" no TripAdvisor/Google Local Guides. Você nunca sugere atividades genéricas nem armadilhas turísticas.

REGRAS ABSOLUTAS:
1. ATIVIDADES FAMOSAS: Sugira os passeios, monumentos, bairros e experiências gastronômicas MAIS COBIERTOS e MAIS FEITOS por turistas em cada destino específico. Use como referência o que aparece no top dos ratings do TripAdvisor, Google Maps, Lonely Planet e guias locais.
2. DURAÇÃO REALISTA + TRÂNSITO: Calcule o horário de cada atividade somando duração da atividade anterior + tempo de deslocamento:
   - Café/lanche: 30-45min | Almoço/jantar: 1h-1h30 | Catedral/monumento: 45min-1h30 | Museu pequeno: 1h-2h | Museu grande: 2h-3h | Bairro: 1h30-2h
   - Deslocamento a pé: 10-20min | Transporte (metro/ônibus): 20-30min
3. PERÍODO COMPLETO: Cada período deve ter atividades cobrindo todo o tempo: manhã=4h(08h-12h), tarde=5h(13h-18h), noite=3h30(19h-22h30). Gere 2 a 4 atividades por período.
4. COORDENADAS PRECISAS: lat e lng devem ser as coordenadas do local ESPECÍFICO, nunca do centro genérico da cidade.
5. ORÇAMENTO: Respeite 100% o nível de orçamento.
6. Responda APENAS em JSON válido.`

        const userPrompt = `Crie um roteiro de viagem detalhado com as seguintes informações:
- Destino: ${destination}
- Duração: ${duration} dia${duration > 1 ? 's' : ''}
- Perfil do viajante: ${travelerLabel}
- Estilo de viagem: ${styleList}
- Nível de orçamento: ${budgetLabel}

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
          { "horario": "08:00", "atividade": "string", "local": "string", "dica": "string", "lat": number, "lng": number },
          { "horario": "09:30", "atividade": "string", "local": "string", "dica": "string", "lat": number, "lng": number }
        ]
      },
      "tarde": {
        "atividades": [
          { "horario": "13:00", "atividade": "string", "local": "string", "dica": "string", "lat": number, "lng": number },
          { "horario": "14:30", "atividade": "string", "local": "string", "dica": "string", "lat": number, "lng": number }
        ]
      },
      "noite": {
        "atividades": [
          { "horario": "19:00", "atividade": "string", "local": "string", "dica": "string", "lat": number, "lng": number },
          { "horario": "21:00", "atividade": "string", "local": "string", "dica": "string", "lat": number, "lng": number }
        ]
      }
    }
  ],
  "dicas_gerais": ["string"],
  "orcamento_estimado": "string",
  "extras": {
    "gastronomia": [{ "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }],
    "cultura": [{ "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }],
    "natureza": [{ "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }],
    "compras": [{ "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }]
  }
}

Regras:
- Gere exatamente ${duration} dias.
- Cada período (manha, tarde, noite) deve ter entre 2 e 4 atividades em "atividades", cobrindo o período inteiro com horários calculados (duração + deslocamento).
- Todas as atividades devem ser FAMOSAS e TOP-RATED no destino. Priorize o que aparece no topo do TripAdvisor, Google Maps e guias de viagem para ${destination}.
- lat e lng de cada atividade devem ser coordenadas REAIS e PRECISAS do local específico.
- "extras": 3-4 itens por categoria com coordenadas precisas.`

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
                response_format: { type: 'json_object' },
                max_tokens: 7500,
                temperature: 0.7,
            }),
        })

        if (!openaiRes.ok) {
            const errText = await openaiRes.text()
            console.error('OpenAI error:', errText)
            return new Response(JSON.stringify({ error: 'OpenAI API error' }), {
                status: 502,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const openaiData = await openaiRes.json()
        const tokensUsed = openaiData.usage?.total_tokens ?? 0
        const rawContent = openaiData.choices?.[0]?.message?.content ?? '{}'
        const result = JSON.parse(rawContent)

        // Save result back to itineraries table
        await supabase
            .from('itineraries')
            .update({ result, tokens_used: tokensUsed })
            .eq('id', itinerary_id)

        return new Response(JSON.stringify({ result, tokens_used: tokensUsed }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        console.error('Edge function error:', err)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
