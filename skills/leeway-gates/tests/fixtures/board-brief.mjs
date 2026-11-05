// Note model's brief as engine board answers it, a leaning or two of each, held to its shape by tests/scripts/test-engine-board-discovery.cjs.
export default {
  kind: 'brief',
  unit: 'fumi',
  topic: 'note-model',
  title: 'Note model',
  order: 1,
  of: 10,
  summary: 'What a fumi is: a Markdown body with a stable UID, an optional first-line-derived title, tags, and colour.',
  sections: [
    { heading: null, text: 'What discovery heard.' },
    { heading: 'Leans', text: '- Content is Markdown — a single source of truth.\n- Identity = a stable per-note UID,\n  fixed for the note\'s life.' },
    { heading: 'Paths not taken', text: '- RTF / rich text — predates Markdown.' },
    { heading: 'Open questions', text: '- Tags: how they are created.' },
  ],
  messages: [{ file: '001-tour.md', title: 'The tour opens first', from: 'Onboarding and permissions', when: '20 Oct' }],
}
