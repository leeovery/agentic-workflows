Execute skills/workflow-implementation-entry/SKILL.md with arguments
$0=feature, $1=pay, then continue into the processing skill it invokes
and run its task loop through every task in the plan. Stop once the
loop reports all tasks complete and control returns to the skill — do
not enter the analysis loop, and dispatch no analysis agents.
