# Melhorias IA — Estratégia e Busca Avançada

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar promos de acúmulo ao passo a passo da estratégia, injetar promos de passagens no chat de busca, alertar watchlist quando há promo ativa para o programa monitorado, e mostrar CPM histórico no StrategyPanel.

**Architecture:** Quatro melhorias independentes em três camadas: (1) Edge Function `strategy` recebe promos de acúmulo; (2) Edge Function `chat-busca` recebe promos de passagens; (3) `server.js` enriquece email de watchlist com promos ativas; (4) `StrategyPanel` faz query secundária ao banco de estratégias salvas para benchmark de CPM.

**Tech Stack:** TypeScript (Deno — Edge Functions), React, Node.js (Express — server.js), Supabase JS client, psycopg2 (N/A aqui)

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/functions/strategy/index.ts` | Modificar | Adicionar query + prompt para promos de acúmulo |
| `supabase/functions/chat-busca/index.ts` | Modificar | Adicionar query de promos de passagens por destino |
| `server.js` | Modificar | Enriquecer email de watchlist com promos ativas do programa |
| `src/components/StrategyPanel.tsx` | Modificar | Query histórica de CPM e badge de comparação |

---

## Task 1: Promos de acúmulo no passo a passo da estratégia

**Files:**
- Modify: `supabase/functions/strategy/index.ts`

### Contexto

O `fetchPromos()` já busca promos de `bonus_transferencia`, `clube` e `milhas_compra`. Precisa também buscar `subcategoria = 'acumulo'` — promos como "15 pts/real na Natura" — para que o LLM possa sugerir ao usuário como ganhar milhas rapidamente sem comprar.

A seção de acúmulo vai para o prompt separada, logo após as promos de transferência.

- [ ] **Step 1: Adicionar query de acúmulo em `fetchPromos()`**

Em `supabase/functions/strategy/index.ts`, dentro de `fetchPromos()`, logo após a definição de `q4` (que buscava passagens — já foi removida), adicione antes do `Promise.all`:

```typescript
// Query acúmulo: ganhe pontos em parceiros (sem comprar milhas diretamente)
const q_acumulo = sb.from('promocoes')
    .select(PROMO_SELECT)
    .or(validFilter)
    .eq('subcategoria', 'acumulo')
    .overlaps('programas_tags', fallbackPrograms)
    .order('valid_until', { ascending: true, nullsFirst: false })
    .limit(3)
```

Adicione `q_acumulo` no `Promise.all`:

```typescript
const [{ data: d1 }, { data: d2 }, { data: d3 }, { data: d_acumulo }] = await Promise.all([q1, q2, q3, q_acumulo])
```

- [ ] **Step 2: Incluir promos de acúmulo no promoStr**

Após o bloco de `selected` e `promoStr`, adicionar:

```typescript
// Promos de acúmulo — mostradas separadamente para o LLM usar em cenários de déficit
const acumuloRows = (d_acumulo ?? []) as PromoRow[]
const acumuloStr = acumuloRows.length > 0
    ? '\nPROMOÇÕES DE ACÚMULO ATIVO (ganhe pontos sem comprar):\n' +
      acumuloRows.map((p, i) => {
          const prog = p.programa ?? (p.programas_tags ?? []).filter(t => !['Nubank','Itaú','Livelo','C6','Inter','Santander','Bradesco','Amex'].includes(t))[0] ?? 'Geral'
          const parts = [`${i + 1}. [acúmulo] ${prog} — ${String(p.titulo ?? '').slice(0, 80)}`]
          if (p.valid_until) parts.push(`(expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')})`)
          return parts.join(' ')
      }).join('\n')
    : ''

