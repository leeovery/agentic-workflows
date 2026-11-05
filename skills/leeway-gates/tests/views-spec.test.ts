import { describe, expect, test, tier } from 'claude-code/testing'

import { COLOUR } from '../hooks/draw.ts'
import type { View } from '../hooks/model.ts'
import { PASS, SECTION, SPEC, SPEC_FINDING } from '../hooks/views/spec.ts'
import { PHASE } from '../hooks/views/unit.ts'
import { block, drawn, markOf } from './drawing.ts'
import MINT_SPEC, { specSection, readPass, cutPhase } from './fixtures/board-spec.mjs'
import PASS_4 from './fixtures/board-pass.mjs'

tier('user')

describe('a specification on the board (20.9)', () => {
  test('This session in a specification is §20.9\'s drawing at 64 columns: what waits with the pass that found it, each call since with its pass and sections, the review', () => {
    expect(drawn(SPEC, MINT_SPEC).text.slice(0, 28)).toEqual(
      block(`
Token-aware diff sizing · specification
Mint · feature
18 sections · 8 phases cut · 4 passes, 24 found · ⚑ pass 5
waits on your answer

WAITING ON YOU ───────────────── 1 · asked in the conversation
⚑ The halving progress line's part count
     found by pass 4 · touches §16                      ▸ read

SINCE YOU LAST LOOKED ────────────────────── 4 calls by Claude
◇ r at single-version regenerate's review gate on chunked
  notes
     pass 4 · §1, 15                                    ▸ read
◇ The progress example merges fewer parts than its own halving
  left
     pass 4 · §8, 16                                    ▸ read
◇ r at regenerate --all's per-version review gate on chunked
  notes
     pass 4 · §1, 12, 15                                ▸ read
◇ The documented timeout default stays 60 seconds while ▸ read
  releases default to 180

REVIEW ───────────────────── stops when a pass changes nothing
○ Pass 5 · reads what pass 4 changed, once you answer
◆ Pass 4 · 6 found · 4 calls, 2 yours                   ▸ read
◆ Pass 3 · 5 found · 4 calls, 1 yours                   ▸ read
◆ Pass 2 · 3 found · 2 calls, 1 yours                   ▸ read
◆ Pass 1 · 10 found · 8 calls, 2 yours                  ▸ read
`),
    )
  })

  test('a gap\'s and a call\'s ▸ read open the finding that raised it, else its entry', () => {
    const { lines } = drawn(SPEC, MINT_SPEC)
    const reads = (key: string) => lines.find(line => line.key === key)?.button?.key

    expect(reads('spec:gap:g1:said')).toBe('page:pass:4:F2')
    expect(reads('spec:since:c1:said')).toBe('page:pass:4:F3')
    expect(reads('spec:since:c4')).toBe('page:entry:c4')
  })

  test('a gap that touches no section says only the pass that found it; one with neither carries ▸ read on its row', () => {
    const gaps = (...waiting: object[]) => drawn(SPEC, { ...MINT_SPEC, waiting } as View).text.slice(5, 8)

    expect(gaps({ id: 'g1', text: 'The part count', pass: 4, finding: 'F2', sections: [] })).toEqual([
      'WAITING ON YOU ───────────────── 1 · asked in the conversation',
      '⚑ The part count',
      '     found by pass 4                                    ▸ read',
    ])
    expect(gaps({ id: 'g1', text: 'The part count', pass: null, finding: null, sections: [] }).slice(1)).toEqual([
      '⚑ The part count                                        ▸ read',
      '',
    ])
  })

  test('then each section with the passes that changed it', () => {
    expect(drawn(SPEC, MINT_SPEC).text.slice(28, 48)).toEqual(
      block(`

SECTIONS ────────────────────────────────────────────────── 18
✓  1 Purpose and Scope                               pass 1, 4
✓  2 The Lean Default AI Command                        pass 1
✓  3 Quote-Aware ai_command Parsing                     pass 3
✓  4 The Per-Call Size Cap                           pass 1, 4
✓  5 Per-Verb Exclusion Lists                        unchanged
✓  6 The Exclusion Check                             pass 1, 3
✓  7 Routing a Release's Notes                          pass 2
✓  8 Chunked Generation                              pass 2, 4
✓  9 Failure Classification                          pass 2, 4
✓ 10 Halving After an Under-Cap Overflow                pass 3
✓ 11 Failures in a Chunked Run                       pass 1, 2
✓ 12 The Remediation Floor                     pass 1, 2, 3, 4
✓ 13 --notes-file                                    unchanged
✓ 14 One Non-AI Body: Dropping [release].fallback       pass 3
✓ 15 Chunked Notes at the Review Gate and in the Ca… pass 2, 4
✓ 16 Progress Narration                           pass 1, 3, 4
✓ 17 mint commit's AI-Failure Output                    pass 1
✓ 18 Documentation and the Setup Guide            pass 1, 3, 4
`),
    )
  })

  test('then the phase cut, each phase with its scenarios and the sections it draws on, and what ready to build waits on', () => {
    expect(drawn(SPEC, MINT_SPEC).text.slice(48)).toEqual(
      block(`

PHASE CUT ─────────────────────────── 8 phases · 610 scenarios
1 Lean default AI command and quote-aware parsing           38
     draws on §2, 3, 4, 17, 18
2 Per-call size cap and chunked release notes               77
     draws on §1, 4, 6, 7, 8, 10, 11, 12, 15, 16, 17, 18
3 \`--notes-file\` and one non-AI body                        51
     draws on §6, 7, 11, 12, 13, 14, 18
4 Failure classification, halving and saved chunk notes    101
     draws on §1, 4, 8, 9, 10, 11, 12, 13, 15, 16, 17, 18
5 The remediation floor                                    100
     draws on §1, 2, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,…
6 Chunked notes at the review gate and in the dry-run cache 81
     draws on §1, 2, 4, 6, 7, 8, 9, 10, 11, 12, 13, 15, 16, 18
7 Per-verb exclusion lists and the exclusion check         109
     draws on §2, 4, 5, 6, 7, 9, 10, 12, 13, 14, 15, 16, 17, …
8 Recording exclusion answers                               53
     draws on §5, 6, 7, 9, 11, 12, 13, 14, 15, 16, 18

READY TO BUILD ──────────────────────────────────────────────
○ once a pass changes nothing
`),
    )
  })

  test('D21: the facts line ends in where the review stands, whole, whatever it stands at', () => {
    const facts = (view: View) => drawn(SPEC, view).text.slice(2, 4).join(' ')
    const running = { ...MINT_SPEC, waiting: [], passes: [{ pass: 5, found: 0, calls: 0, yours: 0, state: 'running', since: '2026-10-21T13:29:00', reads: ['12', '16'] }, ...(MINT_SPEC.passes as object[])] } as View

    expect(facts(MINT_SPEC)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ⚑ pass 5 waits on your answer')
    expect(facts({ ...MINT_SPEC, waiting: [] } as View)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ○ pass 5 next')
    expect(facts(running)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ◐ pass 5 reading')
    expect(facts({ ...MINT_SPEC, waiting: [], ready: 'person' } as View)).toBe('18 sections · 8 phases cut · 4 passes, 24 found · ⚑ ready to build, waiting on your yes')
  })

  test('a pass reading turns and is clocked, its sections being read', () => {
    const reading = {
      ...MINT_SPEC,
      waiting: [],
      sections: (MINT_SPEC.sections as object[]).map((held, at) => ({ ...held, reading: at === 11 })),
      passes: [{ pass: 5, found: 0, calls: 0, yours: 0, state: 'running', since: '2026-10-21T13:29:00', reads: ['12', '16'] }, ...(MINT_SPEC.passes as object[])],
    } as View
    const { text, holds } = drawn(SPEC, reading)

    expect(text).toContain('◐ Pass 5 · reading 2 sections pass 4 changed              1:00')
    expect(text).toContain('◐ 12 The Remediation Floor                          being read')
    expect(holds).toEqual({ turns: true, clocks: true })
  })

  test('D24: at ready to build, WAITING ON YOU lists its yes, which READY TO BUILD puts to the person; no pass is to come', () => {
    const { text } = drawn(SPEC, { ...MINT_SPEC, waiting: [], since: [], ready: 'person' } as View)

    expect(text.slice(5, 7)).toEqual(['WAITING ON YOU ───────────────── 1 · asked in the conversation', '⚑ Ready to build: the outline and the phase cut, for your yes'])
    expect(text.slice(-2)).toEqual(['READY TO BUILD ──────────────────────────────────────────────', '⚑ the outline and the phase cut, put to you'])
    expect(text.some(row => row.startsWith('○ Pass'))).toBe(false)
  })
})

describe('a specification\'s pages (20.9.2)', () => {
  test('a section opens on its page, with the passes that changed it and its words counted', () => {
    const page = { kind: 'section', unit: 'u', number: '4', title: 'The Per-Call Size Cap', changed_by: [1, 4], text: 'max_prompt_bytes replaces max_diff_lines.' }

    expect(drawn(SECTION, page).text).toEqual(['§4 The Per-Call Size Cap', 'changed by pass 1, 4 · 3 words', ` ${'─'.repeat(60)}`, 'max_prompt_bytes replaces max_diff_lines.'])
    expect(drawn(SECTION, { ...page, changed_by: [] }).text[1]).toBe('unchanged by the review · 3 words')
  })

  test('D23: a pass opens on what it read and changed, and each finding as it stands with the person, each opening its own page', () => {
    const { text, lines } = drawn(PASS, PASS_4)

    expect(text).toEqual([
      'Review pass 4 · Token-aware diff sizing',
      'Read what pass 3 changed: §3, 6, 10, 12, 14, 16, 18.',
      'Changed §1, 4, 8, 9, 12, 15, 16, 18.',
      'FOUND ────────────────────────────────────────────────────── 3',
      '✓ claude sends an oversized prompt and the API rejects … yours',
      "⚑ The halving progress line's part count          waits on you",
      "◇ r at single-version regenerate's review gate … Claude's call",
    ])
    expect(lines.filter(line => line.press !== undefined).map(line => line.press)).toEqual(['page:pass:4:F1', 'page:pass:4:F2', 'page:pass:4:F3'])
    expect(markOf(lines, 'pass:found:F2')).toEqual({ text: '⚑', color: COLOUR.needs })
    expect(drawn(PASS, { ...PASS_4, pass: 1, reads: null }).text[1]).toBe('Read the whole specification.')
  })

  test('20.9.2: a finding opens on its own page: where it stands, its pass, lane and sections, and its words', () => {
    const page = { kind: 'spec-finding', unit: 'u', pass: 4, finding: 'F2', label: "The halving progress line's part count", lane: 'gap', standing: 'waits', sections: ['16'], text: 'The line says 4 parts where 6 ran.' }

    expect(drawn(SPEC_FINDING, page).text).toEqual([
      "The halving progress line's part count",
      '⚑ yours · being asked in the conversation',
      'pass 4 · gap · touches §16',
      ` ${'─'.repeat(60)}`,
      'The line says 4 parts where 6 ran.',
    ])
    expect(drawn(SPEC_FINDING, { ...page, standing: 'yours' }).text[1]).toBe('✓ yours · decided')
    expect(drawn(SPEC_FINDING, { ...page, standing: 'claude' }).text[1]).toBe("◇ Claude's call")
  })
})
