export const meta = {
  name: 'audit-auth-implementation',
  description: 'Audit authentication code for security issues and BetterAuth pattern opportunities',
  phases: [
    { title: 'Discover', detail: 'find authentication-related files' },
    { title: 'Audit', detail: 'analyze each for auth vulnerabilities and patterns' },
    { title: 'Verify', detail: 'adversarially verify security findings' },
  ],
}

// args: { pattern: 'src/**/*.ts', severity: 'high' }
// Usage: /audit-auth-implementation --pattern "src/**/*.ts" --severity "critical"

const pattern = args?.pattern || 'src/**/*auth*.ts'
const minSeverity = args?.severity || 'high'

phase('Discover')
const files = await agent(
  `Find all authentication and authorization related files matching pattern: ${pattern}
   Look for files with names containing: auth, session, middleware, token, jwt, oauth, login, signup, user
   Return a JSON object with a "files" array of file paths.`,
  {
    label: 'find-auth-files',
    schema: {
      type: 'object',
      required: ['files'],
      properties: { files: { type: 'array', items: { type: 'string' } } },
    },
  }
)

if (!files?.files?.length) {
  log(`No authentication files found matching ${pattern}`)
  return { findings: [] }
}

log(`Found ${files.files.length} auth files to audit`)

phase('Audit')
const audits = await pipeline(
  files.files,
  (file) =>
    agent(
      `Audit this authentication file for security issues and BetterAuth opportunities.

       Check for:
       1. Session validation - Are sessions properly verified on protected routes?
       2. Token handling - Where are tokens stored/transmitted? (localStorage is unsafe, httpOnly cookies are good)
       3. Secret exposure - Are API keys, secrets, or credentials hardcoded or exposed in code?
       4. CSRF protection - Is CSRF token validation present on state-changing endpoints?
       5. Rate limiting - Is rate limiting applied to auth endpoints (login, signup)?
       6. Password security - Are passwords hashed (bcrypt) or stored in plain text?
       7. Input validation - Is email/password validated before processing?
       8. Error messages - Are errors generic or do they reveal user existence?
       9. SQL injection - Are database queries parameterized?
       10. OAuth handling - Is OAuth state parameter validated?
       11. MFA support - Is multi-factor authentication supported?
       12. Session timeout - Are sessions configured to expire?

       Suggest BetterAuth patterns where applicable.

       Return JSON object:
       {
         "issues": ["issue 1", "issue 2", ...],
         "severity": "critical|high|medium|low",
         "betterAuthSuggestions": ["suggestion 1", "suggestion 2", ...],
         "hasVulnerabilities": boolean
       }`,
      {
        label: `audit:${file}`,
        schema: {
          type: 'object',
          required: ['issues', 'severity', 'hasVulnerabilities'],
          properties: {
            issues: { type: 'array', items: { type: 'string' } },
            severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
            betterAuthSuggestions: { type: 'array', items: { type: 'string' } },
            hasVulnerabilities: { type: 'boolean' },
          },
        },
      }
    )
)

const allFindings = audits
  .filter(Boolean)
  .map((result, i) => ({
    file: files.files[i],
    ...result,
  }))
  .filter((f) => f.hasVulnerabilities && f.issues?.length > 0)

if (!allFindings.length) {
  log('No vulnerabilities found')
  return { findings: [] }
}

log(`Found ${allFindings.length} files with potential issues, verifying...`)

phase('Verify')
const verified = await parallel(
  allFindings.map((finding) => async () => {
    const votes = await parallel([
      () =>
        agent(
          `Is this a REAL security vulnerability in authentication code?

           File: ${finding.file}
           Issues: ${finding.issues.join(', ')}
           Severity: ${finding.severity}

           Be conservative - only vote "real" if this is a genuine security risk that could be exploited.
           Default to "notReal" if uncertain.

           Return JSON: { "isReal": boolean, "reasoning": string }`,
          {
            label: `verify-real:${finding.file}`,
            schema: {
              type: 'object',
              required: ['isReal', 'reasoning'],
              properties: {
                isReal: { type: 'boolean' },
                reasoning: { type: 'string' },
              },
            },
          }
        ),
      () =>
        agent(
          `Could this security issue be EXPLOITED in production?

           File: ${finding.file}
           Issues: ${finding.issues.join(', ')}

           Return JSON: { "isExploitable": boolean, "reasoning": string }`,
          {
            label: `verify-exploitable:${finding.file}`,
            schema: {
              type: 'object',
              required: ['isExploitable', 'reasoning'],
              properties: {
                isExploitable: { type: 'boolean' },
                reasoning: { type: 'string' },
              },
            },
          }
        ),
      () =>
        agent(
          `Does this violate authentication BEST PRACTICES?

           File: ${finding.file}
           Issues: ${finding.issues.join(', ')}
           Context: Modern auth best practices (OWASP, BetterAuth patterns)

           Return JSON: { "violatesBestPractices": boolean, "reasoning": string }`,
          {
            label: `verify-practices:${finding.file}`,
            schema: {
              type: 'object',
              required: ['violatesBestPractices', 'reasoning'],
              properties: {
                violatesBestPractices: { type: 'boolean' },
                reasoning: { type: 'string' },
              },
            },
          }
        ),
    ])

    // Require at least 2 votes to confirm finding
    const realVotes = votes.filter(Boolean).filter((v) => v.isReal || v.isExploitable || v.violatesBestPractices).length
    const survives = realVotes >= 2

    return {
      ...finding,
      verdict: survives ? 'confirmed' : 'rejected',
      votes: realVotes,
      betterAuthPattern:
        finding.betterAuthSuggestions?.length > 0
          ? finding.betterAuthSuggestions[0]
          : 'Review BetterAuth documentation for best practices',
    }
  })
)

const confirmed = verified.filter((f) => f.verdict === 'confirmed')
log(`Verified ${confirmed.length}/${allFindings.length} findings`)

return { findings: confirmed }
