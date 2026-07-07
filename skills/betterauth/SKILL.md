---
name: betterauth
description: >
  Modern authentication and authorization for full-stack apps on Bun.
  Use BetterAuth for passwordless logins, OAuth integration (Google, GitHub), 
  multi-factor authentication, and session management.
  Covers setup with Hono and Drizzle, session patterns, email/password and passkey authentication, 
  OAuth flows, MFA, edge cases, and security best practices.
compatibility: "Bun 1.0+, TypeScript, Hono, Drizzle ORM, better-auth 1.0+"
references:
  - https://better-auth.com/docs/introduction
  - https://better-auth.com/docs/concepts/sessions
  - https://better-auth.com/docs/integrations/drizzle
---

## What is BetterAuth?

BetterAuth is a modern, composable authentication and authorization library designed for full-stack applications. It handles the complexity of authentication—sessions, OAuth, multi-factor authentication, passwordless login—so you can focus on your product.

**Key advantages:**
- **Zero-config setup**: Works out of the box with sensible defaults
- **Multi-auth support**: Sessions, OAuth (Google, GitHub, Discord, etc.), magic links, passkeys, MFA
- **Built-in providers**: 50+ OAuth providers pre-configured
- **Type-safe**: Full TypeScript support with inferred types
- **Drizzle-native**: Auto-generates schema, handles migrations
- **Lightweight**: ~50KB gzipped, no complex dependencies
- **Production-ready**: Used in production by dozens of teams

## Core Concepts

### Authentication Flows

BetterAuth supports multiple authentication approaches:

1. **Session-based** — Traditional stateful sessions (cookie-based)
2. **OAuth/Social** — Delegate to providers (Google, GitHub, etc.)
3. **Passkeys** — FIDO2/WebAuthn passwordless authentication
4. **Email/Password** — Classic username/password with hashing
5. **Multi-Factor Authentication** — TOTP, email verification, recovery codes

### File Structure

```
my-app/
├── src/
│   ├── index.ts              (Hono app entry)
│   ├── auth/
│   │   ├── config.ts         (BetterAuth initialization)
│   │   └── middleware.ts     (Session verification middleware)
│   ├── routes/
│   │   ├── auth/             (auth endpoints)
│   │   │   ├── callback.ts   (OAuth callback)
│   │   │   └── login.ts      (login endpoint)
│   │   └── api/
│   │       └── protected.ts  (requires auth)
│   ├── db.ts                 (Drizzle setup)
│   └── types.ts
├── bunfig.toml
└── package.json
```

### Installation

```bash
bun add better-auth
bun add drizzle-orm drizzle-kit  # for database
bun add hono                     # web framework
```

## Quick Start

### 1. Initialize BetterAuth with Drizzle

BetterAuth auto-generates the database schema. Create a config file:

```typescript
// src/auth/config.ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";

export const auth = betterAuth({
  database: drizzleAdapter(db),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",
  
  // Configure auth methods
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
  },
  
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  
  plugins: [
    // Multi-factor auth
    twoFactor(),
    passkey(),
  ],
});

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.User;
```

### 2. Generate Database Schema

BetterAuth auto-generates the Drizzle schema. Run the migration:

```bash
bunx drizzle-kit generate:sqlite
bunx drizzle-kit migrate:sqlite
```

### 3. Create Auth Endpoints in Hono

```typescript
// src/routes/auth/index.ts
import { Hono } from "hono";
import { auth } from "../../auth/config";

const authRouter = new Hono();

// Mount BetterAuth handler
authRouter.all("/*", async (c) => {
  return auth.handler(c.req.raw);
});

export default authRouter;
```

### 4. Add Auth Middleware

```typescript
// src/auth/middleware.ts
import { createMiddleware } from "hono/factory";
import { auth } from "./config";
import type { Session, User } from "./config";

declare global {
  namespace HonoRequest {
    interface HonoRequest {
      user?: User;
      session?: Session;
    }
  }
}

export const authMiddleware = createMiddleware(async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  
  if (session) {
    c.set("user", session.user);
    c.set("session", session.session);
  }
  
  await next();
});
```

