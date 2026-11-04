/**
 * Generates one Lottie JSON per Owlie expression from the shared SVG paths.
 *   npm run lottie   →   lottie/owlie-<expression>.json
 *
 * Timings mirror src/owlie/owlie.css. Edit the KEYFRAMES section below to tweak.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as P from "../src/owlie/paths.ts";

const FPS = 60;
const SCALE = 4; // 100x68 artwork → 400x272 px
const PAD = 40; // room for tilts / bobs so motion isn't clipped
const W = 100 * SCALE + PAD * 2; // 480
const H = 68 * SCALE + PAD * 2; // 352
const PIVOT: [number, number] = [50, 60]; // bottom-centre of the face (SVG units)

const C = {
  face: "#FAFAFC",
  outline: "#151E52",
  beak: "#FFCB47",
  eye: "#0C1F42",
  shine: "#EAEDEF",
  heart: "#F34C6B",
};

// ───────────────────────── SVG path → Lottie bezier ─────────────────────────
type Vec = [number, number];
type Bez = { c: boolean; v: Vec[]; i: Vec[]; o: Vec[] };

function parsePath(d: string): Bez[] {
  const tokens = d.match(/[MLHVCZ]|-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? [];
  const out: Bez[] = [];
  let cur: Bez | null = null;
  let pt: Vec = [0, 0];
  let k = 0;
  let cmd = "";
  const num = () => parseFloat(tokens[k++]);
  const add = (p: Vec, inT: Vec = [0, 0]) => {
    cur!.v.push(p);
    cur!.i.push(inT);
    cur!.o.push([0, 0]);
    pt = p;
  };
  while (k < tokens.length) {
    if (/[A-Za-z]/.test(tokens[k])) cmd = tokens[k++];
    if (/[a-z]/.test(cmd)) throw new Error(`Relative command ${cmd} not supported`);
    switch (cmd) {
      case "M":
        cur = { c: false, v: [], i: [], o: [] };
        out.push(cur);
        add([num(), num()]);
        cmd = "L";
        break;
      case "L":
        add([num(), num()]);
        break;
      case "H":
        add([num(), pt[1]]);
        break;
      case "V":
        add([pt[0], num()]);
        break;
      case "C": {
        const c1: Vec = [num(), num()];
        const c2: Vec = [num(), num()];
        const end: Vec = [num(), num()];
        const last = cur!.v.length - 1;
        cur!.o[last] = [c1[0] - pt[0], c1[1] - pt[1]];
        add(end, [c2[0] - end[0], c2[1] - end[1]]);
        break;
      }
      case "Z": {
        const b = cur!;
        b.c = true;
        const n = b.v.length - 1;
        if (n > 0 && Math.hypot(b.v[n][0] - b.v[0][0], b.v[n][1] - b.v[0][1]) < 1e-3) {
          b.i[0] = b.i[n];
          b.v.pop();
          b.i.pop();
          b.o.pop();
        }
        pt = b.v[0];
        break;
      }
      default:
        throw new Error(`Unexpected token ${tokens[k]}`);
    }
  }
  return out;
}

// ───────────────────────── Lottie helpers ─────────────────────────
const rgba = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, 1];
};
const st = (k: unknown) => ({ a: 0, k });

type Ease = "ease" | "linear" | "hold";
const EASES: Record<Exclude<Ease, "hold">, { o: object; i: object }> = {
  ease: { o: { x: [0.42], y: [0] }, i: { x: [0.58], y: [1] } }, // CSS ease-in-out
  linear: { o: { x: [0], y: [0] }, i: { x: [1], y: [1] } },
};

/** [percentOfLoop, value, easeIntoNext] → animated property */
type Key = [number, number | number[], Ease?];
function anim(duration: number, keys: Key[]) {
  const total = duration * FPS;
  return {
    a: 1,
    k: keys.map(([pct, val, ease = "ease"], idx) => {
      const s = Array.isArray(val) ? val : [val];
      const t = +((pct / 100) * total).toFixed(3);
      if (idx === keys.length - 1) return { t, s };
      return ease === "hold" ? { t, s, h: 1 } : { t, s, ...EASES[ease] };
    }),
  };
}

const shapes = (d: string) =>
  parsePath(d).map((ks, n) => ({ ty: "sh", nm: `path ${n + 1}`, ks: st(ks) }));
const fill = (hex: string) => ({ ty: "fl", nm: "fill", c: st(rgba(hex)), o: st(100), r: 1 });
const stroke = (hex: string, w: number) => ({
  ty: "st", nm: "stroke", c: st(rgba(hex)), o: st(100), w: st(w), lc: 2, lj: 2, ml: 4,
});

