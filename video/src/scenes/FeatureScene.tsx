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
