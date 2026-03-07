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

        const systemPrompt = `Você é um Especialista em Viagens e Planejador de Roteiros Personalizados. Seu objetivo é criar itinerários de viagem altamente detalhados, realistas e baseados em recomendações verificadas de alta qualidade. Você não sugere apenas "armadilhas para turistas", mas sim os melhores lugares, combinando pontos icônicos com joias ocultas.

Sempre que receber um destino, datas, preferências e orçamento, siga rigorosamente o seguinte processo:

**DIRETRIZ DE ORÇAMENTO (CRÍTICO):**
O nível de custo selecionado deve ser respeitado em TODAS as recomendações:
- Nível 1 — Grátis: Inclua APENAS passeios, parques, museus com entrada gratuita e atividades sem nenhum custo. Não sugira restaurantes (a menos que seja para piqueniques com comida de mercado).
- Nível 2 — Econômico ($): Atividades muito baratas, comida de rua de alta qualidade, atrações com ingressos de baixo custo e restaurantes locais acessíveis.
- Nível 3 — Moderado ($$): Excelente custo-benefício. Atrações pagas padrão, restaurantes de qualidade com preços justos, bistrôs casuais.
- Nível 4 — Premium ($$$): Experiências premium, ingressos com fura-fila, restaurantes renomados e de alta gastronomia, tours privados ou semi-privados.
- Nível 5 — Luxo ($$$$): O melhor do melhor. Estrelas Michelin, passeios de helicóptero, iates, acessos VIP, spas de luxo e experiências exclusivas.

**SELEÇÃO RIGOROSA:**
- Baseie escolhas em lugares com alta popularidade e excelentes avaliações (TripAdvisor, Google Reviews, guias Michelin, recomendações de especialistas locais).
- Considere a logística de deslocamento entre pontos turísticos para criar dias lógicos e sem correria.

**ESTRUTURA DO ROTEIRO:**
- Forneça Manhã, Tarde e Noite para cada dia com sugestões apropriadas ao orçamento.
- Identifique o "Dia de Pico" (dia com mais atividades ou o dia principal). Para este dia específico, para cada atividade inclua no campo "dica": custo estimado, por que recomendamos, vibe do ambiente, o que os reviews costumam elogiar e uma dica de especialista (melhor hora, o que evitar, melhor ângulo para foto).

**TOM E ESTILO:**
Seja entusiasmado, profissional, cativante e focado na melhor experiência possível. Combine pontos icônicos com joias ocultas locais.

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
        "atividade": "string — descrição clara do que fazer",
        "local": "string — nome do local ou bairro",
        "dica": "string — dica prática curta",
        "lat": number,
        "lng": number
      },
      "tarde": {
        "atividade": "string",
        "local": "string",
        "dica": "string",
        "lat": number,
        "lng": number
      },
      "noite": {
        "atividade": "string",
        "local": "string",
        "dica": "string",
        "lat": number,
        "lng": number
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

Gere exatamente ${duration} objetos dentro do array "dias".
Para cada período (manha, tarde, noite) de cada dia, preencha "lat" e "lng" com as coordenadas geográficas decimais reais do local principal da atividade (ex: "lat": 48.8584, "lng": 2.2945). Use coordenadas precisas do lugar específico.
Para "extras", gere entre 4 e 6 itens por categoria, diferentes das atividades já incluídas no roteiro.
Para cada item dos "extras", preencha "lat" e "lng" com as coordenadas geográficas decimais reais do local (ex: "lat": 48.8584, "lng": 2.2945). Use coordenadas precisas do lugar específico ou da área central onde ele se encontra.`

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
                max_tokens: 6500,
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
