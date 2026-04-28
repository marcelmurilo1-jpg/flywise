# Fase 2 — Filtros de Promoções + Badge no StrategyPanel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtros por categoria (Milhas/Passagens) e por programa (Smiles, LATAM Pass…) na tela de promoções, e mostrar um badge de promoção ativa no StrategyPanel antes do usuário gerar a estratégia.

**Architecture:** Três mudanças independentes que compartilham o mesmo tipo base. (1) `supabase.ts` recebe os campos novos no tipo `Promocao` — isso desbloqueia os outros dois. (2) `PromotionsSection` ganha filtros client-side: busca até 100 promos e filtra por `categoria` e `programas_tags` no estado local. (3) `StrategyPanel` faz uma query separada e leve (5 registros) ao abrir, mostrando badges das promos do programa do voo selecionado.

**Tech Stack:** React, TypeScript, Supabase JS client, Lucide icons, Framer Motion (já presentes)

---

## File Map

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `src/lib/supabase.ts` | Modificar linha 61–69 | Adicionar campos novos ao tipo `Promocao` |
| `src/components/PromotionsSection.tsx` | Modificar | Filtros por categoria e programa; busca 100 promos |
| `src/components/StrategyPanel.tsx` | Modificar | Badge de promo ativa para o programa do voo |

---

## Task 1: Atualizar tipo `Promocao` em supabase.ts

**Files:**
- Modify: `src/lib/supabase.ts:61-69`

- [ ] **Step 1: Substituir a interface `Promocao`**

Localizar (linha ~61) e substituir o bloco inteiro:

```typescript
export interface Promocao {
    id: number
    titulo?: string
    url?: string
    valid_until?: string
    conteudo?: string
    imagens?: unknown
    created_at?: string
}
```

Por:

```typescript
export interface Promocao {
    id: number
    titulo?: string
    url?: string
    valid_until?: string
    conteudo?: string
    imagens?: unknown
    created_at?: string
    // Campos do scraper
    categoria?: 'milhas' | 'passagens' | null
    subcategoria?: 'transferencia' | 'clube' | null
    programas_tags?: string[] | null
    bonus_pct?: number | null
    preco_clube?: number | null
    fonte?: string | null
}
```

- [ ] **Step 2: Verificar que o TypeScript compila sem erros**

```bash
npx tsc --noEmit
```

Resultado esperado: nenhum erro.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat(types): add scraper fields to Promocao interface"
```

---

## Task 2: Filtro por categoria no PromotionsSection

**Files:**
- Modify: `src/components/PromotionsSection.tsx`

### Contexto

A query atual busca `limit` promos. Para filtrar client-side com resultado útil, precisamos buscar mais (100). O `landingMode` continua com `limit` original — só o dashboard mode ganha filtros.

- [ ] **Step 1: Ampliar a query para 100 promos no dashboard mode**

Localizar o `useEffect` (linha ~291) e substituir:

```typescript
useEffect(() => {
    const load = async () => {
        try {
            const fetchLimit = landingMode ? limit : 100
            const { data, error } = await supabase
                .from('vw_promocoes_ativas')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(fetchLimit)
            if (error) throw error
            setPromos(data ?? [])
        } catch { setError('Não foi possível carregar.') }
        finally { setLoading(false) }
    }
    load()
}, [limit, landingMode])
```

- [ ] **Step 2: Adicionar estado `activeCategory` e os chips de filtro**

Logo após os estados existentes (linha ~288), adicionar:

```typescript
const [activeCategory, setActiveCategory] = useState<'all' | 'milhas' | 'passagens'>('all')
const [activeProgram, setActiveProgram] = useState<string | null>(null)
```

- [ ] **Step 3: Derivar programas disponíveis nas promos carregadas**

Antes do bloco `groupedPromos` (linha ~310), adicionar:

```typescript
// Programas únicos presentes nas promos carregadas (para chips de filtro)
const availablePrograms = Array.from(
    new Set(promos.flatMap(p => p.programas_tags ?? []))
).sort()

