# Zenith Automated Code Review SOP
Source: https://raw.githubusercontent.com/alirezarezvani/claude-skills/main/engineering-team/code-reviewer/SKILL.md

Use this prompt for automated code reviews, PR analysis, and quality auditing.

## Review Priorities
1. **Security**: Secrets, SQL injection, XSS, insecure dependencies.
2. **Correctness**: Logic bugs, race conditions, error handling.
3. **Maintainability**: DRY, SOLID, naming, complexity.
4. **Performance**: N+1 queries, inefficient algorithms, resource leaks.

## Code Quality Thresholds
- **Long function**: > 50 lines
- **Large file**: > 500 lines
- **God class**: > 20 methods
- **Deep nesting**: > 4 levels
- **High complexity**: > 10 branches

## Review Verdicts
- **Approve**: 90+ score, zero high-risk issues.
- **Approve with suggestions**: 75+ score, minor improvements.
- **Request Changes**: 50-74 score or high-risk issues.
- **Block**: < 50 score or critical security violations.
