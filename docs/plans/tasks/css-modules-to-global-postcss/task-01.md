# Task 1: Install postcss-preset-env

## Overview

Install the `postcss-preset-env` package as a dev dependency in the workspace root. This package provides modern CSS features (including CSS nesting) to Next.js via PostCSS.

## Related Documents

- **Work Plan**: Phase 1, Task 1
- **Design Doc**: Section "2. Package Installation"

## Target Files

- `D:/git/github/nookstead/main/package.json` (modified -- add to devDependencies)

## Implementation Steps

### Step 1: Install the package

Run the following command from the workspace root:

```bash
npm install -D postcss-preset-env
```

### Step 2: Verify installation

Check that `postcss-preset-env` appears in the root `package.json` under `devDependencies`:

```bash
grep -A 5 '"devDependencies"' package.json | grep postcss-preset-env
```

Expected output should show a line like:
```json
"postcss-preset-env": "^10.1.5",
```

(Version number may vary -- any version is acceptable as long as it's listed.)

## Completion Criteria

- [ ] `postcss-preset-env` appears in root `package.json` under `devDependencies`
- [ ] `npm install` command exits with code 0 (no errors)
- [ ] No peer dependency warnings in npm output

## Verification Procedure

1. Run `npm install -D postcss-preset-env` from workspace root
2. Verify command exits successfully (no errors)
3. Verify `package.json` contains the new dependency:
   ```bash
   cat package.json | grep postcss-preset-env
   ```
4. Expected: A line like `"postcss-preset-env": "^X.Y.Z",` appears in devDependencies

## Notes

- This task has no dependencies -- it can be executed immediately
- This is a prerequisite for Task 2 (PostCSS configuration) and Task 3 (global.css rewrite with nesting syntax)
