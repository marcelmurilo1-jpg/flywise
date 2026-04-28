# Design: "Para onde posso voar?"

**Data:** 2026-04-11  
**Status:** Aprovado pelo usuário  
**Escopo:** Feature 1 de 3 (Watchlist e Calendário de preços são specs separados)

---

## Objetivo

Adicionar uma tab **"Para onde posso voar?"** na página Carteira (`/wallet`) que mostre, dado o saldo de milhas do usuário e as promoções de transferência ativas, quais destinos ele consegue voar agora — ou quase consegue — sem precisar buscar rota por rota manualmente.

---

## Fluxo do usuário

1. Usuário configura aeroporto de origem em **Configurações** (uma única vez)
2. Abre **Carteira → Para onde posso voar?**
3. Seleciona filtros: mês, região, cabine, programa
4. Vê resultados progressivos em duas seções:
   - **"Você pode voar agora"** — tem milhas suficientes (diretamente ou via transferência com bônus)
   - **"Quase lá"** — falta ≤ 40% das milhas, com melhor caminho de transferência
5. Clica em **"Ver estratégia"** → abre o painel de estratégia existente

---

## Mudanças por camada

### 1. Configurações (`Configurações.tsx`)

Nova seção **"Aeroporto de origem padrão"**:
- Reutiliza o componente `AirportInput` existente
- Salva em `user_metadata` do Supabase:
  - `home_airport`: código IATA (ex: `"GRU"`)
  - `home_airport_label`: nome exibido (ex: `"Guarulhos, São Paulo"`)
  - `home_airport_lock`: boolean — se `true`, usa sempre o salvo sem mostrar campo de alteração na tab
- Toggle: **"Usar sempre este aeroporto"** (default: `true`)

Se `home_airport_lock = false`, a tab mostra o campo de origem editável.

---

### 2. Tab na Carteira (`Wallet.tsx`)

Adicionar terceira tab às existentes `[Carteira] [Simulador]`:

```
[Carteira]  [Simulador]  [Para onde posso voar?]
```

A tab renderiza o componente `ParaOndeVoo`.

Se o usuário não tem `home_airport` configurado, exibe:
```
Defina seu aeroporto de origem nas Configurações para usar esta feature.
[Ir para Configurações →]
```

---

### 3. Componente `ParaOndeVoo.tsx`

**Barra de filtros:**
```
De: [GRU — Guarulhos]  (editável se home_airport_lock = false)

Quando?   [Jan][Fev][Mar][Abr][Mai][Jun][Jul][Ago][Set][Out][Nov][Dez]
Para onde? [Nordeste][Sul/Sudeste][Norte/CO][Amér. do Sul][Amér. do Norte]
           [Caribe][Europa][Or. Médio][Ásia/Oceania][África]
Cabine:   [Economy] [Business]
Programa: [Todos][Smiles][LATAM Pass][TudoAzul][Outros]
```

**Comportamento:**
- Ao selecionar filtros, dispara `POST /api/discover-routes`
- Resultados chegam progressivamente (streaming por região)
- Exibe skeleton cards enquanto carrega

**Seção "Você pode voar agora":**
```
┌────────────────────────────────────────────┐
│ 🌴 Fortaleza — FOR                         │
│ Smiles · Economy · Direto                  │
│                                            │
│ Necessário: 18.000 milhas                  │
│ ✅ Você tem 22.000 Smiles direto           │
│                         [Ver estratégia →] │
└────────────────────────────────────────────┘

┌────────────────────────────────────────────┐
│ 🗼 Lisboa — LIS                            │
│ Smiles · Business                          │
│                                            │
│ Necessário: 85.000 milhas                  │
│ 💡 Via Nubank (bônus 100%):               │
│    Transfira 42.500 pts → 85.000 Smiles   │
│    Você tem 50.000 pts Nubank ✅           │
│                         [Ver estratégia →] │
└────────────────────────────────────────────┘
```

**Seção "Quase lá":**
```
┌────────────────────────────────────────────┐
│ 🗽 Nova York — JFK                         │
│ LATAM Pass · Business                      │
│                                            │
│ Necessário: 70.000 milhas                  │
│ Você tem: 40.000 LATAM Pass               │
│                                            │
│ 💡 Com Itaú (bônus 50%):                  │
│    Transfira 20.000 pts → 30.000 LATAM    │
│    Total com transferência: 70.000 ✅      │
│    Faltam apenas 10.000 pts Itaú           │
│                                            │
│ [Ver promoções →]       [Ver estratégia →] │
└────────────────────────────────────────────┘
```

---

### 4. Lista de destinos curados (~150 destinos)

Definida em `src/lib/discoverDestinations.ts`. Cada entrada:
```ts
{ iata: string, name: string, region: Region, emoji: string }
```

