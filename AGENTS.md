# Agents, Workflows, and Patterns

This directory contains custom agents, reusable workflow templates, and quality patterns for orchestrating multi-agent work in Claude Code.

## Available Agents

- **architect** - Systems architect for product design and architecture decisions
- **code-reviewer** - Code reviewer for PRs and implementation audits

See `agents/` for detailed configuration.

## Workflow Templates

Reusable orchestration scripts for common multi-agent patterns. Each template accepts arguments and can be customized for your domain. Stored in `workflows/`.

### audit-codebase.js

Fan out auditors to find issues, then adversarially verify each finding before reporting.

```
Pattern: Find → Audit in parallel → Verify each finding → Report confirmed
Cost: O(files × 3 verifiers)
Use when: Security audits, compliance checks, code standards sweeps
```

**Example:** Audit all routes for missing authentication checks
```
/audit-codebase --pattern src/routes/*.ts --issue "missing auth checks"
```

### migrate-in-parallel.js

Discover files, transform each in an isolated worktree (no conflicts), verify results.

```
Pattern: Find → Migrate each in isolated tree → Verify migrations
Cost: O(files) with worktree isolation
Use when: Refactors, library upgrades, large API changes
```

**Example:** Migrate all components from styled-components to Tailwind
```
/migrate-in-parallel --pattern src/components/*.tsx --task "replace styled-components with Tailwind"
```

### research-question.js

Fan out web searches, fetch sources, cross-check claims, synthesize a cited report.

```
Pattern: Search (3 angles) → Fetch sources → Verify claims cross-source → Synthesize
Cost: O(sources × 3 checks)
Use when: Competitive analysis, trend research, tech evaluation
```

**Example:** Research rate limiting approaches
```
/research-question --question "How do AWS, GCP, Azure handle rate limiting?"
```

### loop-until-converged.js

Iteratively find issues, deduplicate against what's seen, stop when N rounds find nothing new.

```
Pattern: Search → Dedup → Loop until dry
Cost: O(rounds) with dedup optimization
Use when: Flaky test discovery, bug sweeps, finding edge cases
```

**Example:** Find all flaky tests
```
/loop-until-converged --task "Find flaky tests" --rounds 5 --dryRounds 2
```

### judge-panel.js

Have N agents draft solutions from different angles, judge each draft, synthesize winner + best ideas.

```
Pattern: Draft (MVP/Risk/Cost/User angles) → Judge each → Synthesize
Cost: O(angles × 2) = drafts + judges
Use when: Architecture decisions, design choices, trade-off analysis
```

**Example:** Decide between ORM options
```
/judge-panel --decision "Should we migrate to Drizzle ORM?"
```

### audit-auth-implementation.js

Review authentication code for security vulnerabilities and BetterAuth pattern opportunities.

```
Pattern: Find auth files → Audit for vulnerabilities → Verify findings
Cost: O(files × 3 verifiers)
Use when: Security audit, auth implementation review, BetterAuth migration planning
```

**Example:** Audit auth endpoints for vulnerabilities
```
/audit-auth-implementation --pattern "src/**/*.ts" --severity "critical"
```

## Quality Patterns

Reusable orchestration techniques that encode best practices. Referenced in workflow templates and available in `rules/patterns-*.md`.

### Adversarial Verification

Spawn N skeptics to refute each finding. Report only if majority survives refutation.

**Best for:** High-stakes findings (security, breaking changes)  
**Cost:** 3× per finding  
**Filename:** `patterns-adversarial-verify.md`

```javascript
const votes = await parallel(Array.from({length: 3}, () => () =>
  agent(`Try to refute: ${finding}`, {schema: VERDICT})
))
const survives = votes.filter(Boolean).filter(v => !v.refuted).length >= 2
```

### Perspective-Diverse Review

Each reviewer examines via a different lens (correctness, security, perf, etc).

**Best for:** Multi-faceted quality (code, design, architecture)  
**Cost:** N lenses per finding  
**Filename:** `patterns-perspective-diverse.md`

```javascript
const reviews = await parallel([
  () => agent('Review for CORRECTNESS...'),
  () => agent('Review for SECURITY...'),
  () => agent('Review for PERFORMANCE...'),
])
```

### Deduplication Against Seen Set

Maintain Set<key>, filter new items, avoid re-processing duplicates.

**Best for:** Iterative discovery (loop-until-dry)  
**Cost:** Negligible (O(1) per check)  
**Filename:** `patterns-dedup.md`

```javascript
const fresh = new_items.filter(item => !seen.has(key(item)))
new_items.forEach(item => seen.add(key(item)))
```

