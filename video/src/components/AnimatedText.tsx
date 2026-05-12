import { interpolate, useCurrentFrame, Easing } from "remotion";
import { FONT_FAMILY, COLORS } from "../theme";

type AnimatedTextProps = {
  text: string;
  startFrame?: number;
  wordDelayFrames?: number;
  style?: React.CSSProperties;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  text,
  startFrame = 0,
  wordDelayFrames = 3,
  style,
}) => {
  const frame = useCurrentFrame();
  const words = text.split(" ");

  return (
    <span style={{ display: "inline", ...style }}>
      {words.map((word, i) => {
        const wordStart = startFrame + i * wordDelayFrames;
        const opacity = interpolate(frame, [wordStart, wordStart + 12], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        const translateY = interpolate(frame, [wordStart, wordStart + 12], [8, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });
        return (
          <span
            key={i}
            style={{
              opacity,
              display: "inline-block",
              transform: `translateY(${translateY}px)`,
              marginRight: "0.3em",
              fontFamily: FONT_FAMILY,
              color: COLORS.navy,
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
};
