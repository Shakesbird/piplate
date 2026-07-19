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
  const header = page.getByTestId('app-header');
  await expect(header).toBeVisible();
  await header.getByRole('button', { name: /settings|einstellungen/i }).click();
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
  expect(serviceWorker).toContain('const fetchForPrecache = async url =>');
  expect(serviceWorker).toContain('attempt <= 3');
  expect(serviceWorker).toContain('SHOULD_NAVIGATE_CLIENTS = true');
  expect(serviceWorker).toContain("client.navigate(appUrl.toString())");
  expect(serviceWorker).toContain("self.clients.matchAll({ type: 'window', includeUncontrolled: true })");
  expect(serviceWorker).not.toContain('cache.addAll(PRECACHE_URLS)');
  expect(serviceWorker).not.toContain('recipe-images/');
});

test('stuck updates fall back to the safe cache repair', async () => {
  const pwaHook = await readFile('hooks/usePwa.ts', 'utf8');
  expect(pwaHook).toContain('await registration.unregister();');
  expect(pwaHook).toContain("cacheName.startsWith('piplate-')");
  expect(pwaHook).toContain("new URL(import.meta.env.BASE_URL, window.location.href)");
  expect(pwaHook).toContain('await waitForWaitingWorker(activeRegistration)');
  expect(pwaHook).toContain('await reloadWithoutStuckAppCache(activeRegistration)');
  expect(pwaHook).toContain('Promise.race([');
  expect(pwaHook).toContain("window.location.replace(getFreshAppUrl('repaired'));");
  expect(pwaHook).toContain("window.location.replace(getFreshAppUrl('updated'));");
});

test('recipe previews use small, prioritised WebP images', async ({ page }) => {
  await expect.poll(() => page.evaluate(() => {
    const images = [...document.querySelectorAll<HTMLImageElement>('article img')];
    return images.length === 10
      && images.slice(0, 4).every(image => image.complete && image.naturalWidth > 0);
  })).toBe(true);

  const previews = await page.evaluate(() => [...document.querySelectorAll<HTMLImageElement>('article img')].map(image => ({
    src: image.src,
    loading: image.loading,
    decoding: image.decoding,
    fetchPriority: image.fetchPriority,
    loaded: image.complete && image.naturalWidth > 0,
  })));

  expect(previews).toHaveLength(10);
  expect(previews.every(image => image.src.endsWith('.webp'))).toBe(true);
  expect(previews.slice(0, 4).every(image => image.loading === 'eager' && image.fetchPriority === 'high' && image.loaded)).toBe(true);
  expect(previews.slice(4).every(image => image.loading === 'lazy' && image.fetchPriority === 'low' && image.decoding === 'async')).toBe(true);
});

test('recipe statistics sit at the panel bottom and show calories per portion', async ({ page }) => {
  const recipeCard = page.locator('article').filter({ has: page.getByRole('heading', { name: /gnocci/i }) });
  const statistics = recipeCard.locator('.recipe-card-stats');
  await expect(statistics).toContainText(/145 kcal\/portion/i);

  const bottomGap = await recipeCard.evaluate(card => {
    const cardBox = card.getBoundingClientRect();
    const statisticsBox = card.querySelector('.recipe-card-stats')!.getBoundingClientRect();
    return cardBox.bottom - statisticsBox.bottom;
  });
  expect(bottomGap).toBeGreaterThanOrEqual(12);
  expect(bottomGap).toBeLessThanOrEqual(22);
  await expectNoHorizontalOverflow(page);
});

