---
title: Evaluation Contract
scope: generator-evaluator-loop skill
---

# Evaluation Contract

Defines the `new_context` schema, rejection taxonomy, and loop state structure.

---

## The Contract

The story's `### Verification` section is the evaluation contract. It is written
by the Reasoner before execution begins and is **immutable during the loop**.

- Generator cannot modify the Verification section
- Quality cannot modify the Verification section
- Only the human Arbiter can modify it, and only during an escalation

If Quality believes a Verification criterion is wrong, that is an escalation —
not a silent skip.

---

## Loop State (in story file)

Appended to the story under `## Loop State` when the skill is first invoked.
Updated by Quality at the end of each iteration.

```markdown
## Loop State

**Skill:** generator-evaluator-loop
**Invoked:** YYYY-MM-DD HH:MM
**Max iterations:** 3
**Current iteration:** N
**Status:** RUNNING | ACCEPTED | ESCALATED | EXHAUSTED

### Iteration Log
| # | Generator summary | Quality verdict | Rejection tier | Key finding |
|---|-------------------|----------------|----------------|-------------|
| 1 | {one line} | REJECTED | OBJECTIVE | {tool + finding} |
| 2 | {one line} | ACCEPTED | — | — |
```

The iteration log is the primary artifact for evaluating loop ROI. It answers:
- Did the loop catch anything? (verdict column)
- What tier of error? (rejection tier)
- Was it worth the tokens? (key finding)

---

## `new_context` Schema

Quality produces one `evaluation_result` per iteration. It is appended to the
story (prior iterations are summarized in the Loop State table, not deleted).

See `templates/evaluation_result.md` for the full template.

### Required fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | ACCEPTED \| REJECTED \| ESCALATED | Overall verdict |
| `iteration` | integer | Current loop iteration number |
| `tool_findings` | table | One row per Verification criterion |
| `convention_findings` | table | One row per convention violation found |
| `design_findings` | table | One row per subjective concern (escalation candidates) |
| `actionable_feedback` | checklist | Specific changes for Generator to make |
| `escalation_required` | boolean | Whether loop should pause |

### Rejection tier classification

| Tier | Criteria | Loop action |
|------|----------|-------------|
| OBJECTIVE | Tool output or cited convention | Auto-retry |
| SUBJECTIVE | Design judgment, story-intent ambiguity | Escalate |
| NONE | All criteria pass | Accept |

---

## What Quality Must NOT Do

- Invent verification criteria not in the story
- Reject based on personal style preference without a convention citation
- Modify the story's Acceptance Criteria or Verification section
- Pass a story that has unrun tool checks (absence of failure ≠ pass)
- Conflate "I would have done it differently" with "this is wrong"

---

## What Quality MUST Do

- Run every tool prescribed in the Verification section
- Capture verbatim tool output (or path to log) for every tool run
- Cite the specific doc and section for every convention finding
- Clearly label subjective concerns as subjective
- Produce actionable feedback — specific enough that Generator knows exactly what to change
- Record the iteration in the Loop State table regardless of verdict

---

## Measuring Loop ROI

After N stories, review the iteration logs to answer:

1. **Pass rate on iteration 1** — if >80%, loop may be over-engineered for this project
2. **Rejection tier distribution** — mostly OBJECTIVE means tools are doing the work (good);
   mostly SUBJECTIVE means the Verification section needs better criteria
3. **Finding categories** — which tool or convention catches the most? Invest there.
4. **Escalation rate** — high escalation rate means Reasoner stories need clearer Verification sections

This data lives in the story files. A periodic review of `docs/stories/` and
`docs/reference/completed/` iteration logs gives the signal.
