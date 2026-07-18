import { expect, Page, test } from '@playwright/test';

const openApp = async (page: Page) => {
  await page.goto('/');
  const releaseDialog = page.getByRole('dialog', { name: /updated|aktualisiert|recipe editor|rezepteditor/i });
  if (await releaseDialog.isVisible()) {
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

test.beforeEach(async ({ page }) => {
  await openApp(page);
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

  await page.getByRole('button', { name: /planner|wochenplan/i }).last().click();
  await expect(page.getByRole('heading', { name: /weekly planner|wochenplan/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole('button', { name: /settings|einstellungen/i }).last().click();
  await expect(page.getByRole('heading', { name: /settings|einstellungen/i })).toBeVisible();
  await expect(page.getByText(/chatgpt|gemini/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});
