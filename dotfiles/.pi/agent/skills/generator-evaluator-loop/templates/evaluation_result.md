---
title: Evaluation Result Template
scope: generator-evaluator-loop skill
usage: Quality appends one instance of this per iteration to the story file.
       Replace all {placeholders}. Delete sections that have no findings.
---

<!--
  EVALUATION RESULT — Iteration {N}
  Quality: append this block to the story after each evaluation pass.
  Do not delete prior iterations — they are summarized in Loop State.
-->

## Evaluation Result — Iteration {N}

**Status:** ACCEPTED | REJECTED | ESCALATED
**Date:** YYYY-MM-DD HH:MM
**Conventions loaded:** {list of convention docs consulted}

---

### Tool-Based Findings (Objective)

One row per criterion in the story's Verification section.
Result must be based on actual tool execution — not assumed.

| Criterion | Command run | Result | Output / log |
|-----------|-------------|--------|--------------|
| {from story Verification} | `{exact command}` | ✅ PASS \| ❌ FAIL | {verbatim output or path} |

> If a tool could not be run, mark result as ⚠️ NOT RUN and explain why.
> NOT RUN is not a pass — it is a blocker that must be resolved before ACCEPTED.

---

### Convention Findings (Objective with citation)

One row per violation. Empty table = no convention violations found.

| File | Line | Convention doc | Section | Violation |
|------|------|---------------|---------|-----------|
| {path} | {N} | {doc path} | {§ or anchor} | {specific description} |

---

### Design Findings (Subjective — escalation candidates)

One row per concern. Empty table = no subjective concerns.
Every row here is a candidate for escalation. Quality must decide: escalate now,
or note as informational if the concern is minor and the story passes otherwise.

| Concern | Story reference | Generator's approach | Quality's concern |
|---------|----------------|---------------------|-------------------|
| {description} | {Verification line or AC item} | {what Coder did} | {why Quality is concerned} |

---

### Actionable Feedback for Generator

Only present when Status = REJECTED. Specific, ordered, completable.
Each item maps to a finding above.

- [ ] {specific change — file, line, what to fix, citation if applicable}
- [ ] {specific change}

---

### Loop ROI Note

> Quality: record one line for the iteration log in Loop State.
> Format: `| {N} | {generator summary} | {verdict} | {tier} | {key finding} |`
