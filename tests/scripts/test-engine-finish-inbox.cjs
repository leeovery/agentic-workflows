'use strict';

// ---------------------------------------------------------------------------
// Finish's inbox item (leeway-engine/scripts/domain/finish-checks.cjs,
// domain/inbox.cjs's `liveResolved` and `closedBy`; 6.4.10, 18.6.4, 18.6.7):
// no item a Resolved: line of the build's log claims left live (18.S24),
// each claim read only on a line of its own, and the screen listing the
// inbox items the unit closed, an item brought back after the close holding
// finish again.
//
// Layer: verb. World: review-world.cjs's, copied for each test.
// ---------------------------------------------------------------------------

require('./hermetic-env.cjs');

const { describe, it } = require('node:test');
const fs = require('fs');
const { sectionOf, layout, commitAll } = require('./engine-harness.cjs');
const { UNIT, useWorld, env, reviewPassed, finishClosed, writeState, statePath, ok, assert } = require('./review-world.cjs');
const { finishHelpers } = require('./finish-world.cjs');

/** @type {string} */
let dir;
useWorld((at) => { dir = at; });
const { screen, refused, items } = finishHelpers(() => dir);

describe('the resolved inbox items closed (6.4.10, 18.6.4, 18.6.7)', () => {
  /** Inbox items written and committed in one commit, each `[folder, file, title]`: their paths, absolute. @param {string[][]} specs */
  const inbox = (...specs) => {
    for (const [folder, file, title] of specs) writeState(dir, layout.inbox(folder, file), `# ${title}\n\nSeen while paying.\n`);
    commitAll(dir, 'inbox');
    return specs.map(([folder, file]) => statePath(dir, layout.inbox(folder, file)));
  };

  /** The build's log written and committed. @param {string[]} lines */
  const logged = (...lines) => {
    writeState(dir, layout.unit(UNIT, 'build', 'log.md'), `# The build\n\n${lines.join('\n')}\n`);
    commitAll(dir, 'the build\'s log');
  };

  /** Finish's inbox item, as `items` draws it. */
  const inboxItem = () => items()[2];

  /** The way on over the claimed items still live. @param {string[]} live */
  const claimed = (live) => `inbox-closed engine open — the build's log claims ${live.join(', ')} resolved, still in the inbox — close each the work resolved: inbox close ${UNIT} <path> …; where the work did not resolve one after all, take its Resolved: line out of the log`;

  it('18.S24: holds finish open while an item a Resolved: line of the build\'s log claims is live, naming each and the close; the two the work resolved closed for the unit, one triage archived meanwhile, and one the log mentions without a claim left live — the screen then lists the unit\'s two closures, and none another unit or none closed; one brought back after the close holds finish again, the way on taking its claim out of the log, and finish stands once the claim is out', () => {
    const [declined, ...rest] = inbox(
      ['bugs', '2026-06-01--a-card-is-charged-twice.md', 'A Card Is Charged Twice'],
      ['bugs', '2026-06-02--a-refund-names-no-card.md', 'A Refund Names No Card'],
      ['ideas', '2026-06-03--receipts-by-mail.md', 'Receipts By Mail'],
      ['ideas', '2026-06-04--pay-by-phone.md', 'Pay By Phone'],
      ['quickfixes', '2026-06-05--rename-the-pay-button.md', 'Rename The Pay Button'],
      ['bugs', '2026-06-06--the-totals-drift.md', 'The Totals Drift'],
    );
    const [resolved, mentioned, elsewhere] = [rest.slice(0, 2), rest[2], rest.slice(3)];
    reviewPassed();
    const [receipts, prose] = ['Resolved: .leeway/.inbox/ideas/2026-06-03--receipts-by-mail.md', `Paying by phone, ${mentioned}, was captured for later.`];
    logged(`Resolved: ${resolved[0]}`, receipts, `Resolved: ${declined}`, '', prose);
    ok(dir, ['inbox', 'archive', declined], { env: env() });
    const open = inboxItem();
    const closed = ok(dir, ['inbox', 'close', UNIT, ...resolved], { env: env() });
    ok(dir, ['inbox', 'close', 'none', elsewhere[0]], { env: env() });
    ok(dir, ['inbox', 'close', 'half', elsewhere[1]], { env: env() });
    const done = inboxItem();
    finishClosed();

    assert.deepStrictEqual([open, closed.unit, done, fs.existsSync(mentioned)], [claimed(resolved), UNIT, 'inbox-closed engine done', true]);
    assert.strictEqual(sectionOf(screen(), 'DISPLAY: finish'), [
      'Pay — finish',
      '',
      'CLOSED IN THE INBOX (2)',
      '  ├─ A Refund Names No Card    [bug]',
      '  └─ Receipts By Mail          [idea]',
      '  ↳ Each is archived as closed by Pay. One closed wrongly comes',
      '    back from the archived items in triage, or ask me to bring it',
      '    back — its Resolved: line taken out of the build\'s log with',
      '    it.',
      '',
      '  ⚑ Skipped at phase 1\'s start: shared design settled — One task',
      '    alone.',
      '',
    ].join('\n'));
    ok(dir, ['inbox', 'restore', closed.closed[0]], { env: env() });
    const held = [inboxItem(), refused(['render', 'finish', UNIT])];
    logged(receipts, `Resolved: ${declined}`, '', prose);

    assert.deepStrictEqual(held, [claimed([resolved[0]]), 'render finish: finish has items open since its close: inbox-closed — they are worked, and it is closed again']);
    assert.match(sectionOf(screen(), 'DISPLAY: finish'), /^Pay — finish\n\nCLOSED IN THE INBOX \(1\)\n  └─ Receipts By Mail /);
  });

  it('reads a claim only on a line of its own, opening Resolved:, its path in any form read from .inbox/ on — absolute, from the project, backticked, a link, punctuation after it — once each; a mention anywhere else claims nothing', () => {
    const paths = inbox(
      ['bugs', '2026-06-01--a.md', 'A'], ['ideas', '2026-06-02--b.md', 'B'], ['bugs', '2026-06-03--c.md', 'C'],
      ['quickfixes', '2026-06-04--d.md', 'D'], ['ideas', '2026-06-05--e.md', 'E'], ['bugs', '2026-06-06--f.md', 'F'], ['ideas', '2026-06-07--g.md', 'G'],
    );
    logged(
      `Resolved: ${paths[0]}`,
      'Resolved: .leeway/.inbox/ideas/2026-06-02--b.md',
      'Resolved: `.inbox/bugs/2026-06-03--c.md`',
      'Resolved: [D](.leeway/.inbox/quickfixes/2026-06-04--d.md)',
      'Resolved: .inbox/ideas/2026-06-05--e.md.',
      `Resolved: ${paths[0]}`,
      `Phase 1 left ${paths[5]} for the next.`,
      '- Resolved: .inbox/ideas/2026-06-07--g.md',
    );

    assert.strictEqual(inboxItem(), claimed(paths.slice(0, 5)));
  });
});