### Judge Panel with Synthesis

Draft from N angles, judge each independently, combine winner + best ideas.

**Best for:** Decisions with no obvious right answer  
**Cost:** N drafts + N judges + synthesis  
**Filename:** `patterns-judge-panel.md`

```javascript
const drafts = await parallel(angles.map(angle => () =>
  agent(`From the ${angle} perspective: ...`)
))
const judged = await parallel(drafts.map(d => () =>
  agent(`Evaluate this draft...`)
))
const synthesis = await agent('Combine winner + best ideas...')
```

### Cost-Aware Scaling

Scale agent count and rounds based on available token budget.

**Best for:** Open-ended discovery with budget constraints  
**Cost:** Adapts to user's token limit  
**Filename:** `patterns-cost-aware.md`

```javascript
const maxRounds = budget.total
  ? Math.min(5, Math.floor(budget.remaining() / 50_000))
  : 5
```

### Phase-Based Orchestration

Use `pipeline()` (no barrier) for independent stages, `parallel()` (barrier) for cross-item logic.

**Best for:** Structuring multi-stage workflows  
**Cost:** Optimizes wall-clock time  
**Filename:** `patterns-phase-orchestration.md`

```javascript
// Pipeline: each item flows independently
const stage1 = await pipeline(items, (item) => agent('Stage 1...'))

// Barrier: dedup needs all stage1 results
const deduped = dedup(stage1)

// Parallel: verify deduped items
const stage2 = await parallel(
  deduped.map(item => () => agent('Stage 2...'))
)
```

## When to Use Workflows vs Subagents vs Skills

| | Subagents | Skills | Workflows |
|---|-----------|--------|-----------|
| **What** | Single specialized worker | Documentation/instructions | Multi-agent orchestration script |
| **Who decides next step** | Claude, turn-by-turn | Claude, following prompt | Script, executing deterministically |
| **Results** | Land in context | Improve prompts | Stay in script variables |
| **Repeatable** | Worker definition | Instructions | Orchestration itself |
| **Scale** | Few per turn | N/A | Dozens to hundreds |
| **Use when** | Offloading a side task | Teaching Claude about a skill | Building repeatable multi-phase work |

**Example workflow usage:**
- ✅ Audit 100 files for issues → use workflow (parallelism, deterministic phases)
- ✅ Research a question across sources → use workflow (multi-phase, cross-check)
- ❌ Quick code review → use subagent (simpler, context stays in session)
- ❌ Explain how Drizzle works → use skill (documentation)

## How to Customize a Template

Each template accepts `args` at invocation:

```javascript
// CLI: pass arguments
/audit-codebase --pattern "src/**/*.ts" --issue "SQL injection"

// Script: template reads args global
const pattern = args?.pattern || 'src/**/*.ts'
const issue = args?.issue || 'security issues'
```

To save a customized version:
1. Run the template with your args
2. In `/workflows`, press `s` to save
3. Give it a project-specific name (e.g., `/audit-api-routes`)
4. It becomes a command you can rerun

## How Skills Fit (Stack-Agnostic)

Skills document **what to build with** (languages, frameworks, libraries), not **how to orchestrate**. Workflows are orthogonal to skills.

**Example:**
- Skill: `bun/SKILL.md` teaches Bun syntax, patterns, APIs
- Workflow: `audit-codebase.js` can audit Bun code (or any code)
- Together: `audit-codebase` + knowledge of Bun patterns = audit Bun-specific issues

**Adding new skills:**
1. Create `.agentic/skills/my-stack/SKILL.md`
2. Hook symlinks it to `.claude/skills/my-stack/SKILL.md`
3. Existing workflows remain unchanged
4. Agents can reference the skill in their prompts

This keeps workflows **stack-agnostic** while allowing deep expertise via skills.

## Running Workflows

**From the CLI:**
```bash
/audit-codebase --pattern "src/routes/*.ts" --issue "missing authentication"
/research-question --question "How do competitors handle X?"
/judge-panel --decision "Migrate to Drizzle?"
```

**Saving for reuse:**
```bash
/workflows  # list running/completed
# Select a run, press 's' to save
# Give it a project-specific name
# It becomes a command: /audit-api-routes
```

**With memory persistence:**
Workflows benefit from persistent memory across phases. Set up in `.claude/settings.local.json`:
```json
{
  "autoMemoryDirectory": "~/.agentic/memory"
}
```
Memory allows phase 2 to reference findings from phase 1, phase 3 to reference both, etc.
