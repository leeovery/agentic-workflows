'use strict';

// A completed discussion whose load-bearing page-size claim is false
// against the tree, while the conclusion leaning on it re-derives from
// the corrected value alone. The discussion measured the gateway
// client's page size at 500 and concluded a full-day backfill of
// ~2,000 events is 4 requests — far inside the gateway's 60-per-minute
// limit, so no queued job; in the world as it stands
// src/gateway/client.js pages at 250, so the recorded command
// contradicts the record while the no-queue conclusion re-lands
// mechanically (8 requests, same comfortable margin). Construction
// must verify the claim before extracting it, take the repair tier —
// one-line notify, no stop, no gate — land claim and repaired
// conclusion in the discussion's own document, reindex it, skip the
// sources-stale valve (single-topic), and continue against the
// corrected record — the spec never absorbs the defect.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);

    // The codebase the discussion measured: the gateway client pages
    // capture events at 250 per request.
    h.write('src/gateway/client.js', [
      "'use strict';",
      '',
      "// REST client for the payment gateway's events endpoint.",
      'const PAGE_SIZE = 250;',
      '',
      'async function listCaptureEvents(client, since) {',
      '  const events = [];',
      '  let cursor = null;',
      '  do {',
      "    const page = await client.get('/v1/events', {",
      "      type: 'capture', since, limit: PAGE_SIZE, cursor,",
      '    });',
      '    events.push(...page.data);',
      '    cursor = page.next_cursor;',
      '  } while (cursor);',
      '  return events;',
      '}',
      '',
      'module.exports = { PAGE_SIZE, listCaptureEvents };',
      '',
    ].join('\n'));

    // The completed discussion — template-shaped, with the false
    // measured claim in Event Backfill and the request-count
    // conclusion computed from it (restated in the Key Insights).
    h.engine('topic', 'start', WU, 'discussion', WU);
    h.write(`.workflows/${WU}/discussion/${WU}.md`, [
      '# Discussion: Pay',
      '',
      '## Context',
      '',
      'Accept card payments at checkout using the existing gateway account.',
      '',
      '---',
      '',
      '## Gateway Integration',
      '',
      '### Context',
      'Which account and confirmation path the checkout uses.',
      '',
      '### Decision',
      'Use the existing gateway account — no new provider onboarding.',
      'Capture is confirmed by gateway webhooks; the checkout never polls.',
      '',
      '---',
      '',
      '## Event Backfill',
      '',
      '### Context',
      'Whether recovering missed capture webhooks needs a queued job.',
      '',
      '### Journey',
      'We started assuming a queued backfill worker, then costed what a',
      'worst day actually takes: the gateway client pages capture events',
      "at 500 per request (`grep 'const PAGE_SIZE' src/gateway/client.js`",
      '→ `const PAGE_SIZE = 500;`), and the gateway dashboard puts a heavy',
      'day at roughly 2,000 capture events. That is 4 requests against the',
      "gateway's documented 60-requests-per-minute allowance — nowhere",
      'near enough to justify a worker.',
      '',
      '### Decision',
      'No queued backfill job for v1 — recovery from missed capture',
      'webhooks is a single synchronous pass. At 500 events per page a',
      'full-day backfill of ~2,000 events is 4 requests, far inside the',
      "gateway's 60-requests-per-minute limit. Revisit only if a backfill",
      'ever trips the rate limit.',
      '',
      '---',
      '',
      '## Summary',
      '',
      '### Key Insights',
      "1. The gateway client's 500-per-page batching keeps a full-day",
      '   backfill at 4 requests — the reason recovery needs no queue.',
      '',
      '### Open Threads',
      '- (none)',
      '',
      '### Current State',
      '- Gateway integration and event backfill are both resolved.',
      '',
    ].join('\n'));
    h.engine('commit', WU, '-m', `discussion(${WU}): capture`);
    h.engine('topic', 'complete', WU, 'discussion', WU);
  },
};
