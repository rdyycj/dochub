import { test, expect } from '@playwright/test';
import { _electron as electron } from 'playwright';
import * as path from 'path';

test.describe('DocHub E2E', () => {
  test('should launch and show main window', async () => {
    const app = await electron.launch({
      args: [path.resolve(__dirname, '../dist/main/index.js')],
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // Check title
    const title = await page.title();
    expect(title).toBe('DocHub');

    // Check navigation tabs exist
    await expect(page.locator('text=文件浏览')).toBeVisible();
    await expect(page.locator('text=全文搜索')).toBeVisible();
    await expect(page.locator('text=设置')).toBeVisible();

    // Navigate to search tab
    await page.click('text=全文搜索');
    await expect(page.locator('input[placeholder="搜索文件内容…"]')).toBeVisible();

    await app.close();
  });
});
