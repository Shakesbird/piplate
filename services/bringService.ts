import { DatabaseReference, ref, remove, set } from 'firebase/database';
import { firebaseAuth, firebaseDatabase, firebaseDatabaseUrl, isBringConfigured } from '../firebase';
import { Recipe, WeeklyPlan } from '../types';

export interface BringItem {
  itemId: string;
  spec?: string;
}

export interface BringRecipePayload {
  author: string;
  linkOutUrl: string;
  name: string;
  tagline: string;
  yield: string;
  time: string;
  items: BringItem[];
}

declare global {
  interface Window {
    __PIPLATE_BRING_BASE_URL__?: string;
    __PIPLATE_BRING_TEST__?: (recipe: BringRecipePayload, deeplinkUrl: string) => void | Promise<void>;
  }
}

const IMPORT_LIFETIME_MS = 9 * 60 * 1000;
const IMPORT_CLEANUP_MS = 10 * 60 * 1000;
const LAST_IMPORT_KEY = 'piplate-bring-import-path';

const normalizeIngredient = (ingredient: string) => ingredient.trim().replace(/\s+/g, ' ');

export const collectPlannerIngredients = (
  recipes: Recipe[],
  plan: WeeklyPlan,
  dayOrder: string[],
) => {
  const recipesById = new Map(recipes.map(recipe => [recipe.id, recipe]));
  const occurrences = dayOrder.flatMap(day => plan[day] || []);
  const counts = new Map<string, { ingredient: string; count: number }>();

  occurrences.forEach(recipeId => {
    recipesById.get(recipeId)?.ingredients.forEach(rawIngredient => {
      const ingredient = normalizeIngredient(rawIngredient);
      if (!ingredient) return;
      const key = ingredient.toLocaleLowerCase();
      const current = counts.get(key);
      counts.set(key, {
        ingredient: current?.ingredient || ingredient,
        count: (current?.count || 0) + 1,
      });
    });
  });

  return Array.from(counts.values()).map(({ ingredient, count }) =>
    count > 1 ? `${count} × ${ingredient}` : ingredient,
  );
};

const QUANTITY_PATTERN = /^(?:(\d+)\s*[×x]\s+)?((?:\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|\d+\s+\d+\/\d+|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞])\s*(?:(?:mg|kg|g|ml|cl|dl|l|el|tl|stück|stk\.?|dose[n]?|packung(?:en)?|päckchen|bund|prise[n]?|tasse[n]?|cups?|tbsp|tsp|oz|lbs?)\b)?)(?:\s+)(.+)$/i;

export const toBringItem = (rawIngredient: string): BringItem => {
  const ingredient = normalizeIngredient(rawIngredient);
  const match = ingredient.match(QUANTITY_PATTERN);
  if (!match) return { itemId: ingredient };

  const [, multiplier, quantity, itemId] = match;
  return {
    itemId,
    spec: multiplier ? `${multiplier} × ${quantity}` : quantity,
  };
};

export const createBringRecipePayload = (
  title: string,
  ingredients: string[],
  linkOutUrl: string,
): BringRecipePayload => ({
  author: 'PiPlate',
  linkOutUrl,
  name: title,
  tagline: '',
  yield: '',
  time: '',
  items: ingredients.map(toBringItem),
});

export const buildBringDeeplinkUrl = (publicRecipeUrl: string) => {
  const params = new URLSearchParams({
    url: publicRecipeUrl,
    source: 'web',
    baseQuantity: '1',
    requestedQuantity: '1',
  });
  return `https://api.getbring.com/rest/bringrecipes/deeplink?${params.toString()}`;
};

const scheduleRemoval = (importReference: DatabaseReference, importPath: string) => {
  window.setTimeout(() => {
    void remove(importReference)
      .then(() => {
        if (localStorage.getItem(LAST_IMPORT_KEY) === importPath) {
          localStorage.removeItem(LAST_IMPORT_KEY);
        }
      })
      .catch(() => undefined);
  }, IMPORT_CLEANUP_MS);
};

export const preparePlannerIngredientsForBring = async (
  title: string,
  ingredients: string[],
): Promise<string> => {
  const baseUrl = import.meta.env.DEV && window.__PIPLATE_BRING_BASE_URL__
    ? window.__PIPLATE_BRING_BASE_URL__
    : import.meta.env.BASE_URL;
  const linkOutUrl = new URL(baseUrl, window.location.href).toString();
  const recipe = createBringRecipePayload(title, ingredients, linkOutUrl);

  if (import.meta.env.DEV && window.__PIPLATE_BRING_TEST__) {
    const testRecipeUrl = 'https://piplate.example/bring-test.json';
    const testDeeplinkUrl = buildBringDeeplinkUrl(testRecipeUrl);
    await window.__PIPLATE_BRING_TEST__(recipe, testDeeplinkUrl);
    return testDeeplinkUrl;
  }

  if (!isBringConfigured || !firebaseDatabase || !firebaseDatabaseUrl) {
    throw new Error('bring/not-configured');
  }

  await firebaseAuth?.authStateReady();
  const user = firebaseAuth?.currentUser;
  if (!user) throw new Error('bring/sign-in-required');

  const previousPath = localStorage.getItem(LAST_IMPORT_KEY);
  const importId = crypto.randomUUID();
  const importPath = `bringImports/${importId}`;
  const importReference = ref(firebaseDatabase, importPath);
  await set(importReference, {
    ownerId: user.uid,
    expiresAt: Date.now() + IMPORT_LIFETIME_MS,
    recipe,
  });

  localStorage.setItem(LAST_IMPORT_KEY, importPath);
  scheduleRemoval(importReference, importPath);
  if (previousPath?.startsWith('bringImports/') && previousPath !== importPath) {
    void remove(ref(firebaseDatabase, previousPath)).catch(() => undefined);
  }

  const publicRecipeUrl = `${firebaseDatabaseUrl}/${importPath}/recipe.json`;
  return buildBringDeeplinkUrl(publicRecipeUrl);
};
