'use strict';

// The pay feature routed through research: three open threads on the
// register, none dug, the file holding what the first sitting
// established. The feature mainline's create leaves a carrier that routed
// straight to discussion; this fixture's shaping routed through research
// instead, so the discovery log's Exploration is rewritten to say why —
// the same log the entry skill reads to decide whether a carrier exists.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;

function discoveryLog() {
  return [
    '# Discovery Session 001',
    '',
    'Date: 2026-01-01',
    `Work unit: ${WU}`,
    '',
    '## Description (as of session)',
    '',
    'Accept card payments at checkout.',
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
    'Shaped as a single feature: accept card payments at checkout using',
    'the existing gateway account. Card-only for v1 came up early and was',
    'softly agreed; wallet support was noted as a likely deferral. Nobody',
    'in the room knew whether the existing account supports hosted card',
    'fields, what strong customer authentication would add to the',
    'checkout in the shop\'s markets, or whether a second provider is',
    'worth pricing as a fallback for declines — so the work routes',
    'through research before any of that is decided.',
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
  ].join('\n');
}

function researchFile() {
  return [
    '# Research: Pay',
    '',
    'Accept card payments at checkout using the existing gateway account.',
    'Card-only for v1; what the existing account can and cannot do at the',
    'checkout is what this research explores before anything is decided.',
    '',
    '## Starting Point',
    '',
    'What we knew going in:',
    '- The shop already holds a gateway account; it is the assumed home',
    '  for card payments.',
    '- Card-only for v1 — wallet support was set aside when the work was',
    '  shaped.',
    '- Nobody knew whether the account supports hosted card fields, what',
    '  strong customer authentication adds to the checkout, or whether a',
    '  second provider is worth pricing.',
    '',
    '---',
    '',
    '## Gateway Capabilities',
    '',
    'The existing account exposes a tokenisation API: the browser posts',
    'card details to the gateway and gets a single-use token back, so our',
    'servers hold a token and never a card number. Whether the account',
    'also offers hosted card fields — the gateway rendering the card',
    'inputs inside our page, so the details never pass through our',
    'front-end code either — turns on the account\'s plan tier, and the',
    'plan documentation is silent on it.',
    '',
    '## Checkout Flow Under Consideration',
    '',
    'Card details entered on our checkout page, tokenised in the browser,',
    'the token sent with the order, capture confirmed back to us by the',
    'gateway. Everything downstream of the token is unchanged from the',
    'current order flow.',
    '',
    '## Strong Customer Authentication',
    '',
    'Whether the shop\'s markets require a challenge step on card payments,',
    'and what that step does to the checkout, has not been looked at.',
    '',
    '## Fallback Provider',
    '',
    'A second gateway for declines has been raised as a question and not',
    'explored: what it would cost to onboard, and whether declines are',
    'frequent enough to justify it, are both unknown.',
    '',
  ].join('\n');
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    h.write(`.workflows/${WU}/discovery/sessions/session-001.md`, discoveryLog());

    h.engine('topic', 'start', WU, 'research', WU);
    h.write(`.workflows/${WU}/research/${WU}.md`, researchFile());
    h.engine('research-threads', 'add', WU, WU, 'hosted-fields',
      '--question', 'Does the existing gateway account support hosted card fields, so card details never touch our servers?',
      '--origin', 'seed');
    h.engine('research-threads', 'add', WU, WU, 'three-d-secure',
      '--question', 'What does 3-D Secure add to the checkout for the shop\'s markets?',
      '--origin', 'user');
    h.engine('research-threads', 'add', WU, WU, 'second-provider',
      '--question', 'Is a second gateway worth pricing as a fallback for declines?',
      '--origin', 'conversation');
    h.engine('commit', WU, '--topic', `research/${WU}`, '-m',
      `research(${WU}/${WU}): gateway capabilities and the open questions`);
  },
};
