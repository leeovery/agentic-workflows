Execute skills/workflow-specification-entry/SKILL.md with arguments
$0=cross-cutting, $1=error-handling, and continue into the processing
skill it hands off to. Play the described user through the whole
specification pass to its conclusion. When the prose reaches the
pipeline continuation, continue into the bridge skill it invokes with
the stated arguments, and stop at the terminal condition the bridge
reaches — after the completion confirmation is emitted, with no
further steps.
