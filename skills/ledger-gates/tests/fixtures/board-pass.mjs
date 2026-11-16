// Pass 4's page as engine board answers it, each finding as it stands with the person, held to its shape by tests/scripts/test-engine-board-spec.cjs.
export default {
  kind: 'pass',
  unit: 'token-aware-diff-sizing',
  title: 'Token-aware diff sizing',
  pass: 4,
  reads: ['3', '6', '10', '12', '14', '16', '18'],
  changed: ['1', '4', '8', '9', '12', '15', '16', '18'],
  found: [
    { finding: 'F1', label: 'claude sends an oversized prompt and the API rejects it before any output', standing: 'yours' },
    { finding: 'F2', label: "The halving progress line's part count", standing: 'waits' },
    { finding: 'F3', label: "r at single-version regenerate's review gate on chunked notes", standing: 'claude' },
  ],
}
