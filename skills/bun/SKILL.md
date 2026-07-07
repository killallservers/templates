---
name: bun
description: >
  Fast JavaScript runtime and all-in-one toolchain for building and deploying applications.
  Use Bun for package management, running TypeScript/JSX directly, testing, bundling,
  building HTTP servers with Bun.serve(), managing workspaces, and CLI tooling.
  Covers monorepos, workspace dependencies, streaming, WebSocket support, and deployment.
compatibility: "Bun 1.0+, TypeScript, JSX, Node.js compatibility layer"
references:
  - https://bun.com/docs
  - https://bun.sh/llm.txt
---

## What is Bun?

Bun is a fast, all-in-one JavaScript runtime and toolchain built in Rust. It replaces Node.js, npm/pnpm/yarn, esbuild/webpack, and Jest. Key advantages:

- **3x faster than Node.js**: Native Rust implementation, optimized VM, JIT compilation
- **Drop-in Node.js replacement**: High compatibility with existing Node.js code
- **All-in-one**: Package manager, test runner, bundler, HTTP server, all built-in
- **Zero-config development**: TypeScript, JSX work without setup
- **Monorepo-native**: Built-in workspace support with dependency linking

## Core Architecture

### Files & Configuration

- **bunfig.toml** — Optional configuration file (same dir as package.json)
- **bun.lock** — Deterministic lockfile for reproducible installs
- **package.json** — Dependencies, scripts, workspace definitions (same as Node.js)

## Standard package.json Scripts

**Always include these four scripts in package.json.** These are the standard Bun development and production commands:

```json
{
  "scripts": {
    "dev": "bun run src/index.ts --watch",
    "build": "bun build ./src/index.ts --outdir ./dist --minify",
    "start": "bun dist/index.js",
    "test": "bun test"
  }
}
```

- `dev`: Development server with hot reload
- `build`: Production build (minified, bundled)
- `start`: Run production build
- `test`: Run test suite

## Quick Commands Reference

| Task | Command |
|------|---------|
| Run development | `bun run dev` |
| Run build | `bun run build` |
| Run production | `bun run start` |
| Run tests | `bun run test` or `bun test` |
| Run a file | `bun run file.ts` or `bun file.ts` |
| Install deps | `bun install` |
| Add package | `bun add package-name` |
| Add dev dep | `bun add -d package-name` |
| Add workspace dep | `bun add -w @workspace/lib` |
| Remove package | `bun remove package-name` |
| Build bundle | `bun build ./src/index.ts --outdir ./dist` |
| Build executable | `bun build ./src/cli.ts --target executable --outfile cli` |
| Watch mode | `bun --watch run file.ts` or `bun build --watch` |
| REPL | `bun repl` |
| Version | `bun --version` |

## Workspaces & Monorepos

Structure your monorepo with `workspaces` in root `package.json`:

```json
{
  "name": "my-monorepo",
  "workspaces": ["packages/api", "packages/cli", "packages/shared"]
}
```

### Package structure
```
my-monorepo/
├── packages/
│   ├── api/
│   │   ├── package.json  { "name": "@workspace/api" }
│   │   └── src/
│   ├── cli/
│   │   ├── package.json  { "name": "@workspace/cli" }
│   │   └── src/
│   └── shared/
│       ├── package.json  { "name": "@workspace/shared" }
│       └── src/
├── bunfig.toml
└── package.json          (root with workspaces)
```

### Dependency linking

In workspace packages, reference each other:

```json
{
  "name": "@workspace/api",
  "dependencies": {
    "@workspace/shared": "workspace:*"
  }
}
```

Run `bun install` once in root—Bun symlinks workspace packages, no separate builds needed.

### Running workspace scripts

```bash
# Run script in specific workspace
bun run -w @workspace/api dev

# Or cd into the workspace
cd packages/api && bun run dev
```

## Fullstack Development Server

Bun's fullstack dev server is the centerpiece of modern Bun development. It intelligently bundles frontend assets and routes HTTP requests to handlers in one process—no separate dev server needed.

### Complete Example

**Project structure** (the canonical way):

