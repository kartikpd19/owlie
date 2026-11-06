import lottie, { type AnimationItem } from "lottie-web";
import { GIFEncoder, applyPalette, quantize } from "gifenc";

type Lottie = { fr: number; ip: number; op: number; w: number; h: number; [k: string]: unknown };

const files = import.meta.glob<{ default: Lottie }>("../lottie/*.json", { eager: true });
const ORDER = ["normal", "wink", "happy", "laugh", "love"] as const;
type Expr = (typeof ORDER)[number];
const source = (name: Expr) => files[`../lottie/owlie-${name}.json`].default;

// ---------- Editable state (mirrored to the URL hash so a link reproduces the design) ----------

const DEFAULT_COLORS = {
  outline: "#151e52",
  face: "#fafafc",
  beak: "#ffcb47",
  eye: "#0c1f42",
  shine: "#eaedef",
  heart: "#f34c6b",
};
type ColorKey = keyof typeof DEFAULT_COLORS;
const COLOR_LABELS: Record<ColorKey, string> = {
  outline: "Outline & pupils",
  face: "Face",
  beak: "Beak",
  eye: "Line eyes",
  shine: "Eye shine",
  heart: "Hearts",
};

type State = {
  colors: Record<ColorKey, string>;
  speed: number;
  bg: string; // "transparent" or a hex colour
  scale: number; // GIF size multiplier
  expr: Expr;
};
const DEFAULTS: State = { colors: { ...DEFAULT_COLORS }, speed: 1, bg: "transparent", scale: 1, expr: "love" };

const isHex = (v: string | null): v is string => !!v && /^#[0-9a-f]{6}$/i.test(v);

function readHash(): State {
  const p = new URLSearchParams(location.hash.slice(1));
  const s: State = structuredClone(DEFAULTS);
  for (const k of Object.keys(DEFAULT_COLORS) as ColorKey[]) {
    const v = p.get(k) && `#${p.get(k)}`;
    if (isHex(v)) s.colors[k] = v.toLowerCase();
  }
  const speed = Number(p.get("speed"));
  if (speed >= 0.25 && speed <= 3) s.speed = speed;
  const bg = p.get("bg");
  if (bg && isHex(`#${bg}`)) s.bg = `#${bg}`;
  if (p.get("size") === "half") s.scale = 0.5;
  const expr = p.get("expr") as Expr;
  if (ORDER.includes(expr)) s.expr = expr;
  return s;
}

function writeHash() {
  const p = new URLSearchParams();
  for (const k of Object.keys(DEFAULT_COLORS) as ColorKey[]) {
    if (state.colors[k] !== DEFAULT_COLORS[k]) p.set(k, state.colors[k].slice(1));
  }
  if (state.speed !== 1) p.set("speed", String(state.speed));
  if (state.bg !== "transparent") p.set("bg", state.bg.slice(1));
  if (state.scale !== 1) p.set("size", "half");
  if (state.expr !== DEFAULTS.expr) p.set("expr", state.expr);
  const hash = p.toString();
  history.replaceState(null, "", hash ? `#${hash}` : location.pathname + location.search);
}

let state = readHash();

// ---------- Build an edited Lottie JSON ----------

const hexToRgba = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).concat(1);
const colorKey = (c: number[]) => c.slice(0, 3).map((v) => Math.round(v * 255)).join(",");
const DEFAULT_BY_RGB = new Map(
  (Object.entries(DEFAULT_COLORS) as [ColorKey, string][]).map(([k, hex]) => [colorKey(hexToRgba(hex)), k]),
);

function build(name: Expr): Lottie {
  const data = structuredClone(source(name));
  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const node = o as { ty?: string; c?: { k?: unknown } };
    if ((node.ty === "fl" || node.ty === "st") && Array.isArray(node.c?.k)) {
      const key = DEFAULT_BY_RGB.get(colorKey(node.c.k as number[]));
      if (key) node.c.k = hexToRgba(state.colors[key]);
    }
    Object.values(o).forEach(walk);
  };
  walk(data.layers);
  data.fr = source(name).fr * state.speed; // keyframes are in frames, so frame rate = speed
  return data;
}

// ---------- GIF export (rendered in the browser from the edited JSON) ----------

const GIF_FPS = 50; // GIF delays are in 1/100s; 50fps is the fastest rate browsers play at true speed

