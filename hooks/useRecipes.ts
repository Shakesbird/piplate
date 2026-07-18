import { useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db';
import { DAYS_OF_WEEK, normalizeDayOrder, Recipe, WeeklyPlan } from '../types';

const MOCK_RECIPES: Recipe[] = [
  {
    id: '1',
    title: 'Gnocci Hähnchen Paprika',
    ingredients: ['500g Potato Gnocchi', '300g Beef Tips', '1 Onion', '2 Carrots', '1 can Tomato Sauce', 'Fresh Thyme'],
    instructions: [
      'Sear beef tips in a pot.',
      'Add chopped onions and carrots, sauté until soft.',
      'Pour in tomato sauce and simmer for 20 mins.',
      'Add gnocchi and cook for another 4 mins until tender.'
    ],
    portions: 4,
    nutrition: { calories: 580, protein: 35, carbs: 65, fat: 20 },
    imageUri: './recipe-images/gnocchi-chicken-pepper.png',
    createdAt: Date.now(),
  },
  {
    id: '2',
    title: 'Hotdog',
    ingredients: ['4 Brioche Buns', '4 Premium Sausages', 'Crispy Fried Onions', 'Sliced Pickles', 'Mustard', 'Ketchup'],
    instructions: [
      'Grill or pan-fry sausages until browned.',
      'Lightly toast the buns.',
      'Place sausage in bun and top generously with pickles, sauces, and crispy onions.'
    ],
    portions: 4,
    nutrition: { calories: 450, protein: 18, carbs: 45, fat: 25 },
    imageUri: './recipe-images/hotdog.png',
    createdAt: Date.now(),
  },
  {
    id: '3',
    title: 'Joghurt Reispfanne',
    ingredients: ['1.5 cups Jasmine Rice', '1 Zucchini', '1 Eggplant', '2 Bell Peppers', 'Soy Sauce', 'Chili Paste'],
    instructions: [
      'Cook rice according to package.',
      'Dice all vegetables.',
      'Stir-fry vegetables in a hot wok with oil.',
      'Stir in chili paste and soy sauce, then mix with rice.'
    ],
    portions: 3,
    nutrition: { calories: 380, protein: 10, carbs: 75, fat: 8 },
    imageUri: './recipe-images/yoghurt-rice-skillet.png',
    createdAt: Date.now(),
  },
  {
    id: '4',
    title: 'Kichererbsen Ajvar',
    ingredients: ['400g Ground Beef', '1 can Chickpeas', '100g Feta Cheese', 'Parsley', 'Red Pepper', 'Olive Oil'],
    instructions: [
      'Brown the ground beef with spices (cumin, paprika).',
      'Drain and rinse chickpeas.',
      'Combine beef, chickpeas, diced peppers in a bowl.',
      'Top with crumbled feta and fresh parsley.'
    ],
    portions: 2,
    nutrition: { calories: 520, protein: 40, carbs: 35, fat: 28 },
    imageUri: './recipe-images/chickpea-ajvar.png',
    createdAt: Date.now(),
  },
  {
    id: '5',
    title: 'Mangocurry',
    ingredients: ['300g Firm Tofu', '3 Potatoes', '1 can Coconut Milk', 'Yellow Curry Paste', 'Rice', 'Onion'],
    instructions: [
      'Cube tofu and fry until golden.',
      'Sauté curry paste until fragrant.',
      'Add coconut milk and cubed potatoes, simmer until soft.',
      'Add tofu and serve over rice.'
    ],
    portions: 4,
    nutrition: { calories: 480, protein: 15, carbs: 55, fat: 22 },
    imageUri: './recipe-images/mango-curry.png',
    createdAt: Date.now(),
  },
  {
    id: '6',
    title: 'Müsli',
    ingredients: ['1 cup Rolled Oats', '2 cups Almond Milk', '1 Apple', '1/2 cup Blueberries', 'Honey', 'Cinnamon'],
    instructions: [
      'Simmer oats and milk until creamy.',
      'Dice the apple.',
      'Stir in honey and cinnamon.',
      'Top with fresh apple chunks and blueberries.'
    ],
    portions: 2,
    nutrition: { calories: 320, protein: 8, carbs: 60, fat: 6 },
    imageUri: './recipe-images/muesli.png',
    createdAt: Date.now(),
  },
  {
    id: '7',
    title: 'Nudelauflauf',
    ingredients: ['500g Penne Pasta', '700g Marinara Sauce', '250g Mozzarella Cheese', '100g Parmesan', 'Basil'],
    instructions: [
      'Boil pasta al dente.',
      'Toss with marinara sauce.',
      'Transfer to baking dish and cover with cheeses.',
      'Bake at 200°C (400°F) for 20 mins until bubbly.'
    ],
    portions: 6,
    nutrition: { calories: 650, protein: 25, carbs: 80, fat: 28 },
    imageUri: './recipe-images/pasta-bake.png',
    createdAt: Date.now(),
  },
  {
    id: '8',
    title: 'Pfannenkuchen',
    ingredients: ['2 cups Flour', '2 Eggs', '1.5 cups Buttermilk', '2 tbsp Sugar', '1 tsp Baking Powder', 'Butter'],
    instructions: [
      'Whisk dry ingredients.',
      'Mix wet ingredients and combine gently.',
      'Cook on buttered griddle until golden brown.',
      'Serve warm with syrup.'
    ],
    portions: 4,
    nutrition: { calories: 350, protein: 9, carbs: 50, fat: 12 },
    imageUri: './recipe-images/pancakes.png',
    createdAt: Date.now(),
  },
  {
    id: '9',
    title: 'Udon Nudeln',
    ingredients: ['300g Wheat Noodles', '200g Ground Pork', 'Bok Choy', 'Chili Oil', 'Peanuts', 'Scallions'],
    instructions: [
      'Cook noodles and blanch bok choy.',
      'Stir-fry pork with soy sauce and five-spice.',
      'Prepare sauce with chili oil and sesame paste.',
      'Assemble noodles, sauce, pork and toppings.'
    ],
    portions: 2,
    nutrition: { calories: 580, protein: 28, carbs: 65, fat: 25 },
    imageUri: './recipe-images/udon-noodles.png',
    createdAt: Date.now(),
  },
  {
    id: '10',
    title: 'Wrap',
    ingredients: ['2 Large Tortillas', '1 Grilled Chicken Breast', 'Basil Pesto', 'Fresh Spinach', 'Tomato', 'Mozzarella Ball'],
    instructions: [
      'Slice grilled chicken and mozzarella.',
      'Spread pesto on tortillas.',
      'Layer spinach, chicken, tomato, and cheese.',
      'Roll tightly and slice in half.'
    ],
    portions: 2,
    nutrition: { calories: 420, protein: 32, carbs: 35, fat: 18 },
    imageUri: './recipe-images/wrap.png',
    createdAt: Date.now(),
  }
];

const RECIPE_ARTWORK: Record<string, string> = {
  '1': './recipe-images/gnocchi-chicken-pepper.png',
  '2': './recipe-images/hotdog.png',
  '3': './recipe-images/yoghurt-rice-skillet.png',
  '4': './recipe-images/chickpea-ajvar.png',
  '5': './recipe-images/mango-curry.png',
  '6': './recipe-images/muesli.png',
  '7': './recipe-images/pasta-bake.png',
  '8': './recipe-images/pancakes.png',
  '9': './recipe-images/udon-noodles.png',
  '10': './recipe-images/wrap.png',
};

const RECIPE_TITLES: Record<string, string> = {
  '1': 'Gnocci Hähnchen Paprika',
  '2': 'Hotdog',
  '3': 'Joghurt Reispfanne',
  '4': 'Kichererbsen Ajvar',
  '5': 'Mangocurry',
  '6': 'Müsli',
  '7': 'Nudelauflauf',
  '8': 'Pfannenkuchen',
  '9': 'Udon Nudeln',
  '10': 'Wrap',
};

export const useRecipes = () => {
  const recipes = useLiveQuery(() => db.recipes.toArray()) || [];
  const weeklyPlanData = useLiveQuery(() => db.settings.get('weeklyPlan'));
  const dayOrderData = useLiveQuery(() => db.settings.get('dayOrder'));
  const weeklyPlan: WeeklyPlan = weeklyPlanData?.value || {};
  const dayOrder = normalizeDayOrder(dayOrderData?.value);

  useEffect(() => {
    const initDb = async () => {
      const recipeCount = await db.recipes.count();
      if (recipeCount === 0) {
        // React Strict Mode can run this initializer twice in development.
        // bulkPut keeps the seed operation idempotent instead of raising a BulkError.
        await db.recipes.bulkPut(MOCK_RECIPES);
      }

      // Apply the bundled watercolor artwork once to existing installations.
      // Users can still replace these images afterwards without being overwritten.
      const artworkMigration = await db.settings.get('recipeArtworkV1');
      if (!artworkMigration) {
        const existingRecipes = await db.recipes.bulkGet(Object.keys(RECIPE_ARTWORK));
        const recipesWithArtwork = existingRecipes
          .filter((recipe): recipe is Recipe => Boolean(recipe))
          .map(recipe => ({ ...recipe, imageUri: RECIPE_ARTWORK[recipe.id] }));

        if (recipesWithArtwork.length > 0) {
          await db.recipes.bulkPut(recipesWithArtwork);
        }
        await db.settings.put({ key: 'recipeArtworkV1', value: true });
      }

      // Rename the bundled recipes once so existing installations match the
      // original filenames in the user's Rezeptbilder folder.
      const titleMigration = await db.settings.get('recipeTitlesV1');
      if (!titleMigration) {
        const existingRecipes = await db.recipes.bulkGet(Object.keys(RECIPE_TITLES));
        const recipesWithMatchingTitles = existingRecipes
          .filter((recipe): recipe is Recipe => Boolean(recipe))
          .map(recipe => ({ ...recipe, title: RECIPE_TITLES[recipe.id] }));

        if (recipesWithMatchingTitles.length > 0) {
          await db.recipes.bulkPut(recipesWithMatchingTitles);
        }
        await db.settings.put({ key: 'recipeTitlesV1', value: true });
      }

      const storedDayOrder = await db.settings.get('dayOrder');
      if (!storedDayOrder) {
        await db.settings.put({ key: 'dayOrder', value: DAYS_OF_WEEK });
      }
    };
    initDb();
  }, []);

  const saveRecipe = async (recipe: Recipe) => {
    try {
      await db.recipes.put(recipe);
    } catch (e) {
      console.error('Failed to save recipe:', e);
      alert('Could not save recipe.');
    }
  };

  const setWeeklyPlan = async (plan: WeeklyPlan) => {
    try {
      await db.settings.put({ key: 'weeklyPlan', value: plan });
    } catch (e) {
      console.error('Failed to save weekly plan:', e);
    }
  };

  const updateDayOrder = async (nextDayOrder: string[]) => {
    try {
      await db.settings.put({ key: 'dayOrder', value: normalizeDayOrder(nextDayOrder) });
    } catch (e) {
      console.error('Failed to update day order:', e);
    }
  };

  const deleteRecipe = async (id: string) => {
    try {
      await db.recipes.delete(id);
      const currentPlan = await db.settings.get('weeklyPlan');
      if (currentPlan && currentPlan.value) {
        const plan: WeeklyPlan = currentPlan.value;
        let updated = false;
        Object.keys(plan).forEach(day => {
          if (plan[day].includes(id)) {
            plan[day] = plan[day].filter(rId => rId !== id);
            updated = true;
          }
        });
        if (updated) {
          await setWeeklyPlan(plan);
        }
      }
    } catch (e) {
      console.error('Failed to delete recipe:', e);
    }
  };

  const updateWeeklyPlan = async (day: string, recipeIds: string[]) => {
    try {
      const currentPlanData = await db.settings.get('weeklyPlan');
      const currentPlan: WeeklyPlan = currentPlanData?.value || {};
      const newPlan = { ...currentPlan, [day]: recipeIds };
      await setWeeklyPlan(newPlan);
    } catch (e) {
      console.error('Failed to update plan:', e);
    }
  };

  const moveRecipeBetweenDays = async (fromDay: string, toDay: string, recipeId: string) => {
    try {
      const currentPlanData = await db.settings.get('weeklyPlan');
      const currentPlan: WeeklyPlan = currentPlanData?.value || {};

      if (fromDay === toDay) {
        return;
      }

      const nextPlan: WeeklyPlan = { ...currentPlan };
      nextPlan[fromDay] = (nextPlan[fromDay] || []).filter(id => id !== recipeId);

      const nextTargetRecipes = nextPlan[toDay] || [];
      if (!nextTargetRecipes.includes(recipeId)) {
        nextPlan[toDay] = [...nextTargetRecipes, recipeId];
      }

      await setWeeklyPlan(nextPlan);
    } catch (e) {
      console.error('Failed to move recipe between days:', e);
    }
  };

  return { recipes, weeklyPlan, dayOrder, saveRecipe, deleteRecipe, updateWeeklyPlan, moveRecipeBetweenDays, updateDayOrder };
};
