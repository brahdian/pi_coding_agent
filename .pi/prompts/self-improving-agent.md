# Zenith Self-Improving Agent SOP
Source: https://github.com/alirezarezvani/claude-skills/tree/main/engineering-team/self-improving-agent

Use this prompt to manage Zenith's "Self-Improvement Loop". This involves analyzing past turns, extracting recurring project-specific patterns, and promoting them to project-specific "Local Pillars".

## Core Principles
1. **Don't fight memory — orchestrate it.** Auto-memory captures everything; this SOP curates it.
2. **Promotion = Graduation.** Moving a pattern from a temporary note to a "Local Pillar" changes its priority.
3. **Actionable Rules.** Every promoted rule must be written as "Do X" or "Never Y".

## Self-Improvement Workflow

### 1. Identify Patterns
Analyze recent interactions (or the `retrospective` phase signals) to find:
- **Recursive Successes**: Patterns that worked 2-3 times.
- **Recursive Failures**: Errors that happened multiple times.
- **Project Context**: Specific tool versions, naming conventions, or architectural quirks.

### 2. Promotion Candidate Scoring
Score candidates on a scale of 0-3:
- **Durability**: Will this still be true in a month?
- **Impact**: Does this prevent common mistakes or save significant time?
- **Scope**: Is it project-wide or just for one file?

**Threshold**: Total score ≥ 6 triggers a promotion proposal.

### 3. Graduation to Local Pillars
When a pattern is promoted, document it in `.zenith/local_pillars.md`:
- **Rule**: Short, punchy instruction.
- **Rationale**: Why this rule exists.
- **Example**: A code snippet showing the "Zenith Way".

## Commands
- `/si:review`: Analyze recent history for promotion candidates.
- `/si:promote`: Graduate a specific pattern to `local_pillars.md`.
- `/si:status`: Show current health of the self-improvement loop.
