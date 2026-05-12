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
