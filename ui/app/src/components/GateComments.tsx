// Phase 6 §5 — the comment thread on a gate (or artifact), with ceremony.
// Comments never push. A quote affordance inserts a comment into the owner's
// answer draft — the bridge never injects bystander text implicitly, so the
// quote is an explicit, per-comment act by the person answering.
import { useState } from 'react';
import { api, useLive, type CommentData } from '../api';

export function GateComments({
  target,
  onQuote,
  onOpened,
}: {
  target: { gateId?: string; artifact?: string };
  onQuote?: (body: string) => void;
  onOpened?: () => void;
}) {
  const { data, reload } = useLive(() => api.comments(target), [target.gateId, target.artifact]);
  const [draft, setDraft] = useState('');
  const comments = data?.comments ?? [];

  const post = async () => {
    if (draft.trim() === '') return;
    await api.addComment(target, draft.trim());
    setDraft('');
    reload();
  };

  return (
    <div data-testid="gate-comments" className="mt-2 border-t border-stone-200 dark:border-stone-800 pt-2">
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {comments.length === 0 && <p className="text-xs font-sans text-stone-400">No comments yet.</p>}
        {comments.map((c: CommentData) => (
          <div key={c.id} className="text-sm font-sans flex items-start gap-2">
            {/* Unread dot is list chrome, not a confirm control — gold stays
                reserved for gates (rounds 5/7). Warn amber marks the unread. */}
            <span className={`shrink-0 w-1.5 h-1.5 mt-1.5 rounded-full ${c.read ? 'bg-stone-300 dark:bg-stone-700' : 'bg-warn'}`} />
            <div className="flex-1">
              <span className="font-medium text-stone-700 dark:text-stone-300">{c.author}</span>{' '}
              <span className="font-serif text-stone-700 dark:text-stone-300">{c.body}</span>
              {onQuote && (
                <button
                  className="ml-2 text-[11px] text-nav hover:underline"
                  onClick={() => onQuote(`> ${c.author}: ${c.body}\n\n`)}
                >
                  quote
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && post()}
          onFocus={onOpened}
          placeholder="add a comment (never pushes)…"
          className="flex-1 rounded border border-stone-300 dark:border-stone-700 bg-transparent px-2 py-1 text-xs font-sans focus:outline-none focus:border-gate"
        />
        <button onClick={post} disabled={draft.trim() === ''} className="rounded px-2 py-1 text-xs font-sans bg-stone-200 dark:bg-stone-800 disabled:opacity-40">
          comment
        </button>
      </div>
    </div>
  );
}
