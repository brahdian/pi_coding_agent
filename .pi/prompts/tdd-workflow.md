# Zenith TDD & Verification SOP
Source: https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering-team/tdd-guide/SKILL.md

Use this prompt for Test-Driven Development (TDD) workflows, test generation, and coverage analysis.

## Red-Green-Refactor Protocol
1. **RED**: Write a failing test first. Verify it fails for the right reason.
2. **GREEN**: Write the minimal code necessary to make the test pass.
3. **REFACTOR**: Clean up the code while keeping tests green.

## Test Generation Strategy
- **Happy Path**: Core functionality.
- **Error Cases**: Invalid inputs, timeouts, network failures.
- **Edge Cases**: Empty lists, boundary values (0, MAX_INT), null/undefined.
- **Security**: Unauthorized access, malformed tokens.

## Coverage Gaps
- **P0 (Critical)**: Uncovered error paths and core logic.
- **P1 (High)**: Business logic branches.
- **P2 (Medium)**: Utility and helper functions.

## Mutation Testing
Target critical paths (Auth, Payments, Data Processing) for mutation testing.
- Target: 85%+ mutation score on P0 modules.