### 5. Protect Routes

```typescript
// src/routes/api/protected.ts
import { Hono } from "hono";
import { authMiddleware } from "../../auth/middleware";

const api = new Hono();

// Require auth for all routes
api.use(authMiddleware);

api.get("/me", (c) => {
  const user = c.get("user");
  if (!user) {
    return c.json({ error: "Unauthorized" }, { status: 401 });
  }
  return c.json({ user });
});

api.post("/logout", async (c) => {
  const sessionToken = c.req.cookie("better-auth.session_token");
  if (sessionToken) {
    await auth.api.revokeSession({ token: sessionToken });
  }
  return c.json({ message: "Logged out" });
});

export default api;
```

## Core Patterns

### Session Management

**Create session on login:**

```typescript
// Sessions are created automatically by BetterAuth
// User signs in → BetterAuth creates session cookie → Client authenticated

api.post("/sign-in", async (c) => {
  const { email, password } = await c.req.json();
  
  // Call BetterAuth sign-in (session cookie set automatically)
  const response = await auth.api.signInWithCredentials({
    email,
    password,
  });
  
  return response;
});
```

**Verify session on protected routes:**

```typescript
// Use authMiddleware to verify session before route handler
api.use(authMiddleware);

api.get("/profile", (c) => {
  const user = c.get("user");
  
  // If middleware ran, user exists
  return c.json({ user });
});
```

**Session expiry and refresh:**

```typescript
// Configure session lifetime in auth config
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24,      // refresh every 24 hours
    cookieCache: {
      disabled: false,
    },
  },
  // ...
});

// BetterAuth automatically refreshes sessions on each request
// If session expires, user is logged out
```

**Logout and session invalidation:**

```typescript
api.post("/logout", async (c) => {
  const sessionToken = c.req.cookie("better-auth.session_token");
  
  if (sessionToken) {
    // Revoke session on server
    await auth.api.revokeSession({ token: sessionToken });
  }
  
  // Clear client-side cookie
  c.header("Set-Cookie", "better-auth.session_token=; Max-Age=0");
  
  return c.json({ message: "Logged out" });
});
```

### Email/Password Authentication

**User registration with password hashing:**

```typescript
// BetterAuth hashes passwords automatically using bcrypt

api.post("/sign-up", async (c) => {
  const { email, password, name } = await c.req.json();
  
  // Validate input
  if (password.length < 8) {
    return c.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }
  
  // Create user (password hashed automatically)
  const user = await auth.api.signUpWithCredentials({
    email,
    password,
    name,
  });
  
  if (user.error) {
    return c.json({ error: user.error }, { status: 400 });
  }
  
  return c.json({ user: user.data.user }, { status: 201 });
});
```

**Sign-in validation:**

```typescript
api.post("/sign-in", async (c) => {
  const { email, password } = await c.req.json();
  
  const result = await auth.api.signInWithCredentials({
    email,
    password,
  });
  
  // Check for errors (user not found, wrong password)
  if (result.error) {
    // Don't reveal whether user exists (timing attack prevention)
    return c.json(
      { error: "Invalid email or password" },
      { status: 401 }
    );
  }
  
  return c.json({ user: result.data.user });
});
```

**Password reset flow:**

```typescript
// Initiate password reset
api.post("/forgot-password", async (c) => {
  const { email } = await c.req.json();
  
  const result = await auth.api.forgetPassword({
    email,
    redirectURL: `${process.env.BETTER_AUTH_URL}/reset-password`,
  });
  
  // Always return success (don't reveal if email exists)
  return c.json({ message: "Check your email for reset link" });
});

// Reset password with token
api.post("/reset-password", async (c) => {
  const { token, newPassword } = await c.req.json();
  
  const result = await auth.api.resetPassword({
    token,
    newPassword,
  });
  
  if (result.error) {
    return c.json({ error: result.error }, { status: 400 });
  }
  
  return c.json({ message: "Password reset successfully" });
});
```

### OAuth / Social Authentication

