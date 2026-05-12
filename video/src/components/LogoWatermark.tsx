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
