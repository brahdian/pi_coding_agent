# Zenith Tech Debt Tracker SOP
Source: https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering/tech-debt-tracker/SKILL.md

Use this prompt to deeply scan for technical debt, score severity, and generate robust, prioritized remediation plans.

## Debt Taxonomy
- **Architectural Debt**: Shortcuts in system design, circular dependencies, bounded-context bleed.
- **Code Debt**: Bloated functions, god classes, lack of SOLID compliance, missing type safety.
- **Testing Debt**: Low coverage, missing regression tests, brittle assertions.
- **Dependency Debt**: Outdated libraries, unpatched vulnerabilities.
- **Documentation Debt**: Missing ADRs, outdated READMEs, lack of setup guides.

## Scoring Framework (0-10)
Score each debt item based on:
1. **Interest Rate**: How much does this slow down daily work? (0-4)
2. **Risk**: Probability of causing a production incident? (0-3)
3. **Contagion**: How likely is this to spread to other modules? (0-3)

**Remediation Priority**: High (8-10), Medium (5-7), Low (<5).

## Tech Debt Audit Protocol
1. **Scan**: Identify debt signals (e.g., TODOs, complex files, dependency drift).
2. **Score**: Apply the scoring framework objectively.
3. **Analyze**: Provide qualitative insight. Why is this dangerous? What is the blast radius?
4. **Prioritize & Schedule**: Create a ranked list of detailed remediation tasks mapped to Zenith construction waves.

## Output Format
1. **The Audit Report**: Write a robust, professional remediation plan. Explain the debt, the risks, and the exact steps to fix it.
2. **Zenith Manifest Sync**: Conclude your report with a JSON array so Zenith can track the work.
```json
[
  {
    "name": "debt-identifier",
    "description": "Short summary",
    "type": "Architectural|Code|Testing|Dependency|Documentation",
    "affected_module": "module_name",
    "violated_pillar": 0,
    "severity": "CRITICAL|HIGH|MEDIUM|LOW",
    "acceptance_criteria": "How we know it is fixed"
  }
]
```