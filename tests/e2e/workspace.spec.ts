import { test, expect } from '@playwright/test';
test('navigation, persistence, media, review and responsive shell', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'A little clarity. Then create.' }),
  ).toBeVisible();
  for (const route of [
    'morning-review',
    'calendar',
    'ideas',
    'posts',
    'media',
    'intelligence',
    'trends',
    'analytics',
    'assistant',
    'settings',
  ]) {
    await page.goto(`/${route}`);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Workspace unavailable')).toHaveCount(0);
  }
  const title = `Browser verification ${Date.now()}`;
  await page.goto('/create');
  await page.getByLabel('Title', { exact: true }).fill(title);
  await page
    .getByLabel('Content / raw note')
    .fill('An end-to-end check of persistent linked content.');
  await page.getByRole('button', { name: 'Save to workspace' }).click();
  await expect(page.getByRole('status')).toContainText('Draft saved');
  await page.goto('/posts');
  await page.getByRole('link', { name: title }).click();
  await expect(
    page.getByRole('heading', { name: 'X / Twitter', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'LinkedIn', exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: title })).toBeVisible();
  await page.getByLabel('Search workspace').fill(title);
  await page.getByLabel('Search workspace').press('Enter');
  await expect(page.getByRole('link', { name: title })).toBeVisible();
  await page.goto('/media');
  await page.getByLabel('Choose media').setInputFiles({
    name: 'verification.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Upload media' }).click();
  await expect(page.getByRole('status')).toContainText('uploaded');
  const href = await page
    .getByRole('link', { name: 'Open uploaded file' })
    .first()
    .getAttribute('href');
  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toBe('image/png');
  await page.goto('/morning-review');
  await page.getByRole('button', { name: /sample review/ }).click();
  await expect(
    page.getByText('Sample recommendation', { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Accept recommendation' })
    .first()
    .click();
  await expect(
    page.getByText('Latest decision: accepted').first(),
  ).toBeVisible();
  await page.goto('/assistant');
  await page
    .getByLabel('Message', { exact: true })
    .fill('A practical founder lesson');
  await page.getByRole('button', { name: 'Send message' }).click();
  await expect(page.getByRole('status')).toContainText('response saved');
  await expect(
    page.getByText(/Mock brainstorming response/).last(),
  ).toBeVisible();
  await page.goto('/settings');
  await page.getByLabel('Tone', { exact: true }).fill('Clear and practical');
  await page.getByRole('button', { name: 'Save preferences' }).click();
  await expect(page.getByRole('status')).toContainText('saved');
  await page.reload();
  await expect(page.getByLabel('Tone', { exact: true })).toHaveValue(
    'Clear and practical',
  );
  await page.goto('/');
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.screenshot({
    path: '.local/dashboard-desktop.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.sidebar')!).transform ===
      'matrix(1, 0, 0, 1, -236, 0)',
  );
  await page.screenshot({
    path: '.local/dashboard-mobile.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Ideas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ideas', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