```
project/
├── src/
│   ├── index.html          (entry point, served at GET /)
│   ├── index.tsx           (React app, imported by index.html)
│   ├── styles.css          (CSS bundled with entry)
│   └── api/
│       ├── hello.ts        (route: GET /api/hello)
│       ├── users/
│       │   ├── index.ts    (route: GET /api/users, POST /api/users)
│       │   └── [id].ts     (route: GET /api/users/123)
│       └── health.ts       (route: GET /api/health)
├── bunfig.toml
└── package.json
```

**src/index.html** (entry point):

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>My App</title>
</head>
<body>
  <div id="root"></div>
  <script type="module" src="./index.tsx"></script>
</body>
</html>
```

**src/index.tsx** (React frontend):

```typescript
import React from "react";
import { createRoot } from "react-dom/client";

export default function App() {
  const [users, setUsers] = React.useState([]);

  React.useEffect(() => {
    // Fetch from API route
    fetch("/api/users").then(r => r.json()).then(setUsers);
  }, []);

  return (
    <div>
      <h1>Users</h1>
      <ul>
        {users.map(u => <li key={u.id}>{u.name}</li>)}
      </ul>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(<App />);
```

**src/api/users/index.ts** (API route):

```typescript
// GET /api/users — list all users
export const GET = () => {
  return Response.json([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);
};

// POST /api/users — create a user
export const POST = async (req: Request) => {
  const body = await req.json();
  return Response.json({ created: body }, { status: 201 });
};
```

**src/api/users/[id].ts** (dynamic route):

```typescript
// GET /api/users/123
export const GET = (req: Request, server: any) => {
  const { id } = server.params;
  return Response.json({ id, name: `User ${id}` });
};

// DELETE /api/users/123
export const DELETE = (req: Request, server: any) => {
  const { id } = server.params;
  return new Response(null, { status: 204 });
};
```

**bunfig.toml**:

```toml
[build]
root = "src"            # Where index.html lives
entrypoints = ["src/index.tsx"]
target = "browser"

[build.naming]
entry = "[name].[ext]"
chunk = "[name].[ext]"
asset = "[name].[ext]"

[env]
API_URL = "http://localhost:3000"
```

**Running the fullstack dev server**:

```bash
bun dev

# Starts on http://localhost:3000
# - Serves src/index.html at GET /
# - Auto-bundles src/index.tsx
# - Routes requests to src/api/* handlers
# - Hot-reloads on file changes
```

No separate frontend build step. No separate API server. One process handles it all.

### Best Practices

**1. Keep API routes clean and focused**
```typescript
// ✓ Good: One route per file
// src/api/posts/[id].ts
export const GET = (req, server) => {
  return Response.json({ post: getPost(server.params.id) });
};

// ✗ Avoid: Multiple unrelated handlers in one file
```

**2. Use dynamic routes for IDs and slugs**
```typescript
// ✓ Good: src/api/users/[id].ts handles /api/users/:id
export const GET = (req, server) => {
  const { id } = server.params;
  // handle by ID
};

// ✗ Avoid: Manual URL parsing in every route
```

**3. Handle errors explicitly**
```typescript
// ✓ Good: Return appropriate status codes
export const GET = (req, server) => {
  const user = findUser(server.params.id);
  if (!user) return new Response("Not found", { status: 404 });
  return Response.json(user);
};

// ✗ Avoid: Letting exceptions bubble up without handling
```

**4. Use middleware for cross-cutting concerns**
```typescript
// ✓ Good: Create middleware for logging, auth, etc.
const withAuth = (handler) => (req, server) => {
  if (!req.headers.get("authorization")) {
    return new Response("Unauthorized", { status: 401 });
  }
  return handler(req, server);
};

export const GET = withAuth((req, server) => {
  return Response.json({ protected: true });
});
```

**5. Separate frontend from backend concerns**
```typescript
// ✓ Good: API routes only return JSON/data
// Frontend (src/index.tsx) handles all UI

// ✗ Avoid: Returning HTML from API routes in fullstack mode
```

**6. Type your routes for better dev experience**
```typescript
// ✓ Good: Define request/response types
type GetUsersResponse = { id: number; name: string }[];

export const GET = (): Response => {
  const data: GetUsersResponse = [{ id: 1, name: "Alice" }];
  return Response.json(data);
};

type CreateUserRequest = { name: string; email: string };
export const POST = async (req: Request) => {
  const body = await req.json() as CreateUserRequest;
  // Now body is typed
  return Response.json({ created: body }, { status: 201 });
};
```

**7. Production builds**
```bash
# For production, build once and serve
bun build ./src/index.html --outdir ./dist

# Then serve the dist folder with a server
# The bundled frontend + compiled routes go to dist/
```

### Key Points to Remember

- **One process**: Frontend bundling + API routing happens together
- **Hot reload**: Both frontend and API routes hot-reload during dev
- **Route structure**: `src/api/*` maps to `/api/*` HTTP endpoints
- **Entry point**: `src/index.html` is served at GET /
- **Dynamic routes**: `[id].ts` and `[...slug].ts` for dynamic segments
- **HTTP methods**: Export `GET`, `POST`, `PUT`, `DELETE`, `PATCH`, `HEAD`
- **No framework needed**: Plain Request/Response API (modern web standard)

## HTTP Servers with Bun.serve()

Bun's native HTTP server is fast and easy:

### Simple server

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const path = new URL(req.url).pathname;
    
    if (path === "/") return new Response("Hello, Bun!");
    if (path === "/json") return Response.json({ message: "Hello" });
    
    return new Response("Not found", { status: 404 });
  },
});

console.log(`Server running on http://localhost:${server.port}`);
```

### Middleware pattern

```typescript
type Handler = (req: Request, ctx: Context) => Promise<Response> | Response;
type Context = { params?: Record<string, string> };

const handlers: Record<string, Handler> = {
  "GET /": (req) => new Response("Home"),
  "GET /api/users/:id": (req, ctx) => 
    Response.json({ id: ctx.params?.id }),
  "POST /api/data": async (req) => {
    const body = await req.json();
    return Response.json({ received: body });
  },
};

const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const method = req.method;
    const path = new URL(req.url).pathname;
    const key = `${method} ${path}`;
    
    const handler = handlers[key];
    if (handler) return handler(req, {});
    
    return new Response("Not found", { status: 404 });
  },
});
```

### Request/Response utilities

```typescript
// Parse JSON body
const data = await req.json();

// Parse FormData (file uploads, form submissions)
const form = await req.formData();
const file = form.get("file"); // File object

// Stream response
const stream = fs.createReadStream("large.json");
return new Response(stream);

// Headers
const headers = new Headers();
headers.set("X-Custom", "value");
headers.set("Content-Type", "application/json");
return new Response("...", { headers });

// Cookies (via headers)
headers.set("Set-Cookie", "name=value; Path=/; HttpOnly");

// Redirect
return new Response(null, {
  status: 302,
  headers: { Location: "/new-path" },
});
```

### WebSocket support

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    const url = new URL(req.url);
    
    if (url.pathname === "/ws") {
      const success = server.upgrade(req, {
        data: { /* custom context */ },
      });
      return success 
        ? undefined 
        : new Response("WebSocket upgrade failed", { status: 400 });
    }
    
    return new Response("Not a WebSocket request");
  },
  websocket: {
    // Called when client connects
    open(ws) {
      console.log("Client connected");
      ws.send("Welcome!");
    },
    // Called when client sends message
    message(ws, message) {
      console.log("Received:", message);
      ws.send(`Echo: ${message}`);
    },
    // Called when client disconnects
    close(ws) {
      console.log("Client disconnected");
    },
    // Called on error
    error(ws, error) {
      console.error("WebSocket error:", error);
    },
  },
});
```

### Server-Sent Events (SSE)

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    if (new URL(req.url).pathname === "/events") {
      return new Response(
        // Return a ReadableStream that sends events
        new ReadableStream({
          start(controller) {
            let count = 0;
            const interval = setInterval(() => {
              controller.enqueue(
                `data: ${JSON.stringify({ count: ++count })}\n\n`
              );
              if (count >= 10) {
                clearInterval(interval);
                controller.close();
              }
            }, 1000);
          },
        }),
        {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
          },
        }
      );
    }
    return new Response("Not found", { status: 404 });
  },
});
```

