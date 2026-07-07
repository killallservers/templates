# Product Security Rules

## Read Access
- ✅ All `.agentic/` files
- ✅ All `src/` directories
- ✅ README.md
- ✅ Package manifests (package.json, go.mod, Cargo.toml)
- ❌ .env files
- ❌ secrets/, keys/, credentials/

## Execute Access
- ✅ Type checking (tsc, go vet, cargo check)
- ✅ Testing (npm test, go test, cargo test)
- ✅ Building (npm run build, go build, cargo build)
- ✅ Formatting (prettier, gofmt, rustfmt)
- ❌ Deployments (no vercel deploy, kubectl apply, etc.)
- ❌ Database operations in production
- ❌ Deleting files outside of build artifacts

## Package Management
- ✅ Add packages using only the package manager (bun add, cargo add, uv add)
- ✅ Add packages using `@latest` version specifier
- ❌ Never add packages to dependencies manually (edit package.json, Cargo.toml, pyproject.toml directly)
- ❌ Never guess or hardcode versions
- When adding packages, always use: `bun add package@latest` or other package manager equivalent

## Code Quality & Pre-Commit Checks

**RULE: All commits must pass quality checks before creation**

Before any commit is created or updated, **all four checks must pass**:
- ✅ Type checking: `bun run typecheck`
- ✅ Linting: `bun run lint`
- ✅ Formatting: `bun run format`
- ✅ Comprehensive check: `bun run check`

This is enforced automatically by `.git/hooks/pre-commit`. If checks fail, commit is blocked with instructions on how to fix.

See `.agentic/rules/pre-commit-checks.md` for details.
