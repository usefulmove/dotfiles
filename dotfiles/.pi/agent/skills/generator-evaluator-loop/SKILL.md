---
name: generator-evaluator-loop
description: Orchestrate a Coder→Quality iteration loop against a story's Verification contract. Use when a story has a complete Verification section and is ready for execution with automated review.
license: MIT
compatibility: opencode
---

# generator-evaluator-loop

Automates the Generator→Evaluator→Generator feedback cycle for a single enso
story. The story's `### Verification` section is the immutable contract. Tool
failures and convention violations trigger automatic retry. Subjective
disagreements on story intent or design principles pause the loop and escalate
to the human.

---

## When to Use

- Story has a complete `### Verification` section written by the Reasoner
- Story `## Approach & Verification Plan` is finalized (planning phase complete)
- Story `## Context Scope` Write/Read/Exclude lists are defined
- You want automated review with human escalation on disagreement

## When NOT to Use

- Story is still in planning (Verification section incomplete or missing)
- Trivial single-step changes where review overhead exceeds value
- Story has no verifiable success criteria (commands, expected output, tests)
- Story is already in `reference/completed/` — it's done

---

## Roles

| Role | Mode | Responsibility |
|------|------|----------------|
| **Generator** | Coder | Executes story. Produces changes + execution notes. |
| **Evaluator** | Quality | Reads Verification criteria. Runs tools. Reviews conventions. Produces `evaluation_result`. |
| **Arbiter** | Human | Resolves Generator/Evaluator disagreements on story intent or design. |

The Reasoner writes the story before this skill is invoked. The Reasoner is not
active during the loop.

---

## The Loop

```
User invokes skill with story path
         │
         ▼
  ┌─ VALIDATE ──────────────────────────────────────────┐
  │  Story has complete Verification section?            │
  │  Context Scope defined?                              │
  │  Branch/Worktree resolved (if applicable)?           │
  └──────────────────────────────────────────────────────┘
         │ valid                    │ invalid
         ▼                          ▼
  Initialize Loop State        Report + exit (do not start)
  Append ## Loop State
  to story
         │
         ▼
  ┌─ GENERATOR (Coder mode) ────────────────────────────┐
  │  Inputs: story + current context                     │
  │          + prior evaluation_result (if iteration>0)  │
  │  Output: changes applied per Write scope             │
  │          + execution notes (what was done and why)   │
  └──────────────────────────────────────────────────────┘
         │
         ▼
  ┌─ EVALUATOR (Quality mode) ──────────────────────────┐
  │  1. Load convention docs (see CONVENTIONS_MAP.md)    │
  │  2. Run every tool in story Verification section     │
  │  3. Review changes against loaded convention docs    │
  │  4. Classify each finding: OBJECTIVE or SUBJECTIVE   │
  │  5. Produce evaluation_result (see template)         │
  │  6. Update Loop State iteration log                  │
  └──────────────────────────────────────────────────────┘
         │
         ├─── All criteria PASS ──────────────────────────▶ ACCEPTED
         │                                                   Check off Verification
         │                                                   boxes in story. Exit.
         │
         ├─── OBJECTIVE rejections only ─────────────────▶ RETRY
         │    (tool failure, cited convention violation)      Increment iteration.
         │    AND iteration < max                             Return to Generator
         │                                                    with feedback.
         │
         ├─── Any SUBJECTIVE rejection ──────────────────▶ ESCALATE
         │    (design judgment, story-intent ambiguity,       Append escalation_notice
         │     SOUL.md / project principle concern)           to story. Exit. Await
         │                                                    human ruling.
         │
         └─── iteration ≥ max OR same finding 2× ────────▶ FORCE ESCALATE
              (regardless of rejection type)                  Append escalation_notice
                                                              with full iteration
                                                              history. Exit.
```

---

## Step-by-Step Procedure

### Step 1 — Validate the story

Before starting the loop, confirm:

- [ ] `### Verification` section exists and has at least one checkable criterion
- [ ] `## Context Scope` has a non-empty `**Write:**` list
- [ ] If story has `**Branch:**` / `**Worktree:**` fields, worktree exists and is resolved
- [ ] Story is in `docs/stories/` (not `reference/completed/`)

If any check fails: report the specific gap to the user and exit. Do not start
the loop with an incomplete contract.

### Step 2 — Initialize loop state

Append the following block to the story file (after the last existing section):

```markdown
## Loop State

**Skill:** generator-evaluator-loop
**Invoked:** YYYY-MM-DD HH:MM
**Max iterations:** 3
**Current iteration:** 0
**Status:** RUNNING

### Iteration Log
| # | Generator summary | Quality verdict | Rejection tier | Key finding |
|---|-------------------|----------------|----------------|-------------|
```

Determine which convention docs to load for the Evaluator phase by consulting
`references/CONVENTIONS_MAP.md` against the story's Write scope file paths.

### Step 3 — Generator phase (Coder mode)

Invoke the Generator as a Coder-mode sub-agent via the `task` tool.

