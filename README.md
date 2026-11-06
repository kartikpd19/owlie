# Owlie: inline animated mascot

**Live demo:** https://kartikpd19.github.io/owlie/ · **Lottie preview:** https://kartikpd19.github.io/owlie/lottie.html

Owlie sits inside headlines like an emoji and plays a short looping expression while its headline is on screen.

```tsx
import { InlineHeadline, Owlie } from "./owlie";

<InlineHeadline as="h1" text="Learn smarter {owlie} every day" expression="wink" />
<Owlie expression="love" size="md" />
```

| Prop | Values | Default |
|---|---|---|
| `expression` | `normal` · `wink` · `happy` · `laugh` · `love` | `normal` |
| `size` | `auto` (scales with font, ~1.5× cap height) · `lg` 100×68 · `md` 76×52 · `sm` 44×30 | `auto` |
| `playing` | `true` / `false` to override; leave it out to play while the nearest heading is ≥50% in view | (auto) |

- Run the demo: `npm install && npm run dev`
- Build: `npm run build`

How it works:

- **One SVG.** The face, outline and beak never change. Expressions only toggle the `#eyes-*` groups, using opacity and scale, so the body never flickers.
- **No layout shift.** The animated layer is absolutely positioned inside a fixed-size inline-block, so motion can overflow without moving the text.
- **Accessible.** The mascot is `aria-hidden` with `pointer-events: none`. Screen readers read only the headline text. With `prefers-reduced-motion`, each expression shows as a still pose.
- **Fast.** Only `transform` and `opacity` are animated.
- **Theming.** Set `--owlie-outline`, `--owlie-face`, `--owlie-beak`, `--owlie-eye` or `--owlie-heart` on any parent.

## Lottie JSON files

`lottie/owlie-<expression>.json` holds one looping Lottie animation per expression: `normal`, `wink`, `happy`, `laugh` and `love`. They play in lottie-web, LottieFiles, iOS/Android Lottie, Framer, Webflow and After Effects (via Bodymovin import).

- **Canvas:** 480×352 at 60fps. The face is 400×272 with 40px padding on each side, so tilts and bobs aren't clipped. To place it inline the way the CSS version does, size the player 1.2× wider and 1.29× taller than the face and offset it by the padding.
- **Loop lengths:** normal 3.5s, wink 2s, happy 1.5s, laugh 1.2s, love 3s.
- **Layers:** `body` is a null layer whose pivot is the bottom-centre of the face, and all motion lives on it. The `eyes`, `beak`, `outline` and `face` layers are parented to it.
- **Regenerate:** `npm run lottie` rebuilds every file from `src/owlie/paths.ts` and the keyframes in `scripts/build-lottie.ts`. Edit the numbers there to adjust timing.
- **Preview:** `npm run dev`, then open http://localhost:5173/lottie.html.

The Lottie files don't include the scroll-into-view or reduced-motion behaviour. The player that hosts them handles that: call `play()` or `pause()` from an IntersectionObserver, and use `goToAndStop(0)` for reduced motion.

## GIF files

`gifs/owlie-<expression>.gif`: 480×352, 50fps, infinite loop, **transparent background**, 330 KB–1 MB each. They're rendered from the Lottie files, so they match exactly.

GIF transparency is all-or-nothing per pixel, so the soft edge is snapped at 50% opacity. Owlie's outermost edge is the dark navy outline, so there's no white halo on dark or coloured backgrounds.

- **Regenerate:** `npm run lottie && npm run gifs`. Rendering uses Remotion, with the compositions in `remotion/Root.tsx`.
- **Solid background instead:** `npm run gifs -- --bg=#f4f2fb`. This gives smoother edges and smaller files when you know the page colour.
- **Why 50fps:** GIF frame delays are stored in 1/100s, and browsers slow down any delay shorter than 2/100s. 50fps is the smoothest rate that plays at true speed everywhere.

## Adding a new expression (example: `sleepy`)

1. **Eyes.** In `src/owlie/Owlie.tsx`, add a group next to the others:
   ```tsx
   <g id={id("eyes-sleepy")} className="owlie__eyes owlie__eyes--sleepy owlie__stroke-eyes">
     <path d="M23 31 H38" />
     <path d="M62 31 H77" />
   </g>
   ```
   Use the same `viewBox 0 0 100 68`. The left eye is centred near (30, 31) and the right eye near (69, 31).
2. **Type.** Add `"sleepy"` to the `OwlieExpression` union.
3. **Static pose.** In `owlie.css`, add `.owlie[data-expression="sleepy"] .owlie__eyes--sleepy` to the "Static expressions" selector list.
4. **Motion.** Inside the `prefers-reduced-motion: no-preference` block, add:
   ```css
   .owlie[data-expression="sleepy"] .owlie__body {
     animation: owlie-sleepy 3s ease-in-out infinite;
   }
   @keyframes owlie-sleepy {
     0%, 100% { transform: rotate(0deg); }
     50%      { transform: rotate(8deg) translateY(3%); }
   }
   ```
   Animate `transform` and `opacity` only. Anything inside `.owlie__body` pauses automatically when the headline is offscreen.
