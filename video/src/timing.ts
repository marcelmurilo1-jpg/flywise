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
