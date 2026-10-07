The prose should have taken this path:

1. the skill resolves the topic to the work unit and reads the
   investigation status once — it finds no investigation recorded, and
   creates nothing before initialisation
2. this is a first start: the starting phase note is emitted, no resume
   choice is put to the user, and initialisation follows
3. initialisation reads the work's seed before writing, so the phase
   opens from the origin rather than from an empty page
4. the investigation file is created from the template, and the symptoms
   the discovery carrier already recorded are placed into it — the user
   is not asked to repeat what they have already said
5. the phase is registered through the engine and the file committed,
   and only then does the prose turn to gathering further symptoms

Further claims:

- the walk stops with the symptom interview unstarted: the prose reaches
  the point of asking and the case ends there, so no question is put

EXPECTED WORLD — from a work unit whose investigation had not begun:

- an investigation file at `.workflows/crash-fix/investigation/crash-fix.md`,
  holding Symptoms, Analysis, Fix Direction, and Notes sections
- its Symptoms section seeded from what discovery already captured about
  the checkout crash, not left as template placeholders
- its Analysis and Fix Direction sections still unwritten: nothing has
  been traced or decided, and the walk stops before either begins
- the investigation registered as in progress on the work unit
- no other phase touched, and no second work unit
