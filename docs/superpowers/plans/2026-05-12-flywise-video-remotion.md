# FlyWise Video — Remotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a ~62s, 16:9 FlyWise pitch video in Remotion — white background, persistent logo watermark, 6 feature scenes with Ken Burns screenshots, fade transitions throughout.

**Architecture:** Standalone `video/` package inside the FlyWise repo (independent `package.json`, does not affect Vercel build). All scenes use `TransitionSeries` from `@remotion/transitions` for 15-frame fades between each scene. Each `FeatureScene` is a reusable component that receives an asset path, label, and sublabel as props.

**Tech Stack:** Remotion 4.x, `@remotion/transitions`, `@remotion/google-fonts` (Inter), `@remotion/media` (for video assets), React 18, TypeScript.

---

## File Map

| File | Responsibility |
|------|---------------|
| `video/package.json` | Remotion deps, studio/render scripts |
| `video/tsconfig.json` | TypeScript config for the video package |
| `video/src/Root.tsx` | `registerRoot`, single `<Composition>` |
| `video/src/FlyWiseVideo.tsx` | `TransitionSeries` with all 9 scenes |
| `video/src/theme.ts` | Color palette, font family constant |
| `video/src/timing.ts` | Frame counts per scene (source of truth) |
| `video/src/components/AnimatedText.tsx` | Word-stagger animation primitive |
| `video/src/components/KenBurns.tsx` | Zoom wrapper for Img and Video |
| `video/src/components/LogoWatermark.tsx` | Top-left persistent logo |
| `video/src/scenes/AberturaScene.tsx` | Opening: centered logo + tagline |
| `video/src/scenes/ProblemaScene.tsx` | Problem: 3-block staggered text |
| `video/src/scenes/FeatureScene.tsx` | Reusable feature scene (Ken Burns + label) |
| `video/src/scenes/CTAScene.tsx` | Closing CTA: centered logo + URL |
| `video/src/assets/logo.png` | Copied from `public/logo.png` |
| `video/src/assets/screenshots/` | Placeholder PNGs + user-supplied assets |

---

## Timing Reference

Composition total: **1860 frames at 30 fps = 62s**  
Each transition overlap: **15 frames** between adjacent scenes.  
`TransitionSeries.Sequence` durations (padded to account for overlaps):

| Scene | Frames in TransitionSeries |
|-------|---------------------------|
| Abertura | 195 |
| Problema | 225 |
| Busca | 225 |
| Estratégia | 225 |
| Transferência | 225 |
| Para onde | 225 |
| Roteiro | 225 |
| Promoções | 225 |
| CTA | 210 |
| **8 transitions × −15** | **−120** |
| **Total** | **1860** |

Internal animations inside each scene use `useCurrentFrame()` which returns local frames starting at 0.

---

## Task 1: Scaffold the `video/` package

**Files:**
- Create: `video/package.json`
- Create: `video/tsconfig.json`
- Create: `video/src/` (directory)
- Create: `video/src/assets/screenshots/` (directory)

- [ ] **Step 1: Create `video/package.json`**

```json
{
  "name": "flywise-video",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "studio": "remotion studio src/Root.tsx",
    "render": "remotion render src/Root.tsx FlyWiseVideo --codec h264 --output out/flywise.mp4"
  },
  "dependencies": {
    "@remotion/google-fonts": "^4.0.0",
    "@remotion/media": "^4.0.0",
    "@remotion/transitions": "^4.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "remotion": "^4.0.0"
  },
  "devDependencies": {
    "@remotion/cli": "^4.0.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.0"
  }
}
```

- [ ] **Step 2: Create `video/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create directory structure**

```bash
mkdir -p video/src/scenes video/src/components video/src/assets/screenshots
```

- [ ] **Step 4: Copy logo and install dependencies**

```bash
cp public/logo.png video/src/assets/logo.png
cd video && npm install
```

Expected: `node_modules/` created inside `video/`, no errors.

- [ ] **Step 5: Create placeholder screenshot assets**

For each missing screenshot, create a 1920×1080 placeholder PNG so the video renders without missing assets. Run from the repo root:

```bash
# Create minimal valid 1×1 PNG placeholders (magenta) so Remotion doesn't crash
python3 - <<'EOF'
import struct, zlib, os