test('recipes can be sorted by name and the choice persists', async ({ page }) => {
  const sortSelect = page.getByLabel(/sort recipes|rezepte sortieren/i);
  await expect(sortSelect).toBeVisible();

  await sortSelect.selectOption('name-asc');
  const ascendingTitles = await page.locator('article h3').allTextContents();
  expect(ascendingTitles).toHaveLength(10);
  expect(ascendingTitles).toEqual([...ascendingTitles].sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base', numeric: true })));

  await sortSelect.selectOption('name-desc');
  const descendingTitles = await page.locator('article h3').allTextContents();
  expect(descendingTitles).toEqual([...ascendingTitles].reverse());
  await expect.poll(() => page.evaluate(() => localStorage.getItem('piplate-recipe-sort'))).toBe('name-desc');

  await page.reload();
  await expect(page.getByLabel(/sort recipes|rezepte sortieren/i)).toHaveValue('name-desc');
  await expect(page.locator('article h3').first()).toHaveText(descendingTitles[0]);
  await expectNoHorizontalOverflow(page);
});

test('the complete recipe name remains visible in the first card', async ({ page }) => {
  const longTitle = 'A beautifully layered roasted vegetable lasagne for the entire family';
  await page.evaluate(async title => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('PiPlateDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('recipes', 'readwrite');
        transaction.objectStore('recipes').put({
          id: 'long-title-first-card',
          title,
          ingredients: ['Vegetables'],
          instructions: ['Layer and bake'],
          portions: 4,
          nutrition: { calories: 480, protein: 18, carbs: 62, fat: 16 },
          imageUri: './recipe-images/gnocchi-chicken-pepper.webp',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, longTitle);

  await page.reload();
  await page.getByLabel(/sort recipes|rezepte sortieren/i).selectOption('newest');
  const firstTitle = page.locator('article h3').first();
  await expect(firstTitle).toHaveText(longTitle);
  const titleLayout = await firstTitle.evaluate(element => {
    const titleBox = element.getBoundingClientRect();
    const cardBox = element.closest('article')!.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      lineClamp: style.getPropertyValue('-webkit-line-clamp'),
      fullyRendered: element.scrollHeight <= element.clientHeight + 1,
      insideCard: titleBox.top >= cardBox.top && titleBox.bottom <= cardBox.bottom,
    };
  });
  expect(titleLayout.lineClamp).toBe('none');
  expect(titleLayout.fullyRendered).toBe(true);
  expect(titleLayout.insideCard).toBe(true);
  await expectNoHorizontalOverflow(page);
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
  const header = page.getByTestId('app-header');
  const navigation = mobileNavigation(page);
  await expect(header.locator('img')).toHaveAttribute('src', './icons/piplate-192.png');
  await expect(header.getByRole('button', { name: /add recipe|rezept hinzufügen/i })).toHaveCount(0);
  await expect(page.getByText(/Your recipe collection|Deine Rezeptsammlung/i)).toHaveCount(0);
  await expect(page.locator('.filter-chip')).toHaveCount(0);
  await expect(navigation.getByRole('button', { name: /settings|einstellungen/i })).toHaveCount(0);
  const recipeTab = navigation.getByRole('button', { name: /recipes|rezepte/i });
  const plannerTab = navigation.getByRole('button', { name: /planner|wochenplan/i });
  const addButton = navigation.getByRole('button', { name: /add recipe|rezept hinzuf/i });
  const navigationAlignment = await (async () => {
    const navigationBox = await navigation.boundingBox();
    const recipeBox = await recipeTab.boundingBox();
    const recipeIconBox = await recipeTab.locator('svg').boundingBox();
    const plannerBox = await plannerTab.boundingBox();
    const addBox = await addButton.boundingBox();
    if (!navigationBox || !recipeBox || !recipeIconBox || !plannerBox || !addBox) throw new Error('Mobile navigation geometry is unavailable');
    const navigationStyle = await navigation.evaluate(element => {
      const style = getComputedStyle(element);
      return {
        border: Number.parseFloat(style.borderLeftWidth),
        padding: Number.parseFloat(style.paddingLeft),
      };
    });
    const center = (box: { x: number; width: number }) => box.x + box.width / 2;
    const expectedColumnGap = (navigationBox.width - 2 * (navigationStyle.border + navigationStyle.padding)) / 3;
    return {
      addToNavigation: Math.abs(center(addBox) - center(navigationBox)),
      tabSymmetry: Math.abs((center(addBox) - center(recipeBox)) - (center(plannerBox) - center(addBox))),
      iconToHighlight: Math.abs(center(recipeIconBox) - center(recipeBox)),
      equalColumnGap: Math.abs((center(addBox) - center(recipeBox)) - expectedColumnGap),
    };
  })();
  expect(navigationAlignment.addToNavigation).toBeLessThan(1.5);
  expect(navigationAlignment.tabSymmetry).toBeLessThan(1.5);
  expect(navigationAlignment.iconToHighlight).toBeLessThan(1.5);
  expect(navigationAlignment.equalColumnGap).toBeLessThan(1.5);
  await expectNoHorizontalOverflow(page);

  await openPlanner(page);
  const plannerHeader = page.getByTestId('planner-header');
  const bringButton = plannerHeader.getByRole('button', { name: /open in Bring|in Bring/i });
  await expect.poll(async () => {
    const plannerHeadingBox = await plannerHeader.getByRole('heading', { name: /weekly planner|wochenplan/i }).boundingBox();
    const bringButtonBox = await bringButton.boundingBox();
    if (!plannerHeadingBox || !bringButtonBox) return Number.POSITIVE_INFINITY;
    return Math.abs((plannerHeadingBox.y + plannerHeadingBox.height / 2) - (bringButtonBox.y + bringButtonBox.height / 2));
  }).toBeLessThan(14);
  await expect.poll(async () => (await bringButton.boundingBox())?.width ?? Number.POSITIVE_INFINITY).toBeLessThan(100);
  await expect(page.getByText(/Seven days, one view|Sieben Tage auf einen Blick/i)).toHaveCount(0);
  await expect(page.getByText(/Tap \+ to plan|Tippe auf \+/i)).toHaveCount(0);
  await expect(page.getByText(/Bring handles your login|Die Anmeldung übernimmt Bring/i)).toHaveCount(0);
  await expect(header.getByRole('button', { name: /settings|einstellungen/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await openSettings(page);
  await expect(page.getByText(/chatgpt|gemini/i)).toHaveCount(0);
  await expect(page.getByText(/week order|reihenfolge der woche/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('installed mode hides installation controls and keeps patch details compact', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'standalone', { configurable: true, value: true });
  });
  await page.reload();
  await expect(page.getByRole('heading', { name: /what are we cooking|was kochen wir/i })).toBeVisible();
  await openSettings(page);

  await expect(page.getByTestId('install-settings')).toHaveCount(0);
  const patchSection = page.getByTestId('current-patch');
  await expect(patchSection).toBeVisible();
  expect((await patchSection.boundingBox())!.height).toBeLessThan(80);
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

  const bringLink = page.getByRole('link', { name: /open in bring|in bring öffnen/i });
  await expect(bringLink).toHaveAttribute('href', /api\.getbring\.com\/rest\/bringrecipes\/deeplink\?/);
  await bringLink.click();
  await expect(bringLink).toHaveAttribute('data-bring-status', 'opened');
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

test('planner shows complete recipe names without meal quantities', async ({ page }) => {
  const longTitle = 'A colourful vegetable casserole for everyone around the family table';
  await page.evaluate(async title => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open('PiPlateDB');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const database = request.result;
        const transaction = database.transaction('recipes', 'readwrite');
        transaction.objectStore('recipes').put({
          id: 'long-planner-title',
          title,
          ingredients: ['Vegetables'],
          instructions: ['Bake'],
          portions: 4,
          nutrition: { calories: 1200, protein: 40, carbs: 140, fat: 48 },
          imageUri: './recipe-images/pasta-bake.webp',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        transaction.oncomplete = () => { database.close(); resolve(); };
        transaction.onerror = () => reject(transaction.error);
      };
    });
  }, longTitle);
  await page.reload();
  await openPlanner(page);

  const todaySection = page.locator('[data-planner-day]').first();
  await todaySection.getByRole('button', { name: /add recipe to|rezept zu.*hinzuf/i }).click();
  await todaySection.getByRole('button', { name: longTitle }).click();

  const plannerTitle = todaySection.getByRole('heading', { name: longTitle });
  await expect(plannerTitle).toBeVisible();
  const titleLayout = await plannerTitle.evaluate(element => {
    const titleBox = element.getBoundingClientRect();
    const cardBox = element.parentElement!.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      lineClamp: style.getPropertyValue('-webkit-line-clamp'),
      fullyRendered: element.scrollHeight <= element.clientHeight + 1,
      insideCard: titleBox.top >= cardBox.top && titleBox.bottom <= cardBox.bottom,
    };
  });
  expect(titleLayout.lineClamp).toBe('none');
  expect(titleLayout.fullyRendered).toBe(true);
  expect(titleLayout.insideCard).toBe(true);
  await expect(page.getByText(/meals planned|mahlzeiten geplant|1 meal|1 mahlzeit/i)).toHaveCount(0);
  await expectNoHorizontalOverflow(page);
});

test('Bring preparation can be retried after a temporary Android or iPhone failure', async ({ page }) => {
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __PIPLATE_BRING_TEST__?: (recipe: unknown, deeplinkUrl: string) => void;
    };
    testWindow.__PIPLATE_BRING_TEST__ = () => {
      throw new Error('temporary Bring preparation failure');
    };
  });

  await openPlanner(page);
  const todaySection = page.locator('[data-planner-day]').first();
  await todaySection.getByRole('button', { name: /add recipe|rezept zu/i }).click();
  await todaySection.getByRole('button', { name: /gnocci/i }).click();

  await expect(page.getByRole('alert')).toBeVisible();
  const retryButton = page.getByRole('button', { name: /open in Bring|in Bring/i });
  await expect(retryButton).toBeEnabled();
  await expect(retryButton).toHaveAttribute('data-bring-status', 'error');
  await expect(retryButton).toHaveText('Bring');

  await page.evaluate(() => {
    const testWindow = window as Window & {
      __PIPLATE_BRING_TEST__?: (recipe: unknown, deeplinkUrl: string) => void;
      __PIPLATE_LAST_BRING_IMPORT__?: { recipe: unknown; deeplinkUrl: string };
    };
    testWindow.__PIPLATE_BRING_TEST__ = (recipe, deeplinkUrl) => {
      testWindow.__PIPLATE_LAST_BRING_IMPORT__ = { recipe, deeplinkUrl };
    };
  });

  await retryButton.click();
  await expect(page.getByRole('link', { name: /open in Bring|in Bring/i })).toHaveAttribute(
    'href',
    /api\.getbring\.com\/rest\/bringrecipes\/deeplink\?/,
  );
});

test('returning from Bring keeps the prepared export usable', async ({ page }) => {
  await page.evaluate(() => {
    const testWindow = window as Window & {
      __PIPLATE_BRING_PREPARATIONS__?: number;
      __PIPLATE_BRING_TEST__?: () => void;
    };
    testWindow.__PIPLATE_BRING_PREPARATIONS__ = 0;
    testWindow.__PIPLATE_BRING_TEST__ = () => {
      testWindow.__PIPLATE_BRING_PREPARATIONS__ = (testWindow.__PIPLATE_BRING_PREPARATIONS__ || 0) + 1;
      if (testWindow.__PIPLATE_BRING_PREPARATIONS__ > 1) {
        throw new Error('unexpected duplicate Bring preparation');
      }
    };
  });

  await openPlanner(page);
  const todaySection = page.locator('[data-planner-day]').first();
  await todaySection.getByRole('button', { name: /add recipe|rezept zu/i }).click();
  await todaySection.getByRole('button', { name: /gnocci/i }).click();

  const bringLink = page.getByRole('link', { name: /open in Bring|in Bring/i });
  await expect(bringLink).toHaveAttribute('href', /api\.getbring\.com\/rest\/bringrecipes\/deeplink\?/);
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));

  await expect(bringLink).toHaveAttribute('href', /api\.getbring\.com\/rest\/bringrecipes\/deeplink\?/);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => (
    window as Window & { __PIPLATE_BRING_PREPARATIONS__?: number }
  ).__PIPLATE_BRING_PREPARATIONS__)).toBe(1);
});