async function makeGif(name: Expr, onProgress: (pct: number) => void): Promise<Blob> {
  const data = build(name);
  const w = Math.round(data.w * state.scale);
  const h = Math.round(data.h * state.scale);
  // Let lottie create its own canvas (a passed-in context is not drawn to in lottie-web 5.13)
  const anim = lottie.loadAnimation({
    container: document.createElement("div"),
    renderer: "canvas",
    loop: false,
    autoplay: false,
    animationData: data,
    rendererSettings: { clearCanvas: true, preserveAspectRatio: "xMidYMid meet" },
  });
  if (!anim.isLoaded) await new Promise((r) => anim.addEventListener("DOMLoaded", r));
  anim.resize(w, h); // the container is detached (0×0), so size the canvas explicitly
  const ctx = (anim as unknown as { renderer: { canvasContext: CanvasRenderingContext2D } }).renderer.canvasContext;

  const transparent = state.bg === "transparent";
  const span = data.op - data.ip;
  const frames = Math.max(1, Math.round((span / data.fr) * GIF_FPS));
  const gif = GIFEncoder();
  try {
    for (let i = 0; i < frames; i++) {
      anim.goToAndStop((i * span) / frames, true);
      if (!transparent) {
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.globalCompositeOperation = "destination-over";
        ctx.fillStyle = state.bg;
        ctx.fillRect(0, 0, w, h);
        ctx.restore();
      }
      const { data: rgba } = ctx.getImageData(0, 0, w, h);
      if (transparent) {
        // One-bit alpha snapped at 50%, same as the pre-rendered GIFs
        const palette = quantize(rgba, 256, { format: "rgba4444", oneBitAlpha: true });
        const index = applyPalette(rgba, palette, "rgba4444");
        const t = palette.findIndex((c) => c[3] === 0);
        gif.writeFrame(index, w, h, { palette, delay: 1000 / GIF_FPS, transparent: t >= 0, transparentIndex: Math.max(t, 0), dispose: 2 });
      } else {
        const palette = quantize(rgba, 256);
        gif.writeFrame(applyPalette(rgba, palette), w, h, { palette, delay: 1000 / GIF_FPS });
      }
      if (i % 5 === 0) {
        onProgress(Math.round((i / frames) * 100));
        await new Promise((r) => setTimeout(r));
      }
    }
  } finally {
    anim.destroy();
  }
  gif.finish();
  return new Blob([gif.bytes() as BlobPart], { type: "image/gif" });
}

// ---------- Downloads ----------