def make_png(path, w=1920, h=1080, r=255, g=0, b=255):
    def chunk(name, data):
        c = zlib.crc32(name + data) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + name + data + struct.pack('>I', c)
    sig = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0))
    row = b'\x00' + bytes([r, g, b] * w)
    raw = row * h
    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'wb').write(sig + ihdr + idat + iend)

for name in ['busca', 'estrategia', 'transferencia', 'paraonde', 'roteiro', 'promocoes']:
    make_png(f'video/src/assets/screenshots/{name}.png')
    print(f'Created {name}.png')
EOF
```

Expected: 6 magenta PNG files in `video/src/assets/screenshots/`.

- [ ] **Step 6: Commit scaffold**

```bash
git add video/package.json video/tsconfig.json video/src/assets/
git commit -m "feat(video): scaffold Remotion video package with placeholder assets"
```

---

## Task 2: `theme.ts` and `timing.ts`

**Files:**
- Create: `video/src/theme.ts`
- Create: `video/src/timing.ts`

- [ ] **Step 1: Create `video/src/theme.ts`**

```ts
import { loadFont } from "@remotion/google-fonts/Inter";

const { fontFamily } = loadFont("normal", {
  weights: ["400", "600", "700"],
  subsets: ["latin"],
});

export const FONT_FAMILY = fontFamily;

export const COLORS = {
  bg: "#F7F9FC",
  navy: "#0E2A55",
  blue: "#2A60C2",
  border: "#E2E8F0",
  muted: "#64748b",
  accent: "#7dd3fc",
} as const;
```

- [ ] **Step 2: Create `video/src/timing.ts`**

```ts
export const FPS = 30;
export const TRANSITION_FRAMES = 15;

// Padded durations for TransitionSeries.Sequence
// Each scene (except last) is padded +15 to keep total = 1860 frames
export const SCENE_DURATIONS = {
  abertura:      195,
  problema:      225,
  busca:         225,
  estrategia:    225,
  transferencia: 225,
  paraonde:      225,
  roteiro:       225,
  promocoes:     225,
  cta:           210,
} as const;

// Composition total = sum(durations) - 8×15 = 1980 - 120 = 1860 frames = 62s
export const TOTAL_FRAMES = 1860;
```

- [ ] **Step 3: Commit**

```bash
cd video && git add src/theme.ts src/timing.ts
cd .. && git add video/src/theme.ts video/src/timing.ts
git commit -m "feat(video): add theme and timing constants"
```

---

## Task 3: `AnimatedText` component

**Files:**
- Create: `video/src/components/AnimatedText.tsx`

- [ ] **Step 1: Create `video/src/components/AnimatedText.tsx`**

Each word fades in with `opacity 0→1` and slides up `translateY 8→0` with a per-word delay.

```tsx
import { interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FAMILY, COLORS } from "../theme";

