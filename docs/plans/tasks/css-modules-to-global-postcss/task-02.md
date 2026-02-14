# Task 2: Create postcss.config.js

## Overview

Create a PostCSS configuration file in the game app root that configures `postcss-preset-env` with stage 2 features and explicit CSS nesting support. Next.js will auto-detect this config and use it to process all CSS files.

## Related Documents

- **Work Plan**: Phase 1, Task 2
- **Design Doc**: Section "1. PostCSS Configuration"

## Prerequisites

- Task 1 must be completed (`postcss-preset-env` installed)

## Target Files

- `D:/git/github/nookstead/main/apps/game/postcss.config.js` (new file)

## Implementation Steps

### Step 1: Create postcss.config.js

Create the file `D:/git/github/nookstead/main/apps/game/postcss.config.js` with the following exact content:

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    'postcss-preset-env': {
      stage: 2,
      features: {
        'nesting-rules': true,
      },
    },
  },
};

module.exports = config;
```

**Important notes**:
- Use **plain object export** (`module.exports = config;`), not a function
- This is a Next.js requirement (see [Next.js PostCSS docs](https://nextjs.org/docs/messages/postcss-function))
- The config explicitly enables `nesting-rules` for CSS nesting syntax

### Step 2: Verify file creation

Confirm the file exists:

```bash
ls -la apps/game/postcss.config.js
```

### Step 3: Verify Next.js auto-detection

Run a build to confirm Next.js detects the PostCSS config:

```bash
npx nx build game
```

**Expected behavior**:
- Build should succeed (exit code 0)
- No PostCSS-related warnings or errors in output
- Next.js should process CSS through postcss-preset-env

If the build fails with a PostCSS error, verify:
1. `postcss-preset-env` is installed (Task 1)
2. Config syntax matches the example exactly (plain object, not function)

## Completion Criteria

- [ ] `apps/game/postcss.config.js` exists
- [ ] File content matches Design Doc specification exactly
- [ ] `npx nx build game` succeeds without PostCSS errors
- [ ] No warnings about missing PostCSS config

## Verification Procedure

1. Create `apps/game/postcss.config.js` with the exact content above
2. Verify file exists:
   ```bash
   cat apps/game/postcss.config.js
   ```
3. Run build to verify Next.js detects the config:
   ```bash
   npx nx build game
   ```
4. Expected: Build succeeds with no PostCSS-related errors

## Notes

- This config overrides Next.js default PostCSS behavior
- Stage 2 includes autoprefixer + modern CSS features
- The `nesting-rules` feature is explicitly enabled for clarity
- This is a prerequisite for Task 3 (global.css rewrite with nesting syntax)
