# Cancel "No" Returns to the Cancel List

## The Idea

On the epic menu, `a/cancel` opens the cancellable-topics list; picking a
row opens the cancel gate ("Cancel it?"). Answering `no` today returns to
the epic menu. It should return to the cancel list, where `b/back` is the
way out — the person backed out of one cancellation, not out of cancelling.

## Where It Came From

Lee, 2026-09-23, testing the function-hook gates in the lab: a `no` at the
cancel gate jumped past the list he was working in. Out of scope for that
programme; logged so it is not lost.

## Shape

`skills/workflow-continue-epic/references/epic-display-and-menu.md`, the
cancel gate's `**If user chose \`no\`:**` branch, routes `→ Return to
**A. State Display and Menu**`. Route it back to the cancel sub-view that
renders `gateway.cjs cancel-menu {work_unit}` instead. Check the reactivate
sub-view for the same shape while there, and the prose-test cases that walk
the cancel menu (`epic-menu-cancels-a-never-started-topic`,
`epic-menu-cancels-a-specification-then-its-source`).
