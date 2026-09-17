import { test, expect } from '@playwright/test';
test('content management, approvals, audio, Notion mock and mobile', async ({
  page,
}) => {
  const go = async (url: string) => {
    await page.goto(url, { waitUntil: 'networkidle' });
    if (!['/', '/analytics'].includes(url))
      await expect(
        page.locator('main [data-ready=true]').first(),
      ).toBeVisible();
  };
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('dialog', (d) => d.accept());
  await go('/');
  await expect(
    page.getByRole('heading', { name: 'A little clarity. Then create.' }),
  ).toBeVisible();
  for (const route of [
    'calendar',
    'ideas',
    'posts',
    'media',
    'intelligence',
    'trends',
    'analytics',
    'assistant',
    'settings',
    'morning-review',
  ]) {
    await go('/' + route);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText('Workspace unavailable')).toHaveCount(0);
  }
  await go('/create');
  await page
    .getByLabel('Title', { exact: true })
    .fill('Browser stage two story');
  await page
    .getByLabel('Core idea', { exact: true })
    .fill('A practical founder lesson about customer interviews.');
  await page
    .getByRole('button', { name: 'Create draft with X + LinkedIn variants' })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Browser stage two story', exact: true }),
  ).toBeVisible();
  const postUrl = page.url();
  await expect(page.getByLabel('X text', { exact: true })).toContainText('#');
  await expect(page.getByLabel('LinkedIn text', { exact: true })).toContainText(
    '#',
  );
  const generatedX = await page
    .getByLabel('X text', { exact: true })
    .inputValue();
  await page.getByLabel('X text', { exact: true }).fill('界'.repeat(141));
  await expect(page.getByText('282 / 280', { exact: true })).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Save x text', exact: true }),
  ).toBeDisabled();
  await page.getByLabel('X text', { exact: true }).fill(generatedX);
  await page
    .getByLabel('X text', { exact: true })
    .fill(
      'A concise founder lesson.\n\nOne real conversation beats ten assumptions.',
    );
  await page.getByRole('button', { name: 'Save x text', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('Saved');
  await page.reload();
  await expect(page.getByLabel('X text', { exact: true })).toContainText(
    'One real conversation',
  );
  await page
    .getByLabel('Schedule x (America/New_York)', { exact: true })
    .fill('2026-10-20T10:30');
  await page.getByRole('button', { name: 'Schedule x', exact: true }).click();
  await expect(page.getByRole('status').last()).toContainText('Saved');
  await page.getByLabel('AI action for x').selectOption('Improve Hook');
  await page
    .getByRole('button', { name: 'Generate suggestion', exact: true })
    .first()
    .click();
  await expect(
    page.getByText('Improve Hook · Awaiting your approval'),
  ).toBeVisible();
  await expect(page.getByLabel('X text', { exact: true })).not.toContainText(
    'The question I keep',
  );
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByLabel('X text', { exact: true })).toContainText(
    'The question I keep',
  );
  await go('/calendar');
  await page.getByLabel('Calendar date').fill('2026-10-20');
  await expect(
    page.getByText('Browser stage two story', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'week', exact: true }).click();
  await expect(
    page.getByText('Browser stage two story', { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: '.local/stage2-calendar.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  await page.getByRole('button', { name: 'agenda', exact: true }).click();
  await expect(
    page.getByText('Browser stage two story', { exact: true }),
  ).toBeVisible();
  await go('/ideas');
  await page.getByLabel('Idea title').fill('An idea from the browser');
  await page
    .getByLabel('Raw note')
    .fill('Capture the specific lesson and preserve the context.');
  await page.getByRole('button', { name: 'Save idea', exact: true }).click();
  await expect(
    page.getByRole('heading', {
      name: 'An idea from the browser',
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel('Search ideas').fill('An idea from the browser');
  await page
    .getByRole('button', { name: 'Convert to post', exact: true })
    .click();
  await expect(
    page.getByRole('heading', {
      name: 'An idea from the browser',
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByLabel('LinkedIn text', { exact: true })).toContainText(
    'Capture the specific',
  );
  await expect(page.getByLabel('X text', { exact: true })).toContainText('#');
  await expect(page.getByLabel('LinkedIn text', { exact: true })).toContainText(
    '#',
  );
  const originalLinkedIn = await page
    .getByLabel('LinkedIn text', { exact: true })
    .inputValue();
  const originalX = await page
    .getByLabel('X text', { exact: true })
    .inputValue();
  await page.getByRole('button', { name: 'Regenerate x', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: /Regenerate x.*Awaiting your approval/ }),
  ).toBeVisible();
  await expect(page.getByLabel('X text', { exact: true })).toHaveValue(
    originalX,
  );
  await expect(page.getByLabel('LinkedIn text', { exact: true })).toHaveValue(
    originalLinkedIn,
  );
  await page.getByRole('button', { name: 'Reject', exact: true }).click();
  await go('/media');
  await page.getByLabel('Choose media').setInputFiles({
    name: 'stage2-preview.png',
    mimeType: 'image/png',
    buffer: Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aD1sAAAAASUVORK5CYII=',
      'base64',
    ),
  });
  await page.getByRole('button', { name: 'Upload media', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('uploaded');
  await expect(
    page.getByRole('img', { name: 'stage2-preview.png' }),
  ).toBeVisible();
  await go(postUrl);
  await page.getByLabel(/stage2-preview.png/).check();
  await page.getByRole('button', { name: 'Save attachments' }).click();
  await expect(page.getByRole('status').last()).toContainText('Saved');
  await page.screenshot({
    path: '.local/stage2-editor.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  await go('/intelligence');
  await page.getByLabel('Brief to sync (blank means today)').fill('2026-09-14');
  await page.getByRole('button', { name: 'Sync now', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Saved');
  await page.getByLabel('Search intelligence').fill('Prediction');
  await expect(page.locator('details.intelligence-detail')).not.toHaveCount(0);
  await page.locator('details.intelligence-detail summary').first().click();
  await expect(
    page.getByRole('heading', { name: 'Why relevant', exact: true }).first(),
  ).toBeVisible();
  await go('/morning-review');
  await expect(
    page.getByText('MAJOR UPDATE', { exact: true }).first(),
  ).toBeVisible();
  await page.screenshot({
    path: '.local/stage2-review.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  await page
    .getByRole('button', { name: 'Accept revision', exact: true })
    .first()
    .click();
  await expect(
    page.getByText('Decision: accepted', { exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Keep original', exact: true })
    .nth(1)
    .click();
  await page.reload();
  await expect(
    page.getByText('Decision: accepted', { exact: true }).first(),
  ).toBeVisible();
  await go('/trends');
  await expect(
    page.getByRole('button', { name: 'Draft X post', exact: true }).first(),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Save for later', exact: true })
    .first()
    .click();
  await page.getByLabel('Opportunity status').selectOption('saved');
  await expect(
    page.getByRole('button', { name: 'Draft X post', exact: true }).first(),
  ).toBeVisible();
  await go('/assistant');
  await page
    .getByLabel('Message', { exact: true })
    .fill('Create idea: Tool saved idea');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Approve action', exact: true }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Approve action', exact: true })
    .click();
  await expect(page.getByText(/Completed createIdea/)).toBeVisible();
  await page.reload();
  await page
    .getByLabel('Conversations')
    .selectOption({ label: 'Create idea: Tool saved idea' });
  await expect(page.getByText(/Completed createIdea/)).toBeVisible();
  await page.getByLabel('Upload voice note').setInputFiles({
    name: 'voice.wav',
    mimeType: 'audio/wav',
    buffer: Buffer.from('RIFF0000WAVEfmt '),
  });
  await page
    .getByRole('button', { name: 'Transcribe audio', exact: true })
    .click();
  await expect(page.getByLabel('Editable transcript')).toBeVisible();
  await page
    .getByLabel('Editable transcript')
    .fill('We learned to test the simplest founder hypothesis first.');
  await page
    .getByRole('button', { name: 'Find content ideas', exact: true })
    .click();
  await expect(page.locator('.idea-choice').first()).toBeVisible();
  await page.locator('.idea-choice input').first().check();
  await page
    .getByRole('button', { name: 'Save selected ideas', exact: true })
    .first()
    .click();
  await page.screenshot({
    path: '.local/stage2-assistant.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  await go('/settings');
  await page.getByLabel('Tone', { exact: true }).fill('Direct and practical');
  await page.getByLabel('Preferred hook style').fill('A concrete question');
  await page
    .getByRole('button', { name: 'Save writing profile', exact: true })
    .click();
  await page.reload();
  await expect(page.getByLabel('Preferred hook style')).toHaveValue(
    'A concrete question',
  );
  await page.getByLabel('New topic', { exact: true }).fill('Browser topic');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(
    page.getByLabel('Topic Browser topic', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('Search workspace').fill('Tool saved idea');
  await page.getByLabel('Search workspace').press('Enter');
  await expect(
    page.getByRole('link', { name: 'Tool saved idea' }),
  ).toBeVisible();
  await go('/');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForFunction(
    () =>
      getComputedStyle(document.querySelector('.sidebar')!).transform ===
      'matrix(1, 0, 0, 1, -236, 0)',
  );
  await page.screenshot({
    path: '.local/stage2-mobile.png',
    fullPage: true,
    caret: 'initial',
    animations: 'disabled',
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('link', { name: 'Ideas', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Ideas', exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