**Google OAuth setup:**

```typescript
// 1. Get credentials from Google Cloud Console
// 2. Set environment variables
// GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
// GOOGLE_CLIENT_SECRET=xxx

// 3. Configure in BetterAuth
export const auth = betterAuth({
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

// 4. Create login link
// User clicks: /api/auth/signin/google
// BetterAuth redirects to Google → Google redirects back to callback
// Callback creates session → User logged in
```

**GitHub OAuth setup:**

```typescript
// 1. Register OAuth app at github.com/settings/developers
// 2. Set environment variables
// GITHUB_CLIENT_ID=xxx
// GITHUB_CLIENT_SECRET=xxx

// 3. Configure in BetterAuth
export const auth = betterAuth({
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
});
```

**Account linking (multiple providers):**

```typescript
// User can sign in with email OR Google OR GitHub
// Same user account across all providers

// In frontend: offer "Sign in with Google" + "Sign in with GitHub"
// If user exists with email, link the provider automatically
// If new user, create account and link provider

api.post("/link-provider", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  // User clicks "Link GitHub account"
  // They're redirected to GitHub OAuth flow
  // BetterAuth handles linking automatically
  
  const result = await auth.api.linkSocialAccount({
    userId: user.id,
    provider: "github",
  });
  
  return c.json({ linked: !result.error });
});
```

### Passkeys (WebAuthn)

**Register passkey:**

```typescript
api.post("/register-passkey", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  // Start passkey registration
  const options = await auth.api.registerPasskeyStart({
    userId: user.id,
  });
  
  // Send options to client
  // Client uses WebAuthn API to create credential
  return c.json(options);
});

api.post("/register-passkey-verify", async (c) => {
  const user = c.get("user");
  const credential = await c.req.json();
  
  // Verify passkey credential
  const result = await auth.api.registerPasskeyVerify({
    userId: user.id,
    credential,
  });
  
  if (result.error) {
    return c.json({ error: result.error }, { status: 400 });
  }
  
  return c.json({ message: "Passkey registered" });
});
```

**Authenticate with passkey:**

```typescript
api.post("/authenticate-passkey", async (c) => {
  const challenge = await c.req.json();
  
  // Client uses passkey to sign challenge
  // Send signed challenge to verify
  const result = await auth.api.authenticatePasskey({
    challenge,
  });
  
  if (result.error || !result.data) {
    return c.json({ error: "Authentication failed" }, { status: 401 });
  }
  
  // Session created automatically
  return c.json({ user: result.data.user });
});
```

### Multi-Factor Authentication (MFA)

**TOTP setup (authenticator apps):**

```typescript
api.post("/mfa/totp/enable", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  // Generate TOTP secret
  const result = await auth.api.twoFactorTOTPGenerateSecret({
    userId: user.id,
  });
  
  // Send QR code to client
  return c.json({
    secret: result.data?.secret,
    qrCode: result.data?.qrCode,
  });
});

api.post("/mfa/totp/verify", async (c) => {
  const user = c.get("user");
  const { code } = await c.req.json();
  
  // Verify TOTP code
  const result = await auth.api.twoFactorTOTPVerify({
    userId: user.id,
    code,
  });
  
  if (result.error) {
    return c.json({ error: "Invalid code" }, { status: 400 });
  }
  
  return c.json({ message: "MFA enabled" });
});
```

**Email verification MFA:**

```typescript
// After user signs up, require email verification
api.post("/verify-email", async (c) => {
  const { email } = await c.req.json();
  
  const result = await auth.api.sendVerificationEmail({
    email,
    redirectURL: `${process.env.BETTER_AUTH_URL}/verify`,
  });
  
  return c.json({ message: "Verification email sent" });
});

api.get("/verify", async (c) => {
  const token = c.req.query("token");
  
  const result = await auth.api.verifyEmail({ token });
  
  if (result.error) {
    return c.text("Invalid or expired token", { status: 400 });
  }
  
  return c.text("Email verified!");
});
```

**Recovery codes:**

