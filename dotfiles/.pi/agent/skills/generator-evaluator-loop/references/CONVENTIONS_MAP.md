---
title: Conventions Map
scope: generator-evaluator-loop skill
---

# Conventions Map

Defines which convention documents Quality loads based on the story's Write
scope. Quality derives the domain from file paths — the Reasoner does not need
to enumerate conventions in the story.

---

## Lookup Rules

Evaluate the story's `**Write:**` file list against these patterns in order.
Multiple domains may match; load all that apply. `SOUL.md` always loads.

| Write scope pattern | Convention docs to load |
|--------------------|------------------------|
| `**/*.{cpp,h,hpp}` | `{project}/docs/core/architecture/ros2/CODE_CONVENTIONS.md` |
| `**/luum_ws/**` | `{project}/docs/core/architecture/ros2/CODE_CONVENTIONS.md` |
| `**/*.{ts,tsx}` | `{project}/docs/core/architecture/gui/CODE_CONVENTIONS.md` + `{project}/docs/core/architecture/gui/UI_CONVENTIONS.md` |
| `**/foxi-gui/**` | `{project}/docs/core/architecture/gui/CODE_CONVENTIONS.md` + `{project}/docs/core/architecture/gui/UI_CONVENTIONS.md` |
| `**/docs/core/architecture/**` | `{project}/AGENTS.md §10` |
| `**/docs/**` | `{project}/AGENTS.md §10` |
| `*` (always) | `{project}/SOUL.md` (or equivalent project identity doc) |

`{project}` is the harness workspace root — the directory containing `AGENTS.md`.

---

## Project Identity Doc

Every project using this skill should have a document that defines its design
principles, values, and "what done looks like." This is the `SOUL.md` equivalent.

Quality looks for it in this order:
1. `SOUL.md` at workspace root
2. `docs/core/SOUL.md`
3. `docs/reference/PRINCIPLES.md`
4. Falls back to `AGENTS.md §10` behavioral principles only

If none exist, Quality notes the absence in the evaluation result and applies
only the harness behavioral principles (enso §10).

---

## Convention Doc Absence

If a convention doc is listed above but does not exist in the project:
- Quality notes the absence in the evaluation result
- Quality does not fabricate conventions
- Standards review for that domain is skipped (not failed)
- Quality may flag the absence as a recommendation in the evaluation result

---

## Adding Project-Specific Patterns

Projects with additional domains (e.g., Python scripts, YAML config, Android/Kotlin)
should extend this map in their own harness. The global skill references the
generic patterns above; project-specific overrides live in the project's
`docs/skills/generator-evaluator-loop/` if they create a local copy.
