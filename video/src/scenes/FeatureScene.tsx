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

  // Screenshot: fade in
  const screenshotOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Pill badge: pops in at frame 15
  const pillScale = interpolate(frame, [15, 32], [0.7, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.56, 0.64, 1), // overshoot pop
  });
  const pillOpacity = interpolate(frame, [15, 28], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  // Label: slides in from left at frame 25
  const labelX = interpolate(frame, [25, 50], [-32, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const labelOpacity = interpolate(frame, [25, 45], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  // Sublabel: slides in slightly after label
  const sublabelX = interpolate(frame, [38, 62], [-24, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  const sublabelOpacity = interpolate(frame, [38, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bg }}>
      <LogoWatermark size="small" />

      {/* Screenshot */}
      <AbsoluteFill
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "80px 120px 160px",
        }}
      >
        <div
          style={{
            width: "100%",
            height: "100%",
            opacity: screenshotOpacity,
            borderRadius: 16,
            boxShadow: "0 24px 80px rgba(14,42,85,0.15)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <KenBurns src={staticFile(assetSrc)} totalFrames={totalFrames} />
        </div>
      </AbsoluteFill>

      {/* Label block — bottom left, appears at start */}
      <div
        style={{
          position: "absolute",
          bottom: 52,
          left: 120,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {/* Blue pill */}
        <div
          style={{
            display: "inline-flex",
            opacity: pillOpacity,
            transform: `scale(${pillScale})`,
            transformOrigin: "left center",
          }}
        >
          <span
            style={{
              fontFamily: FONT_FAMILY,
              fontSize: 13,
              fontWeight: 600,
              color: COLORS.blue,
              backgroundColor: `${COLORS.blue}18`,
              border: `1.5px solid ${COLORS.blue}40`,
              padding: "4px 12px",
              borderRadius: 999,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            FlyWise
          </span>
        </div>

        {/* Label */}
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 34,
            fontWeight: 700,
            color: COLORS.navy,
            margin: 0,
            letterSpacing: "-0.5px",
            opacity: labelOpacity,
            transform: `translateX(${labelX}px)`,
          }}
        >
          {label}
        </p>

        {/* Sublabel */}
        <p
          style={{
            fontFamily: FONT_FAMILY,
            fontSize: 20,
            fontWeight: 400,
            color: COLORS.muted,
            margin: 0,
            opacity: sublabelOpacity,
            transform: `translateX(${sublabelX}px)`,
          }}
        >
          {sublabel}
        </p>
      </div>
    </AbsoluteFill>
  );
};