```typescript
// Generate recovery codes for MFA backup
api.post("/mfa/recovery-codes", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  const result = await auth.api.twoFactorTOTPGenerateBackupCodes({
    userId: user.id,
  });
  
  // Show codes to user once (they can't see again)
  return c.json({
    codes: result.data?.codes,
    message: "Save these in a safe place",
  });
});
```

## Best Practices & Anti-Patterns

**✓ Good: Use httpOnly, secure cookies for sessions**
```typescript
// BetterAuth uses httpOnly cookies by default
// Sessions survive page reloads, cannot be stolen by XSS
export const auth = betterAuth({
  session: {
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    },
  },
});
```

**✗ Avoid: Storing tokens in localStorage**
```typescript
// DON'T do this — localStorage is vulnerable to XSS
// localStorage.setItem("token", jwt);
// Instead use BetterAuth's cookie-based sessions
```

**✓ Good: Validate email before granting access**
```typescript
// Require email verification
export const auth = betterAuth({
  emailAndPassword: {
    autoSignInAfterSignUp: false, // Require email verification
    requireEmailVerification: true,
  },
});
```

**✗ Avoid: Hardcoding secrets**
```typescript
// DON'T hardcode
// const secret = "super-secret-key-123";

// DO use environment variables
const secret = process.env.BETTER_AUTH_SECRET!;
if (!secret) throw new Error("BETTER_AUTH_SECRET not set");
```

**✓ Good: Rate limit auth endpoints**
```typescript
import { rateLimit } from "hono/rate-limit";

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts
});

api.post("/sign-in", limiter, async (c) => {
  // Handle sign-in
});
```

**✗ Avoid: Revealing user existence in error messages**
```typescript
// DON'T tell attackers which emails are registered
// return c.json({ error: "User with this email not found" });

// DO use generic message
return c.json({ error: "Invalid email or password" }, { status: 401 });
```

**✓ Good: Use CSRF tokens for form submissions**
```typescript
// BetterAuth includes CSRF protection
// Token sent automatically with forms
// Verify on POST/PUT/DELETE requests
```

**✗ Avoid: Storing passwords in plain text or weak hashing**
```typescript
// BetterAuth uses bcrypt automatically
// Never use md5 or unsalted hashing
```

**✓ Good: Implement "sign out everywhere"**
```typescript
api.post("/logout-all", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  // Revoke all sessions for this user
  await auth.api.revokeAllUserSessions({ userId: user.id });
  
  return c.json({ message: "Logged out of all devices" });
});
```

**✗ Avoid: Exposing session IDs in URLs**
```typescript
// DON'T include session ID in URL (can be logged, shared)
// /api/profile?sessionId=xxx

// DO use secure cookies (BetterAuth default)
// Cookie sent automatically with requests
```

## Edge Cases & Gotchas

**Token refresh on expiry:**

By default, BetterAuth refreshes sessions on each request. If the session is expired and refresh token is also expired, the user is logged out.

```typescript
// Configure refresh behavior
export const auth = betterAuth({
  session: {
    expiresIn: 60 * 60 * 24 * 7,  // 7 days
    updateAge: 60 * 60 * 24,       // refresh every 24 hours
    absoluteLifetime: 60 * 60 * 24 * 30, // absolute max 30 days
  },
});

// If both session and refresh token expire, user must sign in again
```

**Cross-origin auth (CORS):**

When frontend and API are on different domains, cookies need special handling.

```typescript
export const auth = betterAuth({
  session: {
    cookie: {
      sameSite: "none",  // Allow cross-origin cookies
      secure: true,      // HTTPS required with sameSite=none
    },
  },
  baseURL: "https://api.example.com",
});

// Frontend must send credentials: fetch(url, { credentials: "include" })
```

**Concurrent login attempts:**

Race conditions can occur if user signs in on two devices simultaneously.

```typescript
// BetterAuth handles this automatically
// Most recent session is valid, older ones are refreshed
// No data corruption or state issues
```

**Account deletion with active sessions:**

When user deletes account, all sessions should be invalidated.

