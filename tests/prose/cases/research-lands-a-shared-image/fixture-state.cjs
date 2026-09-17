'use strict';

// The pay feature mid-research, with the screenshot the user is about to
// share sitting where they saved it. The feature mainline's create leaves a
// carrier that routed straight to discussion; this fixture's shaping routed
// through research instead, so the discovery log's Exploration is rewritten
// to say why — the same log the entry skill reads to decide whether a
// carrier exists.

const m = require('../../mainlines/feature.cjs');

const WU = m.WU;
// Saved the way a screenshot arrives: spaces in the name, capitals in the
// extension. Unquoted it splits into a positional per word, and the landed
// name is the engine's, not the one the user typed.
const SHOT = 'notes/Rival Checkout Permissions.PNG';

// A real 16×16 PNG. The file type is the point: it keeps its extension, it
// is tracked on the manifest and never embedded, and nothing about it
// normalises to `.md`.
const SHOT_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAGklEQVR42mNQIBEwAPEd'
  + 'osGohlENA62BJAAAaOgP73FPJbcAAAAASUVORK5CYII=',
  'base64',
);

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
    'softly agreed. Nobody in the room knew what the checkout has to put',
    'in front of a shopper before it can keep a card for next time — so',
    'the work routes through research before any of that is decided.',
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
    'Card-only for v1; what the checkout can and cannot ask of the shopper',
    'is what this research explores before anything is decided.',
    '',
    '## Starting Point',
    '',
    'The account exposes a tokenisation API: the browser posts card details',
    'to the gateway and gets a single-use token back, so our servers hold a',
    'token and never a card number. Storing that token for a repeat order is',
    'a second thing, and it needs the shopper to agree to it.',
    '',
    '## Checkout Flow Under Consideration',
    '',
    'Card details entered on our checkout page, tokenised in the browser,',
    'the token sent with the order, capture confirmed back to us by the',
    'gateway. Whether the token is kept afterwards is the open question.',
    '',
    '## Storing A Card For Next Time',
    '',
    'What the checkout has to show the shopper before it keeps their card —',
    'what is asked, where it sits in the flow, and what the shopper is',
    'agreeing to — has not been looked at.',
    '',
  ].join('\n');
}

module.exports = {
  build(h) {
    m.init(h);
    m.create(h);
    h.write(`.workflows/${WU}/discovery/sessions/session-001.md`, discoveryLog());
    h.write(SHOT, SHOT_BYTES);

    h.engine('topic', 'start', WU, 'research', WU);
    h.write(`.workflows/${WU}/research/${WU}.md`, researchFile());
    h.engine('research-threads', 'add', WU, WU, 'storing-a-card',
      '--question', 'What does the checkout have to put in front of the shopper before it can keep their card for next time?',
      '--origin', 'seed');
    h.engine('commit', WU, '--topic', `research/${WU}`, '-m',
      `research(${WU}/${WU}): tokenisation, and the open question about storing a card`);
  },
};
