/**
 * Renders lottie/owlie-<expression>.json → gifs/owlie-<expression>.gif
 * using the Remotion compositions in remotion/Root.tsx ("Owlie-<expression>").
 *
 *   npm run gifs                   transparent background (default)
 *   npm run gifs -- --bg=#f4f2fb   solid background colour instead
 *
 * Frames are rendered as PNGs, then encoded with ffmpeg using a single optimised palette.
 * GIF transparency is 1-bit, so edge pixels are snapped to opaque/transparent at 50% alpha.
 */
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "gifs");
mkdirSync(outDir, { recursive: true });

const bg = process.argv.find((a) => a.startsWith("--bg="))?.slice(5) ?? "transparent";
const transparent = bg === "transparent";
const props = JSON.stringify({ backgroundColor: bg }).replace(/"/g, '\\"');
const FPS = 50;
const run = (cmd: string) => execSync(cmd, { cwd: root, stdio: ["ignore", "ignore", "inherit"] });

for (const name of ["normal", "wink", "happy", "laugh", "love"]) {
  const frames = mkdtempSync(join(tmpdir(), `owlie-${name}-`));
  const out = join(outDir, `owlie-${name}.gif`);
  try {
    run(
      `npx remotion render Owlie-${name} "${frames}" --sequence --image-format=png ` +
        `--image-sequence-pattern="f-[frame].[ext]" --props="${props}" --log=error`,
    );
    const first = readdirSync(frames).filter((f) => f.endsWith(".png")).sort()[0];
    const digits = first.match(/f-(\d+)\.png/)![1].length;
    const filter = transparent
      ? "split[a][b];[a]palettegen=max_colors=128:stats_mode=full:reserve_transparent=1[p];" +
        "[b][p]paletteuse=dither=none:alpha_threshold=128"
      : "split[a][b];[a]palettegen=max_colors=128:stats_mode=full:reserve_transparent=0[p];" +
        "[b][p]paletteuse=dither=none:diff_mode=rectangle";
    // With transparency, every frame is stored whole and cleared before the next one,
    // otherwise pixels Owlie moves away from would leave trails.
    const gifFlags = transparent ? "-gifflags -offsetting-transdiff" : "";
    run(
      `npx remotion ffmpeg -v error -y -framerate ${FPS} -i "${join(frames, `f-%0${digits}d.png`)}" ` +
        `-vf "${filter}" ${gifFlags} -loop 0 "${out}"`,
    );
    console.log(`✓ ${out}`);
  } finally {
    rmSync(frames, { recursive: true, force: true });
  }
}
