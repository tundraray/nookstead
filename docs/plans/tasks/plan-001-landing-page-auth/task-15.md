# Task 4.4: Manual OAuth Flow Testing with Real Credentials

**Phase**: Phase 4 - Quality Assurance
**Estimated Duration**: 30 minutes (includes OAuth provider setup)
**Dependencies**: Task 4.3 (responsive design must pass), requires OAuth credentials
**Task Type**: Verification

## Overview

Test the complete OAuth authentication flow with real Google and Discord credentials. This verifies end-to-end integration of NextAuth, route protection, and session management.

## Prerequisites

### OAuth Provider Credentials Required

This task requires OAuth 2.0 credentials from Google and Discord. If not already configured:

**Google Cloud Console**:
1. Go to https://console.cloud.google.com/apis/credentials
2. Create OAuth 2.0 Client ID
3. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
4. Copy Client ID and Client Secret

**Discord Developer Portal**:
1. Go to https://discord.com/developers/applications
2. Create new application
3. In OAuth2 settings, add redirect: `http://localhost:3000/api/auth/callback/discord`
4. Copy Client ID and Client Secret

### Environment Configuration

Create `.env.local` in workspace root (if not already created):

```bash
# Generate AUTH_SECRET
AUTH_SECRET=$(openssl rand -base64 32)

# Google OAuth (replace with your values)
AUTH_GOOGLE_ID=your-google-client-id-here
AUTH_GOOGLE_SECRET=your-google-client-secret-here

# Discord OAuth (replace with your values)
AUTH_DISCORD_ID=your-discord-client-id-here
AUTH_DISCORD_SECRET=your-discord-client-secret-here
```

**Save and restart dev server** for environment variables to take effect.

## Manual Testing Procedures

### Test 1: Google OAuth Login Flow

**Purpose**: Verify Google OAuth integration works end-to-end

1. **Start fresh** (incognito window, no session):
   - Open incognito/private browser window
   - Navigate to `http://localhost:3000/`
   - Verify login buttons are visible

2. **Initiate Google OAuth**:
   - Click "Sign in with Google" button
   - **Expected**: Button text changes to "Redirecting..."
   - **Expected**: Browser redirects to Google OAuth consent screen

3. **Complete Google consent**:
   - Select a Google account
   - Grant permissions if prompted
   - **Expected**: Redirect back to `http://localhost:3000/game`

4. **Verify post-login state**:
   - **Expected**: Game page loads successfully
   - **Expected**: No redirect to landing page (session is active)

5. **Verify session on landing page**:
   - Navigate to `http://localhost:3000/`
   - **Expected**: Welcome message appears: "Welcome back, [Your Google Name]!"
   - **Expected**: Green "Play" button is visible
   - **Expected**: Login buttons are NOT visible

6. **Verify Play button works**:
   - Click "Play" button
   - **Expected**: Navigate to `/game`

**If Google OAuth fails**:
- Check `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` are correct
- Verify redirect URI in Google Cloud Console matches exactly: `http://localhost:3000/api/auth/callback/google`
- Check browser console for errors
- Review NextAuth logs in terminal

### Test 2: Discord OAuth Login Flow

**Purpose**: Verify Discord OAuth integration works end-to-end

1. **Sign out** (or use a different incognito window):
   - Close previous incognito window or clear cookies
   - Open new incognito window
   - Navigate to `http://localhost:3000/`

2. **Initiate Discord OAuth**:
   - Click "Sign in with Discord" button
   - **Expected**: Button text changes to "Redirecting..."
   - **Expected**: Browser redirects to Discord OAuth authorization screen

3. **Complete Discord authorization**:
   - Log in to Discord if prompted
   - Click "Authorize" to grant permissions
   - **Expected**: Redirect back to `http://localhost:3000/game`

4. **Verify post-login state**:
   - **Expected**: Game page loads successfully
   - **Expected**: No redirect to landing page (session is active)

5. **Verify session on landing page**:
   - Navigate to `http://localhost:3000/`
   - **Expected**: Welcome message appears: "Welcome back, [Your Discord Username]!"
   - **Expected**: Green "Play" button is visible
   - **Expected**: Login buttons are NOT visible

**If Discord OAuth fails**:
- Check `AUTH_DISCORD_ID` and `AUTH_DISCORD_SECRET` are correct
- Verify redirect URI in Discord Developer Portal matches exactly: `http://localhost:3000/api/auth/callback/discord`
- Check browser console for errors
- Review NextAuth logs in terminal

### Test 3: Route Protection (Unauthenticated)

**Purpose**: Verify proxy.ts redirects unauthenticated users

1. **Open incognito window** (no session):
   - Navigate directly to `http://localhost:3000/game`
   - **Expected**: Immediate redirect to `http://localhost:3000/`
   - **Expected**: Landing page with login buttons appears

**If redirect doesn't work**:
- Verify `proxy.ts` is in correct location (`apps/game/src/proxy.ts`)
- Check session cookie naming (dev: `authjs.session-token`, prod: `__Secure-authjs.session-token`)
- Restart dev server (proxy changes require restart)

