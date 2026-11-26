// A blind question's gate as engine raise states it, Claude's answer held back — its own question asked, no row recommended, its rows numbered in the order its question's id gives them, what the person reads printed in the chat above it and stated plain as the gate's identity — held to it by tests/scripts/test-engine-raise-blind.cjs.
export default {
  gate: 'raise — Q3x9mT2bLk7WvP4nRf8Za',
  question: 'When you make a new note, where should its window open?',
  statement: [
    'Fumi · Note Window',
    'When you make a new note, where should its window open?',
    "WHAT YOU'D NOTICE",
    '- Main: every note opens on the same screen',
    '- Cursor: the note opens where you are looking',
  ].join('\n'),
  options: [
    { key: '1', word: null, head: 'On the main screen', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
    { key: '2', word: null, head: 'On the screen the cursor is on', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
    { key: 't', word: 'technical', head: 'Show the mechanism', tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
    { key: 'e', word: 'explain', head: "I don't follow — explain it again", tail: null, cue: null, holder: null, detail: null, struck: false, recommended: false },
  ],
  typed: [{ label: 'Comment', description: "Ask about it, or tell me what I've missed", detail: null }],
}
