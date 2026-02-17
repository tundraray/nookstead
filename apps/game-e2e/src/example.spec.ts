import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
  await page.goto('/');

  // Expect logo image to be present with the game title as alt text.
  const logo = page.locator('img[alt="Nookstead"]');
  await expect(logo).toBeVisible();
});
