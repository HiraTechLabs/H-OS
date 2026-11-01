# Clean Code Principles (CODE)

### CODE-001 [must|lint] *
TypeScript strict mode. No `any` without a `// why:` comment and a lint suppression. No `@ts-ignore`; use `@ts-expect-error` with the reason.

### CODE-002 [should|lint] *
Functions do one thing: at most 40 lines and cyclomatic complexity 10. Files stay under 300 lines. Split by responsibility, not by line count alone.

### CODE-003 [must|review] *
Names reveal intent and use the domain glossary (`docs/glossary.md`). Identifiers are English. No abbreviations except those in the glossary.

### CODE-004 [must|lint] *
No dead code, no commented-out code, no unused exports or dependencies (knip in CI).

### CODE-005 [must|lint] *
Comments explain why, not what. A TODO must carry an issue ID.

### CODE-006 [must|lint] domain
Immutability by default: `readonly`, no mutation of inputs, no shared mutable state.

### CODE-007 [must|review] domain, api
Expected failures are typed domain errors mapped to API errors at the boundary. Never swallow an exception, never use an empty `catch`, never throw bare strings.

### CODE-008 [must|lint] *
Formatting and import order are automated (Prettier, ESLint). Review does not discuss style.

### CODE-009 [must|review] *
No magic numbers or strings: use named constants, enums or config. Remove duplication of business knowledge; do not merge code that merely looks alike.

### CODE-010 [must|ci] deps
Each new dependency needs a one-line justification in the PR, an acceptable license, active maintenance, and no equivalent already in the stack.

### CODE-011 [should|review] *
Public functions and exported types have precise types. Prefer discriminated unions over optional-field bags and boolean flags that change behavior.

### CODE-012 [must|review] *
Keep the diff to what the request needs: no drive-by refactors, no unrelated renames.