## Testing with Bun

Bun has a built-in Jest-compatible test runner:

```typescript
// math.test.ts
import { test, expect, describe, beforeEach, afterEach } from "bun:test";

describe("Math utilities", () => {
  test("addition", () => {
    expect(1 + 1).toBe(2);
  });

  test("strings", () => {
    expect("hello").toContain("ell");
    expect("world").toMatch(/wor/);
  });

  test("arrays", () => {
    expect([1, 2, 3]).toContain(2);
    expect([1, 2, 3]).toHaveLength(3);
  });

  test("objects", () => {
    expect({ a: 1 }).toEqual({ a: 1 });
    expect({ a: 1, b: 2 }).toHaveProperty("a");
  });

  test("async", async () => {
    const result = await Promise.resolve(42);
    expect(result).toBe(42);
  });

  beforeEach(() => {
    console.log("Before each test");
  });

  afterEach(() => {
    console.log("After each test");
  });
});
```

Run tests:
```bash
bun test                          # Run all *.test.ts files
bun test path/to/test.ts          # Specific file
bun test --watch                  # Watch mode
bun test --timeout 5000           # Timeout (ms)
bun test --bail                   # Stop on first failure
```

### Mocking

```typescript
import { test, expect, mock } from "bun:test";
import { fetchUser } from "./api";

test("mocked fetch", async () => {
  const mockFetch = mock(() => Promise.resolve({ id: 1, name: "Alice" }));
  
  // Temporarily replace global fetch
  const original = global.fetch;
  global.fetch = mockFetch as any;
  
  const user = await fetchUser(1);
  
  expect(mockFetch).toHaveBeenCalledTimes(1);
  expect(user.name).toBe("Alice");
  
  global.fetch = original;
});
```

