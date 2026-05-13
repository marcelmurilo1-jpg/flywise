import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from "remotion";
import { LogoWatermark } from "../components/LogoWatermark";
import { COLORS, FONT_FAMILY } from "../theme";

const LINES = [
  "Bilhões em milhas expiram todo ano no Brasil.",
  "Não por falta de pontos —",
  "por falta de estratégia.",
];

const LineBlock: React.FC<{ text: string; startFrame: number; highlight?: boolean }> = ({ text, startFrame, highlight }) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [startFrame, startFrame + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const translateY = interpolate(frame, [startFrame, startFrame + 22], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <p
      style={{
        opacity,
        transform: `translateY(${translateY}px)`,
        fontFamily: FONT_FAMILY,
        fontSize: 46,
        fontWeight: highlight ? 700 : 600,
        color: highlight ? COLORS.blue : COLORS.navy,
        margin: 0,
        textAlign: "center",
        lineHeight: 1.5,
        letterSpacing: "-0.5px",
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
          <LineBlock key={i} text={line} startFrame={20 + i * 45} highlight={i === 2} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
