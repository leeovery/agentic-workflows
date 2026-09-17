The prose should have taken this path:

1. no investigation exists, so this is a fresh start — no resume choice is
   put to the user
2. initialisation reads the work's seed and writes the investigation file,
   placing what discovery already recorded into its Symptoms section before
   anything is asked
3. the interview runs from there — opening broad, narrowing on what the
   answers give back, and never putting back to the user what the carrier
   already said
4. **the path the user offers lands as an import.** When the questioning
   reaches what references they have and the user names the screenshot, one
   call lands it — `workunit import crash-fix notes/checkout-500.png --from
   investigation/crash-fix` — the origin naming the phase and topic this
   session is sitting in. Nothing is asked first: no gate, no confirmation,
   no offer to land it. The file lands at `imports/checkout-500.png`, the
   extension kept and nothing normalised to `.md`, and the session runs no
   commit of its own for it: the verb committed itself
5. the screenshot is read as an image and what it shows is treated as
   symptom evidence — the blank page and the console line are written into
   the investigation file in its own terms
6. the file carries the file itself by reference: an inline link on the
   relative path `../imports/checkout-500.png`, its text saying what the
   screenshot shows, under the symptoms' references. The link target is the
   relative path, never an absolute one and never the original `notes/` path
7. what the user says is written into the investigation file as it is
   gathered, and committed
8. the questioning ends and the prose turns to the knowledge base, which is
   where this walk stops

Landing claims — the lens is the behaviour under test:

- the file lands through the engine and only through the engine: it is
  never copied, moved or written into `.workflows/` by hand, and no
  directory is invented beside the investigation file to hold it — one
  home, `imports/`, whatever the file type
- the source file stays where the user put it: `notes/` is untouched, and
  the landing is a copy
- the screenshot is never handed to the knowledge base — what embeds is the
  verb's call, and a PNG is tracked on the manifest alone
- the manifest's `imports[]` gains exactly one entry, carrying the landed
  path, a timestamp, and `origin: "investigation/crash-fix"` — never
  `discovery`

Further claims:

- nothing the user already said in discovery is put back to them as a
  question — the carrier is read, not re-asked
- the user's ignorance is recorded as such: where they had no error
  tracking, no logs, and no better date than last week, the file says so
  rather than leaving those sections as placeholders
- the analysis is untouched: no hypothesis, no code trace, no root cause.
  Nothing has been investigated yet, only described

EXPECTED WORLD — from a work unit whose investigation had not begun:

- an investigation file at `.workflows/crash-fix/investigation/crash-fix.md`
  holding Symptoms, Analysis, and Fix Direction sections
- its Symptoms section holding what discovery captured, what the interview
  added — the digital-only basket, the staging reproduction, the absence of
  logs or a tracking link — and the screenshot's link under its references
- its Analysis and Fix Direction sections still unwritten
- the screenshot at `.workflows/crash-fix/imports/checkout-500.png`,
  byte-identical to the one in `notes/` (which is still there), with one
  `imports[]` entry carrying `origin: "investigation/crash-fix"`
- the investigation registered as in progress on the work unit
- no other phase touched