function save(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const downloadJson = (name: Expr) =>
  save(new Blob([JSON.stringify(build(name))], { type: "application/json" }), `owlie-${name}.json`);

const busy = new Set<Expr>();
async function downloadGif(name: Expr) {
  if (busy.has(name)) return;
  busy.add(name);
  const buttons = [...document.querySelectorAll<HTMLButtonElement>(`[data-gif="${name}"]`)];
  const labels = buttons.map((b) => b.textContent);
  buttons.forEach((b) => (b.disabled = true));
  try {
    const blob = await makeGif(name, (pct) => buttons.forEach((b) => (b.textContent = `${pct}%`)));
    save(blob, `owlie-${name}.gif`);
  } finally {
    buttons.forEach((b, i) => {
      b.disabled = false;
      b.textContent = labels[i];
    });
    busy.delete(name);
  }
}

// ---------- UI ----------

const $ = <T extends HTMLElement = HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const colorsEl = $("#colors");
for (const k of Object.keys(DEFAULT_COLORS) as ColorKey[]) {
  const row = document.createElement("label");
  row.className = "color";
  row.innerHTML = `<input type="color" data-color="${k}"><span>${COLOR_LABELS[k]}</span><input type="text" data-hex="${k}" maxlength="7" spellcheck="false">`;
  colorsEl.appendChild(row);
}

const chipsEl = $("#chips");
const grid = $("#grid");
for (const name of ORDER) {
  const chip = document.createElement("button");
  chip.className = "chip";
  chip.dataset.expr = name;
  chip.textContent = name;
  chipsEl.appendChild(chip);

  const card = document.createElement("div");
  card.className = "card";
  card.dataset.expr = name;
  card.innerHTML =
    `<div class="player"></div><code>owlie-${name}</code>` +
    `<div class="row"><button class="btn" data-json="${name}">JSON</button>` +
    `<button class="btn" data-gif="${name}">GIF</button></div>`;
  grid.appendChild(card);
}

const players = new Map<HTMLElement, AnimationItem>();
(window as unknown as { owlie: typeof players }).owlie = players;

function mount(el: HTMLElement, name: Expr) {
  players.get(el)?.destroy();
  players.set(
    el,
    lottie.loadAnimation({ container: el, renderer: "svg", loop: true, autoplay: true, animationData: build(name) }),
  );
}

function renderPlayers() {
  mount($("#stage"), state.expr);
  document.querySelectorAll<HTMLElement>(".card").forEach((card) => mount(card.querySelector(".player")!, card.dataset.expr as Expr));
}

function syncControls() {
  for (const k of Object.keys(DEFAULT_COLORS) as ColorKey[]) {
    $<HTMLInputElement>(`[data-color="${k}"]`).value = state.colors[k];
    const hex = $<HTMLInputElement>(`[data-hex="${k}"]`);
    if (document.activeElement !== hex) hex.value = state.colors[k];
  }
  $<HTMLInputElement>("#speed").value = String(state.speed);
  $("#speed-value").textContent = `${state.speed.toFixed(2).replace(/\.?0+$/, "")}×`;
  const solid = state.bg !== "transparent";
  $<HTMLInputElement>(`input[name="bg"][value="${solid ? "solid" : "transparent"}"]`).checked = true;
  $<HTMLInputElement>("#bg-color").disabled = !solid;
  if (solid) $<HTMLInputElement>("#bg-color").value = state.bg;
  $<HTMLSelectElement>("#size").value = String(state.scale);
  const w = Math.round(480 * state.scale), h = Math.round(352 * state.scale);
  $("#size-note").textContent = `${w}×${h}, ${GIF_FPS}fps, loops forever`;
  document.querySelectorAll<HTMLElement>("[data-expr]").forEach((el) => el.classList.toggle("is-active", el.dataset.expr === state.expr));
  $("#selected").textContent = state.expr;
  $("#stage-wrap").style.background = solid ? state.bg : "";
  $("#stage-wrap").classList.toggle("checker", !solid);
  $<HTMLButtonElement>("#dl-json").dataset.json = state.expr;
  $<HTMLButtonElement>("#dl-gif").dataset.gif = state.expr;
}

let frame = 0;
function update(rebuild = true) {
  writeHash();
  syncControls();
  if (!rebuild) return;
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(renderPlayers);
}

document.addEventListener("input", (e) => {
  const t = e.target as HTMLInputElement;
  if (t.dataset.color) {
    state.colors[t.dataset.color as ColorKey] = t.value;
    update();
  } else if (t.dataset.hex) {
    const v = (t.value.startsWith("#") ? t.value : `#${t.value}`).toLowerCase();
    if (isHex(v)) {
      state.colors[t.dataset.hex as ColorKey] = v;
      update();
    }
  } else if (t.id === "speed") {
    state.speed = Number(t.value);
    update();
  } else if (t.name === "bg") {
    state.bg = t.value === "solid" ? $<HTMLInputElement>("#bg-color").value : "transparent";
    update(false);
  } else if (t.id === "bg-color") {
    state.bg = t.value;
    update(false);
  } else if (t.id === "size") {
    state.scale = Number(t.value);
    update(false);
  }
});

document.addEventListener("click", (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>("button, .card");
  if (!t) return;
  if (t.dataset.json) return downloadJson(t.dataset.json as Expr);
  if (t.dataset.gif) return void downloadGif(t.dataset.gif as Expr);
  if (t.id === "reset") {
    state = structuredClone({ ...DEFAULTS, expr: state.expr });
    return update();
  }
  if (t.id === "copy-link") {
    navigator.clipboard?.writeText(location.href).then(() => {
      t.textContent = "Link copied";
      setTimeout(() => (t.textContent = "Copy link"), 1500);
    });
    return;
  }
  if (t.dataset.expr && state.expr !== t.dataset.expr) {
    state.expr = t.dataset.expr as Expr;
    syncControls();
    writeHash();
    mount($("#stage"), state.expr);
  }
});

window.addEventListener("hashchange", () => {
  state = readHash();
  update();
});

syncControls();
renderPlayers();
