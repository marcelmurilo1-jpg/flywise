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
