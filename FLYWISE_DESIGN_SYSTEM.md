# FlyWise — Design System

---

## 1. Paleta de Cores

### Azuis Principais (Brand)

| Nome | Hex | Uso |
|---|---|---|
| Blue Medium | `#4A90E2` | Ícones ativos, destaques, bottom nav ativo |
| Blue Vibrant | `#2A60C2` | CTAs primários, botões, links |
| Blue Navy | `#0E2A55` | Headings, textos escuros, fundos navy |

### Superfícies e Fundos

| Nome | Hex | Uso |
|---|---|---|
| White | `#FFFFFF` | Background principal |
| Snow | `#F7F9FC` | Cards, painéis, superfícies elevadas |

### Neutros

| Nome | Hex | Uso |
|---|---|---|
| Gray Light | `#EEF2F8` | Skeleton loader, separadores |
| Gray Mid | `#C8D4E8` | Scrollbar, bordas em hover |
| Border Light | `#E2EAF5` | Borda padrão de cards |
| Border Mid | `#C0CFEA` | Borda em estado hover |

### Tipografia (cores)

| Nome | Hex | Uso |
|---|---|---|
| Text Dark | `#0E2A55` | Títulos, textos primários |
| Text Body | `#2C3E6B` | Corpo de texto |
| Text Muted | `#6B7A99` | Labels, textos secundários |
| Text Faint | `#A0AECB` | Placeholders, hints |

### Transparências (sobre fundos escuros)

| Nome | Valor | Uso |
|---|---|---|
| White 80% | `rgba(255,255,255,0.80)` | Texto secundário sobre navy |
| White 60% | `rgba(255,255,255,0.60)` | Texto terciário sobre navy |
| Blue Pale | `rgba(74,144,226,0.10)` | Background de item ativo |
| Blue Pale Mid | `rgba(42,96,194,0.12)` | Hover suave em elementos |

### Sombras

| Nome | Valor |
|---|---|
| Shadow XS | `0 1px 3px rgba(14,42,85,0.06), 0 1px 2px rgba(14,42,85,0.04)` |
| Shadow SM | `0 2px 10px rgba(14,42,85,0.08), 0 1px 4px rgba(14,42,85,0.05)` |
| Shadow MD | `0 4px 24px rgba(14,42,85,0.10), 0 2px 8px rgba(14,42,85,0.06)` |
| Shadow LG | `0 8px 48px rgba(14,42,85,0.12), 0 4px 16px rgba(14,42,85,0.08)` |
| Shadow Blue | `0 4px 20px rgba(42,96,194,0.30)` |

---

## 2. Tipografia

### Fonte Principal — Inter

Usada em toda a interface: corpo de texto, botões, labels, títulos.

```
font-family: 'Inter', system-ui, sans-serif;
```

| Peso | Valor | Uso |
|---|---|---|
| Light | 300 | Textos auxiliares, captions longas |
| Regular | 400 | Corpo de texto, descrições |
| Medium | 500 | Subtítulos, itens de lista |
| Semibold | 600 | Labels, botões secundários, nav |
| Bold | 700 | Botões primários, títulos de seção |
| Extrabold | 800 | Headings principais, CTAs |
| Black | 900 | Display text, hero headlines |

### Fonte Secundária — Manrope

Usada em elementos de destaque: notificações, modais, textos de marca.

```
font-family: 'Manrope', system-ui, sans-serif;
```

### Configurações Globais

```css
font-size base:    16px (padrão do browser)
line-height:       1.6
letter-spacing:    -0.01em (botões), 0.07em (labels uppercase)
-webkit-font-smoothing: antialiased
```

### Escala Tipográfica (referência)

| Tamanho | Uso |
|---|---|
| 10px | Labels de bottom nav |
| 12px | Labels uppercase, badges, captions |
| 13px | Textos auxiliares, botões pequenos |
| 14px | Corpo padrão, botões primários |
| 15px | Textos de destaque, botões grandes |
| 16px | Inputs (mínimo obrigatório no iOS) |
| 22px+ | Títulos de seção (responsivo com clamp) |

---

## 3. Estilo Visual Geral

### Tema
**Light mode exclusivo.** Fundo branco `#FFFFFF` com superfícies em `#F7F9FC`. Não há dark mode implementado no produto atual.

### Identidade Visual

**Clean e profissional, com personalidade azul.**
O design prioriza clareza e confiança — próprio de um produto financeiro/travel. A paleta azul (do céu e da aviação) reforça a identidade do nicho sem ser genérica.

### Características Definidoras

| Aspecto | Decisão |
|---|---|
| **Estilo geral** | Minimalista com profundidade — usa sombras sutis no lugar de bordas pesadas |
| **Bordas arredondadas** | 8px (micro), 10px (inputs), 12px (botões), 16px (cards), 24px (floating nav) |
| **Cards** | Fundo branco, borda `#E2EAF5`, `border-radius: 16px`, sombra suave |
| **Elevação** | Simulada via sombras progressivas (xs → xl), nunca por contraste de cor forte |
| **Glass morphism** | Usado pontualmente: `backdrop-filter: blur(16-20px)` em navs e overlays flutuantes |
| **Animações** | Suaves e rápidas: `0.15s–0.55s ease`. Translate de 1–2px em hover de cards. Sem animações pesadas |
| **Hover** | Sempre `translateY(-1px ou -2px)` + sombra mais intensa. Nunca muda cor de fundo bruscamente |
| **Botões** | CTA primário: `#2A60C2` sólido. Secundário: outline com `border: 1.5px`. Ghost: fundo transparente |
| **Densidade** | Média — não é compacto, não é espaçoso demais. Padding generoso em cards (20–32px) |
| **Mobile** | Bottom navigation fixa, breakpoint principal em 768px, touch targets mínimos de 44px |
| **Foco/Ring** | `box-shadow: 0 0 0 3px rgba(42,96,194,0.12)` — consistente com a cor brand |

### Hierarquia de Cor

```
Ação primária  →  #2A60C2  (Blue Vibrant)
Texto primário →  #0E2A55  (Blue Navy)
Texto corpo    →  #2C3E6B
Texto muted    →  #6B7A99
Texto hint     →  #A0AECB
Fundo base     →  #FFFFFF
Fundo surface  →  #F7F9FC
```

### Tom Visual em Palavras

> Clean, confiável, moderno, azul-aviação. Mais próximo de um fintech do que de um portal de turismo. Sem gradientes chamativos, sem cores quentes em destaque. A energia vem da composição e da tipografia, não de cores vibrantes.
