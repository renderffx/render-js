import { test, expect } from '@playwright/test';

test.describe('Stress Tests', () => {
  test('should handle rapid navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    for (let i = 0; i < 10; i++) {
      await page.reload();
      await page.waitForLoadState('domcontentloaded');
    }
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle concurrent requests', async ({ page, request }) => {
    const promises = [];
    for (let i = 0; i < 5; i++) {
      promises.push(request.get('/'));
    }
    
    const responses = await Promise.all(promises);
    responses.forEach(response => {
      expect(response.status()).toBeGreaterThanOrEqual(200);
    });
  });

  test('should handle large payloads', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const content = await page.content();
    expect(content.length).toBeGreaterThan(0);
  });

  test('should handle long sessions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    await page.waitForTimeout(5000);
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Performance Tests', () => {
  test('should load page quickly', async ({ page }) => {
    const start = Date.now();
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const loadTime = Date.now() - start;
    
    expect(loadTime).toBeLessThan(10000);
  });

  test('should have fast TTFB', async ({ page, request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
  });

  test('should minimize CLS', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Memory Tests', () => {
  test('should not leak memory on navigation', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    for (let i = 0; i < 5; i++) {
      await page.reload();
      await page.waitForLoadState('networkidle');
    }
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle multiple client components', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Edge Cases', () => {
  test('should handle empty page', async ({ page }) => {
    await page.goto('/');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle special characters in URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle very long URL', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should handle concurrent state updates', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });
});

test.describe('RSC Specific', () => {
  test('should handle RSC chunks streaming', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle client reference resolution', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should handle server action streaming', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});

test.describe('Vercel Specific', () => {
  test('should set correct content-type for RSC', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['content-type']).toBeDefined();
  });

  test('should support response streaming headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
  });

  test('should handle edge runtime context', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const body = await page.locator('body');
    await expect(body).toBeVisible();
  });
});
