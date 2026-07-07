# Workflow Selection Guide

## Quick Decision Tree

```
What are you trying to do?

├─ Find bugs/issues/violations?
│  └─ Use: audit-codebase
│     (or audit-auth-implementation for auth-specific issues)
│
├─ Migrate/refactor code at scale?
│  └─ Use: migrate-in-parallel
│
├─ Research a topic or question?
│  └─ Use: research-question
│
├─ Iteratively find edge cases or flaky tests?
│  └─ Use: loop-until-converged
│
└─ Make an architecture or design decision?
   └─ Use: judge-panel
```

---

## Detailed Workflow Guide

### 1. audit-codebase

**When to use:**
- Find bugs, security issues, code quality problems
- Audit codebase against a standard or requirement
- Verify compliance with internal guidelines
- Search for problematic patterns

**Real examples:**
- Find all routes missing authentication checks
- Audit for SQL injection vulnerabilities
- Find hardcoded secrets or API keys
- Verify all error handlers return proper status codes
- Find commented-out code that should be deleted

**Cost:**
- Agents: 4 auditors + 3 verifiers per finding
- Tokens: 100-200k (varies by codebase size)
- Time: 2-3 minutes (parallel)

**How it works:**
```
Phase 1: Find matching files
Phase 2: Fan out auditors (parallel)
Phase 3: Adversarially verify findings
Phase 4: Report confirmed findings
```

**Customization:**
```bash
/audit-codebase \
  --pattern "src/routes/**/*.ts" \
  --issue "missing authentication checks"
```

**After running:**
You have a list of issues. Fix them manually or with agent assistance, then re-run to verify.

**Related:**
- [[01-security-audit-workflow.md]] — Full walk-through
- [[adversarial-verify]] pattern — How verification works
- `audit-auth-implementation` — Specialized for authentication audits

---

### 2. migrate-in-parallel

**When to use:**
- Refactor multiple files with the same change
- Migrate between frameworks or libraries
- Update API across codebase
- Upgrade dependency patterns
- Move code between folders/modules

**Real examples:**
- Migrate TypeORM → Drizzle (15 files)
- Migrate styled-components → Tailwind (40 components)
- Update API responses to new schema
- Refactor class components → functional components
- Update error handling pattern across codebase

**Cost:**
- Agents: N agents (one per file) + verification
- Tokens: 50-100k (for 10-20 files)
- Time: 1-2 minutes (parallel, faster than sequential)

**How it works:**
```
Phase 1: Find matching files
Phase 2: For each file in parallel:
         - Create isolated worktree
         - Migrate
         - Type-check
         - Commit
Phase 3: Merge worktrees back to main
```

**Key advantage:** Isolated worktrees prevent merge conflicts.

**Customization:**
```bash
/migrate-in-parallel \
  --pattern "src/components/**/*.tsx" \
  --task "Replace styled-components with Tailwind CSS"
```

**After running:**
All files are migrated. Type-check and test to verify, then deploy.

**Related:**
- [[02-drizzle-migration-workflow.md]] — Full walk-through
- Composition: audit-codebase → migrate-in-parallel → audit-codebase (fix→verify loop)

---

### 3. research-question

**When to use:**
- Answer a question with web search
- Compare technologies or approaches
- Research competitor strategies or industry trends
- Fact-check claims across multiple sources
- Gather information for decision-making

**Real examples:**
- How do top cloud providers handle rate limiting?
- What are the pros/cons of Drizzle vs TypeORM vs Prisma?
- How is authentication handled in modern web apps?
- What are best practices for caching strategies?
- How do different teams structure their monorepos?

**Cost:**
- Agents: 3 searchers + fetchers + verifiers
- Tokens: 150-250k (scales with sources)
- Time: 3-5 minutes

**How it works:**
```
Phase 1: Multi-source web search (3 angles)
Phase 2: Fetch and summarize sources
Phase 3: Cross-check claims across sources
Phase 4: Synthesize cited report
```

**Customization:**
```bash
/research-question \
  --question "How do AWS, GCP, Azure handle rate limiting?"
```

**After running:**
You have a comprehensive report with citations. Use for:
- Making informed architectural decisions
- Understanding pros/cons of technologies
- Documenting decisions

