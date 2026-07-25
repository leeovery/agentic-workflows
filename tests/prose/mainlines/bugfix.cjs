'use strict';

// The canonical bugfix mainline — `crash-fix`, a checkout crash — as
// staged builders each fixture recipe composes a prefix of. Engine calls
// follow the sequences the skill prose prescribes; content files are the
// artifacts a real run leaves, in the shape downstream prose reads
// (investigation file per workflow-investigation-process/references/
// template.md).
//
// Dates are literals matching the frozen recipe clock (2026-01-01).

const WU = 'crash-fix';

function init(h) {
  h.knowledge('setup', '--keyword-only');
  h.engine('boot');
}

function create(h) {
  // Shape per workflow-discovery/references/template.md: bugfix discovery
  // captures brief intent; Exploration is backfilled at creation.
  const log = `.workflows/${WU}/discovery/sessions/session-001.md`;
  h.write(log, [
    '# Discovery Session 001',
    '',
    'Date: 2026-01-01',
    `Work unit: ${WU}`,
    '',
    '## Description (as of session)',
    '',
    'Checkout crashes when an order has no shipping address.',
    '',
    '## Seed',
    '',
    '(none)',
    '',
    '## Imports',
    '',
    '(none)',
    '',
    '## Map State at Start',
    '',
    '(n/a — single-topic work)',
    '',
    '## Exploration',
    '',
    'Reported by two users this week: the checkout page 500s at the',
    'payment step for orders with no shipping address. Reproducible on',
    'staging with a digital-only basket. No error surfaces to the user —',
    'the page just fails. Confirmed as a bugfix; no design question here,',
    'so it routes straight to investigation.',
    '',
    '## Edits',
    '',
    '(none)',
    '',
    '## Topics Identified',
    '',
    '(none)',
    '',
    '## Conclusion',
    '',
    '(none)',
    '',
  ].join('\n'));
  h.engine('workunit', 'create', WU, 'bugfix',
    '--description', 'Checkout crashes when an order has no shipping address',
    '--session-log-file', log);
}

/** The investigation file as it stands with the root cause documented. */
function investigationFile() {
  return [
    '# Investigation: Checkout Crash On Missing Shipping Address',
    '',
    '## Symptoms',
    '',
    '### Problem Description',
    '',
    'Checkout returns a 500 at the payment step when the order has no',
    'shipping address. No error is surfaced to the user.',
    '',
    '### Manifestation',
    '',
    'Server error on POST to the payment step; the page fails blank.',
    '',
    '### Reproduction Steps',
    '',
    '1. Add a digital-only product to the basket.',
    '2. Proceed to checkout without entering a shipping address.',
    '3. Continue to the payment step — the request 500s.',
    '',
    '### Environment',
    '',
    'Reproduced on staging; reported twice in production this week.',
    '',
    '### Impact',
    '',
    'Digital-only orders cannot complete checkout.',
    '',
    '### References',
    '',
    '(none)',
    '',
    '## Analysis',
    '',
    '### Hypotheses',
    '',
    '- The payment step assumes a shipping address is always present.',
    '- Tax calculation may be the first consumer of the missing address.',
    '',
    '### Code Trace',
    '',
    'The payment step builds a tax context from the order before creating',
    'the payment intent. The tax context reads the shipping address',
    'unconditionally; for a digital-only order the address is absent, so',
    'the read fails and the request aborts before any handler catches it.',
    '',
    '### Root Cause',
    '',
    'The tax context treats the shipping address as mandatory. Digital-only',
    'orders legitimately have none, so the assumption is wrong rather than',
    'the data being wrong.',
    '',
    '### Contributing Factors',
    '',
    'Digital-only baskets were introduced after the tax context was written.',
    '',
    "### Why It Wasn't Caught",
    '',
    'No test covers a basket with no shippable line items.',
    '',
    '### Blast Radius',
    '',
    'Any flow building a tax context from an address-less order.',
    '',
    '## Fix Direction',
    '',
    '### Chosen Approach',
    '',
    '(pending)',
    '',
    '### Options Explored',
    '',
    '(none yet)',
    '',
    '### Discussion',
    '',
    '(none yet)',
    '',
    '### Testing Recommendations',
    '',
    '(pending)',
    '',
    '### Risk Assessment',
    '',
    '(pending)',
    '',
    '## Notes',
    '',
    '(none)',
    '',
  ].join('\n');
}

/**
 * Investigation open with the root cause documented — the state the
 * process reaches just before its root-cause validation step.
 */
function investigateToRootCause(h) {
  h.write(`.workflows/${WU}/investigation/${WU}.md`, investigationFile());
  h.engine('topic', 'start', WU, 'investigation', WU);
  h.engine('commit', WU, '-m', `investigation(${WU}): symptoms and root cause`);
}

/** Fix direction settled and the phase concluded. */
function concludeInvestigation(h) {
  h.write(`.workflows/${WU}/investigation/${WU}.md`, investigationFile()
    .replace('### Chosen Approach\n\n(pending)',
      ['### Chosen Approach',
        '',
        'Make the tax context treat the shipping address as optional: when',
        'an order has no shippable items, build the context from the billing',
        'address instead.',
      ].join('\n'))
    .replace('### Testing Recommendations\n\n(pending)',
      ['### Testing Recommendations',
        '',
        'Cover a digital-only basket end to end through the payment step.',
      ].join('\n'))
    .replace('### Risk Assessment\n\n(pending)',
      ['### Risk Assessment',
        '',
        'Low — the change is confined to tax-context construction.',
      ].join('\n')));
  h.engine('commit', WU, '-m', `investigation(${WU}): fix direction`);
  h.engine('topic', 'complete', WU, 'investigation', WU);
}

module.exports = { WU, init, create, investigateToRootCause, concludeInvestigation };
