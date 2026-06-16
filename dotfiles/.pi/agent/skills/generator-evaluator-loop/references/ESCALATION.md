---
title: Escalation Reference
scope: generator-evaluator-loop skill
---

# Escalation Reference

Defines when Quality retries automatically vs. pauses for human resolution.

---

## Auto-Retry (Objective)

Quality rejects and feeds structured feedback back to the Generator. No human
involvement. Loop increments iteration counter and continues.

| Trigger | Examples |
|---------|---------|
| Build failure | `npm run build` error, `colcon build` failure, compile error |
| Lint / format failure | clang-format diff, Prettier diff, ESLint error |
| Static analysis finding | `verify-architecture` CRITICAL or STALE |
| Verification step not run | Story criterion exists but Quality has no tool output for it |
| Convention violation with explicit citation | Rule exists verbatim in a loaded convention doc |

**Citation requirement:** Every convention rejection must include the source doc
and section. "This doesn't match conventions" without a citation is not a valid
objective rejection — it becomes a subjective one and triggers escalation.

---

## Escalate (Subjective)

Quality pauses the loop, writes an escalation notice to the story, and exits.
Human reads, adjudicates, edits the story, and re-invokes the skill.

| Trigger | Examples |
|---------|---------|
| Story criterion ambiguity | Coder and Quality interpret the same Verification line differently |
| Project design principle violation | `SOUL.md` concern — simplicity, clarity, elegance |
| Wrong problem | Change is technically correct but Quality believes it doesn't satisfy story intent |
| Missing convention | Pattern is new; no convention doc covers it yet |
| Coder explicitly disputes a rejection | Generator's execution notes argue the rejection is wrong |

**SOUL.md violations always escalate.** Design judgment is the human's call,
not Quality's unilateral rejection.

---

## Forced Escalation

Escalates regardless of rejection type.

| Trigger | Condition |
|---------|-----------|
| Max iterations reached | Iteration count ≥ configured max (default: 3) |
| Stuck loop | Same finding appears in 2+ consecutive evaluation results |

Forced escalation notice must include the full iteration history summary so the
human can see what the loop tried and why it failed to converge.

---

## Escalation Is Not Failure

A paused loop is not a broken loop. It means the story's Verification section
needs clarification that only the human can provide. The loop resumes cleanly
once the story is updated.

Quality should frame escalation notices as questions, not verdicts.
