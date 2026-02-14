# Task 1.3: Create API Route Handler and Environment Variable Documentation

**Phase**: Phase 1 - Authentication Foundation
**Estimated Duration**: 10 minutes
**Dependencies**: Task 1.2 (auth.ts must exist)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Create the NextAuth API route handler that exposes OAuth endpoints (`/api/auth/*`) and document required environment variables in `.env.example`. This task makes the authentication infrastructure accessible via HTTP endpoints.

## Target Files

### New Files
- `apps/game/src/app/api/auth/[...nextauth]/route.ts` - NextAuth route handler
- `.env.example` - Environment variable documentation (workspace root)

## Implementation Steps

### TDD Cycle

**RED (Verify endpoint doesn't exist)**:
1. Start dev server: `npx nx dev game`
2. Navigate to `http://localhost:3000/api/auth/providers`
3. Should return 404 (route doesn't exist yet)

**GREEN (Implement route handler)**:

### 1. Create the catch-all route handler

Create directory structure and file:

```bash
mkdir -p apps/game/src/app/api/auth/[...nextauth]
```

Create `apps/game/src/app/api/auth/[...nextauth]/route.ts`:

```typescript
export { GET, POST } from '@/auth';
```

**Why re-export handlers**:
NextAuth v5 provides `handlers` object with `GET` and `POST` methods. Next.js App Router expects route handlers to export `GET` and `POST` as named exports. The `handlers` from `auth.ts` destructures to these exact exports.

However, to make this work correctly, we need to adjust the import. Update to:

```typescript
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
```

### 2. Create .env.example

Create `.env.example` in the workspace root (NOT in apps/game):

```bash
# NextAuth.js v5 Configuration
# Generate AUTH_SECRET with: openssl rand -base64 32

AUTH_SECRET=your-secret-key-here

# Google OAuth 2.0 Credentials
# Obtain from: https://console.cloud.google.com/apis/credentials
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret

# Discord OAuth 2.0 Credentials
# Obtain from: https://discord.com/developers/applications
AUTH_DISCORD_ID=your-discord-client-id
AUTH_DISCORD_SECRET=your-discord-client-secret
```

### 3. Verify build succeeds

```bash
npx nx build game
```

Should complete with zero errors.

**REFACTOR**:
- Verify import path uses `@/auth` alias
- Ensure .env.example comments are clear and helpful
- Confirm directory nesting is correct (`api/auth/[...nextauth]`)

### 4. Verify route handler works (optional if .env.local set up)

If you want to test the endpoint, create `.env.local` in workspace root with at minimum:

```bash
AUTH_SECRET=$(openssl rand -base64 32)
```

Then:

```bash
npx nx dev game
```

Navigate to `http://localhost:3000/api/auth/providers`

Should return JSON:
```json
{
  "google": {
    "id": "google",
    "name": "Google",
    "type": "oidc"
  },
  "discord": {
    "id": "discord",
    "name": "Discord",
    "type": "oidc"
  }
}
```

If environment variables are not set, you may see errors in the console, but the route structure is correct.

## Implementation Details

### Catch-all Route Pattern

`[...nextauth]` is a Next.js dynamic route segment that captures all paths under `/api/auth/`:
- `/api/auth/signin` → handled by NextAuth
- `/api/auth/signout` → handled by NextAuth
- `/api/auth/callback/google` → OAuth callback
- `/api/auth/providers` → list configured providers

### Environment Variables

**AUTH_SECRET**:
- Required for JWT encryption and CSRF protection
- Generate with `openssl rand -base64 32`
- Minimum 32 characters recommended

**Provider credentials**:
- Not required during development of tasks 1-3
- Required for Task 4.4 (manual OAuth testing)
- Obtained from Google Cloud Console and Discord Developer Portal

**File locations**:
- `.env.example` - Committed to git, documents required variables
- `.env.local` - NOT committed (in .gitignore), holds actual secrets

## Acceptance Criteria

- [ ] `apps/game/src/app/api/auth/[...nextauth]/route.ts` exists
- [ ] Route handler exports `GET` and `POST` from `handlers`
- [ ] `.env.example` documents all 5 required environment variables
- [ ] `.env.example` includes helpful comments with credential URLs
- [ ] `npx nx build game` succeeds
- [ ] (Optional) `/api/auth/providers` returns JSON listing Google and Discord

## Verification Steps

1. Run `npx nx build game` - should succeed
2. Verify file structure:
   ```
   apps/game/src/app/api/auth/[...nextauth]/route.ts
   .env.example
   ```
3. (Optional) Start dev server and test `/api/auth/providers` endpoint

## Rollback Procedure

If route handler causes issues:

```bash
rm -rf apps/game/src/app/api/auth
rm .env.example
npx nx build game
```

## Notes

- OAuth endpoints are now functional, but clicking login buttons won't work until Task 2.3 (LoginButton component)
- Session management endpoints are active but won't be used until Task 3.x (integration tasks)
- The route handler will be referenced in Phase 1 completion verification
- `.env.local` is NOT created in this task (manual setup by developer)
