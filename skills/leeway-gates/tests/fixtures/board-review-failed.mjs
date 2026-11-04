// The review phase's This session as engine board answers it, for the locked board's Mint review once round 1 failed, its fix tasks not yet built, held to its shape by tests/scripts/test-engine-board-review.cjs.
export default {
  "kind": "review",
  "unit": "token-aware-diff-sizing",
  "title": "Token-aware diff sizing",
  "project": "Mint",
  "type": "feature",
  "built": 99,
  "round": 1,
  "finish": false,
  "waiting": [],
  "stopped": false,
  "recorded": true,
  "areas": [
    {
      "area": "1",
      "title": "Purpose and Scope",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "2",
      "title": "The Lean Default AI Command",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "3",
      "title": "Quote-Aware ai_command Parsing",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "4",
      "title": "The Per-Call Size Cap",
      "state": "read",
      "ran": 0,
      "found": 1,
      "since": null
    },
    {
      "area": "5",
      "title": "Per-Verb Exclusion Lists",
      "state": "read",
      "ran": 1,
      "found": 1,
      "since": null
    },
    {
      "area": "6",
      "title": "The Exclusion Check",
      "state": "read",
      "ran": 4,
      "found": 2,
      "since": null
    },
    {
      "area": "7",
      "title": "Routing a Release's Notes",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "8",
      "title": "Chunked Generation",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "9",
      "title": "Failure Classification",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "10",
      "title": "Halving After an Under-Cap Overflow",
      "state": "read",
      "ran": 1,
      "found": 0,
      "since": null
    },
    {
      "area": "11",
      "title": "Failures in a Chunked Run",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "12",
      "title": "The Remediation Floor",
      "state": "read",
      "ran": 2,
      "found": 5,
      "since": null
    },
    {
      "area": "13",
      "title": "--notes-file",
      "state": "read",
      "ran": 9,
      "found": 0,
      "since": null
    },
    {
      "area": "14",
      "title": "One Non-AI Body: Dropping [release].fallback",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "15",
      "title": "Chunked Notes at the Review Gate and in the Cache",
      "state": "read",
      "ran": 1,
      "found": 0,
      "since": null
    },
    {
      "area": "16",
      "title": "Progress Narration",
      "state": "read",
      "ran": 0,
      "found": 1,
      "since": null
    },
    {
      "area": "17",
      "title": "mint commit's AI-Failure Output",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "18",
      "title": "Documentation and the Setup Guide",
      "state": "read",
      "ran": 6,
      "found": 3,
      "since": null
    },
    {
      "area": "tests",
      "title": "Tests held against the specification",
      "state": "read",
      "ran": 0,
      "found": 4,
      "since": null
    }
  ],
  "found": [
    {
      "round": 1,
      "finding": 1,
      "area": "tests",
      "call": "bug",
      "text": "no test drives mint release regenerate <version> against a malformed ai_command, though AC1 names it beside release and commit, and regenerate loads config at its own site (this one, rendering through fmt.Fprintf(os.Stderr, …)) rather than through engine.Release's or commit.Run's load. Add a cmd/mint test that calls regenerate(t.Context(), rec, f, req) (the seam at cmd/mint/main.go:149, already used by cmd/mint/regenerate_notesfile_test.go and cmd/mint/regenerate_floor_test.go) with a .mint.toml holding [release]\\nai_command = 'claude --system-prompt \"Be terse', the FakeRunner seeded only for git rev-parse --show-toplevel, and assert a non-zero exit and that git rev-parse --show-toplevel is the only recorded invocation (no tag read, no AI call) — FAILS: a regression that moved regenerate's config.Load behind version resolution or the source/target prompts, or dropped its error check, leaves the suite green while AC1's regenerate arm (\"fails before any step runs … and makes no AI call\") is broken."
    },
    {
      "round": 1,
      "finding": 2,
      "area": "18-documentation-and-the-setup-guide",
      "call": "nit",
      "text": "the generousTimeout comment still says tests exist \"so tests never wait the production ~60s\". This task rewrote the identical claim in internal/ai/transport.go:128 to \"never wait out a production deadline\" and edited this same test file (line 516), but missed this line. Replace \"never wait the production ~60s.\" with \"never wait out a production deadline.\" — FAILS: the comment states a single 60s production deadline, which the code now falsifies (release-notes calls get 180s); it is a single-60s-default comment of the kind §18.3 and CLAUDE.md's \"true to as-built\" rule require rewritten. Comment-only remedy, non-blocking."
    },
    {
      "round": 1,
      "finding": 3,
      "area": "4-the-per-call-size-cap",
      "call": "nit",
      "text": "The comment above the regeneration stage says every exit closes it via \"success via the timed completion closure, a transport failure via the spinner-stopping AI-failure Warn …, any other failure via surface's StageFailed\". This task added the over-cap branch at run.go:681-684, which closes the stage through the oversized Warn, not a StageFailed, so the comment's \"any other failure\" claim is now false. Replace the sentence with: \"Every exit closes it: success via the timed completion closure, a transport failure via the spinner-stopping AI-failure Warn and an over-cap prompt via the oversized Warn (r is interactive-only, so both paths are always attended), any other failure via surface's StageFailed.\" — FAILS: a reader trusting the comment expects an over-cap regeneration to emit a StageFailed. The code and TestRun_Oversized_RegenNudgeOverCap_OpensEmptyEditor (run_oversized_test.go:557) assert the opposite, which breaks the project's comments-true-to-as-built rule (CLAUDE.md, Comments)."
    },
    {
      "round": 1,
      "finding": 4,
      "area": "tests",
      "call": "bug",
      "text": "The criterion names three verbs, but only mint release (this file) and mint commit (internal/commit/run_malformed_aicommand_test.go:51) have a test. mint release regenerate <version> loads config on a separate path (cmd/mint/main.go:163), and no test drives it with an invalid .mint.toml (a search for invalid .mint.toml in cmd/mint tests finds nothing). Fix: add a cmd/mint test that writes max_diff_lines = 50000 into the temp root and calls regenerate(t.Context(), rec, f, req) with the runner seeded only for rev-parse --show-toplevel. It asserts a non-zero exit code and that the runner saw exactly that one git call, the same \"nothing after load\" proof the release and commit tests use. The message itself is already pinned by internal/config/max_diff_lines_removed_test.go. — FAILS: if regenerate's config load moved after release-branch resolution, preflight or the interactive prompts, or were rerouted through a path that tolerates unknown keys, no test fails. Regenerate would then run steps against a repo still carrying the dead key, against the criterion's \"before any step runs\"."
    },
    {
      "round": 1,
      "finding": 5,
      "area": "tests",
      "call": "bug",
      "text": "assertNoTag still counts the pre-3-8 argv git tag -a {nextTag} -F -, which production no longer issues, so countCmd always returns 0 and the helper can never fail. It was added later (task 5-1, commit 816b9e0) against the stale argv. The 12 call sites across 7 files rely on it (notes_floor_test.go, notes_floor_edit_test.go, notes_floor_dryrun_test.go, notes_floor_nextmoves_test.go, notes_fallback_warning_test.go, release_exclusionsuggestions_test.go, release_reviewgate_unwind_test.go). This is the same vacuity the task closed for release_setversion_test.go:181. Fix: replace the condition with a prefix match on the existing helper, if at := firstIndexWithPrefix(f, \"git tag -a\"); at != -1 { (defined at internal/engine/release_preflighthook_test.go:31, same engine_test package, no new imports), so future argv changes can't make it vacuous again. — FAILS: a regression that creates (and pushes) the release tag on a floor abort, an unattended floor stop, a cancel, a failed regenerate or a dry run passes every test that calls assertNoTag, because the guard can't see the tag argv production actually runs."
    },
    {
      "round": 1,
      "finding": 6,
      "area": "tests",
      "call": "bug",
      "text": "Regenerate's production chunk-notes store is built inline inside regenerate() (cmd/mint/main.go:148), and that function is the seam every cmd regenerate test calls. So no test can inject a store, and none checks that one is wired. The forward release takes the store as a parameter of release() (cmd/mint/main.go:310), and TestRelease_ChunkedRunFails_SavesTheFinishedPartsNotesInTheGivenStore (cmd/mint/release_seam_test.go:260) checks it end to end. Fix: give regenerate() a chunkNotes engine.ChunkNotesSaver parameter the same way, have runRegenerate pass notescache.NewUserChunkNotes(os.UserCacheDir), have the cmd test callers pass notescache.NewChunkNotes(t.TempDir()), and add one cmd test that drives a chunked fresh regenerate failure through regenerate() and asserts the saved file. — FAILS: if the ChunkNotes: field at main.go:193 is dropped, or set to nil, every test still passes. The keeper's saver() then returns nil (internal/engine/chunknotes.go:29-31), and every regenerate chunked failure silently saves no file and gives no warning, losing finished wave work. The engine tests cannot see this because they inject deps.ChunkNotes themselves."
    },
    {
      "round": 1,
      "finding": 7,
      "area": "12-the-remediation-floor",
      "call": "nit",
      "text": "The Edit method doc says \"A non-nil error means no edit could be obtained (e.g. no editor on PATH); the engine surfaces it and aborts\". This task widened that interface doc to cover \"an e choice\" at the floor as well as the review gate. A missing editor actually returns ErrEditorReturnToGate (internal/engine/editor.go:113-118), and both consumers re-present their gate without surfacing or aborting (internal/engine/notesfloor.go:165-166, internal/engine/release.go:1802-1808). Replace the sentence with: \"A non-nil error means no edit could be obtained: ErrEditorReturnToGate (no editor could be launched, already reported) sends the engine back to the gate or choice it came from; any other error is surfaced and aborts.\" — FAILS: the seam's own contract tells an implementer of a new Editor that every error aborts the run. It never mentions the ErrEditorReturnToGate sentinel that both gate loops branch on. A new implementation that reports a missing editor with a plain error would therefore turn the floor's AC8 path (warn and return to the choice) into an abort and unwind. The comment also breaks CLAUDE.md's \"true to as-built\" comment rule."
    },
    {
      "round": 1,
      "finding": 8,
      "area": "12-the-remediation-floor",
      "call": "nit",
      "text": "The file header (lines 19-22) says batch skip-and-continue is \"consciously OVERRIDING the single-version on_notes_failure=abort default\". TestRegenerateAll_SkipOverridesOnNotesFailureAbort's doc (lines 174-177) and its failure message (line 195, \"skip-and-continue must override on_notes_failure=abort\") say the same. Regenerate never reads on_notes_failure: the only production reader is notes.ResolveFailure (internal/notes/resolve.go:58), reached only from release's selector (internal/notes/select.go:266), and internal/engine/regenerate_interactive.go:234 states \"on_notes_failure is release's alone\". The test also never sets the key. The work edited line 20 of this same paragraph and the matching production comment at internal/engine/regenerate_batch.go:185, but left these lines. Fix: reword them to say the batch skips and continues whatever on_notes_failure holds, which it never reads, and drop the \"pins task 5-12\" process reference at line 19. — FAILS: a reader is told on_notes_failure governs regenerate, which contradicts §12.3 and the code's own comment at regenerate_interactive.go:234, and a test claims to prove an override of a setting it never sets."
    },
    {
      "round": 1,
      "finding": 10,
      "area": "18-documentation-and-the-setup-guide",
      "call": "nit",
      "text": "GenerateWithContext's doc still says \"It is the AI support for the review gate's r (regenerate) choice\", unqualified, while this task routed r on chunked notes to Remerge instead; the range counterpart's doc (internal/notes/generate.go:156-158) was qualified for the same change. Replace \"It is the AI support for the review gate's r (regenerate) choice:\" with \"It is the AI support for the review gate's r (regenerate) choice on notes not written by a chunked run (chunked notes re-merge through Remerge instead):\" — FAILS: a reader of the forward path's generator is told every r re-runs the whole AI path through this method, contradicting the merge-only r the code now takes, against CLAUDE.md's keep-comments-true-to-as-built rule and §18.3. Comment-only remedy; non-blocking."
    },
    {
      "round": 1,
      "finding": 11,
      "area": "5-per-verb-exclusion-lists",
      "call": "nit",
      "text": "This task changed the assertion two lines above to expect :(exclude)CHANGELOG.md plus :(exclude).mint.toml, but the failure message still reads \"want CHANGELOG.md exclude only\". Two test names make the same claim: TestAssembler_AssembleDiff_AbsentDiffExclude_ExcludesOnlyChangelog (internal/notes/assemble_test.go:272) and TestAssembler_BuildChangeMap_AbsentDiffExclude_ExcludesOnlyChangelog (internal/notes/changemap_test.go:350). This task updated both bodies, and their own comments now say \"the only excludes are the built-ins\". Fix: change the message to \"want the built-in excludes only\", and rename both tests to ..._ExcludesOnlyTheBuiltIns. — FAILS: if a regression drops the .mint.toml exclude, line 161 fails while stating \"CHANGELOG.md exclude only\" as the expectation. That is exactly the regressed argv, so it points the fixer at the wrong target. The two names also advertise the contract this task removed, against CLAUDE.md's rule that comments stay true to as-built."
    },
    {
      "round": 1,
      "finding": 12,
      "area": "16-progress-narration",
      "call": "serious",
      "text": "In pretty mode, a failed check kills the notes stage's live line for the rest of the stage. CheckFailed brackets its Warn with SuspendSpinner/ResumeSpinner so the notes line comes back afterwards, but the pretty presenter undoes the bracket. SuspendSpinner stops the spinner and sets spinnerSuspended = true (internal/presenter/pretty.go:437-445). PrettyPresenter.Warn then calls p.stopSpinner() (internal/presenter/pretty.go:691), which sets spinnerSuspended = false (internal/presenter/pretty.go:415). ResumeSpinner then returns without restarting anything (internal/presenter/pretty.go:458-460). With activeSpinner nil, every later NotesProgress/NotesHalving/NotesMerging is dropped by setSpinnerText (internal/presenter/pretty.go:548-551). The fix has more than one defensible shape. One is to make Warn stop a live spinner without clearing a pending suspend, so a bracketed Warn resumes. That needs a check of the other Warn-inside-a-bracket paths (the editor and gate brackets), where resuming would now also happen. The other is a dedicated presenter event for the check failure that renders without ending the line. Whichever shape is chosen, it should land with a pretty presenter test, for example beside internal/presenter/notescheck_test.go:46: drive StageStarted(Blocking) → NotesChecking → NotesChecked → SuspendSpinner → Warn → ResumeSpinner → NotesProgress, and assert a live spinner whose text becomes the Writing notes: … in N parts · 0 of N done line. — FAILS: in pretty mode at a TTY, any release whose check fails prints the ⚠ line and then shows nothing while the notes are written. A single call can take minutes, and a chunked run's progress never appears until ✓ Notes written (…), which is the \"looks hung\" state §16.1 exists to prevent. Plain mode and the RecordingPresenter-based engine tests do not see this, since plain's Suspend/Resume are no-ops and the recorder only checks event order."
    },
    {
      "round": 1,
      "finding": 13,
      "area": "6-the-exclusion-check",
      "call": "nit",
      "text": "The CheckNarration doc says it is told \"when the exclusion check's call starts and when it ends, and, after the end, when the check failed\". This task's no-fit path (internal/notes/exclusioncheck.go:130-131) calls CheckFailed(\"\") with no Checking/Checked before it, and the test at internal/notes/exclusioncondense_test.go:245 pins that order ([\"failed: \"]). Reword the doc so it covers both cases, e.g. \"CheckNarration is told when the exclusion check's call starts and when it ends, and when the check failed: after the call ends when the call failed or its answer was unreadable, and with no call at all when the call would not fit under the cap. output is the AI's captured output, or its unreadable answer, verbatim but for trailing whitespace, and empty when there is none.\" — FAILS: the interface contract states an ordering the code breaks. A CheckNarration implementation that relies on the documented order would mis-narrate a check whose call was never sent, for example by closing a check line in CheckFailed that Checking never opened. CLAUDE.md requires comments to change in the same commit as the behaviour they describe."
    },
    {
      "round": 1,
      "finding": 14,
      "area": "18-documentation-and-the-setup-guide",
      "call": "nit",
      "text": "the file header still describes \"the up-to-two-commit graph\" and says the tag lands on \"the bookkeeping commit when one exists, else the hook-artifact commit, else the pre-existing HEAD\". Since this task, the graph is up to three commits, and without a bookkeeping commit the tag sits on the answers commit when one was made. Reword lines 11-15 so the file says it pins the hook-artifact/bookkeeping combinations of a first release (where no exclusion check runs, so no answers commit is made), and state the tag rule as \"the last commit mint made this run, else the pre-existing HEAD\", matching internal/engine/release.go:729-730. Comment-only remedy, so not blocking. — FAILS: the comment states a commit-graph and tag-placement rule the shipped code now falsifies. That breaks CLAUDE.md's \"Keep them TRUE TO AS-BUILT\" rule and §18.3. A maintainer reading this file as the graph's pin would believe the three-commit order and the tag-on-answers-commit case are pinned here, when they are pinned only in release_answerscommit_test.go."
    },
    {
      "round": 1,
      "finding": 15,
      "area": "12-the-remediation-floor",
      "call": "nit",
      "text": "The touchesConfig doc says the git calls naming .mint.toml are \"the answers commit's ignore probe, staging or commit\". The commit step does not name it: record.CommitFile runs git -C dir commit -m subject (internal/record/commit.go:111), so only the check-ignore -q -- .mint.toml probe (internal/record/commit.go:121) and add .mint.toml (internal/record/commit.go:108) match. Change the comment's second clause to \"the answers commit's ignore probe or its staging\". Remedy is comment text only, so this is non-blocking. — FAILS: the comment says the guard covers more than it does. A maintainer who changes the answers commit to stage some other way (for example commit -a, or dropping the probe) would believe the commit call still trips touchesConfig. It does not, and the -y test's \"no answers commit\" assertion would then pass unnoticed."
    },
    {
      "round": 1,
      "finding": 16,
      "area": "6-the-exclusion-check",
      "call": "nit",
      "text": "The AUTO-UNWIND header says the unwind \"re-commits the exclusion answers on the starting commit when their commit had landed, the one thing it keeps\". Task 8-9's ignored route falsified this, and the header was written in this feature (e0e2e63, task 8-5). The unwind also keeps the answers' uncommitted write to an untracked .mint.toml that git ignores: release.go:1115 clears a.edit, so made.answersEdit is nil and unwind.go:127 reverts nothing. Fix by replacing \"then re-commits the exclusion answers on the starting commit when their commit had landed, the one thing it keeps.\" with \"then re-commits the exclusion answers on the starting commit when their commit had landed, and leaves their uncommitted write to a .mint.toml git ignores in place: the answers are the one thing it keeps.\" This is comment text only and does not block. — FAILS: a maintainer working in the release spine reads the header's \"the one thing it keeps\" and takes the surviving ignored-file write for a leak. Adding it to the unwind brings back the dead end the §6.6 corrigendum closed: a repo that ignores .mint.toml is asked the same questions again after every abort. This is the same failure task 9-3 names for CLAUDE.md, at the comment that sits on the code itself."
    },
    {
      "round": 1,
      "finding": 17,
      "area": "12-the-remediation-floor",
      "call": "nit",
      "text": "The phase 11 comment-corrections commit (49f7b86) deleted the type's whole doc comment instead of only dropping \"the -y flag\" as the task's Do said. type RegenerateRunRequest struct now has no doc. Fix: restore a short doc comment that is true of the current struct. For example: \"// RegenerateRunRequest carries one version's inputs to RegenerateRun, the single-version counterpart of BatchRegenerateRequest. It carries no -y: the notes floor reads -y from ReleaseDeps.Yes, and the presenter answers gates under it.\" — FAILS: This is the only one of the 25 top-level exported types in internal/engine's non-test files without a doc comment. go doc and editor hover show nothing for the request type at the centre of this fix. Nothing on the type now tells a maintainer that it is the single-version request or that -y does not belong on it. That is the confusion this task removed, and it would make re-adding a field that does nothing an easy mistake. Comment-only remedy; never blocking."
    }
  ],
  "not_proven": [
    {
      "round": 1,
      "scenario": "13.S1",
      "standing": "not proven",
      "text": "Afterwards notes.md is still untracked with its contents unchanged, and no commit the release made contains it"
    },
    {
      "round": 1,
      "scenario": "13.S2",
      "standing": "not proven",
      "text": "afterwards the file carries the same edits, staged if they were staged and unstaged if not"
    },
    {
      "round": 1,
      "scenario": "13.S3",
      "standing": "not proven",
      "text": "The notes file stays in the work tree through the run with its contents and staged state unchanged."
    },
    {
      "round": 1,
      "scenario": "13.S4",
      "standing": "not proven",
      "text": "the file that path names is the one left out of the clean-tree check, the stash and the commits"
    },
    {
      "round": 1,
      "scenario": "13.S5",
      "standing": "not proven",
      "text": "In each case HEAD is back at the starting commit, and the rest of the work tree is as the as-built reset leaves it: the changelog write, any version-file…"
    },
    {
      "round": 1,
      "scenario": "13.S6",
      "standing": "not proven",
      "text": "Given that file, --autostash with other uncommitted changes, and a failure before the push, the other changes are restored after the unwind as built."
    },
    {
      "round": 1,
      "scenario": "18.S7",
      "standing": "not proven",
      "text": "diff.noprefix = true, custom diff.srcPrefix/diff.dstPrefix and diff.mnemonicPrefix all yield a/P b/P headers once --src-prefix=a/ --dst-prefix=b/ sit ahead of…"
    },
    {
      "round": 1,
      "scenario": "6.S8",
      "standing": "not proven",
      "text": "Given either warning, carrying out the steps it names, in the order it names them, leaves the branch at the starting commit with the answers committed on top…"
    },
    {
      "round": 1,
      "scenario": "6.S9",
      "standing": "not proven",
      "text": "A tracked .mint.toml, one a .gitignore rule matches included, and an untracked or absent .mint.toml that no rule matches, take today's route"
    }
  ],
  "inbox": [
    {
      "round": 1,
      "finding": 9,
      "text": "The file header still says processOneVersion returns \"a per-version result + error the loop currently propagates) so task 5-12 can wrap each iteration in skip-and-continue\". The loop already records skips (internal/engine/regenerate_batch.go:207-210), and the paragraph is written in process-artifact terms (\"this task\", \"task 5-13\"). These lines were not touched by this work. Fix: describe the as-built split, where a skip is recorded and the loop continues while an error ends the batch, with no task ids. — FAILS: the header of the file that implements skip-and-continue describes it as future work, against CLAUDE.md's \"Never leave scope/phase claims that contradict the shipped code\"."
    }
  ],
  "verdict": "failed",
  "fixes": {
    "phase": 9,
    "round": 1,
    "tasks": [
      {
        "task": "9.1",
        "title": "The notes stage's live line after a failed check",
        "state": "not-started",
        "since": null,
        "on": []
      },
      {
        "task": "9.2",
        "title": "Add or repair the 4 tests the criteria name",
        "state": "not-started",
        "since": null,
        "on": []
      },
      {
        "task": "9.3",
        "title": "Correct the 11 comments that no longer match the code",
        "state": "not-started",
        "since": null,
        "on": []
      }
    ]
  }
}