interface Tr {
  center?: Vec;
  s?: object; // animated scale
  o?: object; // animated opacity
}
function group(nm: string, items: object[], tr: Tr = {}) {
  const c = tr.center ?? [0, 0];
  return {
    ty: "gr",
    nm,
    it: [
      ...items,
      {
        ty: "tr",
        a: st(c),
        p: st(c),
        s: tr.s ?? st([100, 100]),
        r: st(0),
        o: tr.o ?? st(100),
        sk: st(0),
        sa: st(0),
      },
    ],
  };
}

const roundEye = (d: string, shine: string, nm: string, center: Vec, tr: Tr = {}) =>
  group(nm, [group("shine", [...shapes(shine), stroke(C.shine, 1.68536)]), group("pupil", [...shapes(d), fill(C.outline)])], {
    center,
    ...tr,
  });
const arc = (d: string, nm: string, center: Vec, tr: Tr = {}) =>
  group(nm, [...shapes(d), stroke(C.eye, 4)], { center, ...tr });
const heart = (d: string, nm: string, center: Vec, tr: Tr = {}) =>
  group(nm, [...shapes(d), fill(C.heart)], { center, ...tr });

const EYE_L_C: Vec = [30.13, 31];
const EYE_R_C: Vec = [69.13, 31];
const ARC_L_C: Vec = [30.5, 30.7];
const ARC_R_C: Vec = [69.5, 30.7];
const HEART_L_C: Vec = [29.55, 31.2];
const HEART_R_C: Vec = [69.45, 31.2];
const EYES_C: Vec = [49.63, 31];

// ───────────────────────── Body motion ─────────────────────────
interface Body {
  /** [pct, dx, dy] in SVG units */ move?: [number, number, number, Ease?][];
  /** [pct, degrees] */ rotate?: Key[];
  /** [pct, sx, sy] as factors */ scale?: [number, number, number, Ease?][];
}

function bodyLayer(duration: number, body: Body, frames: number) {
  const base: Vec = [PAD + PIVOT[0] * SCALE, PAD + PIVOT[1] * SCALE];
  return {
    ddd: 0, ind: 1, ty: 3, nm: "body (pivot: bottom-centre)", sr: 1, ao: 0, ip: 0, op: frames, st: 0, bm: 0,
    ks: {
      o: st(100),
      a: st([...PIVOT, 0]),
      p: body.move
        ? anim(duration, body.move.map(([t, x, y, e]) => [t, [base[0] + x * SCALE, base[1] + y * SCALE, 0], e]))
        : st([...base, 0]),
      r: body.rotate ? anim(duration, body.rotate) : st(0),
      s: body.scale
        ? anim(duration, body.scale.map(([t, x, y, e]) => [t, [x * 100 * SCALE, y * 100 * SCALE, 100], e]))
        : st([100 * SCALE, 100 * SCALE, 100]),
    },
  };
}

function partLayer(ind: number, nm: string, shapesArr: object[], frames: number) {
  return {
    ddd: 0, ind, ty: 4, nm, sr: 1, ao: 0, ip: 0, op: frames, st: 0, bm: 0, parent: 1,
    ks: { o: st(100), r: st(0), p: st([0, 0, 0]), a: st([0, 0, 0]), s: st([100, 100, 100]) },
    shapes: shapesArr,
  };
}

function build(name: string, duration: number, body: Body, eyes: object[]) {
  const frames = Math.round(duration * FPS);
  return {
    v: "5.12.2", fr: FPS, ip: 0, op: frames, w: W, h: H, nm: `Owlie ${name}`, ddd: 0, assets: [],
    layers: [
      bodyLayer(duration, body, frames),
      partLayer(2, "eyes", eyes, frames),
      partLayer(3, "beak", [group("beak", [...shapes(P.BEAK), stroke(C.outline, 3.07761), fill(C.beak)])], frames),
      partLayer(4, "outline", [group("outline", [...shapes(P.OUTLINE), fill(C.outline)])], frames),
      partLayer(5, "face", [group("face", [...shapes(P.FACE), fill(C.face)])], frames),
    ],
  };
}

// ───────────────────────── KEYFRAMES (mirror owlie.css) ─────────────────────────
const normalEyes = (tr: { l?: Tr; r?: Tr; group?: Tr } = {}) =>
  group("eyes-normal", [
    roundEye(P.EYE_R, P.EYE_R_SHINE, "eye-r", EYE_R_C, tr.r),
    roundEye(P.EYE_L, P.EYE_L_SHINE, "eye-l", EYE_L_C, tr.l),
  ], { center: EYES_C, ...tr.group });

const files: Record<string, object> = {};

// 5. idle: blink every 3.5s (120ms) + 2px float
{
  const D = 3.5;
  const blink = anim(D, [[0, [100, 100], "linear"], [90, [100, 100], "linear"], [91.7, [100, 10], "linear"], [93.4, [100, 100], "linear"], [100, [100, 100]]]);
  files.normal = build("normal", D, { move: [[0, 0, 0], [50, 0, -2], [100, 0, 0]] }, [normalEyes({ l: { s: blink }, r: { s: blink } })]);
}

