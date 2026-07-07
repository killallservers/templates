# Failure Scenarios & Recovery

When running workflows, things can go wrong. This guide documents common failures, how to recognize them, and how to recover.

## Scenario 1: Agent Returns Malformed JSON

**Symptom:** 
```
Error: Schema validation failed
Agent output does not match schema { "type": "object", "properties": {...} }
```

**Root cause:**
- Agent returned plain text instead of JSON
- Agent returned JSON with wrong field names
- Agent response was truncated

**Recovery:**
1. Check the agent's actual output (look in Claude Code logs)
2. Retry the agent with lower effort (might help):
   ```
   agent(prompt, { schema: MY_SCHEMA, effort: 'low' })
   ```
3. If retry fails, return partial results:
   ```javascript
   const result = await agent(prompt, { schema: SCHEMA })
     .catch(err => {
       log(`Schema validation failed. Returning empty results.`)
       return { findings: [] }  // or appropriate empty structure
     })
   ```

**Prevention:**
- Always use explicit `schema` parameter in agent calls
- Keep prompts clear about the expected JSON structure
- Test the agent prompt manually first

**Example fix in workflow:**
```javascript
const result = await agent(
  `Return a JSON object with "items" array`,
  { schema: { type: 'object', properties: { items: { type: 'array' } } } }
)
  .catch(err => {
    log(`Agent failed to return valid JSON: ${err.message}`)
    return { items: [] }
  })

return result || { items: [] }  // Fallback if still null
```

---

## Scenario 2: Agent Refuses Task (Too Complex/Large)

**Symptom:**
```
I can't analyze this 50KB file effectively. 
Please break it into smaller pieces.
```

**Root cause:**
- File is too large (>30KB)
- Task is too complex for single agent call
- Context window exhaustion

**Recovery:**
1. Break file into chunks:
   ```javascript
   const chunks = breakFileIntoChunks(file, 5000)  // 5KB per chunk
   const results = await parallel(
     chunks.map(chunk => () => agent(`Analyze chunk: ${chunk}`))
   )
   ```

2. Try simpler prompt:
   ```javascript
   // Instead of: "Find all issues"
   // Try: "List lines that contain 'TODO' or 'FIXME'"
   ```

3. Reduce scope:
   ```javascript
   // Instead of auditing all 100 files
   // Try auditing first 10
   ```

**Prevention:**
- Keep files under 20KB if analyzing in detail
- Ask agents for high-level summaries first, then details
- Use `--pattern` to scope to relevant files only

---

## Scenario 3: Discovered Files Don't Exist

**Symptom:**
```
Error: File not found: src/routes/old-api.ts
(File was deleted between phases or gitignored)
```

