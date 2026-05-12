# FlyWise Feature Showcase Video — Remotion Design Spec

## Overview

Vídeo de apresentação do FlyWise para pitch com investidores, parceiros e eventos. Estilo Premium & Aspiracional, estrutura Problema → Solução. Duração ~62s, formato 16:9 (1920×1080), sem narração embutida (adicionada externamente depois). Assets de cada feature são screenshots reais ou vídeos curtos do app.

---

## Decisões de Design

| Dimensão | Decisão |
|----------|---------|
| Estilo | Premium & Aspiracional — navy escuro, animações suaves, fontes grandes |
| Formato | 16:9 horizontal, 1920×1080 |
| Duração | ~62s (1860 frames a 30fps) |
| Áudio | Sem narração embutida — placeholder de silêncio; música ambiente opcional no futuro |
| Assets | Screenshots reais do app + vídeos curtos enviados pelo usuário |
| Paleta | `#0E2A55` navy, `#2A60C2` blue, `#F7F9FC` light, `#E2E8F0` borders, `#7dd3fc` accent |
| Fontes | Inter ou Geist (match do app FlyWise) |

---

## Storyboard — Cenas e Timing

### Cena 1 — Abertura (frames 0–180, 0–6s)
- Fundo: `#0E2A55` navy escuro
- Logo FlyWise entra com fade-in suave (0–2s)
- Tagline aparece palavra a palavra com stagger (2–5s): *"Milhas que você tem. Destinos que você ainda não imaginou."*
- Transição: fade para Cena 2

### Cena 2 — Problema (frames 180–390, 6–13s)
- Fundo: navy escuro (`#0E2A55`)
- Texto aparece em 3 blocos com stagger:
  1. *"Você tem pontos acumulando…"*
  2. *"mas não sabe para onde ir,"*
  3. *"quando transferir ou quanto vai custar."*
- Cada bloco entra com slide-up + fade, intervalo de ~1.5s entre blocos
- Transição: fade para Feature 1

### Cenas 3–8 — Features (frames 390–1650, 13–55s) — ~7s cada

Cada feature segue o template `<FeatureScene>`:
- 0.5s: screenshot/vídeo entra com zoom suave (scale 1.05 → 1.0) + fade-in
- 0.5–5.5s: screenshot visível, zoom lento contínuo (1.0 → 1.03) — Ken Burns effect
- 5.5–7s: label e sublabel animam para baixo, fade-out da cena

| Índice | Feature | Screenshot/Vídeo | Label | Sublabel |
|--------|---------|-----------------|-------|---------|
| 3 | Busca Avançada IA | Tela de resultados de voos | Disponibilidade real de assentos premium | Powered by Seats.aero |
| 4 | Estratégia com IA | Tela da estratégia gerada | Plano passo a passo em segundos | Claude analisa CPM, programas e transferências |
| 5 | Simulador de Transferência | Tela do simulador com bônus | Saiba exatamente quando transferir | Bônus de transferência em tempo real |
| 6 | Para onde posso voar? | Tela de destinos disponíveis | Todos os destinos com suas milhas | Smiles, LATAM Pass, TudoAzul comparados |
| 7 | Roteiro com IA | Tela do roteiro/mapa interativo | Roteiro completo, dia a dia | Do voo ao hotel — tudo em um lugar |
| 8 | Promoções & Alertas | Feed de promoções e alertas | Alertas em tempo real enquanto você dorme | Nunca perca um bônus de transferência |

### Cena 9 — CTA (frames 1650–1860, 55–62s)
- Fundo: navy escuro, fade-in
- *"FlyWise"* aparece grande com fade (55–57s)
- Subtítulo: *"Entre na lista de espera"* (57–58.5s)
- URL ou badge animado: `flywise.app` (58.5–60.5s)
- Partículas sutis ou brilho suave no fundo (60–62s)
- Fade-out final

---

## Arquitetura de Componentes Remotion

