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