**Related:**
- [[04-architecture-decision.md]] — Combine research with judge-panel for decisions
- Composition: research-question → judge-panel (research informs decision)

---

### 4. loop-until-converged

**When to use:**
- Iteratively find issues where multiple runs reveal new findings
- Discover flaky tests or intermittent bugs
- Find edge cases through repeated execution
- Sweep for issues that aren't always present
- Build exhaustive list through repeated discovery

**Real examples:**
- Find all flaky tests (run test suite multiple times)
- Find intermittent performance issues
- Discover all potential race conditions
- Iteratively refactor and find remaining issues
- Build comprehensive list of edge cases

**Cost:**
- Agents: 1-2 per round × N rounds
- Tokens: 100-150k (for 3-5 rounds)
- Time: 2-4 minutes (depends on rounds needed)

**How it works:**
```
Round 1: Find issues, store in set
Round 2: Find issues again, only report NEW ones (dedup)
Round 3: Find issues, compare to seen set
Round N: If M consecutive rounds find nothing new → Stop
```

**Key advantage:** Deduplication means you find all issues without duplicates.

**Customization:**
```bash
/loop-until-converged \
  --task "Run test suite and identify flaky tests" \
  --rounds 10 \
  --dryRounds 2
```

**Parameters:**
- `--rounds`: Max rounds to run (prevents infinite loops)
- `--dryRounds`: Consecutive dry runs before stopping (e.g., 2 = 2 rounds with zero new findings)

**After running:**
You have a comprehensive list of issues found across multiple runs. No duplicates.

**Related:**
- [[03-bug-discovery-workflow.md]] — Full walk-through
- [[dedup]] pattern — How deduplication works
- [[cost-aware]] pattern — Budget-aware round scaling

---

### 5. judge-panel

**When to use:**
- Make an architectural or design decision
- Evaluate multiple approaches for a problem
- Document decision reasoning
- Get consensus on trade-offs
- Choose between competing options

**Real examples:**
- Should we migrate to Drizzle ORM?
- Microservices vs monolith for our scale?
- Should we use TypeScript?
- Which caching strategy (Redis, in-memory, CDN)?
- Should we build or buy this feature?

**Cost:**
- Agents: 3-5 drafters + judges + synthesis
- Tokens: 50-80k
- Time: 1-2 minutes

**How it works:**
```
Phase 1: N agents draft answers from different perspectives
         (e.g., MVP-first, Risk-first, User-first)
Phase 2: Independent judges score each draft
Phase 3: Synthesis agent combines winner + best ideas
Phase 4: Return decision with full reasoning
```

**Customization:**
```bash
/judge-panel \
  --decision "Should we migrate from TypeORM to Drizzle?" \
  --context "Bun backend, 15 DB files, 8-week launch, regulatory compliance"
```

**After running:**
You have:
- A recommended decision (e.g., "Migrate to Drizzle")
- Reasoning from multiple perspectives
- Trade-offs explicitly documented
- Rationale for future reference

**Related:**
- [[04-architecture-decision.md]] — Full walk-through
- [[judge-panel]] pattern — How synthesis works
- Composition: research-question → judge-panel (research informs drafts)

---

### 6. audit-auth-implementation

**When to use:**
- Security audit of authentication code
- Review authentication implementation
- Find auth vulnerabilities (session hijacking, CSRF, etc)
- Evaluate BetterAuth integration opportunities
- Compliance review of auth patterns

**Real examples:**
- Audit all auth endpoints for vulnerabilities
- Review session handling for security
- Check CSRF protection on all forms
- Verify password hashing strength
- Audit OAuth flow implementation

**Cost:**
- Similar to audit-codebase (4 auditors + 3 verifiers)
- Tokens: 100-150k
- Time: 2-3 minutes

**How it works:**
```
Same as audit-codebase, but specialized for authentication patterns
```

**Customization:**
```bash
/audit-auth-implementation \
  --pattern "src/**/*.ts" \
  --severity "critical"
```

**After running:**
You have a list of auth vulnerabilities. Fix them and re-audit to verify.

**Related:**
- [[01-security-audit-workflow.md]] — Similar walk-through (different domain)
- [[skills/betterauth]] — BetterAuth patterns for fixing auth issues

