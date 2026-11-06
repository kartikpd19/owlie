import { InlineHeadline, Owlie, type OwlieExpression } from "./owlie";

const SECTIONS: {
  expression: OwlieExpression;
  tag: "h1" | "h2";
  text: string;
  body: string;
}[] = [
  {
    expression: "wink",
    tag: "h1",
    text: "Learn smarter {owlie} every day",
    body: "Wink: holds on Normal, squashes the right eye shut for ~180ms, then reopens. 2s loop.",
  },
  {
    expression: "happy",
    tag: "h2",
    text: "Study with {owlie} your friends",
    body: "Happy: ^^ eyes. Bobs up 5px and tilts ±6° on a 0.75s ease-in-out loop.",
  },
  {
    expression: "laugh",
    tag: "h2",
    text: "Make mistakes {owlie} and laugh",
    body: "Laugh: > < eyes. Three quick ±4° shakes with a tiny squash, then a pause. 1.2s loop.",
  },
  {
    expression: "love",
    tag: "h2",
    text: "Fall in love {owlie} with learning",
    body: "Love: Normal eyes pop into hearts (0 → 1.15 → 1). The hearts pulse while the face squashes and stretches. 3s loop.",
  },
  {
    expression: "normal",
    tag: "h2",
    text: "Owlie is {owlie} always here",
    body: "Idle: slow blink every 3.5s plus a 2px float.",
  },
];

const ALL: OwlieExpression[] = ["normal", "wink", "happy", "laugh", "love"];

export const App: React.FC = () => (
  <main>
    <a className="demo-editor-link" href="./lottie.html">
      Edit colours &amp; download GIF / JSON →
    </a>
    {SECTIONS.map((s, i) => (
      <section
        key={s.expression}
        className={`demo-section demo-section--${i % 2 ? "alt" : "base"}`}
      >
        <p className="demo-label">
          {String(i + 1).padStart(2, "0")} · {s.expression}
        </p>
        <InlineHeadline
          as={s.tag}
          text={s.text}
          expression={s.expression}
          className="demo-headline"
        />
        <p className="demo-body">{s.body}</p>
      </section>
    ))}

    <section className="demo-section demo-section--base">
      <p className="demo-label">Sizes · lg / md / sm</p>
      <div className="demo-grid">
        {ALL.map((e) => (
          <div key={e} className="demo-cell">
            <div className="demo-sizes">
              <Owlie expression={e} size="lg" playing />
              <Owlie expression={e} size="md" playing />
              <Owlie expression={e} size="sm" playing />
            </div>
            <code>{e}</code>
          </div>
        ))}
      </div>
    </section>
  </main>
);