```typescript
api.post("/delete-account", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  // Delete all sessions first
  await auth.api.revokeAllUserSessions({ userId: user.id });
  
  // Then delete user account
  // (You implement this with Drizzle)
  
  return c.json({ message: "Account deleted" });
});
```

**User lockout after failed attempts:**

Implement account lockout to prevent brute-force attacks.

```typescript
// Track failed attempts in database
// Lock account after N failures (e.g., 5)
// Automatically unlock after time period (e.g., 15 minutes)

api.post("/sign-in", async (c) => {
  const { email, password } = await c.req.json();
  
  // Check if account is locked
  const user = await db.select().from(users).where(eq(users.email, email));
  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    return c.json(
      { error: "Account locked. Try again later." },
      { status: 429 }
    );
  }
  
  // Attempt sign-in
  const result = await auth.api.signInWithCredentials({ email, password });
  
  if (result.error) {
    // Increment failed attempts
    // If >= 5, lock account for 15 minutes
    return c.json({ error: "Invalid credentials" }, { status: 401 });
  }
  
  // Reset failed attempts on success
  return c.json({ user: result.data.user });
});
```

## Integration with Hono

**Type-safe session in handlers:**

```typescript
// src/types.ts
import type { Session, User } from "./auth/config";

declare global {
  namespace HonoRequest {
    interface HonoRequest {
      user?: User;
      session?: Session;
    }
  }
}

// In route handlers
api.get("/me", (c) => {
  const user = c.get("user");  // TypeScript knows this is User | undefined
  
  if (!user) {
    return c.json({ error: "Not authenticated" }, { status: 401 });
  }
  
  return c.json({ user });  // TypeScript confirms user exists
});
```

**Error handling:**

```typescript
api.post("/sign-in", async (c) => {
  try {
    const result = await auth.api.signInWithCredentials({ email, password });
    
    if (result.error) {
      // Handle auth error
      return c.json({ error: result.error }, { status: 401 });
    }
    
    return c.json({ user: result.data.user });
  } catch (error) {
    // Handle unexpected error
    console.error("Sign-in error:", error);
    return c.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});
```

## Integration with Drizzle

**Auto-generated schema:**

BetterAuth generates Drizzle schema automatically. You can extend it with custom fields:

```typescript
// src/db.ts
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// BetterAuth creates these automatically:
// users, sessions, accounts, verifications

// Extend users with custom fields
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified").notNull(),
  name: text("name"),
  image: text("image"),
  // Your custom fields
  role: text("role").default("user"), // "user" | "admin"
  plan: text("plan").default("free"), // "free" | "pro"
  createdAt: integer("createdAt").notNull(),
});
```

**Query auth tables with Drizzle:**

```typescript
// Look up user by email
const user = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .get();

// Check user sessions
const sessions = await db
  .select()
  .from(sessions)
  .where(eq(sessions.userId, userId));

// Clean up old sessions
await db
  .delete(sessions)
  .where(and(
    eq(sessions.userId, userId),
    lt(sessions.createdAt, Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days
  ));
```

## Security Considerations

**CORS and credentials:**

```typescript
import { cors } from "hono/cors";

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true,  // Allow cookies
  allowMethods: ["GET", "POST", "PUT", "DELETE"],
  allowHeaders: ["Content-Type"],
}));
```

**XSS prevention (httpOnly cookies):**

BetterAuth uses httpOnly cookies by default. JavaScript cannot access them, preventing XSS attacks from stealing sessions.

**CSRF protection:**

BetterAuth includes CSRF tokens. Always verify:
- Origin header for API requests
- SameSite cookie attribute (default: lax)

**Secure password hashing:**

BetterAuth uses bcrypt with salt rounds = 12. Passwords are never stored in plain text.

**Token expiry:**

Sessions expire automatically. Always check session validity on protected routes:

```typescript
api.use(authMiddleware);  // Validates session on every request
```

## Common Patterns

**"Remember me" (long-lived session):**

