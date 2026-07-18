import { expect, Page, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const openApp = async (page: Page) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /what are we cooking|was kochen wir/i })).toBeVisible();
  const releaseDialog = page.getByRole('dialog');
  await expect(releaseDialog).toBeVisible();
  const dismissButton = releaseDialog.getByRole('button', { name: /got it|verstanden/i });
  for (let attempt = 0; attempt < 3 && await releaseDialog.isVisible(); attempt += 1) {
    await dismissButton.click();
    await releaseDialog.waitFor({ state: 'hidden', timeout: 2_000 }).catch(() => undefined);
  }
  await expect(releaseDialog).toBeHidden();
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
  await page.addInitScript(() => {
    const testWindow = window as Window & {
      __PIPLATE_SYNC_TEST__?: boolean;
      __PIPLATE_BRING_TEST__?: (recipe: unknown, deeplinkUrl: string) => void;
      __PIPLATE_LAST_BRING_IMPORT__?: { recipe: unknown; deeplinkUrl: string };
    };
    testWindow.__PIPLATE_SYNC_TEST__ = true;
    testWindow.__PIPLATE_BRING_TEST__ = (recipe, deeplinkUrl) => {
      testWindow.__PIPLATE_LAST_BRING_IMPORT__ = { recipe, deeplinkUrl };
    };
  });
  await openApp(page);
});