---

## Workflow Comparison Matrix

| Workflow | Use Case | Parallel? | Phases | Cost | Time |
|----------|----------|-----------|--------|------|------|
| audit-codebase | Find issues | ✅ Yes | 4 | 100-200k | 2-3m |
| migrate-in-parallel | Refactor files | ✅ Yes | 3 | 50-100k | 1-2m |
| research-question | Research topic | ✅ Yes | 4 | 150-250k | 3-5m |
| loop-until-converged | Iterative discovery | ✅ Yes | N rounds | 100-150k | 2-4m |
| judge-panel | Decision making | ✅ Yes | 3 | 50-80k | 1-2m |
| audit-auth-implementation | Auth review | ✅ Yes | 4 | 100-150k | 2-3m |

---

## Composition: Combining Workflows

You can chain workflows together. Common patterns:

### Pattern 1: Audit → Fix → Audit (Verify)

```
Step 1: Run audit-codebase
        → Find issues

Step 2: Manually or agent-assisted fix
        → Apply changes

Step 3: Run audit-codebase again
        → Verify all issues resolved
```

**Use when:** You want to verify fixes actually worked

**Related:** [[01-security-audit-workflow.md]]

### Pattern 2: Research → Judge Panel (Informed Decision)

```
Step 1: Run research-question
        → Gather info on options

Step 2: Run judge-panel with research in context
        → Make informed decision based on facts
```

**Use when:** Decision requires external research (new tech, market analysis)

**Related:** [[04-architecture-decision.md]]

### Pattern 3: Loop Until Converged → Migrate (Fix Each Finding)

```
Step 1: Run loop-until-converged
        → Find all issues

Step 2: For each issue, migrate/refactor manually or with agent
        → Fix issues

Step 3: Run loop-until-converged again
        → Verify all issues fixed
```

**Use when:** You want to iteratively find and fix problems

---

## Choosing Between Workflows

### "I want to find bugs"
→ **audit-codebase** (general) or **audit-auth-implementation** (auth-specific)

### "I want to refactor a bunch of files the same way"
→ **migrate-in-parallel**

### "I want to know how other companies/teams do X"
→ **research-question**

### "I want to find all edge cases or flaky tests"
→ **loop-until-converged**

### "I need to decide between A and B"
→ **judge-panel**

### "I want to research AND then decide"
→ **research-question** + **judge-panel** (two steps)

### "I want to find issues, fix them, and verify fixes"
→ **audit-codebase** + manual/agent fix + **audit-codebase** again (three steps)

---

## Common Questions

### Q: How long do workflows take?
**A:** 1-5 minutes typically. Depends on:
- Codebase size (larger = slower)
- Number of findings (more = longer verification)
- Number of rounds (loop-until-converged)

### Q: What if a workflow fails?
**A:** See [[failure-scenarios.md]] for common issues and recovery strategies.

### Q: Can I run two workflows in parallel?
**A:** Workflows themselves are parallel internally. Running two workflows at once (from CLI) runs them sequentially. For parallel workflow execution, see [[workflow-composition.md]].

### Q: How much does this cost?
**A:** Costs depend on your Claude Code subscription. Tokens/cost is shown in each workflow description.

### Q: Can I customize a workflow?
**A:** Yes, by modifying the `.agentic/workflows/*.js` files. Easier: just invoke the workflow with different arguments (e.g., different `--pattern` or `--issue`).

### Q: Which workflow should I use first?
**A:** Start with **audit-codebase**. It's the simplest and most universally useful.

---

## Next Steps

1. **Pick a workflow** based on your immediate need
2. **Run it** following the quick-start in the corresponding example
3. **Review results** and take action
4. **Iterate** as needed

See `.agentic/examples/` for full walk-throughs of each workflow in context.

---

## See Also

- `.agentic/examples/` — Full walk-throughs
- `.agentic/AGENTS.md` — All agents and workflows
- `.agentic/rules/failure-scenarios.md` — What can go wrong
- `.agentic/rules/workflow-composition.md` — Advanced: combining workflows
- `.agentic/rules/memory-flow-patterns.md` — Passing context between phases