| Região | Destinos |
|--------|---------|
| Nordeste | SSA, REC, FOR, NAT, MCZ, JPA, AJU, SLZ, THE, IMP, STM, MCP |
| Sul/Sudeste | GRU, GIG, SDU, CNF, VCP, VIX, POA, CWB, FLN, IGU, LDB, MGF, JOI, NVT, UDI, RAO |
| Norte/Centro-Oeste | BSB, GYN, MAN, BEL, CGB, CGR, PMW, PVH, RBR, BVB, CZS, MAB |
| América do Sul | EZE, SCL, LIM, BOG, MDE, CTG, CLO, UIO, GYE, MVD, ASU, CCS, LPB, VVI, CBB |
| América do Norte | MIA, JFK, LAX, MCO, ORD, IAH, ATL, BOS, SFO, LAS, DFW, DEN, SEA, PHX, EWR, DTW, MSP, CUN, MEX, GDL, MTY, YYZ, YVR, YUL |
| Caribe | PUJ, HAV, NAS, SJU, AUA, CUR, BGI, MBJ, KIN, GCM, CZM, STT, BDA |
| Europa | LIS, MAD, CDG, FCO, LHR, FRA, AMS, BCN, ZRH, MUC, VIE, DUB, CPH, ARN, OSL, HEL, WAW, BUD, PRG, MXP, NCE, ATH, IST, BER, BRU, GVA, EDI, LYS, OTP, BEG, KEF, MLA, TLL, RIX, VNO, LJU, BTS, LUX, TIA |
| Oriente Médio | DXB, DOH, AUH, RUH, AMM, BEY, CAI, TLV, MCT, KWI |
| Ásia/Oceania | NRT, HND, KIX, ICN, SIN, BKK, HKG, PEK, PVG, TPE, KUL, MNL, DEL, BOM, SYD, MEL, AKL, CGK, DPS, HAN, SGN, CMB, PNH, KTM, PER, BNE |
| África | JNB, CPT, ADD, NBO, LOS, ABV, CMN, DKR, ACC, MPM, LAD, TUN, ALG, DAR, LUN |

---

### 5. Amostragem de datas

Para um mês selecionado, busca **3 datas fixas**:
- Dia **5** do mês
- Dia **15** do mês
- Dia **25** do mês

Usa o **menor valor em milhas** entre as 3 datas como preço de referência para o card.

---

### 6. Lógica de classificação

```
Para cada destino filtrado:
  Chama Seats.aero (origin → destination, 3 datas)
  milhas_min = min(economy ou business conforme filtro)

  // 1. Direto
  if wallet[programa] >= milhas_min:
    → "Pode voar agora" (direto)

  // 2. Via transferência com promoção ativa
  para cada cartão em user.activeCards:
    para cada promoção cartão→programa:
      ratio_efetivo = ratio_base × (1 + bonus_pct / 100)
      pontos_necessários = milhas_min / ratio_efetivo
      if wallet[cartão] >= pontos_necessários:
        → "Pode voar agora" (via transferência)

  // 3. Quase lá — deficit ≤ 40%
  melhor_path = menor pontos_necessários entre todas as promoções
  if (pontos_necessários - wallet[cartão]) / pontos_necessários ≤ 0.40:
    → "Quase lá" com melhor path

  // 4. Muito longe → oculto
```

**Exemplo do usuário:**
- Rota: 20.000 milhas Smiles
- Promoção ativa: Nubank → Smiles 100% de bônus
- `ratio_efetivo = 1.0 × (1 + 1.00) = 2.0`
- `pontos_necessários = 20.000 / 2.0 = 10.000 pts Nubank`
- Usuário tem 12.000 pts Nubank → **"Pode voar agora" via transferência** ✅

---

### 7. Backend: `POST /api/discover-routes`

**Request:**
```json
{
  "origin": "GRU",
  "destinations": ["SSA", "REC", "FOR"],
  "months": ["2026-10"],
  "cabin": "economy",
  "programs": ["smiles", "latam", "tudoazul"]
}
```

**Implementação:**
- Filtra destinos pela lista curada + região/programa selecionados
- Para cada destino: chama `fetchSeatsAeroAPI` para as 3 datas amostradas
- Usa `pLimit(3)` — 3 chamadas paralelas (já importado no server.js)
- Reutiliza a tabela `seatsaero_searches` com TTL estendido para **4 horas** neste contexto
- Retorna array de resultados conforme chegam (ou aguarda tudo e responde em batch)

**Response:**
```json
[
  {
    "destination": "SSA",
    "destinationName": "Salvador",
    "economy_miles": 18000,
    "business_miles": 45000,
    "source": "smiles",
    "isDirect": true,
    "sampleDate": "2026-10-05"
  }
]
```

A lógica de classificação (direto / transferência / quase lá) roda no **frontend** com os dados da carteira e promoções — evita enviar dados sensíveis pro servidor e mantém o cálculo instantâneo.

---

### 8. Acesso por plano

| Plano | Acesso |
|-------|--------|
| Free | Vê até 5 destinos (teaser — "Desbloqueie mais com o plano Essencial") |
| Essencial | Acesso completo |
| Pro / Elite | Acesso completo |

---

## Arquivos a criar/modificar

| Arquivo | Tipo |
|---------|------|
| `src/lib/discoverDestinations.ts` | Novo — lista de destinos |
| `src/pages/ParaOndeVoo.tsx` | Novo — componente principal da tab |
| `src/pages/Wallet.tsx` | Modificar — adicionar 3ª tab |
| `src/pages/Configuracoes.tsx` | Modificar — adicionar campo home airport |
| `server.js` | Modificar — novo endpoint `/api/discover-routes` |

---

## Fora do escopo deste spec

- Watchlist de rotas + alertas (spec separado)
- Calendário de preços flexível (spec separado)
- Integração com preço em dinheiro (decisão: não implementar)
