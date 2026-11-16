'use strict';

//
// Migration 073: The linters move to the project's environment — a step
// that does nothing
//
// Written as a step of its own over `.ledger/`, which no release before
// Ledger wrote and the guard (074), numbered after it but run before it,
// places empty: run in a project's chain, it finds no state to carry. The
// carry is the move's (078, through reshape/linters.cjs), over the state it
// writes. The number
// stays, so the steps after it keep theirs: it records itself run and
// changes nothing.
//

module.exports = {
  id: '073',
  description: 'nothing: the linters are carried onto the project\'s environment by the move (078)',
  run({ reportSkip }) {
    reportSkip();
  },
};
