import { GoogleGenAI, Type } from "@google/genai";
import { Recipe } from "../types";

const getApiKey = () => {
    const viteApiKey = import.meta.env.VITE_GEMINI_API_KEY;
    const processApiKey = typeof process !== 'undefined'
        ? process.env?.GEMINI_API_KEY || process.env?.API_KEY
        : undefined;

    return viteApiKey || processApiKey;
};

const getClient = () => {
    const apiKey = getApiKey();
    if (!apiKey) return null;
    return new GoogleGenAI({ apiKey });
};

export const isAiConfigured = () => Boolean(getApiKey());

const STYLE_REFERENCE_URLS = [
    './recipe-images/gnocchi-chicken-pepper.png',
    './recipe-images/mango-curry.png',
    './recipe-images/wrap.png',
];

const createStyleReference = async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Could not load style reference: ${url}`);

    const sourceBlob = await response.blob();
    const bitmap = await createImageBitmap(sourceBlob);
    const maxEdge = 768;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext('2d');

    if (!context) {
        bitmap.close();
        throw new Error('Could not prepare the style reference');
    }

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
    return {
        inlineData: {
            mimeType: 'image/jpeg',
            data: dataUrl.split(',')[1],
        },
    };
};

export const generateRecipeImage = async (
    dishName: string,
    ingredients: string[] = [],
): Promise<string | null> => {
    const ai = getClient();
    if (!ai) {
        console.error('Gemini API key not found');
        return null;
    }

    try {
        const styleReferences = await Promise.all(STYLE_REFERENCE_URLS.map(createStyleReference));
        const ingredientHint = ingredients.filter(Boolean).slice(0, 10).join(', ');
        const prompt = `Create an original recipe illustration for "${dishName}"${ingredientHint ? ` featuring ${ingredientHint}` : ''}.

Use the three supplied images only as visual style references. Match their hand-painted watercolor-and-fine-ink treatment, softly textured off-white paper background, warm natural colors, gentle highlights, centered plated-food composition, generous white space, and appetizing ingredient detail. Show the complete dish from a slightly elevated three-quarter view in a 4:3 landscape composition. Keep the food large and clearly recognizable.

Do not copy the food from the references. No text, labels, logos, watermark, hands, people, cutlery, table scene, photographic realism, dark background, or decorative border.`;

        const response = await ai.models.generateContent({
            model: 'gemini-3.1-flash-image',
            contents: [{ text: prompt }, ...styleReferences],
            config: {
                responseModalities: ['IMAGE'],
            },
        });

        let generatedImage: { data?: string; mimeType?: string } | undefined;
        for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) generatedImage = part.inlineData;
        }

        if (!generatedImage?.data) return null;
        return `data:${generatedImage.mimeType || 'image/png'};base64,${generatedImage.data}`;
    } catch (error) {
        console.error('Failed to generate recipe image:', error);
        return null;
    }
};

export const generateRecipeDetails = async (dishName: string, language: 'de' | 'en' = 'en'): Promise<Partial<Recipe> | null> => {
    const ai = getClient();
    if (!ai) {
        console.error("API Key not found");
        return null;
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-flash-preview",
            contents: `Generate a detailed recipe for "${dishName}". Write all ingredients and cooking instructions in ${language === 'de' ? 'German' : 'English'}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        ingredients: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of ingredients with quantities"
                        },
                        instructions: {
                            type: Type.ARRAY,
                            items: { type: Type.STRING },
                            description: "List of cooking steps"
                        },
                        portions: {
                            type: Type.NUMBER,
                            description: "Number of servings this recipe makes"
                        },
                        nutrition: {
                            type: Type.OBJECT,
                            properties: {
                                calories: { type: Type.NUMBER },
                                protein: { type: Type.NUMBER },
                                carbs: { type: Type.NUMBER },
                                fat: { type: Type.NUMBER }
                            },
                            required: ["calories", "protein", "carbs", "fat"]
                        }
                    },
                    required: ["ingredients", "instructions", "portions", "nutrition"]
                }
            }
        });

        const text = response.text;
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        console.error("Failed to generate recipe:", error);
        return null;
    }
};

export const generateShoppingList = async (ingredients: string[]): Promise<string | null> => {
   const ai = getClient();
   if (!ai) return null;

   try {
       const response = await ai.models.generateContent({
           model: "gemini-3-flash-preview",
           contents: `Group these ingredients into categories (Produce, Dairy, Meat, etc) for a shopping list app called 'Bring'. Format as a simple text list. Ingredients: ${ingredients.join(', ')}`
       });
       return response.text || null;
   } catch (e) {
       console.error(e);
       return null;
   }
};
