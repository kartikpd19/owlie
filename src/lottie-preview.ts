import lottie from "lottie-web";

const files = import.meta.glob<{ default: object }>("../lottie/*.json", { eager: true });
const urls = import.meta.glob<string>("../lottie/*.json", { eager: true, query: "?url", import: "default" });
const gifs = import.meta.glob<string>("../gifs/*.gif", { eager: true, query: "?url", import: "default" });
const order = ["normal", "wink", "happy", "laugh", "love"];
const players: Record<string, ReturnType<typeof lottie.loadAnimation>> = {};
(window as unknown as { owlie: typeof players }).owlie = players;
const grid = document.getElementById("grid")!;

for (const name of order) {
  const key = `../lottie/owlie-${name}.json`;
  const data = files[key]?.default;
  if (!data) continue;

  const card = document.createElement("div");
  card.className = "card";
  const gif = gifs[`../gifs/owlie-${name}.gif`];
  card.innerHTML =
    `<div class="player"></div><code>owlie-${name}</code>` +
    `<div class="row"><a class="btn" download="owlie-${name}.json" href="${urls[key]}">JSON</a>` +
    (gif ? `<a class="btn" download="owlie-${name}.gif" href="${gif}">GIF</a>` : "") +
    `</div>`;
  grid.appendChild(card);

  players[name] = lottie.loadAnimation({
    container: card.querySelector(".player")!,
    renderer: "svg",
    loop: true,
    autoplay: true,
    animationData: structuredClone(data),
  });
}
