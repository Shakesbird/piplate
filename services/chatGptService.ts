import { Language } from '../i18n';

export type ChatGptHandoffResult = 'shared' | 'copied' | 'cancelled';

export const buildChatGptArtworkPrompt = (
  dishName: string,
  ingredients: string[],
  language: Language,
) => {
  const cleanIngredients = ingredients.map(item => item.trim()).filter(Boolean).slice(0, 12);
  const ingredientText = cleanIngredients.length > 0
    ? cleanIngredients.join(', ')
    : language === 'de' ? 'keine Zutaten angegeben' : 'no ingredients provided';

  if (language === 'de') {
    return [
      `Erstelle ein quadratisches Rezeptbild für „${dishName.trim()}“.`,
      `Zutaten als Orientierung: ${ingredientText}.`,
      'Stil: warme, minimalistische Aquarell-Illustration auf hellem Papier, appetitlich angerichtet, weiche natürliche Schatten, keine Schrift, kein Logo, keine Menschen.',
      'Gib nur das fertige Bild aus.',
    ].join('\n');
  }

  return [
    `Create a square recipe image for “${dishName.trim()}”.`,
    `Ingredients for visual reference: ${ingredientText}.`,
    'Style: warm minimalist watercolor illustration on light paper, appetizing plating, soft natural shadows, no text, no logo, no people.',
    'Return only the finished image.',
  ].join('\n');
};

export const handoffArtworkToChatGpt = async (
  dishName: string,
  ingredients: string[],
  language: Language,
): Promise<ChatGptHandoffResult> => {
  const prompt = buildChatGptArtworkPrompt(dishName, ingredients, language);

  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({
        title: language === 'de' ? `Rezeptbild: ${dishName}` : `Recipe artwork: ${dishName}`,
        text: prompt,
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled';
      // Some browsers expose navigator.share but reject text sharing. In that
      // case, fall through to a local clipboard handoff.
    }
  }

  await navigator.clipboard.writeText(prompt);
  window.open('https://chatgpt.com/', '_blank', 'noopener,noreferrer');
  return 'copied';
};