```typescript
api.post("/sign-in", async (c) => {
  const { email, password, rememberMe } = await c.req.json();
  
  const result = await auth.api.signInWithCredentials({ email, password });
  
  if (rememberMe) {
    // Extend session lifetime
    // (BetterAuth config allows this per session)
    c.header("Set-Cookie", "better-auth.session_token=...; Max-Age=2592000"); // 30 days
  }
  
  return c.json({ user: result.data.user });
});
```

**Sign-in as (admin impersonation):**

```typescript
api.post("/impersonate/:userId", async (c) => {
  const admin = c.get("user");
  if (admin?.role !== "admin") {
    return c.json({ error: "Unauthorized" }, { status: 403 });
  }
  
  const userId = c.req.param("userId");
  
  // Create session for target user
  const session = await auth.api.createSession({
    userId,
  });
  
  // Log impersonation for audit
  // ...
  
  return c.json({ session });
});
```

**Sign out everywhere:**

```typescript
api.post("/logout-all-devices", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Not authenticated" }, { status: 401 });
  
  await auth.api.revokeAllUserSessions({ userId: user.id });
  
  return c.json({ message: "Signed out of all devices" });
});
```

## Key Points

| Concept | Pattern |
|---------|---------|
| **Session storage** | Server-side (database), cookie contains only token |
| **Token lifetime** | 7 days default, refresh token up to 30 days absolute |
| **OAuth flow** | Delegate to provider, auto-create account on first login |
| **Passkeys** | Browser WebAuthn API, no password needed, most secure |
| **MFA** | TOTP (authenticator app) or email verification |
| **Recovery** | Recovery codes (one-time use) for MFA backup |
| **Lockout** | Implement rate limiting on auth endpoints |
| **Logout** | Revoke session token on server, clear cookie on client |

## Setup Checklist

- [ ] Install: `bun add better-auth`
- [ ] Set environment variables: `BETTER_AUTH_SECRET`, provider IDs/secrets
- [ ] Initialize BetterAuth config with Drizzle
- [ ] Run: `bunx drizzle-kit generate:sqlite && bunx drizzle-kit migrate:sqlite`
- [ ] Create auth endpoints in Hono
- [ ] Add auth middleware to protected routes
- [ ] Test sign-up, sign-in, sign-out flow
- [ ] Test OAuth (if configured)
- [ ] Enable email verification
- [ ] Set up MFA (optional)
- [ ] Add rate limiting to auth endpoints
- [ ] Test CSRF protection
- [ ] Review security headers (CORS, SameSite, etc.)

## Edge Cases & Gotchas

### Session Hijacking Prevention

**Problem:** Session tokens accessible to malicious scripts (XSS)

**Solution:**
```typescript
// Use httpOnly cookies, never localStorage
const session = await betterAuth.createSession({
  userId,
  cookieOptions: {
    httpOnly: true,  // Can't be accessed by JavaScript
    secure: true,    // HTTPS only
    sameSite: 'strict',
  }
})
```

**Never:**
```typescript
// Don't store tokens in localStorage (XSS vulnerable)
localStorage.setItem('token', sessionToken)
```

### Token Rotation Strategies

**Problem:** Reusing tokens indefinitely increases breach window

**Solution:**
```typescript
// Rotate tokens on each request (sliding window)
const session = await betterAuth.refreshSession(sessionId)
// Old token invalidated, new token issued

// Or: rotate on sensitive operations
const sensitive = await betterAuth.requireMFA(session)
```

### Cross-Tab Session Sync

**Problem:** Session expires in tab A, still valid in tab B

**Solution:**
```typescript
// Check session validity before each request
const isValid = await betterAuth.verifySession(sessionToken)
if (!isValid) {
  // Redirect to login
  window.location.href = '/login'
}

// Or: use storage events to sync across tabs
window.addEventListener('storage', (e) => {
  if (e.key === 'auth:session' && !e.newValue) {
    // Session invalidated in another tab
    logout()
  }
})
```

### OAuth Provider Quirks

**Problem:** Each OAuth provider has different response formats

**Known issues:**
- **Google:** Returns `id_token` but not always `refresh_token`
- **GitHub:** No user email if account is private
- **Okta:** Requires explicit scopes for user info