**Inputs to provide:**
- Full story file content
- Prior `evaluation_result` block if iteration > 0 (the actionable feedback list)
- Instruction: execute the story per enso §10 behavioral principles — surgical,
  scoped, simple. Write execution notes summarizing what was changed and why.

**Generator must NOT:**
- Modify the story's `### Verification` section
- Modify the story's `## Acceptance Criteria`
- Modify the `## Loop State` section
- Work outside the story's `**Write:**` scope without flagging it

**Generator execution notes** (appended to story under `## Execution Notes — Iteration N`):
- What files were changed and why
- Any assumptions made
- Any scope questions that arose
- If disputing a prior rejection: state the dispute explicitly here

### Step 4 — Evaluator phase (Quality mode)

Invoke the Evaluator as a Quality-mode sub-agent via the `task` tool.

**Inputs to provide:**
- Full story file content (including execution notes from Step 3)
- List of convention docs to load (from Step 2)
- Instruction: evaluate per the contract defined in `references/EVALUATION_CONTRACT.md`

**Evaluator procedure:**

1. **Run tools first.** Execute every command listed in the story's
   `### Verification` section. Capture verbatim output. Do not evaluate
   conventions until all tools have been run.

2. **Review conventions.** For each changed file, check against the loaded
   convention docs. Every finding must cite doc path + section. No citation =
   not a valid objective rejection.

3. **Review design.** Read changed files against the project identity doc
   (`SOUL.md` or equivalent). Flag concerns as SUBJECTIVE — do not reject
   unilaterally on design grounds.

4. **Classify findings:**
   - Tool failure → OBJECTIVE
   - Convention violation with citation → OBJECTIVE
   - Convention violation without citation → SUBJECTIVE
   - Design / project-principle concern → SUBJECTIVE
   - Story-intent ambiguity → SUBJECTIVE

5. **Produce `evaluation_result`** using `templates/evaluation_result.md`.
   Append to story under `## Evaluation Result — Iteration N`.

6. **Update Loop State** iteration log with one-line summary.

### Step 5 — Decision

Read the evaluation result and route:

| Condition | Action |
|-----------|--------|
| Status = ACCEPTED | Check off Verification boxes. Update Loop State status to ACCEPTED. Exit. |
| Status = REJECTED, all findings OBJECTIVE, iteration < max | Increment iteration counter in Loop State. Return to Step 3. |
| Status = REJECTED, any finding SUBJECTIVE | Append `escalation_notice` (see template). Update Loop State status to ESCALATED. Exit. |
| iteration ≥ max | Append `escalation_notice` with reason MAX_ITERATIONS. Update Loop State status to EXHAUSTED. Exit. |
| Same key finding appears in 2+ consecutive iterations | Append `escalation_notice` with reason STUCK_LOOP. Update Loop State status to ESCALATED. Exit. |

### Step 6 — Resuming after escalation

When the user re-invokes the skill after adjudicating an escalation:

1. Read the `## Arbiter Ruling` section the user added to the story
2. Do NOT re-run prior iterations — resume from the iteration after the escalation
3. Carry the ruling as additional context into the Generator phase
4. The ruling is binding: if Quality would reject on the same grounds again,
   it must accept the ruling and note it in the evaluation result instead

---

## Inputs

| Input | Required | Description |
|-------|----------|-------------|
| Story path | Yes | Relative or absolute path to the story file |
| Max iterations | No | Default: 3. Override if story is complex. |

Example invocation:
> "Run the generator-evaluator-loop skill on docs/stories/STORY-042.md"

---

## Outputs

| Output | Location | Description |
|--------|----------|-------------|
| Code / doc changes | Per story Write scope | The actual work product |
| Loop State | Appended to story | Iteration log, status, ROI data |
| Execution Notes | Appended to story (per iteration) | Generator's summary of what was done |
| Evaluation Result | Appended to story (per iteration) | Quality's findings and verdict |
| Escalation Notice | Appended to story (if escalated) | Disagreement framed as a question for human |

---

## Measuring Loop ROI

The iteration log in `## Loop State` is the primary ROI signal. After running
the loop on several stories, review the logs to answer:

- **Pass rate on iteration 1** — if consistently >80%, the loop may be
  over-engineered for this project's story quality
- **Rejection tier distribution** — mostly OBJECTIVE = tools doing the work
  (good); mostly SUBJECTIVE = Verification sections need sharper criteria
- **Finding categories** — which tool or convention catches the most real
  errors? Invest in those checks.
- **Escalation rate** — high rate = Reasoner stories need clearer Verification
  sections; consider feeding this back to the Reasoner prompt

See `references/EVALUATION_CONTRACT.md` §Measuring Loop ROI for the full
framework.

---

## References

| Document | Purpose |
|----------|---------|
| `references/EVALUATION_CONTRACT.md` | new_context schema, rejection taxonomy, ROI framework |
| `references/ESCALATION.md` | Full escalation trigger taxonomy |
| `references/CONVENTIONS_MAP.md` | Which convention docs load per domain |
| `templates/evaluation_result.md` | Quality's output template |
| `templates/escalation_notice.md` | Escalation pause template |
