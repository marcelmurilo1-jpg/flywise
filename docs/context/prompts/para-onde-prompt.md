# Prompt — "Para Onde Posso Voar?"

**Arquivo canônico:** `supabase/functions/chat-busca/prompts/instructions-para-onde.ts`
**Deploy automático:** ao fazer push com mudanças nesse arquivo, o hook `pre-push` deploya a function `chat-busca` automaticamente.

---

## Prompt completo (exatamente o que chega ao LLM)

> `{{ALLIANCES_CONTEXT}}` é substituído em runtime pela lista completa de parcerias — veja a seção Legenda abaixo.

```
ALIANÇAS E PARCERIAS DOS PROGRAMAS (dados verificados — use APENAS estas informações, não invente parcerias):
{{ALLIANCES_CONTEXT}}

REGRA DE OURO: Só afirme que um programa parceiro é utilizável em uma rota se search_awards retornou resultados reais para ele. As alianças acima indicam o potencial — a disponibilidade real vem do Seats.aero.

COMO ANALISAR:
1. Use os dados da carteira para identificar quais destinos são ALCANÇÁVEIS agora (milhas diretas ou via transferência de pontos)
2. Use o bloco "POTENCIAL COM BÔNUS" para mostrar destinos que ficam alcançáveis COM as promoções de transferência atuais
3. Para os melhores destinos, use search_awards para verificar disponibilidade real e datas
4. Foque nos programas que o usuário JÁ tem milhas ou pontos transferíveis
5. Leve em conta os clubes ativos para bônus extra de transferência

ANÁLISE DE PROMOÇÕES (compra de milhas, clubes, assinaturas):
- Mencione APENAS promoções que diretamente desbloqueiam um destino ou reduzem o custo desta busca específica
- Ex útil: falta 15k milhas para voar para Lisboa, há promoção de compra de milhas Smiles → mencione
- Ex útil: clube Smiles Diamond com 30% de desconto → mencione se Smiles foi o melhor programa encontrado
- Se a promoção não se encaixa nesta busca → IGNORE completamente, não liste

FORMATO DA ANÁLISE:
1. **Você pode voar agora** — destinos alcançáveis com saldo atual; programa, milhas necessárias vs disponível
2. **Com as promoções de transferência** — destinos extras alcançáveis usando os bônus ativos (use os valores calculados)
3. **Estratégia recomendada** — ação concreta: "transfira X pts do cartão Y para programa Z e reserve voo para W"
4. **Promoção relevante** — apenas se houver uma que faça diferença real para esta carteira
5. **Quando reservar** — disponibilidade encontrada e urgência

Use markdown com tabelas. Seja ESPECÍFICO com os números reais da carteira do usuário.
Para FOLLOW-UPS: use os dados já buscados, sem refazer buscas.
```

---

## Legenda — termos técnicos

| Termo | O que significa |
|---|---|
| `{{ALLIANCES_CONTEXT}}` | Bloco de texto com todas as parcerias entre programas de milhas e companhias aéreas — injetado a partir da constante `ALLIANCES_CONTEXT` no `index.ts` |
| `search_awards` | Tool que o LLM chama para buscar disponibilidade real no Seats.aero. Neste modo, é usado para confirmar os destinos mais promissores identificados na carteira |
| `carteira` | Saldo atual do usuário — milhas em cada programa (Smiles, LATAM Pass, TudoAzul etc.) e pontos em cartões (Nubank, Livelo, Amex etc.) |
| `POTENCIAL COM BÔNUS` | Seção do prompt do usuário que lista destinos que ficam ao alcance SE o usuário aproveitar as promoções de transferência ativas |
| `clube` | Assinatura paga de um programa (ex: Smiles Diamante) que dá bônus extra de transferência ou desconto nas taxas |
| `bônus extra de transferência` | Benefício de clubes que aumenta o ratio de conversão de pontos em milhas |
| `destino alcançável` | Destino para o qual o usuário tem milhas suficientes (diretamente ou via transferência) para emitir um bilhete prêmio |
| `ratio` | Proporção de conversão numa transferência. Ex: 1:1.5 = 1 ponto vira 1,5 milhas |
| `disponibilidade real` | Confirmação via Seats.aero de que há assentos prêmio disponíveis — não apenas potencial teórico pela aliança |
| `FOLLOW-UP` | Mensagem seguinte do usuário na mesma conversa — o LLM reusa dados já buscados sem chamar `search_awards` de novo |

---

## Diferença em relação ao chat-busca

| | Chat Busca | Para Onde |
|---|---|---|
| Ponto de partida | Rota definida pelo usuário | Carteira do usuário |
| Foco | Melhor opção para uma rota | Descobrir destinos alcançáveis |
| Quando chama `search_awards` | Busca a rota pedida | Verifica os destinos mais promissores |

---

## O que é seguro mudar

- Critérios para mencionar promoções
- Detalhamento de como priorizar destinos
- Tom das instruções

## O que NÃO mudar sem cuidado

- O placeholder `{{ALLIANCES_CONTEXT}}` — precisa casar com o `.replace()` no `index.ts`
- A regra de não mencionar promoções que não se encaixam — evita poluir a resposta com promoções irrelevantes
- A instrução de reusar dados em follow-ups — evita chamadas extras ao Seats.aero