const promoStr = milhasStr + acumuloStr
```

- [ ] **Step 3: Atualizar instrução do LLM para usar acúmulo no déficit**

No system prompt (bloco de string que começa com `Você é FlyWise, especialista em milhas`), adicione após a regra 11 existente:

```
12. Se há "PROMOÇÕES DE ACÚMULO ATIVO" e o usuário tem déficit de milhas, gere um passo dedicado: qual programa, qual parceiro, quanto gastar para cobrir o déficit. Ex: "Comprando R$ 670 na Natura esta semana você ganha 10.050 pts Livelo — suficiente para cobrir o déficit sem comprar milhas."
```

- [ ] **Step 4: Deploy da Edge Function**

```bash
supabase functions deploy strategy
```

- [ ] **Step 5: Testar**

No app, selecionar um voo Livelo/Smiles e gerar estratégia. Se houver promos de acúmulo no banco com esses programas, o passo a passo deve mencionar a forma de ganhar pontos nos parceiros.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/strategy/index.ts
git commit -m "feat(strategy): include acumulo promos in step-by-step deficit analysis"
```

---

## Task 2: Chat de busca avançada com promos de passagens por destino

**Files:**
- Modify: `supabase/functions/chat-busca/index.ts`

### Contexto

O chat-busca já extrai o destino do usuário (`wizard_data.destination`). Basta fazer uma query leve nas promos de `categoria = 'passagens'` filtrando por `ilike` no título, e injetar no system prompt para o LLM sugerir datas e preços.

O Supabase client já existe na edge function via `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 1: Criar cliente Supabase no topo da edge function**

Em `supabase/functions/chat-busca/index.ts`, logo após os imports, verificar se já existe um `createClient`. Se não existir, adicionar:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const sbAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
)
```

Se já existir um cliente, reutilize-o (não crie duplicata).

- [ ] **Step 2: Criar função `fetchPassagensPromos()`**

Adicionar antes da função `serve()`:

```typescript
async function fetchPassagensPromos(destination: string): Promise<string> {
    try {
        // Extrai cidade/país do destino (ex: "Lisboa" de "LIS" ou "Lisboa, Portugal")
        const keyword = destination.replace(/[A-Z]{3}/, '').trim() || destination

        const { data } = await sbAdmin
            .from('vw_promocoes_ativas')
            .select('titulo, valid_until, fonte, url')
            .eq('categoria', 'passagens')
            .ilike('titulo', `%${keyword}%`)
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(3)

        if (!data || data.length === 0) return ''

        const lines = data.map((p, i) => {
            const expiry = p.valid_until
                ? ` (expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')})`
                : ''
            return `${i + 1}. ${p.titulo}${expiry}`
        })

        return '\n\nPROMOÇÕES DE PASSAGENS ATIVAS PARA ESTE DESTINO:\n' + lines.join('\n') +
            '\n→ Mencione essas promoções na sua resposta e sugira buscar nessas datas se o usuário não tem data fixa.'
    } catch {
        return ''
    }
}
```

- [ ] **Step 3: Injetar promos no system prompt**

No trecho onde o system prompt é montado (busque por `systemPrompt` ou `system_prompt` na função), adicionar a chamada antes de finalizar o prompt:

```typescript
// Busca promos de passagens para o destino (não bloqueia se falhar)
const destination = wizardData?.destination ?? wizardData?.destinations?.[0] ?? ''
const passagensContext = destination ? await fetchPassagensPromos(destination) : ''

// Adicionar passagensContext ao final do system prompt
const fullSystemPrompt = systemPrompt + passagensContext
```

Usar `fullSystemPrompt` em vez de `systemPrompt` na chamada ao LLM.

- [ ] **Step 4: Deploy**

```bash
supabase functions deploy chat-busca
```

- [ ] **Step 5: Testar**

Abrir o chat de busca avançada, digitar destino "Miami" ou "Lisboa". Se houver promos de passagens ativas para esses destinos, o chat deve mencionar os preços e sugerir as datas.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/chat-busca/index.ts
git commit -m "feat(chat-busca): inject active passagens promos for destination into LLM prompt"
```

---

## Task 3: Watchlist — alertar quando há promo ativa para o programa monitorado