// Filtro combinado: categoria + programa + tab existente
const filteredPromos = promos.filter(p => {
    if (activeTab === 'today' && !(p.valid_until && isToday(parseISO(p.valid_until)))) return false
    if (activeCategory === 'milhas' && p.categoria !== 'milhas') return false
    if (activeCategory === 'passagens' && p.categoria !== 'passagens') return false
    if (activeProgram && !(p.programas_tags ?? []).includes(activeProgram)) return false
    return true
})
```

- [ ] **Step 4: Substituir todas as referências a `displayPromos` por `filteredPromos`**

No componente, `displayPromos` é usado em:
- `todayPromos` (linha ~306) — manter baseado em `promos`, não em `displayPromos`
- `groupedPromos` — trocar para `filteredPromos`
- render final — trocar para `filteredPromos`

Fazer as substituições:

```typescript
// linha ~306 — manter baseado em promos (total, não filtrado)
const todayPromos = promos.filter(p => p.valid_until && isToday(parseISO(p.valid_until)))

// groupedPromos — trocar displayPromos → filteredPromos
const groupedPromos = (() => {
    if (landingMode || filteredPromos.length === 0) return []
    // ... resto igual mas usando filteredPromos
    for (const p of filteredPromos) {
```

No JSX final, trocar `displayPromos` → `filteredPromos` nas duas ocorrências do `landingMode` render e do `groupedPromos` render.

- [ ] **Step 5: Renderizar os chips de categoria e programa**

Substituir o bloco de tabs (linha ~370) para incluir os filtros abaixo dos tabs existentes:

```tsx
{/* Tabs de prazo (Todas / Acaba hoje) — inalteradas */}
{!landingMode && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
        {/* Linha 1: tabs existentes */}
        <div style={{ display: 'flex', gap: '8px' }}>
            {[
                { key: 'all', label: `Todas (${promos.length})`, icon: <Tag size={13} /> },
                { key: 'today', label: `Acaba hoje${todayPromos.length > 0 ? ` (${todayPromos.length})` : ''}`, icon: <Flame size={13} /> },
            ].map(tab => {
                const isActive = activeTab === tab.key
                const isTodayTab = tab.key === 'today'
                return (
                    <button key={tab.key} onClick={() => setActiveTab(tab.key as 'all' | 'today')}
                        style={{
                            display: 'inline-flex', alignItems: 'center', gap: '6px',
                            padding: '8px 18px', borderRadius: '10px', cursor: 'pointer',
                            fontFamily: 'inherit', fontWeight: 600, fontSize: '13px',
                            transition: 'all 0.18s',
                            background: isActive ? (isTodayTab ? 'rgba(220,38,38,0.10)' : 'rgba(74,144,226,0.12)') : 'rgba(255,255,255,0.04)',
                            color: isActive ? (isTodayTab ? '#F87171' : '#4a90e2') : '#475569',
                            border: isActive
                                ? (isTodayTab ? '1.5px solid rgba(220,38,38,0.25)' : '1.5px solid rgba(74,144,226,0.25)')
                                : '1.5px solid transparent',
                        }}
                    >
                        {tab.icon}{tab.label}
                    </button>
                )
            })}
        </div>

        {/* Linha 2: filtros de categoria */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {(['all', 'milhas', 'passagens'] as const).map(cat => {
                const label = cat === 'all' ? 'Todas as categorias' : cat === 'milhas' ? '✦ Milhas' : '✈ Passagens'
                const isActive = activeCategory === cat
                return (
                    <button key={cat} onClick={() => { setActiveCategory(cat); setActiveProgram(null) }}
                        style={{
                            padding: '5px 14px', borderRadius: '999px', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '12px', fontWeight: 600,
                            background: isActive ? '#0E2A55' : 'transparent',
                            color: isActive ? '#fff' : '#64748B',
                            border: isActive ? '1.5px solid #0E2A55' : '1.5px solid #E2EAF5',
                            transition: 'all 0.15s',
                        }}
                    >
                        {label}
                    </button>
                )
            })}
        </div>

        {/* Linha 3: chips de programa (só quando milhas selecionado e há programas) */}
        {activeCategory === 'milhas' && availablePrograms.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setActiveProgram(null)}
                    style={{
                        padding: '4px 12px', borderRadius: '999px', cursor: 'pointer',
                        fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600,
                        background: activeProgram === null ? '#2A60C2' : 'transparent',
                        color: activeProgram === null ? '#fff' : '#64748B',
                        border: activeProgram === null ? '1.5px solid #2A60C2' : '1.5px solid #E2EAF5',
                        transition: 'all 0.15s',
                    }}
                >
                    Todos
                </button>
                {availablePrograms.map(prog => (
                    <button key={prog} onClick={() => setActiveProgram(prog)}
                        style={{
                            padding: '4px 12px', borderRadius: '999px', cursor: 'pointer',
                            fontFamily: 'inherit', fontSize: '11.5px', fontWeight: 600,
                            background: activeProgram === prog ? '#2A60C2' : 'transparent',
                            color: activeProgram === prog ? '#fff' : '#64748B',
                            border: activeProgram === prog ? '1.5px solid #2A60C2' : '1.5px solid #E2EAF5',
                            transition: 'all 0.15s',
                        }}
                    >
                        {prog}
                    </button>
                ))}
            </div>
        )}
    </div>
)}
```

- [ ] **Step 6: Verificar TypeScript e testar no browser**

```bash
npx tsc --noEmit
```

No browser: abrir `/promocoes`, selecionar "Milhas" → chips de programa aparecem. Selecionar "Smiles" → só promos Smiles. Selecionar "Passagens" → promos de passagens. Sem erros de console.

- [ ] **Step 7: Commit**

```bash
git add src/components/PromotionsSection.tsx
git commit -m "feat(promocoes): add category and program filter chips"
```

---

## Task 3: Badges de tipo na PromoCard e PromoModal

**Files:**
- Modify: `src/components/PromotionsSection.tsx`

### Contexto

Os cards não mostram nenhuma indicação de categoria/programa. Adicionar um badge discreto com o tipo e o primeiro programa da promo.

- [ ] **Step 1: Adicionar badge de programa/tipo ao PromoCard**

No componente `PromoCard`, dentro do `<div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>` (logo abaixo do ícone), adicionar:

```tsx
{/* Badges de programa */}
<div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flex: 1 }}>
    {promo.subcategoria === 'clube' && (
        <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '999px', background: '#FEF3C7', color: '#B45309',
        }}>
            Clube
        </span>
    )}
    {promo.subcategoria === 'transferencia' && (
        <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '999px', background: '#EDE9FE', color: '#6D28D9',
        }}>
            Transferência
        </span>
    )}
    {promo.categoria === 'passagens' && (
        <span style={{
            fontSize: '10px', fontWeight: 700, padding: '2px 7px',
            borderRadius: '999px', background: '#E0F2FE', color: '#0369A1',
        }}>
            Passagem
        </span>
    )}
    {(promo.programas_tags ?? []).slice(0, 2).map(tag => (
        <span key={tag} style={{
            fontSize: '10px', fontWeight: 600, padding: '2px 7px',
            borderRadius: '999px',
            background: dark ? 'rgba(74,144,226,0.15)' : '#EEF2F8',
            color: dark ? '#93C5FD' : '#2A60C2',
        }}>
            {tag}
        </span>
    ))}