## Bundling with Bun

```bash
# Bundle for browser
bun build ./src/index.ts --outdir ./dist

# Bundle for Node.js
bun build ./src/index.ts --target node --outdir ./dist

# Minify
bun build ./src/index.ts --minify

# Source maps
bun build ./src/index.ts --sourcemap=external

# Watch mode
bun build ./src/index.ts --watch --outdir ./dist

# Code splitting
bun build ./src/index.ts --splitting --outdir ./dist
```

### bunfig.toml for bundler

```toml
[build]
target = "browser"  # or "node", "bun"
minify = true
sourcemap = "external"
splitting = true
entrypoints = ["src/index.ts"]
outdir = "dist"

# Asset naming
[build.naming]
entry = "[dir]/[name]-[hash].[ext]"
chunk = "[name]-[hash].[ext]"
asset = "[name]-[hash].[ext]"

[build.define]
VERSION = "1.0.0"
```

## Native TOML Reader/Parser

Bun can parse TOML files natively (no dependencies needed):

### Reading bunfig.toml

```typescript
import { readFileSync } from "fs";
import TOML from "bun:toml";

// Parse bunfig.toml
const config = TOML.parse(readFileSync("bunfig.toml", "utf-8"));

console.log(config.build.target);        // "browser"
console.log(config.build.splitting);     // true
console.log(config.env.DATABASE_URL);    // "postgresql://..."
```

### Parsing TOML strings

```typescript
import TOML from "bun:toml";

const tomlString = `
[database]
host = "localhost"
port = 5432
name = "mydb"

[server]
port = 3000
debug = true
`;

const config = TOML.parse(tomlString);
console.log(config.database.host);   // "localhost"
console.log(config.server.debug);    // true
```

### Writing TOML

```typescript
import TOML from "bun:toml";
import { writeFileSync } from "fs";

const config = {
  database: {
    host: "localhost",
    port: 5432,
  },
  server: {
    port: 3000,
  },
};

const tomlString = TOML.stringify(config);
writeFileSync("config.toml", tomlString);
```

### Complete bunfig.toml example

```toml
# Bundler configuration
[build]
target = "browser"
entrypoints = ["src/index.ts"]
outdir = "dist"
minify = true
sourcemap = "external"
splitting = true

# Asset naming patterns
[build.naming]
entry = "[dir]/[name]-[hash].[ext]"
chunk = "[name]-[hash].[ext]"
asset = "[name]-[hash].[ext]"

# Define compile-time constants
[build.define]
VERSION = "1.0.0"
API_URL = "https://api.example.com"
DEBUG = false

# Bundler optimizations
[build.optimization]
removeUnusedCode = true
treeshaking = true

# Development server
[serve]
port = 3000
hostname = "localhost"
staticDir = "public"
hot = true

# Environment variables
[env]
DATABASE_URL = "postgresql://localhost/mydb"
NODE_ENV = "development"
```

### Loading environment from bunfig.toml

Bun automatically loads `[env]` section from bunfig.toml into `process.env`:

