import { Composition, registerRoot } from "remotion";
import { FlyWiseVideo } from "./FlyWiseVideo";
import { TOTAL_FRAMES, FPS } from "./timing";

const RemotionRoot: React.FC = () => {
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

registerRoot(RemotionRoot);