**Solution:**
```typescript
// Handle provider-specific responses
const user = await betterAuth.oauth.callback(provider, code)

// Verify provider returned expected fields
if (provider === 'google' && !user.email) {
  throw new Error('Google must return email')
}

// Map provider fields to app schema
const normalizedUser = {
  id: user.sub || user.id,
  email: user.email,
  name: user.name,
  avatar: user.picture,
}
```

### MFA Gotchas

**Recovery Codes:**
```typescript
// Generate when enabling MFA
const { backupCodes } = await betterAuth.mfa.enableTOTP()

// Store securely (not in browser storage)
// If user loses authenticator, only recovery codes work
const recoveryCode = prompt('Enter recovery code')
const authenticated = await betterAuth.mfa.verifyRecoveryCode(recoveryCode)
```

**TOTP Drift:**
```typescript
// Clock skew between server and device
// Solution: allow ±1 time window
const verified = await betterAuth.mfa.verifyTOTP(code, {
  window: 1  // Allow previous/next 30-second window
})
```

**Backup MFA Method:**
```typescript
// If primary MFA disabled/lost, what's the fallback?
// Solution: require second MFA before disabling first
if (user.mfaEnabled) {
  const backupMFA = await betterAuth.mfa.enableBackupMethod()
  // User must confirm backup before disabling primary
}
```

### CSRF Protection

**Problem:** Cross-site requests forge session

**Solution:**
```typescript
// BetterAuth generates CSRF tokens automatically
// Verify token on state-changing requests (POST, PUT, DELETE)

// In form:
<form method="POST">
  <input type="hidden" name="csrf" value={csrfToken} />
  <button>Sign out</button>
</form>

// In handler:
app.post('/logout', async (c) => {
  const csrf = c.req.formData().csrf
  if (csrf !== c.get('csrfToken')) {
    return c.text('CSRF token invalid', 403)
  }
  await betterAuth.logout(sessionId)
})
```

## Anti-Patterns

### ❌ Don't: Store tokens in localStorage

```typescript
// Bad: XSS can steal tokens
const token = await betterAuth.createSession()
localStorage.setItem('auth_token', token)

// Good: use httpOnly cookies
// BetterAuth handles this automatically
```

### ❌ Don't: Skip CSRF validation

```typescript
// Bad: allows cross-site forgery
app.post('/logout', async (c) => {
  await betterAuth.logout(sessionId)  // No CSRF check!
})

// Good: validate CSRF token
app.post('/logout', validateCSRF, async (c) => {
  await betterAuth.logout(sessionId)
})
```

### ❌ Don't: Hardcode OAuth secrets

```typescript
// Bad: secrets in code!
const auth = betterAuth({
  google: {
    clientId: 'xxx-xxx-xxx',
    clientSecret: 'super-secret-key',  // EXPOSED!
  }
})

// Good: use env vars
const auth = betterAuth({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  }
})
```

### ❌ Don't: Trust provider tokens at face value

```typescript
// Bad: assume provider token is valid
const user = await parseJWT(googleToken)
// Could be forged, expired, or revoked

// Good: verify with provider
const user = await betterAuth.oauth.callback('google', code)
// BetterAuth verifies the token with Google
```

### ❌ Don't: Reuse recovery codes

```typescript
// Bad: user can reuse same recovery code
const verified = await betterAuth.mfa.verifyRecoveryCode(code)
// User enters same code again next time

// Good: consume recovery code on use
const verified = await betterAuth.mfa.verifyRecoveryCode(code, {
  consumeOnUse: true
})
// Code is invalidated after first use
```

## External Resources

- **Official Docs:** https://better-auth.com/docs
- **Drizzle Integration:** https://better-auth.com/docs/integrations/drizzle
- **OAuth Providers:** https://better-auth.com/docs/integrations/oauth-providers
- **API Reference:** https://better-auth.com/docs/api
- **Security Best Practices:** https://owasp.org/www-project-authentication-cheat-sheet/