```toml
[env]
DATABASE_URL = "postgresql://localhost"
API_KEY = "secret-key"
```

```typescript
console.log(process.env.DATABASE_URL);  // Automatically loaded
```

## File I/O

Bun extends Node.js fs with faster operations:

```typescript
// Read file
const content = await Bun.file("path/to/file.txt").text();
const buffer = await Bun.file("path/to/file.bin").arrayBuffer();
const json = await Bun.file("data.json").json();

// Write file
await Bun.write("output.txt", "content");
await Bun.write("data.json", JSON.stringify(obj, null, 2));

// Glob files
for (const file of await glob("src/**/*.ts")) {
  console.log(file);
}
```

## Environment Variables

```typescript
// .env file (auto-loaded)
DATABASE_URL=postgresql://...
API_KEY=secret123

// In code
const dbUrl = process.env.DATABASE_URL;
const apiKey = process.env.API_KEY;

// bunfig.toml
[env]
DATABASE_URL = "postgresql://localhost/mydb"
```

## Package Management Features

### Trusting packages

```bash
bun install --trust    # Trust all packages (skip audit)
```

### Peer dependencies

```bash
bun add -P react@18    # Add as peer dependency
```

### Workspace dependencies

```bash
bun add @workspace/shared -w   # Add from workspace
```

### Git dependencies

```bash
bun add git+https://github.com/user/repo.git#main
```

### Lockfile

- **bun.lock** — Always commit this (like package-lock.json)
- Deterministic and fast to parse
- Not meant for human editing

## TypeScript Support

Bun has best-in-class TypeScript support with zero configuration:

### Running TypeScript directly

```bash
# No compilation needed
bun run app.ts
bun app.ts
bun --watch app.ts
```

### TypeScript 5+ features

- **Enums** — Full enum support
- **Decorators** — Experimental decorators
- **Namespaces** — TypeScript namespaces
- **Generic constraints** — Advanced type constraints
- **Module augmentation** — Extend types from libraries

```typescript
// Full TypeScript support out of the box
interface Config {
  port: number;
  debug: boolean;
}

type ApiResponse<T> = {
  data: T;
  status: "success" | "error";
};

const config: Config = {
  port: 3000,
  debug: true,
};

async function fetchUser(id: string): Promise<ApiResponse<User>> {
  return { data: { id }, status: "success" };
}
```

### Type-checking

```bash
# Check types without running
bun check        # Check for type errors

# In watch mode
bun check --watch
```

### tsconfig.json

Bun respects tsconfig.json, but works without it:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "lib": ["ES2022"],
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true
  }
}
```

### JSX support

Bun handles `.tsx` files natively:

```typescript
// app.tsx - no build step needed
export function App() {
  return <h1>Hello from Bun!</h1>;
}
```

## SQLite Database

Bun has a built-in, fast SQLite driver:

### Basic usage

```typescript
import { Database } from "bun:sqlite";

// Open/create database
const db = new Database("myapp.db");

// Execute SQL
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Insert with prepared statements
const insert = db.prepare("INSERT INTO users (email, name) VALUES (?, ?)");
insert.run("alice@example.com", "Alice");
insert.run("bob@example.com", "Bob");

// Query all rows
const users = db.query("SELECT * FROM users").all();
console.log(users);

// Query single row
const user = db.query("SELECT * FROM users WHERE email = ?").get("alice@example.com");
console.log(user);

// Query with parameters
const stmt = db.prepare("SELECT * FROM users WHERE id > ?");
const filtered = stmt.all(1);

// Close database
db.close();
```

### Transactions

```typescript
const db = new Database("myapp.db");

const insert = db.prepare("INSERT INTO users (email, name) VALUES (?, ?)");

// Transaction
db.transaction(() => {
  insert.run("alice@example.com", "Alice");
  insert.run("bob@example.com", "Bob");
  insert.run("charlie@example.com", "Charlie");
})();  // Execute transaction

// Rollback on error
try {
  db.transaction(() => {
    insert.run("dave@example.com", "Dave");
    throw new Error("Oops!");
  })();
} catch (e) {
  console.log("Transaction rolled back");
}
```

### Column affinity and type safety

```typescript
interface User {
  id: number;
  email: string;
  name: string | null;
  created_at: string;
}

const db = new Database("myapp.db");

