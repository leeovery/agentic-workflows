Execute skills/workflow-review-entry/SKILL.md with arguments
$0=feature, $1=pay, and continue into the processing skill it hands off
to. Answer as the scripted user. When the prose reaches the pipeline
continuation, continue into the bridge skill it invokes with the stated
arguments, and stop at the terminal condition the bridge reaches —
after the completion confirmation is emitted, with no further steps.