**Root cause:**
- File was deleted or moved between workflow phases
- File is in `.gitignore` (agent found reference but file doesn't exist)
- Race condition (multi-phase workflow, file changed)

**Recovery:**
1. Check file existence before operating:
   ```javascript
   const existingFiles = await parallel(
     discoveredFiles.map(f => () => {
       try {
         const content = fs.readFileSync(f)
         return { exists: true, file: f }
       } catch {
         return { exists: false, file: f }
       }
     })
   )
   
   const validFiles = existingFiles
     .filter(f => f.exists)
     .map(f => f.file)
   ```

2. Skip missing files gracefully:
   ```javascript
   const validFiles = discoveredFiles.filter(f => {
     try {
       fs.accessSync(f)
       return true
     } catch {
       log(`Skipping deleted file: ${f}`)
       return false
     }
   })
   ```

**Prevention:**
- Between workflow phases, use git to verify files haven't changed
- Don't run workflows across major branch changes
- Keep file discovery and file operation in same phase when possible

---

## Scenario 4: Budget Exhaustion

**Symptom:**
```
Workflow stopped mid-execution:
Phase 2 of 3 started, but budget limit reached.
Remaining budget: 0 tokens
```

**Root cause:**
- User set a low token limit (`/effort +50k`)
- Workflow is more expensive than expected
- Many agents spawned (audit-codebase, loop-until-converged)

**Recovery:**
1. Return partial results with clear message:
   ```javascript
   if (budget.total && budget.remaining() < 25_000) {
     log(`Budget limit reached. Returning ${completedItems.length} completed items.`)
     return { items: completedItems, note: 'Incomplete due to budget' }
   }
   ```

2. Reduce scope:
   ```javascript
   const maxFilesToProcess = budget.total
     ? Math.floor(budget.remaining() / 5_000)  // ~5k per file
     : allFiles.length
   
   const filesToProcess = allFiles.slice(0, maxFilesToProcess)
   ```

3. Skip expensive stages:
   ```javascript
   if (budget.remaining() < 50_000) {
     log('Low budget: skipping verification phase')
     return { findings: preliminaryFindings, verified: false }
   }
   ```

**Prevention:**
- Check budget before expensive operations
- Use cost-aware patterns (loop-until-converged, budget scaling)
- Estimate: 5-10k tokens per file audited, 20-50k per agent call
- See [cost-aware pattern](.agentic/rules/patterns/cost-aware.md)

---

## Scenario 5: Worktree Conflicts (migrate-in-parallel)

**Symptom:**
```
Error: Worktree already locked
Git worktree is already checked out by another process
```

**Root cause:**
- Previous workflow run didn't clean up worktrees
- Two workflows running in parallel trying to use same worktree
- Stale lock file from crash

**Recovery:**
1. Clean up stale worktrees:
   ```bash
   git worktree list
   git worktree prune  # Remove deleted worktrees
   git worktree remove <path> --force  # Force remove if locked
   ```

2. Use unique worktree names:
   ```javascript
   const timestamp = Date.now()
   const worktreePath = `.worktree-${file}-${timestamp}`
   ```

3. Graceful cleanup in workflow:
   ```javascript
   try {
     // Migration work
   } finally {
     // Always clean up worktree
     await cleanupWorktree(worktreePath)
   }
   ```

**Prevention:**
- Always use cleanup/finally blocks for worktree operations
- Don't run multiple migrate-in-parallel workflows simultaneously
- Periodically: `git worktree prune`

---

## Scenario 6: Network Timeout

**Symptom:**
```
Error: Request timeout after 30s
Connection reset by peer
```

**Root cause:**
- LLM API temporarily unavailable
- Network connectivity issue
- Model overloaded (rare)

**Recovery:**
1. Retry with exponential backoff (usually handled by agent library):
   ```javascript
   const result = await agent(prompt)
     .catch(err => {
       log(`First attempt failed: ${err.message}. Retrying...`)
       return agent(prompt, { effort: 'low' })  // Simpler second attempt
     })
   ```

2. Return partial results if all retries fail:
   ```javascript
   let result = null
   for (let i = 0; i < 3; i++) {
     try {
       result = await agent(prompt)
       break
     } catch (err) {
       if (i === 2) {
         log(`All retries failed. Returning incomplete results.`)
         return { partial: true, items: [] }
       }
    
     }
   }
   ```

**Prevention:**
- This is normal. Build graceful degradation into workflows.
- Don't assume every agent call succeeds.
- Expect 1-2% failure rate and handle it.

---

## Scenario 7: Circular Dependencies in Findings

**Symptom:**
```
Round 3: Same bugs found as Round 2
Agents keep finding new things even after "fixing" them
```

**Root cause:**
- Fix doesn't actually solve the problem (root cause misunderstood)
- Fixing one thing creates new instances of the same problem
- Agents find slightly different instances each round

**Recovery:**
1. Look at actual findings, not just counts:
   ```javascript
   const newFindings = round3Findings
     .filter(f => !round2Findings.find(r2 => r2.file === f.file && r2.line === f.line))
   
   if (newFindings.length > 0) {
     log(`Round 3 found different issues than Round 2:`)
     newFindings.forEach(f => log(`  - ${f.file}: ${f.issue}`))
   }
   ```

2. Increase dry rounds to detect true convergence:
   ```javascript
   // Instead of dryRounds: 1
   // Use dryRounds: 3
   // Requires 3 consecutive rounds with zero NEW findings (by key)
   ```

3. Manually break the cycle:
   ```javascript
   if (dryCount >= 2) {
     // True convergence
     log(`Converged after ${rounds} rounds`)
     break
   }
   ```

**Prevention:**
- Fix root causes, not symptoms
- Use dedup by (file, line) not just (file)
- In loop-until-converged, set dryRounds ≥ 2
- See [dedup pattern](.agentic/rules/patterns/dedup.md)

---

## Scenario 8: Type Checking Fails After Migration

**Symptom:**
```
src/db/repositories/user.ts:45:10 - error TS2345:
Argument of type 'string | undefined' is not assignable to parameter of type 'string'
```

**Root cause:**
- Migration (e.g., TypeORM → Drizzle) produced type-unsafe code
- Agent missed a type annotation or null check
- Schema mismatch between old and new code

**Recovery:**
1. In worktree, have agent fix types:
   ```javascript
   if (typeErrors.length > 0) {
     const fixed = await agent(
       `Fix these TypeScript errors: ${typeErrors.join(', ')}\n\n` +
       `File content: ${fileContent}`,
       { effort: 'high' }  // More effort for type fixes
     )
     return fixed
   }
   ```

2. Manually fix critical types:
   ```javascript
   // If agent can't fix, return the file as-is
   // Merge worktree without the broken type fixes
   // Manual PR review fixes the types
   ```

3. Accept and fix in review:
   ```javascript
   // In migrate-in-parallel: if some worktrees have type errors, merge anyway
   // Flag them in results: { file, status: 'migrated_with_type_errors' }
   // Developer manually fixes before committing
   ```

**Prevention:**
- Run `tsc --noEmit` in each worktree before merging
- Have agent retry with `effort: 'high'` if types fail
- Test migrations on a small subset first

---

## Generic Recovery Pattern

All failures follow this pattern:

```javascript
try {
  // Main operation
  const result = await agent(prompt, { schema: SCHEMA })
  
  // Validation
  if (!isValid(result)) {
    throw new Error('Invalid result')
  }
  
  return result
  
} catch (err) {
  // Log what went wrong
  log(`Operation failed: ${err.message}`)
  
  // Attempt recovery
  // Option 1: Retry simpler
  // Option 2: Fallback to partial results
  // Option 3: Skip and continue
  
  return fallback()  // Return safe default
}
```

---

## Debugging Tips

**Enable verbose logging:**
```javascript
log(`DEBUG: Agent received prompt: ${prompt.slice(0, 100)}...`)
log(`DEBUG: Schema: ${JSON.stringify(schema)}`)
log(`DEBUG: Agent result: ${JSON.stringify(result)}`)
```

**Check budget state:**
```javascript
log(`Budget: ${budget.total ? Math.round(budget.remaining() / 1000) : 'unlimited'}k remaining`)
```

**Inspect file state:**
```javascript
const files = await agent(`List files matching ${pattern}`)
log(`Found ${files.files.length} files: ${files.files.slice(0, 5).join(', ')}...`)
```

**Test agent prompts manually:**
Open Claude Code and run:
```
/claude "Find TODO comments in src/routes/user.ts"
```
Before asking a workflow to do it.

---

## See Also

- [Workflow Composition Guide](.agentic/rules/workflow-composition.md) — Advanced: combining workflows
- [Cost-Aware Scaling Pattern](.agentic/rules/patterns/cost-aware.md) — Preventing budget exhaustion
- [Dedup Pattern](.agentic/rules/patterns/dedup.md) — Preventing circular findings
- [Phase Orchestration](.agentic/rules/patterns/phase-orchestration.md) — Avoiding data flow issues
