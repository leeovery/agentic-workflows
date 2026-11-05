// The review phase's This session as engine board answers it, for the locked board's Mint review once round 2 passed and finish waits on the person, held to its shape by tests/scripts/test-engine-board-review.cjs.
export default {
  "kind": "review",
  "unit": "token-aware-diff-sizing",
  "title": "Token-aware diff sizing",
  "project": "Mint",
  "type": "feature",
  "built": 99,
  "round": 2,
  "waiting": [{ "kind": "finish", "id": "finish", "text": "Finish: the report of every round, and your verdict on each call you changed", "page": null }],
  "stopped": false,
  "recorded": true,
  "areas": [
    {
      "area": "1",
      "title": "Purpose and Scope",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "2",
      "title": "The Lean Default AI Command",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "3",
      "title": "Quote-Aware ai_command Parsing",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "4",
      "title": "The Per-Call Size Cap",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "5",
      "title": "Per-Verb Exclusion Lists",
      "state": "read",
      "ran": 1,
      "found": 0,
      "since": null
    },
    {
      "area": "6",
      "title": "The Exclusion Check",
      "state": "read",
      "ran": 4,
      "found": 0,
      "since": null
    },
    {
      "area": "7",
      "title": "Routing a Release's Notes",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "8",
      "title": "Chunked Generation",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "9",
      "title": "Failure Classification",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "10",
      "title": "Halving After an Under-Cap Overflow",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "11",
      "title": "Failures in a Chunked Run",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "12",
      "title": "The Remediation Floor",
      "state": "read",
      "ran": 2,
      "found": 0,
      "since": null
    },
    {
      "area": "13",
      "title": "--notes-file",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "14",
      "title": "One Non-AI Body: Dropping [release].fallback",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "15",
      "title": "Chunked Notes at the Review Gate and in the Cache",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "16",
      "title": "Progress Narration",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "17",
      "title": "mint commit's AI-Failure Output",
      "state": "unchanged",
      "ran": 0,
      "found": 0,
      "since": null
    },
    {
      "area": "18",
      "title": "Documentation and the Setup Guide",
      "state": "read",
      "ran": 6,
      "found": 0,
      "since": null
    },
    {
      "area": "tests",
      "title": "Tests held against the specification",
      "state": "read",
      "ran": 0,
      "found": 0,
      "since": null
    }
  ],
  "found": [],
  "not_proven": [
    {
      "round": 2,
      "scenario": "13.S1",
      "standing": "not proven",
      "text": "Afterwards notes.md is still untracked with its contents unchanged, and no commit the release made contains it"
    },
    {
      "round": 2,
      "scenario": "13.S2",
      "standing": "not proven",
      "text": "afterwards the file carries the same edits, staged if they were staged and unstaged if not"
    },
    {
      "round": 2,
      "scenario": "13.S3",
      "standing": "not proven",
      "text": "The notes file stays in the work tree through the run with its contents and staged state unchanged."
    },
    {
      "round": 2,
      "scenario": "13.S4",
      "standing": "not proven",
      "text": "the file that path names is the one left out of the clean-tree check, the stash and the commits"
    },
    {
      "round": 2,
      "scenario": "13.S5",
      "standing": "not proven",
      "text": "In each case HEAD is back at the starting commit, and the rest of the work tree is as the as-built reset leaves it: the changelog write, any version-file…"
    },
    {
      "round": 2,
      "scenario": "13.S6",
      "standing": "not proven",
      "text": "Given that file, --autostash with other uncommitted changes, and a failure before the push, the other changes are restored after the unwind as built."
    },
    {
      "round": 2,
      "scenario": "18.S7",
      "standing": "not proven",
      "text": "diff.noprefix = true, custom diff.srcPrefix/diff.dstPrefix and diff.mnemonicPrefix all yield a/P b/P headers once --src-prefix=a/ --dst-prefix=b/ sit ahead of…"
    },
    {
      "round": 2,
      "scenario": "6.S8",
      "standing": "not proven",
      "text": "Given either warning, carrying out the steps it names, in the order it names them, leaves the branch at the starting commit with the answers committed on top…"
    },
    {
      "round": 2,
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
  "verdict": "passed",
  "fixes": {
    "phase": 9,
    "round": 1,
    "tasks": [
      {
        "task": "9.1",
        "title": "The notes stage's live line after a failed check",
        "state": "done",
        "since": null,
        "on": []
      },
      {
        "task": "9.2",
        "title": "Add or repair the 4 tests the criteria name",
        "state": "done",
        "since": null,
        "on": []
      },
      {
        "task": "9.3",
        "title": "Correct the 11 comments that no longer match the code",
        "state": "done",
        "since": null,
        "on": []
      }
    ]
  }
}
