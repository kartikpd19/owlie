import { Fragment } from "react";
import { Owlie, type OwlieExpression, type OwlieSize } from "./Owlie";

type HeadingTag = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";

export interface InlineHeadlineProps {
  /** Text containing a `{owlie}` token, e.g. "Trade {owlie} with friends". */
  text: string;
  expression?: OwlieExpression;
  size?: OwlieSize;
  as?: HeadingTag;
  className?: string;
}

const TOKEN = "{owlie}";

/**
 * Renders a heading and swaps each `{owlie}` token for an inline mascot.
 * The mascot is aria-hidden, so screen readers read only the text.
 */
export const InlineHeadline: React.FC<InlineHeadlineProps> = ({
  text,
  expression = "normal",
  size = "auto",
  as: Tag = "h2",
  className,
}) => {
  const parts = text.split(TOKEN);
  return (
    <Tag className={className}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && <Owlie expression={expression} size={size} />}
        </Fragment>
      ))}
    </Tag>
  );
};
