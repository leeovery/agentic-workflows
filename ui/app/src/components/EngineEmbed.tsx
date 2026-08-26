// EngineEmbed (catalog: P1, N2) — the engine's render verbatim,
// terminal-framed, width-pinned, never restyled. Deliberately unstyled beyond
// the frame: the anti-drift mechanism. Identity with the terminal is modulo
// width — canonical at the pinned width.
export function EngineEmbed({ text, label }: { text: string; label?: string }) {
  return (
    <figure className="my-0">
      {label && <figcaption className="region-label mb-1">{label}</figcaption>}
      <pre className="engine-embed" data-testid="engine-embed">
        {text}
      </pre>
    </figure>
  );
}
