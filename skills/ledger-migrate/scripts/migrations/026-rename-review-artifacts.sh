#!/bin/bash
#
# Migration 026: Rename review artifacts
#
# - review.md → report.md (final synthesis)
# - qa-task-{N}.md → report-{phase_id}-{task_id}.md (per-task, positional mapping from plan)
#
# Uses positional mapping: qa-task files are numbered sequentially (1, 2, 3...)
# and map to plan tasks in table order. The suffix ({phase_id}-{task_id}) is
# extracted as the trailing two numeric segments of each internal ID.
#
# Idempotent. Direct file operations — never uses manifest CLI.
#

WORKFLOWS_DIR="${PROJECT_DIR:-.}/.workflows"

[ -d "$WORKFLOWS_DIR" ] || return 0

for manifest in "$WORKFLOWS_DIR"/*/manifest.json; do
  [ -f "$manifest" ] || continue

  dir=$(dirname "$manifest")
  wu_name=$(basename "$dir")

  # Skip dot-prefixed directories
  case "$wu_name" in .*) continue ;; esac

  review_dir="$dir/review"
  [ -d "$review_dir" ] || continue

  # Process each topic directory under review/
  for topic_dir in "$review_dir"/*/; do
    [ -d "$topic_dir" ] || continue
    topic=$(basename "$topic_dir")

    # Step 1: Rename review.md → report.md
    if [ -f "$topic_dir/review.md" ] && [ ! -f "$topic_dir/report.md" ]; then
      mv "$topic_dir/review.md" "$topic_dir/report.md"
      report_update
    fi

    # Step 2: Rename qa-task-{N}.md → report-{phase_id}-{task_id}.md
    # Check if any qa-task files exist
    qa_files=()
    for f in "$topic_dir"/qa-task-*.md; do
      [ -f "$f" ] && qa_files+=("$f")
    done
    [ ${#qa_files[@]} -eq 0 ] && continue

    # Find the plan to build positional mapping
    plan_file="$dir/planning/$topic/planning.md"
    if [ ! -f "$plan_file" ]; then
      report_skip
      continue
    fi

    # Extract internal IDs from the plan task table.
    # IDs may use an abbreviated prefix (e.g. acps-1-1 for topic auto-cascade-parent-status),
    # so we match any row whose first column starts with a letter and ends with -{digit}-{digit}.
    # The letter requirement excludes date rows (e.g. 2026-01-27) in changelog tables.
    internal_ids=()
    while IFS= read -r line; do
      id=$(echo "$line" | sed -n 's/^| *\([^ |]*\) *|.*/\1/p')
      [ -n "$id" ] && internal_ids+=("$id")
    done < <(grep -E '^\| *[a-zA-Z][^ |]*-[0-9]+-[0-9]+ *\|' "$plan_file")

    if [ ${#internal_ids[@]} -eq 0 ]; then
      report_skip
      continue
    fi

    # Sort qa-task files numerically by the N in qa-task-{N}.md. The basename
    # number is the only reliable key: sorting dash-split full paths keys on a
    # field that shifts with kebab-case directory names, so >=10 tasks would
    # sort lexicographically (qa-task-10 before qa-task-2). Emit "N<TAB>path",
    # sort by the numeric key, then strip it.
    sorted_qa=()
    while IFS= read -r f; do
      sorted_qa+=("$f")
    done < <(
      for f in "${qa_files[@]}"; do
        n=$(basename "$f" | sed -n 's/^qa-task-\([0-9][0-9]*\)\.md$/\1/p')
        printf '%s\t%s\n' "$n" "$f"
      done | sort -n -k1,1 | cut -f2-
    )

    # Validate counts match
    if [ ${#sorted_qa[@]} -ne ${#internal_ids[@]} ]; then
      report_skip
      continue
    fi

    # Rename each qa-task file using positional mapping
    for i in "${!sorted_qa[@]}"; do
      qa_file="${sorted_qa[$i]}"
      internal_id="${internal_ids[$i]}"

      # Extract trailing {phase_id}-{task_id} from internal ID
      # Works regardless of prefix (full topic name or abbreviation)
      suffix=$(echo "$internal_id" | grep -oE '[0-9]+-[0-9]+$')
      new_file="$topic_dir/report-${suffix}.md"

      if [ ! -f "$new_file" ]; then
        mv "$qa_file" "$new_file"
        report_update
      fi
    done
  done
done
