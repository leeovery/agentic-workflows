Execute skills/workflow-implementation-entry/SKILL.md with arguments
$0=feature, $1=pay, then continue into the processing skill it invokes
and run its task loop. Stop once the phase's closing sweep has finished
with the plan and the loop comes back round to picking up work — start
none of the work that sweep added, and do not enter the analysis loop.
