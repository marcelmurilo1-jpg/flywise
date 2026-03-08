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
            1: 'Nível 1 — Grátis [Grátis]: APENAS passeios, parques, museus com entrada gratuita e atividades sem nenhum custo. Não incluir restaurantes.',
            2: 'Nível 2 — Econômico [$]: Atividades muito baratas, comida de rua de alta qualidade, atrações com ingressos de baixo custo e restaurantes locais acessíveis.',
            3: 'Nível 3 — Moderado [$$]: Excelente custo-benefício. Atrações pagas padrão, restaurantes de qualidade com preços justos, bistrôs casuais.',
            4: 'Nível 4 — Premium [$$$]: Experiências premium, ingressos com fura-fila, restaurantes renomados e de alta gastronomia, tours privados ou semi-privados.',
        }
        const budgetLabel = budgetMap[budget ?? 2] ?? budgetMap[2]

        const travelerMap: Record<string, string> = {
            solo: 'Solo (viajante individual)',
            casal: 'Casal',
            familia: 'Família com crianças',
            amigos: 'Grupo de amigos',
        }
        const travelerLabel = travelerMap[traveler_type] ?? traveler_type

        const systemPrompt = `Você é um Especialista em Viagens e Planejador de Roteiros Personalizados com 20 anos de experiência. Você conhece cada destino a fundo — os melhores locais segundo guias Michelin, Lonely Planet, TripAdvisor (4.5+ estrelas), Google Reviews (4.4+) e especialistas locais. Você NUNCA sugere armadilhas turísticas genéricas.

**DIRETRIZ DE ORÇAMENTO (CRÍTICO):**
O nível de custo selecionado deve ser respeitado em TODAS as recomendações:
- Nível 1 — Grátis: Inclua APENAS passeios, parques, museus com entrada gratuita e atividades sem nenhum custo. Não sugira restaurantes (a menos que seja para piqueniques com comida de mercado).
- Nível 2 — Econômico ($): Atividades muito baratas, comida de rua de alta qualidade, atrações com ingressos de baixo custo e restaurantes locais acessíveis.
- Nível 3 — Moderado ($$): Excelente custo-benefício. Atrações pagas padrão, restaurantes de qualidade com preços justos, bistrôs casuais.
- Nível 4 — Premium ($$$): Experiências premium, ingressos com fura-fila, restaurantes renomados e de alta gastronomia, tours privados ou semi-privados.
- Nível 5 — Luxo ($$$$): O melhor do melhor. Estrelas Michelin, passeios de helicóptero, iates, acessos VIP, spas de luxo e experiências exclusivas.

**SELEÇÃO RIGOROSA DE LUGARES:**
- Cite APENAS lugares reais, com nome completo e correto (ex: "Musée d'Orsay", "Mercado Central de São Paulo", "Ramen Ichiran Shibuya").
- Prefira lugares com avaliação 4.4+ no Google Maps / TripAdvisor ou presença em guias reconhecidos.
- Considere a logística: atividades próximas geograficamente no mesmo período, sem deslocamentos desnecessários.
- Nunca repita o mesmo local em dias diferentes.

**MÚLTIPLAS ATIVIDADES POR PERÍODO:**
Cada período (manhã, tarde, noite) deve ser preenchido de forma realista:
- Se uma atividade principal ocupa TODO o período (ex: visita a um parque temático, trilha de 5h, museu grande), use apenas a atividade principal sem extras.
- Se a atividade principal dura menos que o período (ex: visita a uma catedral = 1h, passeio em mercado = 45min), adicione 1 ou 2 atividades complementares próximas no campo "extras_atividades". Elas devem ser diferentes do local principal e logisticamente próximas.
- Exemplos de combinações naturais: catedral + praça adjacente + café local | mercado + bairro histórico | museu menor + galeria próxima + livraria

**ESTRUTURA DO ROTEIRO:**
- Forneça Manhã, Tarde e Noite para cada dia.
- Para o "Dia de Pico" (dia mais intenso), enriqueça o campo "dica" de cada atividade com: custo estimado, por que é imperdível, vibe do lugar e dica de especialista (melhor horário, o que evitar).

**FORMATO:**
Responda SEMPRE em JSON válido, sem nenhum texto fora do JSON. O JSON deve seguir exatamente a estrutura especificada pelo usuário.`

        const userPrompt = `Crie um roteiro de viagem detalhado com as seguintes informações:
- Destino: ${destination}
- Duração: ${duration} dia${duration > 1 ? 's' : ''}
- Perfil do viajante: ${travelerLabel}
- Estilo de viagem: ${styleList}
- Nível de orçamento: ${budgetLabel}

Responda SOMENTE em JSON com exatamente esta estrutura:
{
  "titulo": "string — ex: 'Roteiro em Paris: 5 dias para Casal'",
  "resumo": "string — 2 a 3 frases descrevendo o destino e o que o viajante vai encontrar",
  "dias": [
    {
      "dia": 1,
      "tema": "string — tema ou foco do dia, ex: 'Chegada e Centro Histórico'",
      "manha": {
        "horario": "string — horário sugerido de início, ex: '08:00'",
        "atividade": "string — descrição clara do que fazer na atividade principal",
        "local": "string — nome real e completo do local",
        "dica": "string — dica prática com custo estimado se relevante",
        "lat": number,
        "lng": number,
        "extras_atividades": [
          {
            "horario": "string — ex: '10:30'",
            "atividade": "string — descrição da atividade complementar (apenas se couber no período)",
            "local": "string — nome real do local complementar",
            "dica": "string"
          }
        ]
      },
      "tarde": {
        "horario": "string",
        "atividade": "string",
        "local": "string",
        "dica": "string",
        "lat": number,
        "lng": number,
        "extras_atividades": []
      },
      "noite": {
        "horario": "string",
        "atividade": "string",
        "local": "string",
        "dica": "string",
        "lat": number,
        "lng": number,
        "extras_atividades": []
      }
    }
  ],
  "dicas_gerais": ["string — até 4 dicas práticas para a viagem"],
  "orcamento_estimado": "string — ex: 'R$ 250 a R$ 400 por pessoa por dia (sem hospedagem)'",
  "extras": {
    "gastronomia": [
      { "nome": "string — nome do restaurante ou prato", "descricao": "string — o que é e por que vale", "dica": "string — dica prática", "lat": number, "lng": number }
    ],
    "cultura": [
      { "nome": "string — nome do museu, monumento ou evento cultural", "descricao": "string", "dica": "string", "lat": number, "lng": number }
    ],
    "natureza": [
      { "nome": "string — parque, praia, trilha ou ponto natural", "descricao": "string", "dica": "string", "lat": number, "lng": number }
    ],
    "compras": [
      { "nome": "string — mercado, rua comercial ou shopping", "descricao": "string", "dica": "string", "lat": number, "lng": number }
    ]
  }
}

Regras obrigatórias:
- Gere exatamente ${duration} objetos dentro do array "dias".
- "extras_atividades" deve ser um array. Use array vazio [] quando a atividade principal ocupar todo o período. Adicione 1 a 2 itens quando houver tempo sobrando no período.
- Preencha "lat" e "lng" com coordenadas decimais reais e precisas do local (ex: 48.8584, 2.2945). Nunca use coordenadas genéricas da cidade.
- Para "extras", gere entre 4 e 6 itens por categoria, todos diferentes das atividades do roteiro.
- Todos os nomes de locais devem ser reais, verificáveis e existentes.`

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
                max_tokens: 8000,
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