```
src/video/
├── Root.tsx                  # registerRoot, define Composition
├── FlyWiseVideo.tsx          # sequencia todas as cenas
├── scenes/
│   ├── AberturaScene.tsx     # logo + tagline stagger
│   ├── ProblemaScene.tsx     # texto em 3 blocos com stagger
│   ├── FeatureScene.tsx      # componente reutilizável (screenshot + Ken Burns + label)
│   └── CTAScene.tsx          # navy + URL + partículas
├── components/
│   ├── AnimatedText.tsx      # stagger de palavras/letras
│   ├── KenBurns.tsx          # wrapper de zoom suave para imagem/vídeo
│   └── FadeTransition.tsx    # wrapper de fade entre cenas
├── assets/
│   ├── logo.svg              # logo FlyWise
│   └── screenshots/          # PNGs ou MPs4s de cada feature (fornecidos pelo usuário)
│       ├── busca.png
│       ├── estrategia.png
│       ├── transferencia.png
│       ├── paraonde.png
│       ├── roteiro.png
│       └── promocoes.png
├── theme.ts                  # paleta de cores, fontes, constantes
└── timing.ts                 # constantes de frame para cada cena
```

---

## Constantes de Timing (`timing.ts`)

```ts
export const FPS = 30;
export const TOTAL_FRAMES = 1860; // ~62s

export const SCENES = {
  abertura:     { from: 0,    durationInFrames: 180 },
  problema:     { from: 180,  durationInFrames: 210 },
  busca:        { from: 390,  durationInFrames: 210 },
  estrategia:   { from: 600,  durationInFrames: 210 },
  transferencia:{ from: 810,  durationInFrames: 210 },
  paraonde:     { from: 1020, durationInFrames: 210 },
  roteiro:      { from: 1230, durationInFrames: 210 },
  promocoes:    { from: 1440, durationInFrames: 210 },
  cta:          { from: 1650, durationInFrames: 210 },
};
```

---

## `FeatureScene` Props Interface

```ts
interface FeatureSceneProps {
  assetSrc: string;        // path to screenshot PNG or video MP4
  assetType: 'image' | 'video';
  label: string;
  sublabel: string;
  accentColor?: string;    // defaults to #2A60C2
}
```

---

## Animações e Efeitos

### Ken Burns (KenBurns.tsx)
- Zoom: `scale(1.05)` → `scale(1.0)` no enter (0.5s), depois `scale(1.0)` → `scale(1.03)` durante o hold
- Implementado com `interpolate()` do Remotion — sem CSS transitions
- Aplicado tanto para imagens PNG quanto para `<Video>` tags

### Stagger de Palavras (AnimatedText.tsx)
- Divide o texto em spans por palavra
- Cada palavra: `opacity: 0 → 1` + `translateY: 8px → 0` com delay proporcional ao índice
- Delay entre palavras: 3–4 frames (100–133ms)

### Fade entre cenas
- Último 0.5s de cada cena: `opacity 1 → 0`
- Primeira 0.5s da cena seguinte: `opacity 0 → 1`
- Overlap de 15 frames entre cenas consecutivas via `<Sequence>`

---

## Assets Necessários (a fornecer pelo usuário)

O usuário pode fornecer screenshots ou vídeos curtos (.mp4, .mov) de:
1. Tela de resultados de busca de voos
2. Tela da estratégia gerada pelo Claude
3. Tela do simulador de transferência
4. Tela de "Para onde posso voar?" com destinos
5. Tela do roteiro com mapa interativo
6. Feed de promoções e alertas

Formato aceito: PNG (min 1920×1080) ou MP4/MOV (min 1280×720). Assets de menor resolução funcionam com KenBurns mas perdem qualidade nos últimos frames do zoom.

---

## Setup do Projeto Remotion

O vídeo será criado como pasta `video/` dentro do repo FlyWise (não como app separado), usando `@remotion/cli` e `remotion` como devDependencies. Renderizado com `npx remotion render` para exportar o MP4 final.

```bash
# Estrutura no repo
/
├── video/
│   ├── package.json        # remotion, @remotion/cli, react, react-dom
│   ├── tsconfig.json
│   └── src/
│       └── (arquitetura acima)
```

O `package.json` do `video/` é independente do app principal — não afeta build da Vercel.

---

## Fora do Escopo

- Narração / locução (adicionada externamente depois da exportação)
- Música de fundo (pode ser adicionada na pós-produção)
- Versão vertical (Reels/TikTok)
- Animações de gráficos ou dados ao vivo
- Integração com Supabase ou API durante a renderização
