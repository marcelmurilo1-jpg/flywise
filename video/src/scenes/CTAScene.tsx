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
