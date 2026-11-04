import { useEffect, useId, useRef, useState } from "react";
import "./owlie.css";
import {
  ARC_L, ARC_R, BEAK, EYE_L, EYE_L_SHINE, EYE_R, EYE_R_SHINE, FACE,
  HEART_L, HEART_R, LAUGH_L, LAUGH_R, OUTLINE,
} from "./paths";

export type OwlieExpression = "normal" | "wink" | "happy" | "laugh" | "love";
export type OwlieSize = "auto" | "lg" | "md" | "sm";

export interface OwlieProps {
  expression?: OwlieExpression;
  /** "auto" scales with the surrounding font size (~1.5x cap height). */
  size?: OwlieSize;
  /** Force play/pause. When omitted, plays while the nearest heading is in view. */
  playing?: boolean;
  className?: string;
}

const RoundEye: React.FC<{ d: string; shine: string; side: "l" | "r" }> = ({
  d,
  shine,
  side,
}) => (
  <g className={`owlie__eye owlie__eye--${side}`}>
    <path d={d} fill="currentColor" />
    <path d={shine} className="owlie__shine" />
  </g>
);

/** Plays while the nearest heading (or the mascot itself) is at least 50% visible. */
function useInView(ref: React.RefObject<HTMLElement | null>, enabled: boolean) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!enabled || !el || typeof IntersectionObserver === "undefined") return;
    const target = el.closest("h1,h2,h3,h4,h5,h6") ?? el;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.5 },
    );
    io.observe(target);
    return () => io.disconnect();
  }, [ref, enabled]);
  return inView;
}

export const Owlie: React.FC<OwlieProps> = ({
  expression = "normal",
  size = "auto",
  playing,
  className,
}) => {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, playing === undefined);
  const isPlaying = playing ?? inView;
  const uid = useId().replace(/:/g, "");
  const id = (name: string) => `owlie-${uid}-${name}`;

  return (
    <span
      ref={ref}
      className={["owlie", className].filter(Boolean).join(" ")}
      data-expression={expression}
      data-size={size}
      data-playing={isPlaying}
      aria-hidden="true"
    >
      <span className="owlie__body">
        <svg viewBox="0 0 100 68" fill="none" xmlns="http://www.w3.org/2000/svg" focusable="false">
          <path id={id("face")} className="owlie__face" d={FACE} />
          <path id={id("outline")} d={OUTLINE} fill="currentColor" />
          <path id={id("beak")} className="owlie__beak" d={BEAK} />

          <g id={id("eyes-normal")} className="owlie__eyes owlie__eyes--normal">
            <RoundEye d={EYE_L} shine={EYE_L_SHINE} side="l" />
            <RoundEye d={EYE_R} shine={EYE_R_SHINE} side="r" />
          </g>
          <g id={id("eyes-happy")} className="owlie__eyes owlie__eyes--happy owlie__stroke-eyes">
            <path d={ARC_L} />
            <path d={ARC_R} />
          </g>
          <g id={id("eyes-laugh")} className="owlie__eyes owlie__eyes--laugh owlie__stroke-eyes">
            <path d={LAUGH_L} />
            <path d={LAUGH_R} />
          </g>
          <g id={id("eyes-love")} className="owlie__eyes owlie__eyes--love">
            <path className="owlie__heart" d={HEART_L} />
            <path className="owlie__heart" d={HEART_R} />
          </g>
          <g id={id("eyes-wink")} className="owlie__eyes owlie__eyes--wink">
            <RoundEye d={EYE_L} shine={EYE_L_SHINE} side="l" />
            <path className="owlie__stroke-eyes" d={ARC_R} />
          </g>
        </svg>
      </span>
    </span>
  );
};