</div>
```

- [ ] **Step 2: Adicionar badge de club price na PromoModal**

Na `PromoModal`, dentro do bloco de metadados (logo após o `expiresText` span), adicionar:

```tsx
{promo.preco_clube && (
    <span style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        fontSize: '12px', fontWeight: 600, color: '#B45309',
        background: '#FEF3C7', padding: '3px 10px', borderRadius: '999px',
    }}>
        Clube · R$ {promo.preco_clube.toFixed(2)}/mês
        {promo.bonus_pct ? ` · ${promo.bonus_pct}% OFF compra` : ''}
    </span>
)}
```

- [ ] **Step 3: Verificar no browser**

Abrir uma promo de clube → badge amarelo "Clube · R$ 34,90/mês · 20% OFF compra" visível na modal. Cards de transferência → badge roxo "Transferência". Cards de Smiles → badge azul "Smiles".

- [ ] **Step 4: Commit**

```bash
git add src/components/PromotionsSection.tsx
git commit -m "feat(promocoes): add category/program badges to cards and modal"
```

---

## Task 4: Badge de promoção ativa no StrategyPanel

**Files:**
- Modify: `src/components/StrategyPanel.tsx`

### Contexto

Quando o painel abre, fazer uma query leve (`limit 3`) buscando promos ativas para o programa do voo. Mostrar um banner compacto antes do botão "Gerar estratégia" para incentivar o uso das promos.

O programa vem de `seatsContext.program` (ex: "Smiles") ou é inferido pelo código IATA do voo.

- [ ] **Step 1: Adicionar imports e estado para as promos ativas**

No topo do arquivo (logo após os imports existentes), adicionar o import do supabase se ainda não estiver:

```typescript
import type { Promocao } from '@/lib/supabase'
```

Dentro do componente `StrategyPanel`, após os estados existentes (linha ~40), adicionar:

```typescript
const [activePromos, setActivePromos] = useState<Promocao[]>([])
```

- [ ] **Step 2: Fazer fetch das promos ao abrir o painel**

Adicionar `useEffect` após os estados:

```typescript
useEffect(() => {
    if (!open) return
    const program = seatsContext?.program ?? null
    if (!program) return

    supabase
        .from('vw_promocoes_ativas')
        .select('id, titulo, subcategoria, bonus_pct, preco_clube, programas_tags, valid_until, fonte')
        .overlaps('programas_tags', [program])
        .order('valid_until', { ascending: true, nullsFirst: false })
        .limit(3)
        .then(({ data }) => setActivePromos(data ?? []))
}, [open, seatsContext?.program])
```

- [ ] **Step 3: Renderizar o banner de promos antes do botão "Gerar estratégia"**

Dentro do bloco `{!strategy && !loading && !llmError && (` (linha ~166), logo após o bloco de "Comparação de custo" e antes do ícone Sparkles, adicionar:

```tsx
{/* Banner de promoções ativas para o programa */}
{activePromos.length > 0 && (
    <div style={{
        width: '100%',
        background: 'linear-gradient(135deg, #EDE9FE, #F5F3FF)',
        border: '1px solid #C4B5FD',
        borderRadius: 12,
        padding: '12px 16px',
        textAlign: 'left',
    }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6D28D9', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            ⚡ Promoções ativas para {seatsContext?.program}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {activePromos.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <span style={{
                        flexShrink: 0, fontSize: '10px', fontWeight: 700,
                        padding: '2px 7px', borderRadius: '999px',
                        background: p.subcategoria === 'clube' ? '#FEF3C7' : '#EDE9FE',
                        color: p.subcategoria === 'clube' ? '#B45309' : '#6D28D9',
                    }}>
                        {p.subcategoria === 'clube' ? 'Clube' : p.subcategoria === 'transferencia' ? 'Transferência' : 'Promo'}
                    </span>
                    <span style={{ fontSize: '12px', color: '#374151', lineHeight: 1.4 }}>
                        {(p.titulo ?? '').slice(0, 80)}{(p.titulo ?? '').length > 80 ? '…' : ''}
                        {p.bonus_pct ? <strong style={{ color: '#6D28D9' }}> +{p.bonus_pct}%</strong> : null}
                        {p.preco_clube ? <span style={{ color: '#B45309' }}> · R$ {p.preco_clube.toFixed(2)}/mês</span> : null}
                    </span>
                </div>
            ))}
        </div>
        <div style={{ fontSize: '10.5px', color: '#7C3AED', marginTop: 8, fontStyle: 'italic' }}>
            A IA vai considerar estas promoções automaticamente na estratégia.
        </div>
    </div>
)}
```

- [ ] **Step 4: Verificar no browser**

No Resultados, selecionar um voo Smiles → abrir StrategyPanel → se houver promos de Smiles no banco, banner roxo aparece listando as promos com badge de tipo. Sem promos → banner não aparece.

- [ ] **Step 5: Commit**

```bash
git add src/components/StrategyPanel.tsx
git commit -m "feat(strategy): show active promos banner before generating strategy"
```

---

## Checklist de cobertura

- [x] Tipo `Promocao` atualizado com todos os campos do scraper
- [x] Filtro por categoria: Todas / Milhas / Passagens
- [x] Filtro por programa: chips dinâmicos derivados das promos carregadas
- [x] Chips de programa só aparecem quando categoria = Milhas
- [x] Badges de tipo nos cards (Clube / Transferência / Passagem / Programa)
- [x] Badge de preço e desconto na modal de clube
- [x] Banner de promos ativas no StrategyPanel antes de gerar
- [x] Landing mode não é afetado pelos filtros
- [x] TypeScript sem erros