### Test 4: Session Persistence Across Page Refresh

**Purpose**: Verify session cookie persists (30-day maxAge)

1. **Log in** (either Google or Discord)
2. **Verify authenticated state** (on `/game` or `/`)
3. **Refresh the page** (`F5` or `Ctrl+R`)
   - **Expected**: Session persists, no redirect to login
   - **Expected**: Still see authenticated view (Play button on landing page)

4. **Close and reopen browser tab**:
   - Navigate back to `http://localhost:3000/`
   - **Expected**: Session persists (within same browser session)
   - **Expected**: Still authenticated

5. **Open new browser tab**:
   - Navigate to `http://localhost:3000/game`
   - **Expected**: Session persists across tabs
   - **Expected**: Game page loads without redirect

**If session doesn't persist**:
- Check JWT maxAge in `auth.ts` (should be 30 days)
- Verify session cookie is being set (check browser DevTools → Application → Cookies)
- Ensure cookie is not being cleared on page navigation

### Test 5: Multiple User Accounts

**Purpose**: Verify different OAuth accounts work correctly

1. **Log in with Google account**
   - Verify welcome message shows Google account name

2. **Sign out** (manually delete session cookie or use new incognito window)
   - DevTools → Application → Cookies → Delete `authjs.session-token`

3. **Log in with Discord account**
   - Verify welcome message shows Discord account name

**Expected**: Both providers work independently, session data is specific to each provider.

### Test 6: Error Handling (Invalid Credentials)

**Purpose**: Verify graceful error handling

1. **Temporarily corrupt credentials**:
   - Edit `.env.local`, change `AUTH_GOOGLE_SECRET` to an invalid value
   - Restart dev server

2. **Attempt Google login**:
   - Click "Sign in with Google"
   - **Expected**: Error page from NextAuth or OAuth provider
   - **Expected**: User is not logged in

3. **Restore correct credentials**:
   - Fix `.env.local`
   - Restart dev server
   - Re-test to verify it works again

## Acceptance Criteria

- [ ] Google OAuth login flow completes successfully
- [ ] Discord OAuth login flow completes successfully
- [ ] Unauthenticated requests to `/game` redirect to `/` (proxy.ts working)
- [ ] Authenticated requests to `/game` pass through without redirect
- [ ] Session persists across page refresh
- [ ] Session persists across browser tabs
- [ ] Welcome message displays correct user name from OAuth provider
- [ ] "Play" button appears when authenticated
- [ ] Login buttons appear when unauthenticated
- [ ] Both OAuth providers work independently
- [ ] Invalid credentials produce error (not crash)

## Verification Steps

1. Set up OAuth credentials in `.env.local`
2. Restart dev server: `npx nx dev game`
3. Execute all 6 test procedures above
4. Document any failures or unexpected behavior
5. Verify all acceptance criteria are met

## Rollback Procedure

If OAuth integration fails and cannot be fixed:

1. Review OAuth provider configuration (Google Cloud Console, Discord Developer Portal)
2. Check redirect URIs match exactly
3. Verify environment variables are correctly named and valued
4. Review NextAuth logs for specific error messages
5. Consult NextAuth v5 documentation for provider-specific issues

## Notes

- OAuth credentials must be kept secret; `.env.local` is in `.gitignore`
- Redirect URIs must match EXACTLY (including protocol, port, path)
- Google OAuth may require email verification or domain verification for production use
- Discord OAuth requires bot permissions to be configured if using Discord bot features (not needed here)
- Session cookies are encrypted and signed; tampering will invalidate the session
- JWT maxAge is 30 days; after expiration, users must log in again
- NextAuth v5 beta may have occasional issues; consult documentation if errors occur

## Troubleshooting Common Issues

### "Invalid redirect_uri" error
- Check redirect URI in OAuth provider console matches exactly: `http://localhost:3000/api/auth/callback/{provider}`
- Ensure no trailing slash
- Verify protocol is `http` for localhost (not `https`)

### "Invalid client_secret" error
- Verify `AUTH_GOOGLE_SECRET` or `AUTH_DISCORD_SECRET` is correct
- Check for leading/trailing whitespace in `.env.local`
- Re-generate secret if necessary

### OAuth consent screen shows error
- Check OAuth provider application status (some require verification)
- Ensure authorized domains include `localhost`
- Verify OAuth scopes are correctly configured

### Session cookie not set
- Check browser DevTools → Application → Cookies
- Verify `authjs.session-token` appears after successful login
- Ensure `AUTH_SECRET` is set in `.env.local`

### Redirect loop
- Check proxy.ts logic for infinite redirects
- Verify session cookie is being read correctly
- Ensure landing page (`/`) is not protected by proxy

## Security Considerations

- **Do NOT commit `.env.local`** to version control (already in `.gitignore`)
- Use strong, unique `AUTH_SECRET` (minimum 32 characters)
- OAuth credentials are sensitive; treat them like passwords
- In production, use `__Secure-` prefixed cookies (automatic on HTTPS)
- Monitor OAuth provider rate limits and quotas