**Files:**
- Modify: `server.js` (linhas 706–733, bloco de envio de email da watchlist)

### Contexto

Quando um item de watchlist é triggered (preço abaixo do threshold), o `sendWatchlistEmail()` é chamado. Precisa também checar promos ativas na tabela `promocoes` para o `item.program` e incluir no email se houver.

O Supabase client já está disponível como `supabase` em `server.js`.

- [ ] **Step 1: Criar função `fetchPromosParaPrograma()` em server.js**

Adicionar antes do bloco `// POST /api/watchlist/check`:

```javascript
async function fetchPromosParaPrograma(program) {
    if (!program || !supabase) return []
    try {
        const now = new Date().toISOString()
        const { data } = await supabase
            .from('promocoes')
            .select('titulo, subcategoria, bonus_pct, valid_until, url')
            .or(`valid_until.is.null,valid_until.gt.${now}`)
            .eq('categoria', 'milhas')
            .overlaps('programas_tags', [program])
            .order('valid_until', { ascending: true, nullsFirst: false })
            .limit(3)
        return data ?? []
    } catch {
        return []
    }
}
```

- [ ] **Step 2: Chamar a função antes de enviar o email**

No bloco de envio (linha ~722), substituir:

```javascript
// Send email
const toEmail = emailMap[item.user_id];
if (toEmail) {
    await sendWatchlistEmail({
        toEmail,
        toName: nameMap[item.user_id],
        item,
        triggeredValue,
    });
```

Por:

```javascript
// Busca promos ativas para o programa monitorado
const promosAtivas = item.program ? await fetchPromosParaPrograma(item.program) : []

// Send email
const toEmail = emailMap[item.user_id];
if (toEmail) {
    await sendWatchlistEmail({
        toEmail,
        toName: nameMap[item.user_id],
        item,
        triggeredValue,
        promosAtivas,
    });
```

- [ ] **Step 3: Atualizar `sendWatchlistEmail()` para incluir promos**

Localizar a função `sendWatchlistEmail` em `server.js`. Adicionar o parâmetro `promosAtivas = []` e incluir no corpo do email (HTML):

```javascript
async function sendWatchlistEmail({ toEmail, toName, item, triggeredValue, promosAtivas = [] }) {
    // ... código existente ...
    
    // Adicionar seção de promos se houver (inserir antes do fechamento do body HTML)
    const promosHtml = promosAtivas.length > 0 ? `
        <div style="margin-top:24px;padding:16px;background:#EDE9FE;border-radius:12px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#6D28D9;text-transform:uppercase;">
                ⚡ Promoções ativas para ${item.program}
            </p>
            ${promosAtivas.map(p => `
                <p style="margin:4px 0;font-size:13px;color:#374151;">
                    ${p.subcategoria === 'transferencia' ? '🔄' : p.subcategoria === 'clube' ? '⭐' : '📍'}
                    ${p.titulo}
                    ${p.valid_until ? `<span style="color:#6D28D9;font-size:11px;">(expira ${new Date(p.valid_until).toLocaleDateString('pt-BR')})</span>` : ''}
                </p>
            `).join('')}
        </div>
    ` : ''
    
    // Inserir promosHtml no template HTML antes do fechamento
}
```

- [ ] **Step 4: Testar localmente**

```bash
node -e "
const { fetchPromosParaPrograma } = require('./server.js') // se exportado
// Ou inspecionar manualmente no log do next run
"
```

Como a função não é exportada, verificar no próximo run do watchlist-check ou inspecionar o banco:

```sql
SELECT titulo, subcategoria, bonus_pct, valid_until
FROM promocoes
WHERE categoria = 'milhas'
  AND programas_tags && ARRAY['Smiles']
  AND (valid_until IS NULL OR valid_until > NOW())
LIMIT 3;
```

Resultado esperado: lista de promos ativas para Smiles.

- [ ] **Step 5: Commit e push (deploy via Railway auto)**

