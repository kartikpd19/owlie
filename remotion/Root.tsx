import { Lottie, type LottieAnimationData } from "@remotion/lottie";
import { AbsoluteFill, Composition, useVideoConfig } from "remotion";
import happy from "../lottie/owlie-happy.json";
import laugh from "../lottie/owlie-laugh.json";
import love from "../lottie/owlie-love.json";
import normal from "../lottie/owlie-normal.json";
import wink from "../lottie/owlie-wink.json";

const ANIMATIONS = { normal, wink, happy, laugh, love } as const;
type Name = keyof typeof ANIMATIONS;

// GIF frame delays are in 1/100s and browsers slow down anything faster than 2/100s,
// so 50fps is the smoothest rate that plays at true speed everywhere.
const GIF_FPS = 50;

type Props = { expression: Name; backgroundColor: string };

const OwlieGif: React.FC<Props> = ({ expression, backgroundColor }) => {
  const { fps } = useVideoConfig();
  const data = ANIMATIONS[expression];
  return (
    <AbsoluteFill style={{ backgroundColor }}>
      <Lottie
        animationData={data as unknown as LottieAnimationData}
        // @remotion/lottie advances one Lottie frame per video frame; match real time.
        playbackRate={data.fr / fps}
        loop
      />
    </AbsoluteFill>
  );
};

export const RemotionRoot: React.FC = () => (
  <>
    {(Object.keys(ANIMATIONS) as Name[]).map((name) => {
      const a = ANIMATIONS[name];
      return (
        <Composition
          key={name}
          id={`Owlie-${name}`}
          component={OwlieGif}
          durationInFrames={Math.round((a.op / a.fr) * GIF_FPS)}
          fps={GIF_FPS}
          width={a.w}
          height={a.h}
          defaultProps={{ expression: name, backgroundColor: "#ffffff" } as Props}
        />
      );
    })}
  </>
);
