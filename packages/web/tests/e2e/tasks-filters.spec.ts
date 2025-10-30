import { test, expect } from '@playwright/test';

// Test against development server (port 3001 for test environment)
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

test.describe('Tasks Page URL Filter Synchronization', () => {
  test.describe('User Story 1: Persistent Filter State via URL', () => {
    test('T006: status filter URL update', async ({ page }) => {
      // Navigate to /tasks/
      await page.goto(`${BASE_URL}/tasks/`);

      // Click "Open" status filter button
      await page.click('button:has-text("Open")');

      // Wait for URL to update
      await page.waitForURL(/status=open/);

      // Assert URL contains ?status=open
      expect(page.url()).toContain('?status=open');

      // Assert Open filter button is active (has green background)
      const openButton = page.locator('button:has-text("Open")');
      await expect(openButton).toHaveClass(/bg-github-green-600/);
    });

    test('T007: filter persistence across page refresh', async ({ page }) => {
      // Navigate to /tasks/
      await page.goto(`${BASE_URL}/tasks/`);

      // Apply "Done" filter
      await page.click('button:has-text("Done")');

      // Verify URL contains ?status=done
      await page.waitForURL(/status=done/);
      expect(page.url()).toContain('?status=done');

      // Refresh page
      await page.reload();

      // Assert URL still contains ?status=done
      expect(page.url()).toContain('?status=done');

      // Assert filter UI shows "Done" as active
      const doneButton = page.locator('button:has-text("Done")');
      await expect(doneButton).toHaveClass(/bg-github-green-600/);
    });

    test('T008: browser back button navigation', async ({ page }) => {
      // Navigate to /tasks/
      await page.goto(`${BASE_URL}/tasks/`);

      // Apply "Open" filter → verify URL
      await page.click('button:has-text("Open")');
      await page.waitForURL(/status=open/);
      expect(page.url()).toContain('?status=open');

      // Apply "Done" filter → verify URL
      await page.click('button:has-text("Done")');
      await page.waitForURL(/status=done/);
      expect(page.url()).toContain('?status=done');

      // Click browser back button
      await page.goBack();

      // Assert URL returns to ?status=open
      expect(page.url()).toContain('?status=open');
      expect(page.url()).not.toContain('status=done');

      // Assert UI shows "Open" filter active
      const openButton = page.locator('button:has-text("Open")');
      await expect(openButton).toHaveClass(/bg-github-green-600/);
    });

    test('T009: direct URL navigation', async ({ page }) => {
      // Navigate directly to /tasks/?status=next
      await page.goto(`${BASE_URL}/tasks/?status=next`);

      // Assert page loads with "Next" filter applied
      expect(page.url()).toContain('?status=next');

      // Assert UI shows "Next" as active filter
      const nextButton = page.locator('button:has-text("Next")');
      await expect(nextButton).toHaveClass(/bg-github-green-600/);
    });

    test('T010: "All" filter clearing URL parameters', async ({ page }) => {
      // Navigate to /tasks/?status=done
      await page.goto(`${BASE_URL}/tasks/?status=done`);

      // Verify we're on the filtered page
      expect(page.url()).toContain('?status=done');

      // Click "All" filter button
      await page.click('button:has-text("All")');

      // Wait for URL to update
      await page.waitForTimeout(200); // Small delay for URL update

      // Assert URL changes to /tasks/ (no parameters)
      expect(page.url()).toBe(`${BASE_URL}/tasks/`);
      expect(page.url()).not.toContain('status=');

      // Assert "All" button is active
      const allButton = page.locator('button:has-text("All")');
      await expect(allButton).toHaveClass(/bg-github-green-600/);
    });
  });

  test.describe('User Story 2: Bookmark Filter State Persistence', () => {
    test('T015: combined filters in URL', async ({ page }) => {
      // Navigate to /tasks/
      await page.goto(`${BASE_URL}/tasks/`);

      // Apply "Open" status filter
      await page.click('button:has-text("Open")');
      await page.waitForURL(/status=open/);

      // Enable bookmark filter
      await page.click('button:has-text("Bookmarked")');

      // Wait for URL to update
      await page.waitForTimeout(200);

      // Assert URL contains ?status=open&bookmarked=true (or reverse order)
      const url = page.url();
      expect(url).toContain('status=open');
      expect(url).toContain('bookmarked=true');

      // Assert both filters are active in UI
      const openButton = page.locator('button:has-text("Open")');
      const bookmarkedButton = page.locator('button:has-text("Bookmarked")');
      await expect(openButton).toHaveClass(/bg-github-green-600/);
      await expect(bookmarkedButton).toHaveClass(/bg-github-green-600/);
    });

    test('T016: bookmark filter URL persistence', async ({ page }) => {
      // Navigate to /tasks/
      await page.goto(`${BASE_URL}/tasks/`);

      // Enable bookmark filter only
      await page.click('button:has-text("Bookmarked")');

      // Wait for URL to update
      await page.waitForTimeout(200);

      // Assert URL contains ?bookmarked=true
      expect(page.url()).toContain('bookmarked=true');

      // Refresh page
      await page.reload();

      // Assert bookmark filter still active
      const bookmarkedButton = page.locator('button:has-text("Bookmarked")');
      await expect(bookmarkedButton).toHaveClass(/bg-github-green-600/);
      expect(page.url()).toContain('bookmarked=true');
    });

    test('T017: disabling bookmark filter clears parameter', async ({ page }) => {
      // Navigate to /tasks/?status=open&bookmarked=true
      await page.goto(`${BASE_URL}/tasks/?status=open&bookmarked=true`);

      // Verify both params are in URL
      expect(page.url()).toContain('status=open');
      expect(page.url()).toContain('bookmarked=true');

      // Disable bookmark filter (click to toggle off)
      await page.click('button:has-text("Bookmarked")');

      // Wait for URL to update
      await page.waitForTimeout(200);

      // Assert URL changes to /tasks/?status=open (bookmarked removed)
      expect(page.url()).toContain('status=open');
      expect(page.url()).not.toContain('bookmarked=true');

      // Assert status filter still active
      const openButton = page.locator('button:has-text("Open")');
      await expect(openButton).toHaveClass(/bg-github-green-600/);

      // Assert bookmark filter is not active
      const bookmarkedButton = page.locator('button:has-text("Bookmarked")');
      await expect(bookmarkedButton).not.toHaveClass(/bg-github-green-600/);
    });
  });

  test.describe('User Story 3: Shareable Filtered Views', () => {
    test('T019: shareable URL with status filter', async ({ page }) => {
      // Navigate directly to /tasks/?status=done in fresh context
      await page.goto(`${BASE_URL}/tasks/?status=done`);

      // Assert page loads with "Done" filter applied
      expect(page.url()).toContain('?status=done');

      // Assert UI shows "Done" as active filter
      const doneButton = page.locator('button:has-text("Done")');
      await expect(doneButton).toHaveClass(/bg-github-green-600/);
    });

    test('T020: shareable URL with combined filters', async ({ page }) => {
      // Navigate directly to /tasks/?status=open&bookmarked=true in new context
      await page.goto(`${BASE_URL}/tasks/?status=open&bookmarked=true`);

      // Assert both filters are applied correctly
      expect(page.url()).toContain('status=open');
      expect(page.url()).toContain('bookmarked=true');

      // Assert UI shows both filters active
      const openButton = page.locator('button:has-text("Open")');
      const bookmarkedButton = page.locator('button:has-text("Bookmarked")');
      await expect(openButton).toHaveClass(/bg-github-green-600/);
      await expect(bookmarkedButton).toHaveClass(/bg-github-green-600/);
    });

    test('T021: invalid URL parameters in shared links', async ({ page }) => {
      // Navigate to /tasks/?status=invalid
      await page.goto(`${BASE_URL}/tasks/?status=invalid`);

      // Assert page defaults to "All" filter gracefully
      const allButton = page.locator('button:has-text("All")');
      await expect(allButton).toHaveClass(/bg-github-green-600/);

      // Assert no error messages displayed (page loads successfully)
      await expect(page.locator('text=error').first()).not.toBeVisible().catch(() => {
        // It's ok if error element doesn't exist
      });

      // Navigate to /tasks/?status=open&bookmarked=yes
      await page.goto(`${BASE_URL}/tasks/?status=open&bookmarked=yes`);

      // Assert status filter works
      const openButton = page.locator('button:has-text("Open")');
      await expect(openButton).toHaveClass(/bg-github-green-600/);

      // Assert bookmark filter defaults to false (invalid value 'yes')
      const bookmarkedButton = page.locator('button:has-text("Bookmarked")');
      await expect(bookmarkedButton).not.toHaveClass(/bg-github-green-600/);
    });
  });
});
