import { Recipe, WeeklyPlan } from '../types';

export type BringShareResult = 'shared' | 'copied' | 'cancelled';

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

const escapeHtml = (value: string) => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const createBringRecipeFile = (title: string, ingredients: string[]) => {
  const recipe = {
    '@context': 'https://schema.org',
    '@type': 'Recipe',
    name: title,
    author: { '@type': 'Organization', name: 'PiPlate' },
    recipeYield: '1 weekly shopping list',
    recipeIngredient: ingredients,
  };
  const items = ingredients.map(ingredient => `<li itemprop="recipeIngredient">${escapeHtml(ingredient)}</li>`).join('');

  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><script type="application/ld+json">${JSON.stringify(recipe).replace(/</g, '\\u003c')}</script></head><body itemscope itemtype="https://schema.org/Recipe"><h1 itemprop="name">${escapeHtml(title)}</h1><p>By <span itemprop="author">PiPlate</span></p><ul>${items}</ul></body></html>`;
  return new File([html], 'piplate-weekly-shopping-list.html', { type: 'text/html' });
};

export const sharePlannerIngredients = async (
  title: string,
  ingredients: string[],
): Promise<BringShareResult> => {
  const text = `${title}\n\n${ingredients.map(ingredient => `• ${ingredient}`).join('\n')}`;

  if (navigator.share) {
    const file = createBringRecipeFile(title, ingredients);
    const filePayload: ShareData = { title, text, files: [file] };
    const sharePayload = navigator.canShare?.(filePayload) ? filePayload : { title, text };

    try {
      await navigator.share(sharePayload);
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      console.warn('Bring share sheet failed; falling back to clipboard.', error);
    }
  }

  await navigator.clipboard.writeText(text);
  return 'copied';
};
