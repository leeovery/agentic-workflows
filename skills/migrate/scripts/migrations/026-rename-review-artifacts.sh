#!/bin/bash
#
# Migration 026: Rename review artifacts
#
# - review.md → report.md (final synthesis)
# - qa-task-{N}.md → report-{phase_id}-{task_id}.md (per-task, positional mapping from plan)
#
# Uses positional mapping: qa-task files are numbered sequentially (1, 2, 3...)
# and map to plan tasks in table order. The internal ID ({topic}-{phase_id}-{task_id})
# has its topic prefix stripped to produce the file suffix ({phase_id}-{task_id}).
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
      report_update "$topic_dir/report.md" "renamed review.md → report.md"
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
      report_skip "$topic_dir" "no plan found for positional mapping"
      continue
    fi

    # Extract internal IDs from the plan task table
    # Rows match: | {topic}-{N}-{N} | ... (internal ID in first column)
    internal_ids=()
    while IFS= read -r line; do
      # Extract the internal ID from the first table column
      id=$(echo "$line" | sed -n 's/^| *\([^ |]*\) *|.*/\1/p')
      [ -n "$id" ] && internal_ids+=("$id")
    done < <(grep "^| *${topic}-[0-9]" "$plan_file")

    if [ ${#internal_ids[@]} -eq 0 ]; then
      report_skip "$topic_dir" "no task IDs found in plan"
      continue
    fi

    # Sort qa-task files numerically
    sorted_qa=()
    while IFS= read -r f; do
      sorted_qa+=("$f")
    done < <(printf '%s\n' "${qa_files[@]}" | sort -t- -k3 -n)

    # Validate counts match
    if [ ${#sorted_qa[@]} -ne ${#internal_ids[@]} ]; then
      report_skip "$topic_dir" "qa-task count (${#sorted_qa[@]}) != plan task count (${#internal_ids[@]})"
      continue
    fi

    # Rename each qa-task file using positional mapping
    for i in "${!sorted_qa[@]}"; do
      qa_file="${sorted_qa[$i]}"
      internal_id="${internal_ids[$i]}"

      # Strip topic prefix to get phase_id-task_id suffix
      suffix="${internal_id#"${topic}-"}"
      new_file="$topic_dir/report-${suffix}.md"

      if [ ! -f "$new_file" ]; then
        mv "$qa_file" "$new_file"
        report_update "$new_file" "renamed $(basename "$qa_file") → report-${suffix}.md"
      fi
    done
  done
done