test('Bring returns to the deployed GitHub Pages app path', async ({ page }) => {
  await page.evaluate(() => {
    (window as Window & { __PIPLATE_BRING_BASE_URL__?: string }).__PIPLATE_BRING_BASE_URL__ = './';
    window.history.replaceState({}, '', '/piplate/');
  });

  await openPlanner(page);
  const todaySection = page.locator('[data-planner-day]').first();
  await todaySection.getByRole('button', { name: /add recipe|rezept zu/i }).click();
  await todaySection.getByRole('button', { name: /gnocci/i }).click();

  await expect(page.getByRole('link', { name: /open in Bring|in Bring/i })).toHaveAttribute(
    'href',
    /api\.getbring\.com\/rest\/bringrecipes\/deeplink\?/,
  );
  const linkOutUrl = await page.evaluate(() => (
    window as Window & {
      __PIPLATE_LAST_BRING_IMPORT__?: { recipe: { linkOutUrl: string } };
    }
  ).__PIPLATE_LAST_BRING_IMPORT__?.recipe.linkOutUrl);
  expect(linkOutUrl).toBe('http://127.0.0.1:4173/piplate/');
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
          imageUri: './recipe-images/gnocchi-chicken-pepper.png',
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
  await expect(page.locator('article img')).toHaveAttribute('src', /recipe-images\/gnocchi-chicken-pepper\.webp/);

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
