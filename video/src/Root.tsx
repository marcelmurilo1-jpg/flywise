import { Composition } from "remotion";
import { FlyWiseVideo } from "./FlyWiseVideo";
import { TOTAL_FRAMES, FPS } from "./timing";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="FlyWiseVideo"
      component={FlyWiseVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};
