// Supabase Edge Function: /chat-busca
// Handles AI chat for Busca Avançada IA conversations
// Deploy: supabase functions deploy chat-busca
//
// Env vars required:
//   OPENAI_API_KEY — your OpenAI key

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

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

const CABIN_LABELS: Record<string, string> = {
    economy: 'Econômica',
    premium_economy: 'Premium Economy',
    business: 'Executiva',
    first: 'Primeira Classe',
}

const HACKER_LABELS: Record<string, string> = {
    comfort: 'Conforto (voo direto)',
    value: 'Melhor Custo-Benefício',
    hacker: 'Modo Hacker (2 reservas separadas)',
}

function buildSystemPrompt(w: WizardData): string {
    const dates = w.tripType === 'round-trip' && w.dateReturn
        ? `${w.dateGo} a ${w.dateReturn}`
        : w.dateGo

    return `Você é o FlyWise AI, especialista em milhas aéreas e viagens para brasileiros.

O usuário preencheu um formulário de busca avançada com os seguintes dados:
- Rota: ${w.origin} → ${w.destination}
- Tipo: ${w.tripType === 'round-trip' ? 'Ida e Volta' : 'Só Ida'}
- Datas: ${dates}
- Passageiros: ${w.passengers}
- Classe: ${CABIN_LABELS[w.cabinClass] ?? w.cabinClass}
- Estratégia: ${HACKER_LABELS[w.hackerMode] ?? w.hackerMode}
- Aeroportos flexíveis: ${w.flexibleOrigin ? 'Sim' : 'Não'}
${w.observations ? `- Observações do usuário: ${w.observations}` : ''}

Seu objetivo é ser um consultor especializado em milhas aéreas para essa rota específica.

Na primeira resposta, forneça uma análise completa e estruturada com:
1. **Programas de milhas recomendados** para essa rota (especificamente para brasileiros): quais programas têm a melhor tabela de resgate, quantidade de milhas necessárias, e como acumular.
2. **Tabela de custos estimados** em milhas para a classe solicitada (busque ser específico com valores reais conhecidos).
3. **Melhor momento para resgatar** (sazonalidade, disponibilidade, alertas de disponibilidade).
4. **Dica de transferência de pontos**: de quais cartões/bancos brasileiros transferir (Amex, Itaú, Bradesco, Santander, C6, Nubank, etc.) e bônus de transferência frequentes.
5. **Alerta de promoções**: se há promoções frequentes nessa rota ou período.

Seja direto, prático e use linguagem acessível. Formate a resposta com markdown. Ao final, convide o usuário a fazer perguntas de follow-up.

Para respostas seguintes, responda às perguntas do usuário mantendo o contexto da rota e dados acima. Seja conciso e útil.`
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const { messages, wizard_data }: { messages: Message[]; wizard_data: WizardData } = await req.json()

        const openaiKey = Deno.env.get('OPENAI_API_KEY')
        if (!openaiKey) throw new Error('OPENAI_API_KEY not set')

        const systemPrompt = buildSystemPrompt(wizard_data)

        const openaiMessages = [
            { role: 'system', content: systemPrompt },
            ...messages.map(m => ({ role: m.role, content: m.content })),
        ]

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${openaiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                model: 'gpt-4o-mini',
                messages: openaiMessages,
                temperature: 0.7,
                max_tokens: 1200,
            }),
        })

        if (!response.ok) {
            const err = await response.text()
            throw new Error(`OpenAI error: ${err}`)
        }

        const result = await response.json()
        const reply = result.choices?.[0]?.message?.content ?? 'Não consegui gerar uma resposta. Tente novamente.'

        return new Response(JSON.stringify({ reply }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    } catch (err) {
        return new Response(JSON.stringify({ error: String(err) }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
