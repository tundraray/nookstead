# Task 2.2: Add Press Start 2P Font and Update Layout Metadata

**Phase**: Phase 2 - Landing Page UI
**Estimated Duration**: 10 minutes
**Dependencies**: Task 2.1 (global.css must be replaced first)
**Task Type**: Implementation (TDD: Red → Green → Refactor)

## Overview

Load the Press Start 2P pixel font from Google Fonts CDN and update the layout metadata (title and description) to reflect Nookstead branding. This task completes the global styling foundation without adding auth integration yet.

## Target Files

### Modified
- `apps/game/src/app/layout.tsx` - Add font link and update metadata

## Implementation Steps

### TDD Cycle

**RED (Verify current state)**:
1. Start dev server: `npx nx dev game`
2. Navigate to `/` - font should be fallback monospace
3. Check page title in browser tab - should be Nx default
4. Inspect computed font-family in DevTools - should be generic monospace

**GREEN (Add font and metadata)**:

### 1. Update layout.tsx

Modify `apps/game/src/app/layout.tsx`:

**Update the metadata export**:

```typescript
export const metadata: Metadata = {
  title: 'Nookstead',
  description: 'A 2D pixel art MMO life sim with AI-powered NPCs',
};
```

**Add the Google Fonts link in the HTML head**:

Inside the `<html>` tag, add the `<link>` element before `{children}`:

```typescript
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

**Complete example layout.tsx** (without AuthProvider, that's Task 3.2):

```typescript
import './global.css';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Nookstead',
  description: 'A 2D pixel art MMO life sim with AI-powered NPCs',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

### 2. Verify font loads

After saving, dev server should hot-reload. Navigate to `/`:

1. Open browser DevTools → Elements → Inspect `<html>` element
2. Check Computed styles → font-family
3. Should now show: `"Press Start 2P", monospace`

**Visual verification**: Text should render in chunky pixel font (very different from default monospace).

### 3. Verify metadata

Check browser tab:
- Title should be "Nookstead"
- In View Source or DevTools → Elements → `<head>`, verify `<meta name="description">` contains the tagline

**REFACTOR**:
- Verify font URL uses `display=swap` for faster rendering
- Ensure metadata description matches Design Doc specification

### 4. Verify build succeeds

```bash
npx nx build game
```

Should complete with zero errors.

## Implementation Details

### Google Fonts CDN

**Why CDN**: Using Google Fonts CDN is simpler than self-hosting for a single font. The font is cached globally and loads quickly.

**Font parameters**:
- `family=Press+Start+2P` - The pixel font family
- `display=swap` - Shows fallback font first, then swaps to Press Start 2P when loaded (prevents invisible text during load)

**Fallback**: If CDN fails, the fallback `monospace` from global.css will be used (from Task 2.1).

### Metadata

The `metadata` export is a Next.js App Router convention for setting page metadata. It populates:
- `<title>Nookstead</title>`
- `<meta name="description" content="A 2D pixel art MMO life sim with AI-powered NPCs">`

This metadata will appear in browser tabs and search engine results.

### Why Not Add AuthProvider Yet

Task 3.2 will add the `<AuthProvider>` wrapper. Separating font/metadata (this task) from auth integration (Task 3.2) keeps changes focused and easier to verify.

## Acceptance Criteria

- [ ] `apps/game/src/app/layout.tsx` includes Google Fonts `<link>` tag
- [ ] Metadata title is "Nookstead"
- [ ] Metadata description is "A 2D pixel art MMO life sim with AI-powered NPCs"
- [ ] Font loads and applies to all pages (verify in DevTools)
- [ ] Browser tab shows "Nookstead" as page title
- [ ] `npx nx build game` succeeds
- [ ] Font fallback works if CDN is unavailable (hard to test, but `monospace` is specified in global.css)

## Verification Steps

1. Start dev server: `npx nx dev game`
2. Navigate to `/`
3. Inspect `<html>` element in DevTools - verify font-family includes "Press Start 2P"
4. Check browser tab title - should be "Nookstead"
5. View page source - verify `<meta name="description">` is present
6. Navigate to `/game` - verify font applies globally (game page should also use Press Start 2P for any text)
7. Run build: `npx nx build game` - should succeed

## Rollback Procedure

If font or metadata causes issues:

```bash
git checkout apps/game/src/app/layout.tsx
npx nx dev game
```

Verify landing page works, then re-attempt the task.

## Notes

- Do NOT add `<AuthProvider>` in this task (that's Task 3.2)
- The font will be used by the landing page logo (Task 2.4) and all text throughout the app
- Press Start 2P is a bold, chunky pixel font - text will be very different from default
- The font is loaded globally; all pages will use it unless they override with CSS Modules
- Font size will be controlled by individual components (e.g., landing page uses `clamp()` for responsive sizing)
