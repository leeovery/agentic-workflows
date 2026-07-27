The prose should have taken this path:

1. no investigation exists, so this is a fresh start — no resume choice
   is put to the user
2. initialisation reads the work's seed and writes the investigation
   file, placing what discovery already recorded into its Symptoms
   section before anything is asked
3. **the interview happens anyway.** The section carrying the carrier's
   account is not treated as symptoms already gathered — the seed is
   where the questioning starts, not a reason to skip it
4. questioning opens broad and narrows on what the answers give back,
   rather than putting the whole bank to the user at once
5. what the user says is written into the investigation file as it is
   gathered, and committed
6. the questioning ends and the prose turns to the knowledge base, which
   is where this walk stops

Further claims:

- nothing the user already said in discovery is put back to them as a
  question — the carrier is read, not re-asked
- the user's ignorance is recorded as such: where they had no error
  tracking, no logs, and no better date than last week, the file says so
  rather than leaving those parts of the template as placeholders
- the analysis is untouched: no hypothesis, no code trace, no root cause.
  Nothing has been investigated yet, only described

EXPECTED WORLD — from a work unit whose investigation had not begun:

- an investigation file at `.workflows/crash-fix/investigation/crash-fix.md`
  carrying the template's structure
- its Symptoms section holding both what discovery captured and what the
  interview added — the digital-only basket, the staging reproduction,
  the absence of logs or a tracking link
- its Analysis and Fix Direction sections still unwritten
- the investigation registered as in progress on the work unit
- no other phase touched
