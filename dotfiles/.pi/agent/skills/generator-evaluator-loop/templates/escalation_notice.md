---
title: Escalation Notice Template
scope: generator-evaluator-loop skill
usage: Quality appends this to the story when the loop must pause for human
       resolution. Replace all {placeholders}.
---

<!--
  ESCALATION NOTICE
  Quality: append this block to the story immediately below the evaluation result.
  The loop is now paused. Do not continue until the human has adjudicated.
-->

## ⏸ Loop Paused — Escalation Required

**Iteration:** {N}
**Reason:** SUBJECTIVE_DISAGREEMENT | OBJECTIVE_EXHAUSTED | MAX_ITERATIONS | STUCK_LOOP

---

### The Disagreement

**Story criterion:**
> {exact quote from story Verification section}

**Generator's interpretation:**
{What the Coder did and the reasoning behind it, as understood from execution notes
or the change itself.}

**Quality's concern:**
{What Quality flagged. Be specific. If citing a principle, quote it.}

**Principle or doc cited (if any):**
{path/to/SOUL.md or convention doc — or "N/A — story intent ambiguity"}

---

### Iteration History

| # | Generator summary | Quality verdict | Key finding |
|---|-------------------|----------------|-------------|
{copy from Loop State iteration log}

---

### Question for Human

{Frame as a single, specific question. Not a verdict. Examples:
  - "Should the FSM timeout be configurable per-state or a single global value?"
  - "Does 'clean verify-architecture output' mean zero findings at any severity,
     or only CRITICAL findings?"
  - "Is the existing abstraction acceptable here, or should this be refactored
     into a separate class per SOUL.md simplicity principle?"}

---

### To Resume

1. Read the disagreement above
2. Edit the story to clarify — typically the `### Verification` section or `### Steps`
3. Optionally add a `### Arbiter Ruling` section to the story with your decision
4. Re-invoke the `generator-evaluator-loop` skill on this story
5. The loop will resume at iteration {N+1} with your ruling as new context

> The loop does not auto-resume. Re-invocation is always explicit.