```bash
git add server.js
git commit -m "feat(watchlist): include active promos for monitored program in alert email"
git push
```

---

## Task 4: CPM histórico no StrategyPanel

**Files:**
- Modify: `src/components/StrategyPanel.tsx`

### Contexto

Após uma estratégia ser gerada, fazer uma query secundária na tabela `strategies` para buscar CPMs históricos do mesmo programa. O campo `cpm_resgate` fica dentro do JSONB `structured_result`. O Supabase permite filtrar JSONB com `.eq('structured_result->programa_recomendado', programa)` e extrair campos numéricos.

- [ ] **Step 1: Adicionar estado `cpmHistorico`**

Dentro do componente `StrategyPanel`, após os estados existentes:

```typescript
const [cpmHistorico, setCpmHistorico] = useState<{ avg: number; count: number } | null>(null)
```

- [ ] **Step 2: Buscar CPM histórico quando strategy carregar**

Adicionar `useEffect` que roda quando `strategy` muda:

```typescript
useEffect(() => {
    if (!strategy?.programa_recomendado || !user?.id) return
    setCpmHistorico(null)

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    supabase
        .from('strategies')
        .select('structured_result')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo)
        .not('structured_result', 'is', null)
        .limit(20)
        .then(({ data }) => {
            if (!data || data.length === 0) return
            const cpms = data
                .map(r => {
                    const sr = r.structured_result as Record<string, unknown>
                    return typeof sr?.cpm_resgate === 'number' ? sr.cpm_resgate : null
                })
                .filter((v): v is number => v !== null && v > 0)
            if (cpms.length < 2) return  // sem histórico suficiente
            const avg = cpms.reduce((s, v) => s + v, 0) / cpms.length
            setCpmHistorico({ avg: parseFloat(avg.toFixed(2)), count: cpms.length })
        })
}, [strategy?.programa_recomendado, user?.id])
```

- [ ] **Step 3: Renderizar badge de comparação**

Localizar onde o CPM é exibido (buscar por `cpm_resgate.toFixed(2)` no arquivo — aparece duas vezes, para vale_a_pena true e false). Logo após cada badge de CPM, adicionar:

```tsx
{cpmHistorico && strategy.cpm_resgate > 0 && (
    <div style={{
        fontSize: '10.5px', color: '#64748B',
        display: 'flex', alignItems: 'center', gap: 4,
    }}>
        {strategy.cpm_resgate > cpmHistorico.avg
            ? <TrendingUp size={11} color="#16A34A" />
            : <TrendingDown size={11} color="#DC2626" />
        }
        {strategy.cpm_resgate > cpmHistorico.avg
            ? `Acima da sua média (${cpmHistorico.avg.toFixed(2)} c/pt nos últimos 30 dias)`
            : `Abaixo da sua média (${cpmHistorico.avg.toFixed(2)} c/pt nos últimos 30 dias)`
        }
    </div>
)}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
npx tsc --noEmit
```

Resultado esperado: sem erros.

- [ ] **Step 5: Testar no browser**

Gerar duas ou mais estratégias. Na terceira, o badge de histórico deve aparecer abaixo do CPM mostrando "Acima/Abaixo da sua média".

- [ ] **Step 6: Commit**

```bash
git add src/components/StrategyPanel.tsx
git commit -m "feat(strategy): show personal CPM benchmark vs last 30 days"
```

---

## Checklist de cobertura

- [x] Promos `subcategoria=acumulo` chegam ao LLM com instrução de uso no déficit
- [x] Chat-busca injeta promos de passagens filtradas pelo destino do usuário
- [x] Email de watchlist inclui seção de promos ativas para o programa monitorado
- [x] StrategyPanel mostra comparação de CPM com histórico pessoal dos últimos 30 dias
- [x] Nenhuma alteração quebra fluxos existentes (tudo é adição, não substituição)
- [x] Deploy necessário apenas para Tasks 1 e 2 (Edge Functions)
- [x] Task 3 faz deploy automático via Railway ao fazer push
