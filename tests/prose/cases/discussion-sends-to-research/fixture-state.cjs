'use strict';

// A settled epic revisited: both discussions concluded, then synonym-handling
// reopened for one late subtopic (result caching). Behavioural-ranking's
// completed discussion settled batch-only signal ingestion — the ground a
// mid-session feasibility message will be sent onto, research-side. No
// mailboxes hold anything; the send this case pins originates here,
// it doesn't arrive here.
//
// The mainline seeds synonym-handling's expansion source on a live
// click-signal stream, against behavioural-ranking's batch decision. Here
// that conflict would be the walk's subject instead of the send: the
// session's sibling check finds it and revises the decided subtopic. So
// this world's expansion source reads the nightly aggregates.

const fs = require('fs');
const path = require('path');
const e = require('../../mainlines/epic.cjs');

const WU = e.WU;

const AGREED = [
  ['within the session, so the expansion service reads the live\nclick-signal stream at query time.',
    'with the nightly refresh, so the expansion service reads the\nnightly click aggregates.'],
  ['consumes the live click-signal stream at query time, keyed on',
    'consumes the nightly click aggregates, keyed on'],
  ['reading the live\n  click-signal stream.',
    'reading the nightly\n  click aggregates.'],
];

module.exports = {
  build(h) {
    e.init(h);
    e.create(h);
    e.harvest(h);
    e.completeDiscussions(h);

    h.engine('topic', 'reopen', WU, 'discussion', 'synonym-handling');
    const file = path.join(h.dir, `.workflows/${WU}/discussion/synonym-handling.md`);
    let text = fs.readFileSync(file, 'utf8');
    for (const [from, to] of AGREED) {
      if (!text.includes(from)) throw new Error(`synonym-handling no longer reads: ${from}`);
      text = text.replace(from, to);
    }
    fs.writeFileSync(file, text);
    h.engine('discussion-map', 'add', WU, 'synonym-handling', 'result-caching');
    h.engine('commit', WU, '--topic', 'discussion/synonym-handling', '-m',
      `discussion(${WU}): reopen synonym-handling for result caching`);
  },
};
