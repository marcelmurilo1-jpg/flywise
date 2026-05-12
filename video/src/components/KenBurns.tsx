import { interpolate, useCurrentFrame, Easing, AbsoluteFill, Img } from "remotion";

type KenBurnsProps = {
  src: string;
  totalFrames: number;
};

export const KenBurns: React.FC<KenBurnsProps> = ({ src, totalFrames }) => {
  const frame = useCurrentFrame();

  const enterScale = interpolate(frame, [0, 15], [1.05, 1.0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });

  const holdScale = interpolate(frame, [15, totalFrames], [1.0, 1.03], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });

  const scale = frame < 15 ? enterScale : holdScale;

  return (
    <AbsoluteFill style={{ overflow: "hidden", borderRadius: 16 }}>
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
      />
    </AbsoluteFill>
  );
};
