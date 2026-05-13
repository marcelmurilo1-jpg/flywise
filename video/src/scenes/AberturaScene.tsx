import { AbsoluteFill, interpolate, useCurrentFrame, Easing, Img, staticFile } from "remotion";
import { COLORS, FONT_FAMILY } from "../theme";

export const AberturaScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Logo: scale up + fade in
  const logoOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const logoScale = interpolate(frame, [0, 30], [0.9, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Line 1: slide up + fade, starts at frame 55
  const line1Opacity = interpolate(frame, [55, 75], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const line1Y = interpolate(frame, [55, 75], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Line 2: slide up + fade, starts at frame 80
  const line2Opacity = interpolate(frame, [80, 100], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const line2Y = interpolate(frame, [80, 100], [24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Accent line under logo: scales width from 0 to 1
  const accentScale = interpolate(frame, [35, 60], [0, 1], {
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
      {/* Logo */}
      <Img
        src={staticFile("logo.png")}
        style={{
          height: 200,
          width: "auto",
          opacity: logoOpacity,
          transform: `scale(${logoScale})`,
        }}
      />

      {/* Accent divider */}
      <div
        style={{
          width: 48,
          height: 3,
          backgroundColor: COLORS.blue,
          borderRadius: 2,
          transform: `scaleX(${accentScale})`,
          transformOrigin: "center",
        }}
      />

      {/* Taglines */}
      <div style={{ textAlign: "center", maxWidth: 860 }}>
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 64,
            fontWeight: 700,
            color: COLORS.navy,
            margin: 0,
            letterSpacing: "-1.5px",
            lineHeight: 1.1,
            opacity: line1Opacity,
            transform: `translateY(${line1Y}px)`,
          }}
        >
          Pare de acumular milhas.
        </p>
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 56,
            fontWeight: 400,
            color: COLORS.blue,
            margin: "12px 0 0",
            letterSpacing: "-1px",
            lineHeight: 1.1,
            opacity: line2Opacity,
            transform: `translateY(${line2Y}px)`,
          }}
        >
          Comece a voar com elas.
        </p>
      </div>
    </AbsoluteFill>
  );
};
