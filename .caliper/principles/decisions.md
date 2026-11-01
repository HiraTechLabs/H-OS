# Decision Principles (DEC)

Decisions record why the project is the way it is. They live in `.caliper/decisions/` (parent) and in each app's `.caliper/decisions/`.

### DEC-001 [must|ci] decision, *
A Decision is required before merging any change to architecture or module structure, tech stack or dependency category, a cross-app contract, a rule relaxation, or a security or data-ownership model.

### DEC-002 [must|ci] decision
File name `DEC-NNNN-short-title.md`. Front matter: `id`, `title`, `status` (proposed, accepted, superseded, rejected), `date`, `tags`, `affects` (paths or modules), `relaxes` (rule IDs, optional), `supersedes` (optional), `review_by` (required when `relaxes` is set). Body sections: Context, Options considered, Decision, Consequences, Rules affected.

### DEC-003 [must|review] decision
An accepted Decision is never edited except for status. Change direction with a new Decision that supersedes it.

### DEC-004 [must|ci] decision
Decisions are retrieved by `affects` and `tags`, not read in full. Keep each one short and self-contained.

### DEC-005 [must|review] decision
Always record the alternatives that were rejected and why. Do not write Decisions for obvious choices already fixed by a rule.

### DEC-006 [must|ci] decision
A rule relaxation cites an accepted Decision with a `review_by` date. Past that date the relaxation fails the resolver until reviewed.

### DEC-007 [must|review] decision, *
When a model meets ambiguity or a conflict between rules, it stops and proposes a Decision. It never resolves the conflict silently.

### DEC-008 [should|review] decision
Decisions the human has already made in conversation are captured as Decisions with the human's reasoning, not paraphrased into assumptions.
