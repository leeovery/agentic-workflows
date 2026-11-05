// Mint's Token-aware diff sizing in its specification as engine board answers it: four passes back, pass 4's question asked and its four calls since, held to its shape by tests/scripts/test-engine-board-spec.cjs.

/** A section of the spec with the passes that changed it. */
export const specSection = (number, title, ...changed) => ({ number: String(number), title, changed_by: changed, reading: false })

/** A pass read, with what it found. */
export const readPass = (pass, found, calls, yours) => ({ pass, found, calls, yours, state: 'read', since: null, reads: null })

/** A phase of the cut, with its scenarios and the sections it draws on. */
export const cutPhase = (at, name, scenarios, ...sections) => ({ phase: at, name, scenarios, sections: sections.map(String) })

/** Ready to build's yes, waiting on the person, as the unit's one list holds it. */
export const READY = { kind: 'ready', id: 'ready-to-build', text: 'Ready to build: the outline and the phase cut, for your yes', page: null, pass: null, finding: null, sections: [] }

export default {
  kind: 'spec',
  unit: 'token-aware-diff-sizing',
  title: 'Token-aware diff sizing',
  type: 'feature',
  project: 'Mint',
  sections: [
    specSection(1, 'Purpose and Scope', 1, 4),
    specSection(2, 'The Lean Default AI Command', 1),
    specSection(3, 'Quote-Aware ai_command Parsing', 3),
    specSection(4, 'The Per-Call Size Cap', 1, 4),
    specSection(5, 'Per-Verb Exclusion Lists'),
    specSection(6, 'The Exclusion Check', 1, 3),
    specSection(7, "Routing a Release's Notes", 2),
    specSection(8, 'Chunked Generation', 2, 4),
    specSection(9, 'Failure Classification', 2, 4),
    specSection(10, 'Halving After an Under-Cap Overflow', 3),
    specSection(11, 'Failures in a Chunked Run', 1, 2),
    specSection(12, 'The Remediation Floor', 1, 2, 3, 4),
    specSection(13, '--notes-file'),
    specSection(14, 'One Non-AI Body: Dropping [release].fallback', 3),
    specSection(15, 'Chunked Notes at the Review Gate and in the Cache', 2, 4),
    specSection(16, 'Progress Narration', 1, 3, 4),
    specSection(17, "mint commit's AI-Failure Output", 1),
    specSection(18, 'Documentation and the Setup Guide', 1, 3, 4),
  ],
  passes: [readPass(4, 6, 4, 2), readPass(3, 5, 4, 1), readPass(2, 3, 2, 1), readPass(1, 10, 8, 2)],
  waiting: [{ kind: 'gap', id: 'g1', text: "The halving progress line's part count", page: 'pass:4:F2', pass: 4, finding: 'F2', sections: ['16'] }],
  since: [
    { id: 'c1', text: 'r re-runs only the merge call.', question: "r at single-version regenerate's review gate on chunked notes", pass: 4, finding: 'F3', sections: ['1', '15'] },
    { id: 'c2', text: 'The example merges four parts.', question: 'The progress example merges fewer parts than its own halving left', pass: 4, finding: 'F4', sections: ['8', '16'] },
    { id: 'c3', text: 'The batch gate is the same gate.', question: "r at regenerate --all's per-version review gate on chunked notes", pass: 4, finding: 'F5', sections: ['1', '12', '15'] },
    { id: 'c4', text: 'The documented timeout default stays 60 seconds while releases default to 180', question: null, pass: null, finding: null, sections: [] },
  ],
  cut: [
    cutPhase(1, 'Lean default AI command and quote-aware parsing', 38, 2, 3, 4, 17, 18),
    cutPhase(2, 'Per-call size cap and chunked release notes', 77, 1, 4, 6, 7, 8, 10, 11, 12, 15, 16, 17, 18),
    cutPhase(3, '`--notes-file` and one non-AI body', 51, 6, 7, 11, 12, 13, 14, 18),
    cutPhase(4, 'Failure classification, halving and saved chunk notes', 101, 1, 4, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18),
    cutPhase(5, 'The remediation floor', 100, 1, 2, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18),
    cutPhase(6, 'Chunked notes at the review gate and in the dry-run cache', 81, 1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18),
    cutPhase(7, 'Per-verb exclusion lists and the exclusion check', 109, 2, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, 18),
    cutPhase(8, 'Recording exclusion answers', 53, 5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18),
  ],
  given: false,
}
