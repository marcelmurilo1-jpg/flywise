// Supabase Edge Function: /refresh-extras
// Runtime: Deno (Supabase Functions)
// Deploy: supabase functions deploy refresh-extras

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

        const { data: itinerary, error: fetchErr } = await supabase
            .from('itineraries')
            .select('destination, traveler_type, travel_style, result')
            .eq('id', itinerary_id)
            .single()

        if (fetchErr || !itinerary) {
            return new Response(JSON.stringify({ error: 'Itinerary not found' }), {
                status: 404,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const { destination, traveler_type, travel_style } = itinerary

        const styleList = Array.isArray(travel_style) && travel_style.length > 0
            ? travel_style.join(', ')
            : 'Geral'

        const travelerMap: Record<string, string> = {
            solo: 'Solo (viajante individual)',
            casal: 'Casal',
            familia: 'Família com crianças',
            amigos: 'Grupo de amigos',
        }
        const travelerLabel = travelerMap[traveler_type] ?? traveler_type

        const systemPrompt = `Você é um especialista em turismo e roteiros de viagem.
Sua função é sugerir atrações extras para viajantes.
Responda SEMPRE em JSON válido, sem texto fora do JSON. Seja específico e prático.`

        const userPrompt = `Sugira atrações adicionais para um viajante em ${destination}.
Perfil: ${travelerLabel}. Estilo: ${styleList}.

Gere sugestões DIFERENTES das mais comuns e óbvias. Prefira opções autênticas e locais.

Responda SOMENTE em JSON com exatamente esta estrutura:
{
  "gastronomia": [
    { "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }
  ],
  "cultura": [
    { "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }
  ],
  "natureza": [
    { "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }
  ],
  "compras": [
    { "nome": "string", "descricao": "string", "dica": "string", "lat": number, "lng": number }
  ]
}

Gere entre 4 e 6 itens por categoria. Para cada item, preencha "lat" e "lng" com coordenadas geográficas decimais reais do local.`

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
                max_tokens: 2500,
                temperature: 0.9,
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
        const rawContent = openaiData.choices?.[0]?.message?.content ?? '{}'
        const extras = JSON.parse(rawContent)

        // Merge new extras into existing result
        const existingResult = itinerary.result ?? {}
        const updatedResult = { ...existingResult, extras }

        await supabase
            .from('itineraries')
            .update({ result: updatedResult })
            .eq('id', itinerary_id)

        return new Response(JSON.stringify({ extras }), {
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