const query = db.query<User>(
  "SELECT * FROM users WHERE email = ?"
);

const user = query.get("alice@example.com");
// user is typed as User | null
console.log(user?.name);
```

### Performance features

```typescript
const db = new Database("myapp.db");

// Batch inserts are fastest
const insert = db.prepare("INSERT INTO users (email, name) VALUES (?, ?)");

const batchInsert = db.batch([
  insert,
  insert,
  insert,
]);

batchInsert(
  ["alice@example.com", "Alice"],
  ["bob@example.com", "Bob"],
  ["charlie@example.com", "Charlie"]
);
```

### Common patterns

```typescript
// Pagination
const query = db.query("SELECT * FROM users LIMIT ? OFFSET ?");
const page = query.all(10, 0);  // First 10

// Count
const count = db.query("SELECT COUNT(*) as count FROM users").get() as { count: number };
console.log(`Total users: ${count.count}`);

// Aggregation
const stats = db.query(`
  SELECT 
    COUNT(*) as total,
    MAX(created_at) as last_created
  FROM users
`).get();
```

## SQL Query Builder

Bun supports raw SQL and works well with query builders like Drizzle:

```typescript
// With Drizzle ORM (recommended for complex apps)
import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

const sqlite = new Database("myapp.db");
const db = drizzle(sqlite);

// Type-safe queries with Drizzle
const users = await db
  .select()
  .from(usersTable)
  .where(eq(usersTable.email, "alice@example.com"));
```

For simple use cases, use raw SQLite API. For complex schemas and type safety, use Drizzle ORM.

## Key Differences from Node.js

| Feature | Node.js | Bun |
|---------|---------|-----|
| TypeScript | Needs ts-node or tsx | Native, zero-config |
| JSX | Needs build step | Native support |
| Package manager | npm/yarn/pnpm | Built-in `bun install` |
| Test runner | Jest, Vitest | Built-in `bun test` |
| Bundler | esbuild, webpack | Built-in `bun build` |
| HTTP server | express, http module | Native `Bun.serve()` |
| Performance | Standard | 3x faster (Rust VM) |
| CommonJS | Supported | Supported (with caveats) |

## Ecosystem Integration

Popular frameworks with Bun:
- **Web**: Express, Hono, Elysia, Next.js, Vite
- **ORM**: Drizzle, Prisma, Mongoose
- **Database**: PostgreSQL, MongoDB, Redis, SQLite
- **Deployment**: Vercel, Railway, DigitalOcean, AWS Lambda, Google Cloud Run
- **Testing**: Bun's built-in test runner (Jest-compatible)
- **Monorepos**: Turborepo (or use Bun workspaces)

## Performance Tips

1. **Use Bun's native APIs**: `Bun.serve()`, `Bun.file()`, `Bun.build()` are faster than Node.js equivalents
2. **Leverage workspaces**: No separate build steps for shared code
3. **Bundle for production**: Use `bun build` with `--minify` and `--splitting`
4. **HTTP streaming**: For large responses, use streams or `ReadableStream`
5. **Worker threads**: Use Bun's worker support for CPU-bound tasks (via `new Worker()`)

## Common Patterns

### Environment-specific configuration

```typescript
const isDev = process.env.NODE_ENV === "development";
const isTest = process.env.NODE_ENV === "test";

const config = {
  port: parseInt(process.env.PORT || "3000"),
  debug: isDev,
  database: process.env.DATABASE_URL,
};
```

### Graceful shutdown

```typescript
const server = Bun.serve({
  port: 3000,
  fetch(req) {
    return new Response("OK");
  },
});

process.on("SIGTERM", () => {
  console.log("Shutting down...");
  server.stop();
  process.exit(0);
});
```

### Environment detection

```typescript
if (import.meta.env.PROD) {
  console.log("Running in production");
}

if (process.platform === "win32") {
  console.log("Running on Windows");
}
```

## When to Use Bun

✓ **Best for:**
- Full-stack TypeScript applications
- CLI tools and scripts
- HTTP APIs and servers (Bun.serve())
- Monorepos with shared code (workspaces)
- Development speed (fast hot reload, rapid testing)
- Projects where you want everything built-in

## Resources

- [Bun Documentation](https://bun.com/docs)
- [Bun GitHub](https://github.com/oven-sh/bun)