type AnimatedTextProps = {
  text: string;
  startFrame?: number;
  wordDelayFrames?: number;
  style?: React.CSSProperties;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  startFrame = 0,
  wordDelayFrames = 3,
  style,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((word, i) => {
        const wordStart = startFrame + i * wordDelayFrames;
        const opacity = interpolate(frame, [wordStart, wordStart + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const translateY = interpolate(frame, [wordStart, wordStart + 12], [8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={i}
            style={{
              opacity,
              display: "inline-block",
              transform: `translateY(${translateY}px)`,
              marginRight: "0.3em",
              fontFamily: FONT_FAMILY,
              color: COLORS.navy,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/components/AnimatedText.tsx
git commit -m "feat(video): add AnimatedText word-stagger component"
```

---

## Task 4: `KenBurns` component

**Files:**
- Create: `video/src/components/KenBurns.tsx`

- [ ] **Step 1: Create `video/src/components/KenBurns.tsx`**

Wraps an `<Img>` (or `<Video>`) with a scale-based Ken Burns zoom. Accepts `totalFrames` so the effect runs through the full scene duration.

```tsx
import { interpolate, useCurrentFrame, Easing, AbsoluteFill, Img, staticFile } from "remotion";

type KenBurnsProps = {
  src: string;
  totalFrames: number;
};

export const KenBurns: React.FC<KenBurnsProps> = ({ src, totalFrames }) => {
  const frame = useCurrentFrame();

  // Enter: 1.05 → 1.0 over first 15 frames (zoom in on appear)
  const enterScale = interpolate(frame, [0, 15], [1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Hold: 1.0 → 1.03 from frame 15 to end (slow creep)
  const holdScale = interpolate(frame, [15, totalFrames], [1.0, 1.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  const scale = frame < 15 ? enterScale : holdScale;

  return (
    <AbsoluteFill
      style={{ overflow: "hidden", borderRadius: 16 }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/components/KenBurns.tsx
git commit -m "feat(video): add KenBurns zoom wrapper component"
```

---

## Task 5: `LogoWatermark` component

**Files:**
- Create: `video/src/components/LogoWatermark.tsx`

- [ ] **Step 1: Create `video/src/components/LogoWatermark.tsx`**

Small logo in top-left corner. Fades in over 20 frames.

```tsx
import { interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";

type LogoWatermarkProps = {
  size?: "small" | "large";
};

export const LogoWatermark: React.FC<LogoWatermarkProps> = ({ size = "small" }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const isLarge = size === "large";

  return (
    <Img
      src={staticFile("logo.png")}
      style={{
        position: "absolute",
        top: isLarge ? "50%" : 40,
        left: isLarge ? "50%" : 48,
        transform: isLarge ? "translate(-50%, -60%)" : "none",
        height: isLarge ? 96 : 40,
        width: "auto",
        opacity,
      }}
    />
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/components/LogoWatermark.tsx
git commit -m "feat(video): add LogoWatermark component"
```

---

## Task 6: `AberturaScene`

**Files:**
- Create: `video/src/scenes/AberturaScene.tsx`

- [ ] **Step 1: Create `video/src/scenes/AberturaScene.tsx`**

Centered logo fades in (0–20f), then tagline words stagger in (60–120f).

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { AnimatedText } from "../components/AnimatedText";
import { COLORS, FONT_FAMILY } from "../theme";

export const AberturaScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 25], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const taglineOpacity = interpolate(frame, [50, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ height: 80, width: "auto", opacity: logoOpacity }}
      />
      <div
        style={{
          opacity: taglineOpacity,
          maxWidth: 900,
          textAlign: "center",
          lineHeight: 1.3,
        }}
      >
        <AnimatedText
          text="Milhas que você tem."
          startFrame={65}
          style={{ fontSize: 52, fontWeight: 700, display: "block", marginBottom: 8 }}
        />
        <AnimatedText
          text="Destinos que você ainda não imaginou."
          startFrame={85}
          style={{ fontSize: 52, fontWeight: 700, color: COLORS.blue }}
        />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/scenes/AberturaScene.tsx
git commit -m "feat(video): add AberturaScene"
```

---

## Task 7: `ProblemaScene`

**Files:**
- Create: `video/src/scenes/ProblemaScene.tsx`

- [ ] **Step 1: Create `video/src/scenes/ProblemaScene.tsx`**

3 text blocks, each slides up + fades in with ~45-frame intervals. Logo watermark persists.

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { LogoWatermark } from "../components/LogoWatermark";
import { COLORS, FONT_FAMILY } from "../theme";

const LINES = [
  "Você tem pontos acumulando…",
  "mas não sabe para onde ir,",
  "quando transferir ou quanto vai custar.",
];

const LineBlock: React.FC<{ text: string; startFrame: number }> = ({ text, startFrame }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const translateY = interpolate(frame, [startFrame, startFrame + 20], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  return (
    <p
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: FONT_FAMILY,
        fontSize: 48,
        fontWeight: 600,
        color: COLORS.navy,
        margin: 0,
        textAlign: "center",
        lineHeight: 1.4,
      }}
    >
      {text}
    </p>
  );
};

export const ProblemaScene: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <LogoWatermark size="small" />
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          padding: "0 120px",
        }}
      >
        {LINES.map((line, i) => (
          <LineBlock key={i} text={line} startFrame={20 + i * 45} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/scenes/ProblemaScene.tsx
git commit -m "feat(video): add ProblemaScene with staggered text blocks"
```

---

## Task 8: `FeatureScene`

**Files:**
- Create: `video/src/scenes/FeatureScene.tsx`

- [ ] **Step 1: Create `video/src/scenes/FeatureScene.tsx`**

White bg + logo watermark + centered screenshot with KenBurns + label/sublabel that slide up in the last 45 frames.

```tsx
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  Easing,
  staticFile,
} from "remotion";
import { KenBurns } from "../components/KenBurns";
import { LogoWatermark } from "../components/LogoWatermark";
import { COLORS, FONT_FAMILY } from "../theme";

export type FeatureSceneProps = {
  assetSrc: string;
  assetType: "image" | "video";
  label: string;
  sublabel: string;
  totalFrames: number;
};

export const FeatureScene: React.FC<FeatureSceneProps> = ({
  assetSrc,
  label,
  sublabel,
  totalFrames,
}) => {
  const frame = useCurrentFrame();
  const labelStart = totalFrames - 60;

  const screenshotOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const labelOpacity = interpolate(frame, [labelStart, labelStart + 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const labelY = interpolate(frame, [labelStart, labelStart + 20], [10, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <LogoWatermark size="small" />

      {/* Screenshot area: 80% width centered, with shadow */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 120px 140px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: screenshotOpacity,
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(14,42,85,0.18)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <KenBurns src={staticFile(assetSrc)} totalFrames={totalFrames} />
        </div>
      </AbsoluteFill>

      {/* Label overlay at bottom */}
      <div
        style={{
          position: "absolute",
          bottom: 60,
          left: 0,
          right: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 8,
          opacity: labelOpacity,
          transform: `translateY(${labelY}px)`,
        }}
      >
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 32,
            fontWeight: 700,
            color: COLORS.navy,
            margin: 0,
          }}
        >
          {label}
        </p>
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 22,
            fontWeight: 400,
            color: COLORS.muted,
            margin: 0,
          }}
        >
          {sublabel}
        </p>
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/scenes/FeatureScene.tsx
git commit -m "feat(video): add reusable FeatureScene component"
```

---

## Task 9: `CTAScene`

**Files:**
- Create: `video/src/scenes/CTAScene.tsx`

- [ ] **Step 1: Create `video/src/scenes/CTAScene.tsx`**

White bg, centered large logo, subtitle slides up, URL fades in with blue underline.

```tsx
import { AbsoluteFill, interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";

export const CTAScene: React.FC = () => {
  const frame = useCurrentFrame();

  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const subtitleOpacity = interpolate(frame, [45, 65], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
  const subtitleY = interpolate(frame, [45, 65], [12, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const urlOpacity = interpolate(frame, [75, 95], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const underlineWidth = interpolate(frame, [90, 120], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLORS.bg,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 28,
      }}
    >
      <Img
        src={staticFile("logo.png")}
        style={{ height: 96, width: "auto", opacity: logoOpacity }}
      />
      <p
        style={{
          fontFamily: FONT_FAMILY,
          fontSize: 36,
          fontWeight: 600,
          color: COLORS.navy,
          margin: 0,
          opacity: subtitleOpacity,
          transform: `translateY(${subtitleY}px)`,
        }}
      >
        Entre na lista de espera
      </p>
      <div style={{ opacity: urlOpacity, position: "relative" }}>
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 28,
            fontWeight: 600,
            color: COLORS.blue,
            margin: 0,
          }}
        >
          flywise.app
        </p>
        <div
          style={{
            position: "absolute",
            bottom: -4,
            left: 0,
            height: 2,
            width: `${underlineWidth}%`,
            backgroundColor: COLORS.blue,
            borderRadius: 2,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/scenes/CTAScene.tsx
git commit -m "feat(video): add CTAScene"
```

---

## Task 10: `FlyWiseVideo` main composition

**Files:**
- Create: `video/src/FlyWiseVideo.tsx`

- [ ] **Step 1: Create `video/src/FlyWiseVideo.tsx`**

Sequences all 9 scenes using `TransitionSeries` with 15-frame fade transitions.

```tsx
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill } from "remotion";
import { SCENE_DURATIONS, TRANSITION_FRAMES } from "./timing";
import { AberturaScene } from "./scenes/AberturaScene";
import { ProblemaScene } from "./scenes/ProblemaScene";
import { FeatureScene } from "./scenes/FeatureScene";
import { CTAScene } from "./scenes/CTAScene";

const FEATURES = [
  {
    assetSrc: "screenshots/busca.png",
    assetType: "image" as const,
    label: "Disponibilidade real de assentos premium",
    sublabel: "Powered by Seats.aero",
    durationInFrames: SCENE_DURATIONS.busca,
  },
  {
    assetSrc: "screenshots/estrategia.png",
    assetType: "image" as const,
    label: "Plano passo a passo em segundos",
    sublabel: "Claude analisa CPM, programas e transferências",
    durationInFrames: SCENE_DURATIONS.estrategia,
  },
  {
    assetSrc: "screenshots/transferencia.png",
    assetType: "image" as const,
    label: "Saiba exatamente quando transferir",
    sublabel: "Bônus de transferência em tempo real",
    durationInFrames: SCENE_DURATIONS.transferencia,
  },
  {
    assetSrc: "screenshots/paraonde.png",
    assetType: "image" as const,
    label: "Todos os destinos com suas milhas",
    sublabel: "Smiles, LATAM Pass, TudoAzul comparados",
    durationInFrames: SCENE_DURATIONS.paraonde,
  },
  {
    assetSrc: "screenshots/roteiro.png",
    assetType: "image" as const,
    label: "Roteiro completo, dia a dia",
    sublabel: "Do voo ao hotel — tudo em um lugar",
    durationInFrames: SCENE_DURATIONS.roteiro,
  },
  {
    assetSrc: "screenshots/promocoes.png",
    assetType: "image" as const,
    label: "Alertas em tempo real enquanto você dorme",
    sublabel: "Nunca perca um bônus de transferência",
    durationInFrames: SCENE_DURATIONS.promocoes,
  },
];

const transition = () => (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
  />
);

export const FlyWiseVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#F7F9FC" }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.abertura}>
          <AberturaScene />
        </TransitionSeries.Sequence>

        {transition()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.problema}>
          <ProblemaScene />
        </TransitionSeries.Sequence>

        {FEATURES.map((feat, i) => (
          <>
            {transition()}
            <TransitionSeries.Sequence key={feat.assetSrc} durationInFrames={feat.durationInFrames}>
              <FeatureScene
                assetSrc={feat.assetSrc}
                assetType={feat.assetType}
                label={feat.label}
                sublabel={feat.sublabel}
                totalFrames={feat.durationInFrames}
              />
            </TransitionSeries.Sequence>
          </>
        ))}

        {transition()}

        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.cta}>
          <CTAScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
```

> **Note:** React Fragments (`<>`) inside `TransitionSeries` must be flattened — if Remotion complains about Fragments as children of TransitionSeries, replace the `.map()` block with explicit entries for each feature (no Fragment wrapper).

- [ ] **Step 2: If the Fragment approach causes a TS/runtime error, replace the map with explicit sequences:**

```tsx
        {transition()}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.busca}>
          <FeatureScene assetSrc="screenshots/busca.png" assetType="image" label="Disponibilidade real de assentos premium" sublabel="Powered by Seats.aero" totalFrames={SCENE_DURATIONS.busca} />
        </TransitionSeries.Sequence>

        {transition()}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.estrategia}>
          <FeatureScene assetSrc="screenshots/estrategia.png" assetType="image" label="Plano passo a passo em segundos" sublabel="Claude analisa CPM, programas e transferências" totalFrames={SCENE_DURATIONS.estrategia} />
        </TransitionSeries.Sequence>

        {transition()}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.transferencia}>
          <FeatureScene assetSrc="screenshots/transferencia.png" assetType="image" label="Saiba exatamente quando transferir" sublabel="Bônus de transferência em tempo real" totalFrames={SCENE_DURATIONS.transferencia} />
        </TransitionSeries.Sequence>

        {transition()}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.paraonde}>
          <FeatureScene assetSrc="screenshots/paraonde.png" assetType="image" label="Todos os destinos com suas milhas" sublabel="Smiles, LATAM Pass, TudoAzul comparados" totalFrames={SCENE_DURATIONS.paraonde} />
        </TransitionSeries.Sequence>

        {transition()}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.roteiro}>
          <FeatureScene assetSrc="screenshots/roteiro.png" assetType="image" label="Roteiro completo, dia a dia" sublabel="Do voo ao hotel — tudo em um lugar" totalFrames={SCENE_DURATIONS.roteiro} />
        </TransitionSeries.Sequence>

        {transition()}
        <TransitionSeries.Sequence durationInFrames={SCENE_DURATIONS.promocoes}>
          <FeatureScene assetSrc="screenshots/promocoes.png" assetType="image" label="Alertas em tempo real enquanto você dorme" sublabel="Nunca perca um bônus de transferência" totalFrames={SCENE_DURATIONS.promocoes} />
        </TransitionSeries.Sequence>
```

- [ ] **Step 3: Commit**

```bash
git add video/src/FlyWiseVideo.tsx
git commit -m "feat(video): add FlyWiseVideo main composition"
```

---

## Task 11: `Root.tsx` — register the composition

**Files:**
- Create: `video/src/Root.tsx`

- [ ] **Step 1: Create `video/src/Root.tsx`**

```tsx
import { Composition } from "remotion";
import { FlyWiseVideo } from "./FlyWiseVideo";
import { TOTAL_FRAMES, FPS } from "./timing";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FlyWiseVideo"
      component={FlyWiseVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
```

- [ ] **Step 2: Commit**

```bash
git add video/src/Root.tsx
git commit -m "feat(video): add Root composition registration"
```

---

## Task 12: Open Remotion Studio and verify

- [ ] **Step 1: Install `@remotion/transitions` (it's a separate package that needs `remotion add`)**

```bash
cd video && npx remotion add @remotion/transitions
```

Expected: `@remotion/transitions` added to `package.json` and installed.

- [ ] **Step 2: Start Remotion Studio**

```bash
cd video && npm run studio
```

Expected: Browser opens at `http://localhost:3000` with the FlyWiseVideo composition listed.

- [ ] **Step 3: Verify each scene**

In Remotion Studio, scrub to these frame numbers and confirm the scene renders without errors:

| Frame | Expected scene |
|-------|---------------|
| 0 | White bg, logo fades in |
| 90 | Tagline words visible |
| 195 | Problem text fading in |
| 400 | Busca screenshot (magenta placeholder) + Ken Burns |
| 620 | Estratégia screenshot |
| 830 | Transferência screenshot |
| 1040 | Para onde screenshot |
| 1250 | Roteiro screenshot |
| 1460 | Promoções screenshot |
| 1665 | CTA — logo fading in |
| 1760 | "flywise.app" with underline animation |

- [ ] **Step 4: Swap in real screenshots**

For each feature, the user provides a PNG (min 1280×720) or MP4. Replace the placeholder:

```bash
# Example — replace busca placeholder with real screenshot:
cp ~/Downloads/busca-screenshot.png video/src/assets/screenshots/busca.png
```

For video assets (`.mp4`), update `FlyWiseVideo.tsx` to set `assetType: "video"` for that feature and update `FeatureScene.tsx` to use `<Video>` from `@remotion/media` instead of `<Img>` when `assetType === "video"`:

```tsx
// In FeatureScene.tsx, replace KenBurns content:
import { Video } from "@remotion/media";

// Inside KenBurns, conditionally render:
{assetType === "video" ? (
  <Video src={staticFile(assetSrc)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} muted />
) : (
  <Img src={staticFile(assetSrc)} style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }} />
)}
```

- [ ] **Step 5: Render the final MP4**

Once all assets are in place:

```bash
cd video && npm run render
```

Expected: `video/out/flywise.mp4` created (≈62s, H.264, 1920×1080).

- [ ] **Step 6: Commit final state**

```bash
git add video/src/
git commit -m "feat(video): complete Remotion video — ready for narration overlay"
```

---

## Self-Review

**Spec coverage:**
- ✅ 16:9 1920×1080 — Root.tsx
- ✅ 62s total — timing.ts (1860 frames)
- ✅ White background (#F7F9FC) — all scenes
- ✅ Logo in opening and persistent watermark — AberturaScene, LogoWatermark
- ✅ Abertura: logo + tagline stagger — AberturaScene
- ✅ Problema: 3 staggered text blocks — ProblemaScene
- ✅ 6 feature scenes with Ken Burns — FeatureScene + FEATURES array
- ✅ Labels and sublabels per spec table — FlyWiseVideo FEATURES const
- ✅ CTA: logo + "Entre na lista de espera" + flywise.app with underline — CTAScene
- ✅ Fade transitions between all scenes — TransitionSeries
- ✅ No narration/audio (added externally) — no audio tracks
- ✅ Independent video/ package, doesn't affect Vercel — separate package.json

**Type consistency:** `FeatureSceneProps` defined in Task 8 and consumed in Task 10 with matching field names (`assetSrc`, `assetType`, `label`, `sublabel`, `totalFrames`).

**Placeholder check:** No TBDs. Asset placeholders created via Python script in Task 1.
