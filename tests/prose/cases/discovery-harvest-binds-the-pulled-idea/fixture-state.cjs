'use strict';

// An epic born at a roadmap pull of one idea and one bug, both brought
// off the inbox. The pull backfilled the epic's first session log with
// each note whole, and the conversation went on into discovery and
// worked the ground through — its running record layered beneath the
// backfill and committed — before it was interrupted: the map is empty,
// the session is still marked active, and both roadmap items are joined
// to the epic with no topic yet.

const fs = require('fs');
const path = require('path');
const m = require('../../mainlines/roadmap.cjs');

const WU = 'pickup-times';
const DRAFT = `.workflows/.cache/${WU}/discovery/session-001.md`;
const LOG = `.workflows/${WU}/discovery/sessions/session-001.md`;

const SCHEDULED_PICKUP = [
  '# Scheduled Pickup',
  '',
  'Customers ordering ahead for collection can only ask for "as soon as',
  'possible". Regulars who order lunch at nine for a half-twelve pickup',
  'end up with food that sat on the pass for three hours, or they wait',
  'until noon to order and then queue. The idea: let the customer choose',
  'a pickup time when they place the order, from the slots the',
  'restaurant is open, and have the order reach the kitchen at the right',
  'moment rather than the moment it was placed.',
  '',
  'Restaurants would set how far ahead a slot can be booked and how many',
  'orders a slot takes. Nothing about delivery changes; this is pickup',
  'only.',
  '',
].join('\n');

const UTC_TIMES = [
  '# Pickup Time Shown in UTC',
  '',
  'On the pilot storefront, the "ready at" time shown to a customer after',
  'they order is in UTC, not the restaurant\'s local time. Through the',
  'summer every estimate reads an hour early, and customers arrive to',
  'find their order still cooking. The kitchen\'s own screen shows the',
  'right time; only what the customer sees is wrong.',
  '',
].join('\n');

const asSection = (text) => text.replace(/^# /, '### ');

const WORKED = [
  'Worked the scheduled pickup through. Slots are per restaurant: each',
  'restaurant sets its slot length, how far ahead a slot can be booked,',
  'and how many orders one slot takes — settled, the user wants',
  'restaurants in control rather than a platform-wide rule. A full slot',
  'is simply not offered. Considered letting customers type any time',
  'they like and dropped it: the kitchen cannot plan around arbitrary',
  'times, and capacity per slot is the point.',
  '',
  'When a scheduled order reaches the kitchen is the open part. Released',
  'a fixed time before the slot is simple; released by how long the',
  'order\'s dishes take to cook is better food and more work. The user',
  'is torn between the two and wants to settle it properly, not now.',
  '',
  'The UTC bug came with the pull and bears straight on this: scheduled',
  'pickup puts many more times in front of customers, so every time the',
  'customer sees has to be the restaurant\'s local time. Agreed the fix',
  'belongs inside the scheduled-pickup work rather than beside it — it is',
  'the same ground, the times a customer is shown.',
  '',
].join('\n');

module.exports = {
  build(h) {
    m.init(h);

    h.write('.workflows/.inbox/ideas/2026-01-01--scheduled-pickup.md', SCHEDULED_PICKUP);
    h.write('.workflows/.inbox/bugs/2026-01-01--pickup-time-shown-in-utc.md', UTC_TIMES);
    const entries = '.workflows/.cache/inbox-roadmap.json';
    h.write(entries, JSON.stringify([
      {
        name: 'scheduled-pickup',
        horizon: 'next',
        summary: 'customers choose a pickup time when they order',
        note: '.workflows/.inbox/ideas/2026-01-01--scheduled-pickup.md',
      },
      {
        name: 'pickup-time-shown-in-utc',
        horizon: 'next',
        summary: 'the pickup time a customer is shown reads in UTC, not local time',
        note: '.workflows/.inbox/bugs/2026-01-01--pickup-time-shown-in-utc.md',
      },
    ], null, 2));
    h.engine('roadmap', 'add-batch', '--file', entries);
    h.remove(entries); // scratch — gitignored in a real project, not fixture state

    h.write(DRAFT, [
      '# Discovery Session 001',
      '',
      'Date: 2026-01-01',
      `Work unit: ${WU}`,
      '',
      '## Description (as of session)',
      '',
      'Customers choose when to collect their order, and every time they see is the restaurant\'s own.',
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
      '(empty — first session)',
      '',
      '## Exploration',
      '',
      'Pulled from the roadmap\'s `next` horizon: scheduled pickup, and the',
      'bug of pickup times shown in UTC. Their notes, whole:',
      '',
      asSection(SCHEDULED_PICKUP),
      asSection(UTC_TIMES),
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
    h.engine('workunit', 'create', WU, 'epic',
      '--description', 'Customers choose when to collect their order, and every time they see is the restaurant\'s own',
      '--session-log-file', DRAFT);
    h.remove(DRAFT); // scratch — gitignored in a real project, not fixture state
    h.engine('roadmap', 'pull', 'scheduled-pickup', 'pickup-time-shown-in-utc', '--into', WU);

    const backfilled = fs.readFileSync(path.join(h.dir, LOG), 'utf8');
    const anchor = '\n## Edits\n';
    if (!backfilled.includes(anchor)) throw new Error(`${LOG} has no Edits section to layer beneath`);
    h.write(LOG, backfilled.replace(anchor, `\n${WORKED}${anchor}`));
    h.engine('commit', WU, '-m', `discovery(${WU}): exploration notes — session-001`, '--discovery');
  },
};
