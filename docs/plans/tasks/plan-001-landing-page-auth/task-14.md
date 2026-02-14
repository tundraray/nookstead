# Task 4.3: Verify Responsive Design at Key Breakpoints

**Phase**: Phase 4 - Quality Assurance
**Estimated Duration**: 15 minutes
**Dependencies**: Task 4.2 (build must pass)
**Task Type**: Verification

## Overview

Manually verify the landing page responsive design works correctly at three key viewport widths: 360px (mobile), 768px (tablet), and 1440px (desktop). This ensures the pixel art UI is accessible and usable across devices.

## Target Files

### Verification Only
- No file changes, manual testing in browser DevTools

## Responsive Design Verification Procedures

### 1. Start Development Server

```bash
npx nx dev game
```

Navigate to `http://localhost:3000/`

### 2. Open Browser DevTools Responsive Mode

**Chrome/Edge**:
- Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Click the "Toggle device toolbar" icon (or press `Ctrl+Shift+M` / `Cmd+Shift+M`)

**Firefox**:
- Press `F12` or `Ctrl+Shift+I` (Windows) / `Cmd+Option+I` (Mac)
- Click the "Responsive Design Mode" icon (or press `Ctrl+Shift+M` / `Cmd+Option+M`)

### 3. Test 360px Viewport (Mobile)

Set viewport to: **360px × 640px**

**Checklist**:
- [ ] No horizontal scrolling occurs (page fits within 360px width)
- [ ] Logo "NOOKSTEAD" is readable (scales down via `clamp()`)
- [ ] Tagline is readable (small but not cut off)
- [ ] Login buttons stack vertically
- [ ] Login buttons fit within viewport (no overflow)
- [ ] Login buttons are at least 44px tall (WCAG touch target minimum)
- [ ] Animated star background is visible
- [ ] Logo glow animation plays smoothly
- [ ] Content is centered horizontally

**How to check 44px height**:
1. Inspect a login button element
2. In DevTools Computed tab, verify `height` is ≥ 44px
3. Or use the element picker to see dimensions overlay

**If horizontal scrolling occurs**:
- Check for fixed-width elements wider than 360px
- Review `max-width` on `.actions` container
- Ensure no hardcoded widths in CSS

### 4. Test 768px Viewport (Tablet)

Set viewport to: **768px × 1024px**

**Checklist**:
- [ ] Font sizes increase (media query at 768px applies)
- [ ] Logo scales up from mobile size
- [ ] Spacing increases (gap changes from 2rem to 3rem)
- [ ] Login buttons remain stacked vertically
- [ ] Login buttons width increases (max-width: 400px)
- [ ] Content remains centered
- [ ] No layout shifts or overflow
- [ ] Animations continue to work smoothly

**Font size verification**:
1. Inspect logo element
2. Check computed `font-size` - should be larger than at 360px
3. Verify `clamp()` is calculating correctly

### 5. Test 1440px Viewport (Desktop)

Set viewport to: **1440px × 900px**

**Checklist**:
- [ ] Maximum font sizes applied (clamp max value)
- [ ] Logo is large and prominent
- [ ] Content remains centered (no excessive whitespace issues)
- [ ] Login buttons maintain readable size (not too large)
- [ ] Star background fills the viewport
- [ ] No awkward spacing or alignment issues
- [ ] Glow animation visible and smooth
- [ ] Overall visual balance is maintained

**Content centering verification**:
1. Inspect main container (`.container` class)
2. Verify `justify-content: center` and `align-items: center` are applied
3. Check that content doesn't stick to top/left

### 6. Test Intermediate Viewports (Optional)

Test a few viewport sizes between breakpoints to ensure smooth fluid typography:

**480px (large phone)**: Fonts should scale smoothly between 360px and 768px values

**1024px (small laptop)**: Fonts should scale smoothly between 768px and 1440px values

### 7. Test Landscape Orientation (Optional)

Set viewport to **640px × 360px** (landscape phone):
- [ ] Content fits within viewport
- [ ] No vertical scrolling issues with header/footer

## Testing Both Authentication States

### Unauthenticated View

(Default state - just load the page)

**Verify at all three breakpoints**:
- [ ] Login buttons are visible and properly sized
- [ ] Button text is readable
- [ ] Hover effects work (translate + box shadow)

### Authenticated View (If OAuth Configured)

Log in via OAuth, then test:

**Verify at all three breakpoints**:
- [ ] Welcome message is readable and centered
- [ ] "Play" button is visible and properly sized
- [ ] "Play" button meets 44px minimum height
- [ ] Green button styling is consistent

## Acceptance Criteria

### 360px (Mobile)
- [ ] No horizontal scrolling
- [ ] All content is readable
- [ ] Touch targets are at least 44px tall
- [ ] Layout is vertically stacked and centered

### 768px (Tablet)
- [ ] Font sizes increase via media query
- [ ] Spacing increases appropriately
- [ ] Content remains centered
- [ ] No layout shifts

### 1440px (Desktop)
- [ ] Maximum font sizes applied
- [ ] Content is centered with balanced spacing
- [ ] No excessive whitespace issues
- [ ] Visual hierarchy is clear

### All Viewports
- [ ] Animations (logo glow, star twinkle) run smoothly
- [ ] No text overflow or truncation
- [ ] Images (if any) scale correctly (image-rendering: pixelated)
- [ ] Color contrast is sufficient (dark bg, light text)

## Verification Steps

1. Start dev server
2. Open landing page in browser
3. Enable responsive mode in DevTools
4. Test each viewport size methodically using the checklists above
5. Take screenshots of any issues for debugging (optional)
6. Test both authenticated and unauthenticated states
7. Verify animations work at all viewport sizes

## Rollback Procedure

If responsive design issues are found:

1. Identify which CSS file needs adjustment:
   - Global layout: `global.css`
   - Landing page: `page.module.css`
   - Login buttons: `LoginButton.module.css`

2. Review the responsive breakpoints and `clamp()` values

3. Fix the CSS and re-test

4. Do NOT proceed to Task 4.4 until all viewports pass

## Notes

- The `clamp()` function provides fluid typography between breakpoints
- Media queries at 768px adjust spacing and base font size
- Pixel art theme requires careful attention to font legibility at small sizes
- Touch target minimum (44px) is a WCAG 2.1 Level AA requirement
- Test on actual devices if possible (emulation is good but not perfect)
- Star animation performance may vary on low-end devices (acceptable)
- Focus on usability: can a user easily read and tap elements?

## Common Issues and Solutions

**Horizontal scrolling on mobile**:
- Remove fixed widths
- Use `max-width: 100%` on containers
- Check for padding that expands elements beyond viewport

**Text too small on mobile**:
- Adjust `clamp()` minimum value
- Ensure line-height provides enough spacing

**Buttons too small for touch**:
- Increase padding or min-height
- Verify 44px minimum is actually applied

**Content not centered**:
- Check flexbox `justify-content` and `align-items`
- Verify min-height: 100vh on container

**Animations jittery**:
- Simplify keyframes
- Use `will-change` property (sparingly)
- Test on actual mobile device for real performance