// 1. wink: hold 1.2s, squash right eye, wink arc ~180ms, reopen (2s)
{
  const D = 2;
  files.wink = build(
    "wink",
    D,
    {
      rotate: [[0, 0, "linear"], [56, 0], [64, -5, "linear"], [74, -5], [84, 0, "linear"], [100, 0]],
      move: [[0, 0, 0, "linear"], [56, 0, 0], [64, 0, -1.4, "linear"], [74, 0, -1.4], [84, 0, 0, "linear"], [100, 0, 0]],
    },
    [
      arc(P.ARC_R, "eyes-wink (right arc)", ARC_R_C, {
        o: anim(D, [[0, 0, "hold"], [64.5, 100, "hold"], [73.6, 0, "hold"], [100, 0]]),
      }),
      normalEyes({
        r: {
          s: anim(D, [[0, [100, 100], "linear"], [60, [100, 100], "linear"], [64.4, [100, 10], "hold"], [73.6, [100, 10], "linear"], [78, [100, 100], "linear"], [100, [100, 100]]]),
          o: anim(D, [[0, 100, "hold"], [64.5, 0, "hold"], [73.6, 100, "hold"], [100, 100]]),
        },
      }),
    ],
  );
}

// 2. happy: bob up 5px + tilt ±6deg (0.75s each way)
{
  const D = 1.5;
  files.happy = build(
    "happy",
    D,
    {
      move: [[0, 0, 0], [25, 0, -5], [50, 0, 0], [75, 0, -5], [100, 0, 0]],
      rotate: [[0, -6], [25, 0], [50, 6], [75, 0], [100, -6]],
    },
    [group("eyes-happy", [arc(P.ARC_R, "eye-r", ARC_R_C), arc(P.ARC_L, "eye-l", ARC_L_C)])],
  );
}

// 3. laugh: 3 fast shakes ±4deg + squash 0.96, then pause (1.2s)
{
  const D = 1.2;
  const sh = [0, 6.25, 12.5, 18.75, 25, 31.25, 37.5];
  files.laugh = build(
    "laugh",
    D,
    {
      rotate: [...sh.map((t, i): Key => [t, i === 0 ? 0 : i % 2 ? -4 : 4]), [45, 0, "linear"], [100, 0]],
      scale: [[0, 1, 1], [6.25, 1, 0.96, "linear"], [37.5, 1, 0.96], [45, 1, 1, "linear"], [100, 1, 1]],
    },
    [group("eyes-laugh", [arc(P.LAUGH_R, "eye-r", [70, 31.25]), arc(P.LAUGH_L, "eye-l", [29, 31.25])])],
  );
}

// 4. love: normal eyes pop into hearts, hearts pulse, soft squash & stretch (3s)
{
  const D = 3;
  const hs = anim(D, [[0, [0, 0], "linear"], [18, [0, 0]], [26, [115, 115]], [32, [100, 100]], [42, [110, 110]], [52, [100, 100]], [62, [110, 110]], [72, [100, 100], "linear"], [80, [100, 100]], [85, [0, 0], "linear"], [100, [0, 0]]]);
  const ho = anim(D, [[0, 0, "hold"], [18, 100, "linear"], [80, 100], [85, 0, "linear"], [100, 0]]);
  files.love = build(
    "love",
    D,
    {
      scale: [[0, 1, 1, "linear"], [17, 1, 1], [23, 1.05, 0.95], [30, 0.97, 1.04], [37, 1, 1], [45, 1.03, 0.97], [55, 1, 1], [65, 1.03, 0.97], [75, 1, 1, "linear"], [100, 1, 1]],
    },
    [
      group("eyes-love", [heart(P.HEART_R, "heart-r", HEART_R_C, { s: hs, o: ho }), heart(P.HEART_L, "heart-l", HEART_L_C, { s: hs, o: ho })]),
      normalEyes({
        group: {
          s: anim(D, [[0, [100, 100], "linear"], [14, [100, 100]], [19, [0, 0], "linear"], [84, [0, 0]], [91, [100, 100], "linear"], [100, [100, 100]]]),
          o: anim(D, [[0, 100, "linear"], [14, 100], [19, 0, "linear"], [84, 0], [91, 100, "linear"], [100, 100]]),
        },
      }),
    ],
  );
}

// ───────────────────────── write ─────────────────────────
const outDir = join(dirname(fileURLToPath(import.meta.url)), "..", "lottie");
mkdirSync(outDir, { recursive: true });
for (const [name, json] of Object.entries(files)) {
  const file = join(outDir, `owlie-${name}.json`);
  writeFileSync(file, JSON.stringify(json));
  console.log(`✓ ${file}`);
}
