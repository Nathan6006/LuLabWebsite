import SplitText from './reactbits/SplitText';

/**
 * The home page masthead, revealed word by word on first paint.
 *
 * Tuned well down from the React Bits defaults: words rather than characters,
 * a short stagger, a small rise and no rotation. A per-character tumble would
 * read as a product launch; this reads as a page settling into place. GSAP's
 * SplitText keeps the original string on the parent as an aria-label, so the
 * split pieces never reach a screen reader.
 */
export default function HeroTitle({ text, className = '' }: { text: string; className?: string }) {
  return (
    <SplitText
      text={text}
      tag="h1"
      className={className}
      splitType="words"
      delay={48}
      duration={0.62}
      ease="power3.out"
      from={{ opacity: 0, y: 34 }}
      to={{ opacity: 1, y: 0 }}
      threshold={0}
      rootMargin="0px"
      textAlign="left"
    />
  );
}
