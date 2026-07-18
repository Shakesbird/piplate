import { expect, Page, test } from '@playwright/test';

const openApp = async (page: Page) => {
  await page.goto('/');
  const releaseDialog = page.getByRole('dialog');
  if (await releaseDialog.count() === 1 && await releaseDialog.isVisible()) {
    await releaseDialog.getByRole('button', { name: /got it|verstanden/i }).click();
  }
  await expect(page.getByRole('heading', { name: /what are we cooking|was kochen wir/i })).toBeVisible();
};

const expectNoHorizontalOverflow = async (page: Page) => {
  const overflow = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
    offenders: [...document.querySelectorAll<HTMLElement>('body *')]
      .filter(element => {
        const rect = element.getBoundingClientRect();
        return rect.right > window.innerWidth + 1 || rect.left < -1;
      })
      .slice(0, 8)
      .map(element => ({
        element: element.tagName.toLowerCase(),
        className: element.className,
        left: Math.round(element.getBoundingClientRect().left),
        right: Math.round(element.getBoundingClientRect().right),
      })),
  }));
  expect(overflow.documentWidth - overflow.viewportWidth, JSON.stringify(overflow, null, 2)).toBeLessThanOrEqual(1);
};

const mobileNavigation = (page: Page) => page.getByRole('navigation', { name: /mobile navigation/i });

const openPlanner = async (page: Page) => {
  const navigation = mobileNavigation(page);
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: /planner|wochenplan/i }).click();
  await expect(page.getByRole('heading', { name: /weekly planner|wochenplan/i })).toBeVisible();
};

const openSettings = async (page: Page) => {
  const navigation = mobileNavigation(page);
  await expect(navigation).toBeVisible();
  await navigation.getByRole('button', { name: /settings|einstellungen/i }).click();
  await expect(page.getByRole('heading', { name: /settings|einstellungen/i })).toBeVisible();
};

test.beforeEach(async ({ page }) => {
  await openApp(page);
});

test('changelog stays minimal and readable', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('piplate-seen-release'));
  await page.reload();

  const changelog = page.getByRole('dialog', { name: 'Changelog' });
  await expect(changelog).toBeVisible();
  await expect(changelog.getByRole('heading', { name: 'Changelog' })).toBeVisible();
  await expect(changelog.locator('[data-changelog-line]')).toHaveCount(2);
  await expect(changelog.getByText(/appears once|erscheint einmal|v1\.2\.4/i)).toHaveCount(0);
  await expect(changelog.getByRole('button', { name: /got it|verstanden/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('recipe editor contains no unfinished AI controls', async ({ page }) => {
  await expect(page.getByText(/10 (recipes|rezepte)/i)).toBeVisible();
  await page.getByRole('button', { name: /gnocci.*(open|öffnen)/i }).click();

  const recipeDialog = page.getByRole('dialog', { name: /gnocci/i });
  await recipeDialog.getByRole('button', { name: /^(edit recipe|rezept bearbeiten)$/i }).click();
  await expect(recipeDialog.getByRole('button', { name: /^(save|speichern)$/i })).toBeVisible();

  await expect(recipeDialog.getByRole('button', { name: /change picture|bild ändern/i })).toBeVisible();
  await expect(recipeDialog.getByRole('button', { name: /generate|generieren|chatgpt|gemini/i })).toHaveCount(0);
  await expect(recipeDialog.getByRole('button', { name: /fill recipe details with ai|rezeptdetails mit ki/i })).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('gallery, planner, and settings remain usable on mobile', async ({ page }) => {
  await expectNoHorizontalOverflow(page);

  await openPlanner(page);
  await expectNoHorizontalOverflow(page);

  await openSettings(page);
  await expect(page.getByText(/chatgpt|gemini/i)).toHaveCount(0);
  await expect(page.getByText(/week order|reihenfolge der woche/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('planner starts with today and keeps planned meals after reload', async ({ page }) => {
  const today = new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    timeZone: 'Europe/Berlin',
  }).format(new Date());

  await openPlanner(page);
  const plannerDays = page.locator('[data-planner-day]');
  await expect(plannerDays).toHaveCount(7);
  const todaySection = plannerDays.first();
  await expect(todaySection).toHaveAttribute('data-planner-day', today);
  await expect(todaySection.getByText(/today|heute/i)).toBeVisible();

  await todaySection.getByRole('button', { name: /add recipe to|rezept zu.*hinzufügen/i }).click();
  await todaySection.getByRole('button', { name: /gnocci/i }).click();
  await expect(todaySection.getByRole('heading', { name: /gnocci/i })).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: /what are we cooking|was kochen wir/i })).toBeVisible();
  await openPlanner(page);

  const reloadedTodaySection = page.locator('[data-planner-day]').first();
  await expect(reloadedTodaySection).toHaveAttribute('data-planner-day', today);
  await expect(reloadedTodaySection.getByRole('heading', { name: /gnocci/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
