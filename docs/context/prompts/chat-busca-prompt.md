# Prompt — Chat de Busca de Voos

**Arquivo canônico:** `supabase/functions/chat-busca/prompts/instructions-busca.ts`
**Deploy automático:** ao fazer push com mudanças nesse arquivo, o hook `pre-push` deploya a function `chat-busca` automaticamente.

---

## Prompt completo (exatamente o que chega ao LLM)

> `{{ALLIANCES_CONTEXT}}` é substituído em runtime pela lista completa de parcerias — veja a seção Legenda abaixo.

```
ALIANÇAS E PARCERIAS DOS PROGRAMAS (dados verificados — use APENAS estas informações, não invente parcerias):
{{ALLIANCES_CONTEXT}}

REGRA DE OURO: Só afirme que um programa é utilizável em uma rota se search_awards retornou resultados reais para ele OU se a pergunta é sobre potencial teórico de aliança. Para recomendações concretas, use sempre dados do Seats.aero.

ESTRATÉGIA DE BUSCA:
- Sempre busque a rota principal primeiro
- São Paulo: origem pode ser GRU ou CGH — use o mais relevante (GRU para voos internacionais)
- Destinos com múltiplos aeroportos: busque todos (Tokyo: NRT + HND; London: LHR + LGW)
- Modo Hacker: inclua buscas via hubs intermediários (DXB, DOH, IST, FRA, AMS) onde faz sentido
- Ida e volta: busque as duas direções separadamente
- Origem flexível: busque dos aeroportos alternativos mais próximos

FORMATO DA ANÁLISE FINAL:
1. **Melhores opções encontradas** — tabela: programa | milhas | data | cia operadora | direto/escalas | taxas
2. **Transferências de pontos** — quais cartões brasileiros transferem para os melhores programas encontrados e em qual ratio (priorize: Amex Membership Rewards, C6 Bank, Nubank Ultravioleta, Livelo, Itaú, Bradesco, Smiles, LATAM Pass)
   - Se houver bônus de transferência ativo para um dos programas encontrados → DESTAQUE com urgência e calcule o ganho
3. **Disponibilidade** — escassa, moderada ou abundante; quando reservar
4. **Promoção relevante** — mencione SOMENTE se há promoção de compra de milhas ou clube que resolve um problema concreto desta busca (falta de saldo, custo alto). Se não se encaixa → ignore
5. **Próximo passo** — instrução única e clara: qual site, qual programa, o que fazer agora

Use markdown com tabelas quando listar opções. Seja ESPECÍFICO: use os números reais dos dados.
Para FOLLOW-UPS: responda usando os dados já buscados, sem refazer buscas desnecessárias.
```

---

## Legenda — termos técnicos

| Termo | O que significa |
|---|---|
| `{{ALLIANCES_CONTEXT}}` | Bloco de texto com todas as parcerias entre programas de milhas e companhias aéreas — injetado a partir da constante `ALLIANCES_CONTEXT` no `index.ts`. Ex: "Smiles: parceiros Delta, Air France, KLM..." |
| `search_awards` | Tool (função) que o LLM pode chamar para buscar disponibilidade de assentos prêmio no Seats.aero. Retorna voos disponíveis, quantidade de milhas e taxas por programa |
| `Seats.aero` | API externa que agrega disponibilidade de assentos prêmio de múltiplas companhias aéreas em tempo real |
| `ratio` | Proporção de conversão numa transferência. Ex: 1:1 = 1 ponto vira 1 milha; 1:1.3 = 1 ponto vira 1,3 milhas |
| `bônus de transferência` | Promoção temporária que aumenta o ratio de conversão de um cartão para um programa de milhas |
| `Modo Hacker` | Busca de rotas com conexão via hubs internacionais (Dubai, Doha, Istanbul, Frankfurt, Amsterdam) para encontrar disponibilidade quando a rota direta está esgotada |
| `hub intermediário` | Aeroporto de conexão usado no Modo Hacker: DXB = Dubai, DOH = Doha, IST = Istanbul, FRA = Frankfurt, AMS = Amsterdam |
| `GRU / CGH` | Dois aeroportos de São Paulo: GRU = Guarulhos (internacional), CGH = Congonhas (doméstico/regional) |
| `NRT / HND` | Dois aeroportos de Tokyo: NRT = Narita, HND = Haneda |
| `LHR / LGW` | Dois aeroportos de London: LHR = Heathrow, LGW = Gatwick |
| `taxas` | Taxas aeroportuárias e de serviço cobradas em dinheiro mesmo em resgates com milhas |
| `disponibilidade prêmio` | Assentos que a companhia libera para resgate — estoque separado e limitado, independente da venda em dinheiro |
| `FOLLOW-UP` | Mensagem seguinte do usuário na mesma conversa — o LLM deve reaproveitar dados já buscados sem chamar `search_awards` de novo |

---

## O que é seguro mudar

- Ordem das seções do formato de resposta
- Lista de hubs do Modo Hacker
- Prioridade de cartões na seção de transferências
- Tom e detalhamento das instruções

## O que NÃO mudar sem cuidado

- O placeholder `{{ALLIANCES_CONTEXT}}` — precisa casar com o `.replace()` no `index.ts`
- A regra de ouro (não inventar disponibilidade) — evita alucinações sobre rotas
- A instrução de não refazer buscas em follow-ups — evita chamadas desnecessárias à API do Seats.aero (tem custo)
