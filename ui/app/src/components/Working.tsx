// A calm working indicator — shown ONLY while a turn the user just triggered is
// in flight (an answer/reply awaits the session's response, often many seconds).
// This is a deliberate, scoped exception to the codebase's "no spinner theatre"
// motion rule (which governs AMBIENT surfaces): here the motion is transient
// feedback for a synchronous action the human initiated, gone the moment the
// response lands — not an attention-grab. Requested explicitly.
export function Working({ label = 'working…' }: { label?: string }) {
  return (
    <span
      data-testid="working"
      role="status"
      aria-live="polite"
      className="inline-flex items-center gap-2 text-xs font-sans text-stone-500"
    >
      <span className="inline-block w-3 h-3 rounded-full border-2 border-stone-300 dark:border-stone-700 border-t-nav dark:border-t-nav animate-spin" />
      {label}
    </span>
  );
}
