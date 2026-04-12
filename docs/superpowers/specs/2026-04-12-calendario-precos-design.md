# Calendário de Preços — Design

## Objetivo

Colorir as datas do `DateRangePicker` existente com tints sutis (verde / amarelo / vermelho) baseados em padrões históricos de demanda no mercado brasileiro, para que o usuário perceba rapidamente quais períodos tendem a ser mais baratos ou mais caros — sem nenhuma chamada de API adicional.

## Abordagem

**Estático / baseado em regras** — sem API, sem banco de dados. A função `getPriceTint` recebe uma `Date` e retorna `'green' | 'yellow' | 'red'` com base em:

1. **Feriados nacionais brasileiros** (datas fixas + regras para datas móveis como Páscoa, Corpus Christi) → vermelho
2. **Pontes e vésperas de feriado** → vermelho
3. **Férias escolares** (janeiro, julho, recesso de dezembro/janeiro, Carnaval, Semana Santa) → vermelho
4. **Datas comemorativas de alta demanda** (Dia das Mães, Namorados, Natal, Réveillon) → vermelho
5. **Fins de semana** (sábado → amarelo, domingo → vermelho por ser dia de retorno comum)
6. **Sextas-feiras** → vermelho (pico de embarque)
7. **Terças e quartas-feiras** fora de períodos de alta → verde
8. **Demais dias de semana** fora de períodos de alta → verde ou amarelo

A lógica de prioridade: feriado/férias sobrepõe dia da semana.

## Visual

- **Verde** (`#F0FDF4`): fundo levíssimo + ponto `#4ADE80` — tende a ser mais barato
- **Amarelo** (`#FEFCE8`): fundo levíssimo + ponto `#FBBF24` — preço médio
- **Vermelho** (`#FFF1F2`): fundo levíssimo + ponto `#FCA5A5` — alta demanda
- Número da data permanece na cor escura padrão (`#1E293B`) em todos os casos
- Sem borda colorida, sem tooltip
- Legenda fixa embaixo do calendário

## Arquitetura

### Arquivos

- **Criar: `src/lib/priceTint.ts`** — exporta `getPriceTint(date: Date): 'green' | 'yellow' | 'red'` e helpers internos (cálculo de Páscoa, Corpus Christi, verificação de feriado, verificação de férias escolares)
- **Modificar: `src/components/DateRangePicker.tsx`** — importar `getPriceTint`, aplicar classe CSS ao botão de cada dia, adicionar estilos de tint e a legenda

### Interface pública

```ts
export type PriceTint = 'green' | 'yellow' | 'red';
export function getPriceTint(date: Date): PriceTint;
```

### Lógica de tint (prioridade decrescente)

```
1. isHoliday(date) || isSchoolBreak(date) || isHighDemandDate(date) → 'red'
2. isBridgeDay(date) → 'red'
3. dayOfWeek === 5 (sexta) || dayOfWeek === 0 (domingo) → 'red'
4. dayOfWeek === 6 (sábado) → 'yellow'
5. isPreHighSeason(date) → 'yellow'
6. default → 'green'
```

### Feriados fixos cobertos

Ano Novo, Carnaval (seg+ter), Tiradentes, Dia do Trabalho, Corpus Christi, Independência, N. Sra. Aparecida, Finados, Proclamação da República, Natal — mais Páscoa e Sexta Santa calculadas pelo algoritmo de Meeus/Jones/Butcher.

### Férias escolares

- Janeiro completo
- Carnaval (semana)
- Semana Santa
- Julho completo
- Recesso 20/dez–6/jan

## Integração no DateRangePicker

Dentro do loop de renderização de cada `day`, antes de retornar o botão:

```tsx
const tint = !isPast ? getPriceTint(dayDate) : undefined;
```

Classes CSS adicionadas ao botão do dia:
```tsx
className={cn(
  'day-btn',
  tint && `tint-${tint}`,
  isSelected && 'selected',
  isPast && 'past',
)}
```

Estilos de tint adicionados ao CSS existente (Tailwind `@layer components` ou inline style object):
- `.tint-green`: `background: #F0FDF4`
- `.tint-yellow`: `background: #FEFCE8`
- `.tint-red`: `background: #FFF1F2`

Ponto indicador pequeno (4 × 4 px) renderizado abaixo do número quando `tint` existe.

Legenda adicionada abaixo do grid de dias, com três swatches.

## Fora de escopo

- Dados reais de preço por data (requereria scraping para cada data)
- Personalização por rota (mesma lógica para todos os destinos)
- Atualização dinâmica dos padrões