test('changelog stays minimal and readable', async ({ page }) => {
  await page.evaluate(() => localStorage.removeItem('piplate-seen-release'));
  await page.goto('/');

  const changelog = page.getByRole('dialog', { name: 'Changelog' });
  await expect(changelog).toBeVisible();
  await expect(changelog.getByRole('heading', { name: 'Changelog' })).toBeVisible();
  await expect(changelog.locator('[data-changelog-line]')).toHaveCount(1);
  await expect(changelog.getByText(/appears once|erscheint einmal|v1\.3\.0/i)).toHaveCount(0);
  await expect(changelog.getByRole('button', { name: /got it|verstanden/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('generated patch worker keeps activation alive until it finishes', async () => {
  const serviceWorker = await readFile('dist/sw.js', 'utf8');
  expect(serviceWorker).toContain('event.waitUntil(self.skipWaiting());');
});

test('update repair keeps local recipes and returns to PiPlate', async ({ page }) => {
  await page.goto('/repair.html');
  await expect(page.getByRole('heading', { name: 'PiPlate reparieren' })).toBeVisible();
  await expect(page.getByText(/Rezepte, Wochenplan und Anmeldung bleiben/i)).toBeVisible();
  await page.getByRole('button', { name: 'Update jetzt reparieren' }).click();
  await expect(page.getByText('Fertig. PiPlate wird neu geöffnet.')).toBeVisible();
  await page.waitForURL(/\?repaired=\d+$/);
  await expect(page.getByRole('heading', { name: /what are we cooking|was kochen wir/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /gnocci/i })).toBeVisible();
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

test('installation guidance matches the mobile browser', async ({ page }, testInfo) => {
  await openSettings(page);
  const installSettings = page.getByTestId('install-settings');

  if (testInfo.project.name === 'iphone-15') {
    await expect(installSettings.getByText(/Safari/i)).toBeVisible();
    await installSettings.getByRole('button', { name: /iPhone instructions|iPhone-Anleitung/i }).click();

    const guide = page.getByRole('dialog', { name: /Install PiPlate|PiPlate installieren/i });
    await expect(guide).toBeVisible();
    const steps = guide.locator('ol');
    await expect(steps.getByText(/Share|Teilen/i)).toBeVisible();
    await expect(steps.getByText(/Add to Home Screen|Zum Home-Bildschirm hinzufügen/i)).toBeVisible();
    await expect(steps.getByText(/Open as Web App|Als Web-App öffnen/i)).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await guide.getByRole('button', { name: /Got it|Verstanden/i }).click();
    await expect(guide).toBeHidden();
  } else {
    await expect(installSettings.getByRole('button', { name: /iPhone instructions|iPhone-Anleitung/i })).toHaveCount(0);
    await expect(installSettings.getByText(/Galaxy S24/i)).toBeVisible();
  }
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

  await page.getByRole('button', { name: /open in bring|in bring öffnen/i }).click();
  await expect(page.getByRole('button', { name: /open in bring|in bring öffnen/i })).toContainText(/bring opened|bring geöffnet/i);
  const bringImport = await page.evaluate(() => (
    window as Window & {
      __PIPLATE_LAST_BRING_IMPORT__?: {
        recipe: { author: string; name: string; items: Array<{ itemId: string; spec?: string }> };
        deeplinkUrl: string;
      };
    }
  ).__PIPLATE_LAST_BRING_IMPORT__);
  expect(bringImport?.recipe.author).toBe('PiPlate');
  expect(bringImport?.recipe.items.length).toBeGreaterThan(0);
  expect(bringImport?.deeplinkUrl).toContain('https://api.getbring.com/rest/bringrecipes/deeplink?');
  expect(bringImport?.deeplinkUrl).toContain('source=web');
  await expectNoHorizontalOverflow(page);

  await page.reload();
  await expect(page.getByRole('heading', { name: /what are we cooking|was kochen wir/i })).toBeVisible();
  await openPlanner(page);

  const reloadedTodaySection = page.locator('[data-planner-day]').first();
  await expect(reloadedTodaySection).toHaveAttribute('data-planner-day', today);
  await expect(reloadedTodaySection.getByRole('heading', { name: /gnocci/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('account and household sync setup works on mobile', async ({ page }) => {
  await openSettings(page);
  const syncSettings = page.getByTestId('sync-settings');
  await expect(syncSettings.getByRole('heading', { name: /shared household|gemeinsamer haushalt/i })).toBeVisible();

  await syncSettings.getByRole('button', { name: /create an account|konto erstellen/i }).click();
  await syncSettings.getByLabel(/email|e-mail/i).fill('mobile-test@example.com');
  await syncSettings.getByLabel(/password|passwort/i).fill('safe-test-password');
  await syncSettings.getByRole('button', { name: /^create account$|^konto erstellen$/i }).click();

  await expect(syncSettings.getByText(/signed in as|angemeldet als/i)).toBeVisible();
  await syncSettings.getByRole('button', { name: /create a household|haushalt erstellen/i }).click();
  await expect(syncSettings.getByRole('group', { name: /connect local data|lokale daten verbinden/i })).toBeVisible();
  await syncSettings.getByRole('button', { name: /confirm and connect|bestätigen und verbinden/i }).click();

  await expect(syncSettings.getByText('TESTHOUSEHOLD2')).toBeVisible();
  await expect(syncSettings.getByText(/everything is up to date|alles ist aktuell/i)).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('upgrading a version 1 database preserves existing recipes', async ({ page }) => {
  const legacyTitle = 'My irreplaceable legacy recipe';
  await page.route('**/legacy-seed', route => route.fulfill({
    contentType: 'text/html',
    body: '<!doctype html><title>Legacy PiPlate seed</title>',
  }));
  await page.goto('/legacy-seed');
  await page.evaluate(async title => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase('PiPlateDB');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error('Legacy database reset was blocked'));
    });
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('PiPlateDB', 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore('recipes', { keyPath: 'id' }).createIndex('title', 'title');
        request.result.createObjectStore('settings', { keyPath: 'key' });
      };
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction(['recipes', 'settings'], 'readwrite');
        transaction.objectStore('recipes').put({
          id: 'legacy-custom',
          title,
          ingredients: ['Do not lose this'],
          instructions: ['Keep it during upgrades'],
          portions: 2,
          nutrition: { calories: 1, protein: 1, carbs: 1, fat: 1 },
          imageUri: '',
          createdAt: 1,
        });
        transaction.objectStore('settings').put({ key: 'initialSeedComplete', value: true });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, legacyTitle);

  await page.goto('/');
  await expect(page.getByRole('heading', { name: legacyTitle })).toBeVisible();
  await expect(page.getByText(/1 (recipe|rezept)/i)).toBeVisible();

  // Version 3 keeps a separate safety snapshot. If the primary recipe store is
  // unexpectedly empty after an update, startup restores the snapshot.
  await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('PiPlateDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('recipes', 'readwrite');
        transaction.objectStore('recipes').clear();
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: legacyTitle })).toBeVisible();
});
